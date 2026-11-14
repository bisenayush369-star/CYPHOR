/**
 * Decides which model answers. Pure functions over the catalog, so every choice can be tested and explained.
 *
 * The Cyphor models are not real models. Each one is a way of choosing:
 *   Auto  reads the message and picks what suits it (code, reasoning, writing, a quick question)
 *   Swift the fastest model that is still good
 *   Core  the best balance of quality and speed
 *   Deep  the strongest reasoner you have connected
 *   Code  the strongest coder you have connected
 *   God   asks several providers at once and merges the answers (see godmode.ts)
 * A model picked by name ("groq:llama-3.3-70b-versatile") is used as it is.
 */
import type { WireMessage } from "../chat-messages"
import { ProviderError } from "../openai"
import { classify, quality } from "./profiles"
import { isResting } from "./health"
import type { ResolvedProvider } from "./providers"
import type { ModelProfile, ProviderId, RoutePriority, Task, VirtualPick } from "./types"

export type VirtualKind = "auto" | "swift" | "core" | "deep" | "code" | "god"

export const VIRTUAL_KINDS: Readonly<Record<string, VirtualKind>> = {
  "cyphor-auto": "auto",
  "cyphor-swift": "swift",
  "cyphor-core": "core",
  "cyphor-deep": "deep",
  "cyphor-code": "code",
  "cyphor-god": "god",
}

export interface Target {
  profile: ModelProfile
  provider: ResolvedProvider
}

export interface PlanCandidate {
  target: Target
  reason: string
  score: number
}

export interface Plan {
  kind: VirtualKind | "direct"
  task: Task
  candidates: PlanCandidate[]
}

/* ---------------------------------------------------------------- */
/* What is the message about?                                        */
/* ---------------------------------------------------------------- */

const CODE_WORDS =
  /\b(bug|stack ?trace|traceback|exception|compile[rd]?|refactor|regex|sql|endpoint|dockerfile|docker|kubernetes|typescript|javascript|python|rust|golang|kotlin|c\+\+|php|ruby|html|css|tailwind|react|next\.?js|vue|svelte|node\.?js|bash|unit tests?|algorithm|leetcode|function|variable|array|debug|repo|pull request|commit|npm|pip|cargo|api|json|yaml|webpack|vite|component|database|query|schema|frontend|backend)\b/gi
const REASONING =
  /\b(prove|proof|derive|derivation|theorem|step[- ]by[- ]step|solve|calculate|compute|probability|integral|equation|optimi[sz]e|trade-?offs?|pros and cons|analy[sz]e|evaluate|compare|strategy|puzzle|riddle|logic|reasoning|why (?:does|is|do|would|can't|isn't)|think (?:hard|carefully|deeply)|plan (?:a|the|for)|decision)\b/gi
const CREATIVE =
  /\b(write|draft|compose|rewrite|rephrase|polish|proofread|improve|translate|brainstorm)\b[^.?!\n]{0,60}\b(story|poem|essay|email|letter|speech|blog|post|caption|slogan|script|song|lyrics|article|bio|cover letter|description|tweet|thread|copy|paragraph|tone|name|names|ideas?)\b|\b(creative|storytelling|narrative|roleplay|role-play)\b/i

/** Reads the last message and says what kind of help it wants. A guess, and a cheap one. */
export function classifyTask(prompt: string): Task {
  const text = prompt.slice(0, 4000)
  const words = new Set((text.match(CODE_WORDS) ?? []).map((w) => w.toLowerCase()))
  let code = words.size
  if (/```/.test(text)) code += 3
  if (/`[^`\n]{2,}`/.test(text)) code += 1
  if (/=>|\(\)|\bdef \w+\(|\bfunction\b|[{};]\s*\n|^\s*(import|from|const|let|var|class)\s/m.test(text)) code += 2
  if (/\b(write|build|create|make|fix|implement|generate)\b[^.?!\n]{0,40}\b(code|function|script|program|class|component|query|endpoint|app|website|api|bug)\b/i.test(text)) code += 3
  if (code >= 3) return "code"

  const reasoning = (text.match(REASONING) ?? []).length + (/\d+\s*[-+*/^=]\s*\d+/.test(text) ? 2 : 0) + (text.length > 900 && /\?/.test(text) ? 1 : 0)
  if (reasoning >= 2) return "reasoning"
  if (CREATIVE.test(text)) return "creative"
  if (text.trim().length <= 80 && !text.includes("\n") && reasoning === 0) return "quick"
  return "general"
}

const TASK_LABEL: Record<Task, string> = { code: "coding", reasoning: "reasoning", creative: "writing", quick: "quick-answer", general: "general" }

/* ---------------------------------------------------------------- */
/* Scoring                                                           */
/* ---------------------------------------------------------------- */

/** How much each score matters for a kind of task: reasoning, coding, writing, speed. */
const WEIGHTS: Record<Task, [number, number, number, number]> = {
  code: [0.25, 0.6, 0.05, 0.1],
  reasoning: [0.65, 0.15, 0.1, 0.1],
  creative: [0.15, 0, 0.7, 0.15],
  general: [0.3, 0.15, 0.3, 0.25],
  quick: [0.1, 0.05, 0.15, 0.7],
}

function weights(task: Task, priority: RoutePriority): [number, number, number, number] {
  let [r, c, w, s] = WEIGHTS[task]
  if (priority === "speed") s += 0.3
  else if (priority === "quality") s = Math.max(0, s - 0.15)
  const sum = r + c + w + s
  return [r / sum, c / sum, w / sum, s / sum]
}

export function scoreModel(m: ModelProfile, task: Task, priority: RoutePriority = "balanced"): number {
  const [wr, wc, ww, ws] = weights(task, priority)
  let v = wr * m.scores.reasoning + wc * m.scores.coding + ww * m.scores.writing + ws * m.scores.speed
  // Models that think first are slow to start. Worth it for hard problems, not for "hi".
  if (m.thinking) v += task === "reasoning" ? 0.5 : task === "quick" ? -1.2 : task === "general" ? -0.2 : 0
  if (priority === "free" && m.free) v += 2.5
  return Math.round(v * 100) / 100
}

/** Rough size of a conversation in tokens. Used only to skip models whose window is too small. */
export function estimateTokens(wire: WireMessage[]) {
  let chars = 0
  let images = 0
  for (const m of wire) {
    if (typeof m.content === "string") chars += m.content.length
    else
      for (const p of m.content) {
        if (p.type === "text") chars += p.text.length
        else images++
      }
  }
  return Math.ceil(chars / 3.5) + images * 800
}

export function hasImages(wire: WireMessage[]) {
  return wire.some((m) => typeof m.content !== "string" && m.content.some((p) => p.type === "image_url"))
}

/** The models that may be used right now: provider connected, not switched off, not resting after failures. */
export function usableTargets(models: ModelProfile[], providers: ResolvedProvider[], disabled: readonly string[] = [], opts: { ignoreRest?: boolean } = {}): Target[] {
  const byId = new Map(providers.map((p) => [p.def.id, p]))
  const out: Target[] = []
  for (const profile of models) {
    const provider = byId.get(profile.provider)
    if (!provider?.configured || provider.needs || disabled.includes(profile.provider)) continue
    if (!opts.ignoreRest && isResting(profile.provider, profile.key)) continue
    out.push({ profile, provider })
  }
  return out
}

/** The best candidate from each provider first (so a second provider is ready if the first is down), then the rest. */
function diversify<T extends { target: Target }>(sorted: T[], max: number): T[] {
  const out: T[] = []
  const seen = new Set<ProviderId>()
  for (const s of sorted) {
    if (seen.has(s.target.profile.provider)) continue
    seen.add(s.target.profile.provider)
    out.push(s)
    if (out.length >= max) return out
  }
  for (const s of sorted) {
    if (!out.includes(s)) out.push(s)
    if (out.length >= max) break
  }
  return out
}

function reasonFor(kind: VirtualKind, task: Task, m: ModelProfile): string {
  switch (kind) {
    case "auto":
      return `Auto saw a ${TASK_LABEL[task]} message and chose ${m.name}.`
    case "swift":
      return `Swift chose the fastest capable model you have connected (speed ${m.scores.speed}/10).`
    case "core":
      return `Core chose the best balance of quality and speed (${m.name}).`
    case "deep":
      return `Deep chose the strongest reasoner you have connected (reasoning ${m.scores.reasoning}/10).`
    case "code":
      return `Code chose the strongest coder you have connected (coding ${m.scores.coding}/10).`
    default:
      return `${m.name} answered.`
  }
}

export interface PlanInput {
  /** `cyphor-auto`... or `provider:model`. */
  model: string
  prompt: string
  hasImages: boolean
  estTokens: number
  priority: RoutePriority
  targets: Target[]
  /** Every connected provider, used to find a model you named that is not in the list. */
  providers: ResolvedProvider[]
  maxCandidates?: number
}

/** Chooses the models to try, in order. The first is the answer; the rest are only used if it fails. */
export function planRoute(input: PlanInput): Plan {
  const kind = VIRTUAL_KINDS[input.model]

  if (!kind) {
    const i = input.model.indexOf(":")
    const found = input.targets.find((t) => t.profile.key === input.model)
    if (found) return { kind: "direct", task: "general", candidates: [{ target: found, reason: "You chose this model.", score: 0 }] }
    const provider = i > 0 ? input.providers.find((p) => p.def.id === input.model.slice(0, i) && p.configured && !p.needs) : undefined
    if (provider) {
      // A model the provider did not list (a new one, or one you typed) still works.
      const profile = classify(provider.def.id, { id: input.model.slice(i + 1) }, true)
      if (profile) return { kind: "direct", task: "general", candidates: [{ target: { profile, provider }, reason: "You chose this model.", score: 0 }] }
    }
    throw new ProviderError(`The model "${input.model}" is not available. Its provider may be switched off or have no key. Pick another model.`, { status: 404 })
  }

  const effective = kind === "god" ? "core" : kind
  const task: Task = effective === "auto" ? classifyTask(input.prompt) : effective === "swift" ? "quick" : effective === "deep" ? "reasoning" : effective === "code" ? "code" : "general"
  const priority: RoutePriority = effective === "swift" ? "speed" : effective === "deep" || effective === "code" ? "quality" : input.priority

  let pool = input.targets
  if (!pool.length) throw new ProviderError("No connected model can answer right now. Check Settings > Router, or try again in a moment.", { status: 503 })

  const keep = (fn: (t: Target) => boolean) => {
    const next = pool.filter(fn)
    if (next.length) pool = next
  }
  if (input.hasImages) keep((t) => t.profile.vision)
  keep((t) => !t.profile.context || input.estTokens <= t.profile.context * 0.75)
  if (effective === "swift") keep((t) => quality(t.profile.scores) >= 6.4)

  const scored = pool
    .map((target) => ({ target, score: scoreModel(target.profile, task, priority), reason: "" }))
    .sort((a, b) => b.score - a.score || (a.target.profile.key < b.target.profile.key ? -1 : 1))

  const candidates = diversify(scored, input.maxCandidates ?? 4).map((c) => ({ ...c, reason: reasonFor(effective, task, c.target.profile) }))
  return { kind, task, candidates }
}

/** What each Cyphor model would use right now, for the model picker. */
export function pickVirtual(model: string, targets: Target[], providers: ResolvedProvider[], priority: RoutePriority = "balanced"): VirtualPick | null {
  if (!targets.length) return null
  try {
    const plan = planRoute({ model, prompt: "", hasImages: false, estTokens: 0, priority, targets, providers, maxCandidates: 1 })
    const c = plan.candidates[0]
    if (!c) return null
    const p = c.target.profile
    return { provider: p.provider, providerLabel: c.target.provider.def.label, model: p.id, key: p.key, name: p.name, reason: c.reason }
  } catch {
    return null
  }
}

/* ---------------------------------------------------------------- */
/* God Mode                                                          */
/* ---------------------------------------------------------------- */

/** One strong model from each provider, the providers with the strongest models first. */
export function planCouncil(targets: Target[], opts: { prompt: string; hasImages: boolean; estTokens: number; max: number }): Target[] {
  const task = classifyTask(opts.prompt)
  let pool = targets
  const keep = (fn: (t: Target) => boolean) => {
    const next = pool.filter(fn)
    if (next.length) pool = next
  }
  if (opts.hasImages) keep((t) => t.profile.vision)
  keep((t) => !t.profile.context || opts.estTokens <= t.profile.context * 0.75)
  // A panel waits for its slowest member, so the smallest models are left out when there is a choice.
  keep((t) => quality(t.profile.scores) >= 6.4)

  const best = new Map<ProviderId, { target: Target; score: number }>()
  for (const t of pool) {
    const score = scoreModel(t.profile, task === "quick" ? "general" : task, "quality")
    const cur = best.get(t.profile.provider)
    if (!cur || score > cur.score) best.set(t.profile.provider, { target: t, score })
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || (a.target.profile.key < b.target.profile.key ? -1 : 1))
    .slice(0, Math.max(2, opts.max))
    .map((b) => b.target)
}

/** Who merges the drafts: strong at reasoning and writing, and not painfully slow. Best first. */
export function chairOrder(targets: Target[], max = 3): Target[] {
  const score = (m: ModelProfile) => 0.45 * m.scores.reasoning + 0.35 * m.scores.writing + 0.2 * m.scores.speed
  const ranked = targets
    .map((target) => ({ target, score: score(target.profile) }))
    .sort((a, b) => b.score - a.score || (a.target.profile.key < b.target.profile.key ? -1 : 1))
  return diversify(ranked, max).map((r) => r.target)
}
