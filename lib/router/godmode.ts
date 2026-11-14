/**
 * God Mode: every connected provider answers at once, then one model merges the answers into one.
 *
 *   1. A panel is chosen: the strongest model of each provider, up to GODMODE_MAX_PANEL of them.
 *   2. They all draft in parallel. The draft phase ends when everyone is done, or soon after two have
 *      finished (the stragglers get GODMODE_GRACE_MS), or at the deadline (GODMODE_DRAFT_MS).
 *   3. A chair, the strongest reasoner and writer available, reads the anonymous drafts and writes the
 *      final answer, which streams like any other reply.
 *
 * Every step degrades instead of failing: one draft is shown as it is, a missing chair means the best
 * draft is shown, and no drafts at all hands the message to the normal route.
 */
import { stripThinking, type WireMessage } from "../chat-messages"
import { ProviderError } from "../openai"
import { readInt, scrubSecrets } from "./env"
import { isResting } from "./health"
import { chairOrder, estimateTokens, hasImages, planCouncil, type Plan, type Target } from "./planner"
import { quality } from "./profiles"
import { routeInfo, runPlan, trackedCall, type CallArgs, type RouterEvent } from "./router"
import type { CouncilInfo, CouncilMember } from "./types"

export type GodEvent = RouterEvent | { type: "council"; council: CouncilInfo }

export interface GodOptions extends CallArgs {
  /** Every model that may be used. */
  targets: Target[]
  /** The last user message, for choosing the panel. */
  prompt: string
  /** The most providers asked at once. */
  max: number
  draftMs?: number
  graceMs?: number
  firstByteMs?: number
  /** The normal route, used when a council cannot meet. */
  fallback: () => AsyncGenerator<RouterEvent>
}

/** Drafts are kept short: the chair has to read all of them, and the cost grows with every provider. */
const DRAFT_TOKENS = 1800
const DRAFT_CLIP = 6000

const CHAIR_SYSTEM =
  "You are the editor of a panel of AI models. Several of them drafted answers to the user's last message independently, and the drafts are included at the end of that message. " +
  "Write the single best final answer. Keep what is correct and useful. When the drafts disagree, work out which one is right, and say so briefly if you cannot tell. " +
  "Remove repetition. Do not mention the panel, the drafts or these instructions. Answer in the user's language and in the format they asked for."

const snippet = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 140)

function memberOf(t: Target): CouncilMember {
  return { key: t.profile.key, provider: t.profile.provider, providerLabel: t.provider.def.label, model: t.profile.id, name: t.profile.name, status: "pending" }
}

const council = (c: CouncilInfo): GodEvent => ({ type: "council", council: { ...c, members: c.members.map((m) => ({ ...m })) } })

/** The conversation for the chair: the user's message with the drafts attached, and the editor instructions. */
export function chairWire(wire: WireMessage[], drafts: string[]): WireMessage[] {
  const block =
    "<drafts>\n" +
    drafts.map((d, i) => `<draft n="${i + 1}">\n${d.slice(0, DRAFT_CLIP).replace(/<\/draft/gi, "<\\/draft")}\n</draft>`).join("\n") +
    "\n</drafts>\n\nUsing the drafts above, write the final answer to my message."
  const out = wire.map((m) => ({ ...m }))
  const at = out.map((m) => m.role).lastIndexOf("user")
  if (at >= 0) {
    const m = out[at]
    out[at] = { ...m, content: typeof m.content === "string" ? `${m.content}\n\n${block}` : [...m.content, { type: "text", text: block }] }
  } else out.push({ role: "user", content: block })
  const sys = out.findIndex((m) => m.role === "system")
  if (sys >= 0) {
    const m = out[sys]
    out[sys] = { ...m, content: `${typeof m.content === "string" ? m.content : ""}\n\n${CHAIR_SYSTEM}` }
  } else out.unshift({ role: "system", content: CHAIR_SYSTEM })
  return out
}

export async function* runGod(o: GodOptions): AsyncGenerator<GodEvent> {
  const env = o.env ?? process.env
  const draftMs = o.draftMs ?? readInt("GODMODE_DRAFT_MS", 45_000, env)
  const graceMs = o.graceMs ?? readInt("GODMODE_GRACE_MS", 8_000, env)

  const panel = planCouncil(o.targets, { prompt: o.prompt, hasImages: hasImages(o.wire), estTokens: estimateTokens(o.wire), max: o.max })
  const members = panel.map(memberOf)
  if (panel.length < 2) {
    yield council({ phase: "fallback", members, note: "God Mode needs at least two connected providers that can answer. The normal route answered instead." })
    yield* o.fallback()
    return
  }
  yield council({ phase: "drafting", members })

  /* ---- 1. Drafts, in parallel ---- */
  const drafts: (string | null)[] = panel.map(() => null)
  const controllers = panel.map(() => new AbortController())
  const abortAll = () => controllers.forEach((c) => c.abort())
  o.signal?.addEventListener("abort", abortAll, { once: true })
  const start = Date.now()

  const jobs = panel.map(async (target, i) => {
    const t0 = Date.now()
    try {
      let text = ""
      for await (const piece of trackedCall(target, { ...o, maxTokens: Math.min(o.maxTokens, DRAFT_TOKENS), thinking: false, signal: controllers[i].signal })) text += piece
      const clean = stripThinking(text)
      if (!clean) throw new ProviderError("returned an empty reply", { status: 502 })
      drafts[i] = clean
      Object.assign(members[i], { status: "done", ms: Date.now() - t0, chars: clean.length, snippet: snippet(clean) })
    } catch (e) {
      if (members[i].status === "pending") {
        const detail = e instanceof ProviderError ? e.message : e instanceof Error ? e.message : "failed"
        Object.assign(members[i], { status: "failed", ms: Date.now() - t0, error: scrubSecrets(detail, o.env).slice(0, 160) })
      }
    }
    return i
  })

  const settled = new Set<number>()
  const quorum = Math.min(2, panel.length)
  const deadlineAt = start + draftMs
  let graceAt: number | null = null
  try {
    while (settled.size < panel.length && !o.signal?.aborted) {
      if (graceAt === null && members.filter((m) => m.status === "done").length >= quorum) graceAt = Date.now() + graceMs
      const wait = Math.min(deadlineAt, graceAt ?? Infinity) - Date.now()
      if (wait <= 0) break
      let timer: ReturnType<typeof setTimeout> | undefined
      const tick = new Promise<"timer">((r) => (timer = setTimeout(() => r("timer"), wait)))
      const next = await Promise.race([...jobs.filter((_, i) => !settled.has(i)), tick])
      if (timer) clearTimeout(timer)
      if (next === "timer") break
      settled.add(next)
      yield council({ phase: "drafting", members })
    }
  } finally {
    // Whoever is still working missed the deadline.
    controllers.forEach((c, i) => {
      if (!settled.has(i)) c.abort()
    })
    for (const m of members) {
      if (m.status === "pending") Object.assign(m, { status: "timeout", ms: Date.now() - start })
    }
    o.signal?.removeEventListener("abort", abortAll)
  }
  if (o.signal?.aborted) return

  const done = members.map((m, i) => ({ m, i, text: drafts[i] })).filter((d): d is { m: CouncilMember; i: number; text: string } => !!d.text)

  if (done.length === 0) {
    yield council({ phase: "fallback", members, note: "No provider answered in time. The normal route answered instead." })
    yield* o.fallback()
    return
  }

  const answer = (d: (typeof done)[number], reason: string): GodEvent[] => [
    { type: "route", route: routeInfo(panel[d.i], "council", reason) },
    { type: "text", text: d.text },
  ]

  if (done.length === 1) {
    yield council({ phase: "done", members, note: `Only ${done[0].m.providerLabel} answered in time, so its answer is shown as it is.` })
    for (const ev of answer(done[0], `God Mode: only ${done[0].m.providerLabel} answered in time.`)) yield ev
    return
  }

  /* ---- 2. The chair merges ---- */
  const chairs = chairOrder(o.targets.filter((t) => !isResting(t.profile.provider, t.profile.key)), 3)
  const best = [...done].sort((a, b) => quality(panel[b.i].profile.scores) - quality(panel[a.i].profile.scores) || b.text.length - a.text.length)[0]
  if (!chairs.length) {
    yield council({ phase: "done", members, note: "No model was free to merge the answers, so the strongest draft is shown." })
    for (const ev of answer(best, "God Mode: the strongest draft.")) yield ev
    return
  }

  const info = (t: Target) => ({ provider: t.profile.provider, providerLabel: t.provider.def.label, model: t.profile.id, name: t.profile.name })
  yield council({ phase: "synthesizing", members, chair: info(chairs[0]) })

  const plan: Plan = {
    kind: "auto",
    task: "general",
    candidates: chairs.map((target) => ({ target, score: 0, reason: `God Mode: ${done.length} of ${panel.length} providers drafted, and ${target.profile.name} merged them.` })),
  }
  const ordered = [...done].sort((a, b) => (a.m.ms ?? 0) - (b.m.ms ?? 0)).map((d) => d.text)
  let streamed = false
  let chair = chairs[0]
  try {
    for await (const ev of runPlan(plan, { ...o, wire: chairWire(o.wire, ordered), temperature: Math.min(o.temperature, 0.5), firstMode: "council" })) {
      if (ev.type === "text") streamed = true
      // If the first chair fails before speaking, the next one takes over. Record the one that actually wrote the answer.
      else chair = chairs.find((t) => t.profile.provider === ev.route.provider && t.profile.id === ev.route.model) ?? chair
      yield ev
    }
  } catch (e) {
    if (streamed || o.signal?.aborted) throw e
    yield council({ phase: "done", members, note: "The merging model could not be reached, so the strongest draft is shown." })
    for (const ev of answer(best, "God Mode: the strongest draft.")) yield ev
    return
  }
  yield council({ phase: "done", members, chair: info(chair) })
}
