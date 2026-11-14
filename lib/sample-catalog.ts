/**
 * What the single-file preview shows in place of a server.
 *
 * Nothing is connected in the preview and nothing is called. Four providers are listed as examples, so the
 * router screens (the provider list, the model menu, the model library, God Mode) have something in them.
 * Every decision made here is made by the real router code: each model's tier and scores come from `classify`,
 * the list is each provider's starter list (what the router offers when a provider cannot list its models),
 * a message is judged by `classifyTask` and a model is picked by `planRoute`, and the God Mode panel and its
 * chair are picked by `planCouncil` and `chairOrder`.
 *
 * What is made up is that anyone was asked. The words of every reply still come from the demo model, so each
 * name this file puts on a reply is marked "(sample)", and the God Mode panel says it is simulated. No draft
 * text and no timing is invented.
 */
import { chairOrder, pickVirtual, planCouncil, planRoute, usableTargets, VIRTUAL_KINDS, type PlanCandidate } from "./router/planner"
import { byStrength, classify } from "./router/profiles"
import { PROVIDERS } from "./router/provider-defs"
import type { ResolvedProvider } from "./router/providers"
import type { CatalogResponse, CouncilInfo, CouncilMember, ModelProfile, ProviderId, ProviderStatus, RouteInfo, RoutePriority, VirtualPick } from "./router/types"
import type { Message } from "./types"

/** The providers listed as connected. Four is enough for God Mode to have a panel and a chair. */
const CONNECTED: readonly ProviderId[] = ["anthropic", "gemini", "groq", "mistral"]
const MARK = " (sample)"
const NOT_REAL = "Simulated in this preview. No provider was called, and the built-in demo model wrote the reply."

let cached: { providers: ResolvedProvider[]; models: ModelProfile[] } | null = null

function world() {
  if (cached) return cached
  const providers: ResolvedProvider[] = PROVIDERS.map((def) => ({
    def,
    apiKey: "",
    baseUrl: def.baseUrl,
    configured: CONNECTED.includes(def.id),
    pinned: [],
    keyEnvName: def.keyEnv[0],
  }))
  const models = providers
    .filter((p) => p.configured)
    .flatMap((p) => p.def.seed.map((id) => classify(p.def.id, { id })))
    .filter((m): m is ModelProfile => m !== null)
    .sort(byStrength)
  return (cached = { providers, models })
}

/** The answer GET /api/models would give if these four providers were connected. */
export function sampleCatalog(disabled: readonly string[] = []): CatalogResponse {
  const { providers, models } = world()
  const statuses: ProviderStatus[] = providers.map((p) => ({
    id: p.def.id,
    label: p.def.label,
    keyEnv: p.keyEnvName,
    configured: p.configured,
    ok: null,
    modelCount: models.filter((m) => m.provider === p.def.id).length,
    docs: p.def.docs,
    sample: p.configured,
  }))

  const targets = usableTargets(models, providers, disabled)
  const virtual: Record<string, VirtualPick | null> = {}
  for (const id of Object.keys(VIRTUAL_KINDS)) {
    let pick: VirtualPick | null
    if (id === "cyphor-god") {
      const chair = chairOrder(targets, 1)[0]
      pick = chair
        ? { provider: chair.profile.provider, providerLabel: chair.provider.def.label, model: chair.profile.id, key: chair.profile.key, name: chair.profile.name, reason: "Merges the drafts of every connected provider." }
        : null
    } else pick = pickVirtual(id, targets, providers)
    virtual[id] = pick && { ...pick, name: pick.name + MARK }
  }

  return {
    mode: "router",
    at: 0,
    providers: statuses,
    models,
    virtual,
    web: { configured: false, keyEnv: "TINYFISH_API_KEY" },
    godReady: new Set(targets.map((t) => t.profile.provider)).size >= 2,
  }
}

function routeOf(c: PlanCandidate, mode: RouteInfo["mode"], task: RouteInfo["task"], reason: string = c.reason): RouteInfo {
  const p = c.target.profile
  const label = c.target.provider.def.label
  return {
    mode,
    provider: p.provider,
    providerLabel: label,
    model: p.id,
    name: p.name + MARK,
    reason: `${reason} This is a sample: nothing was sent to ${label}, and the built-in demo model wrote the reply.`,
    task,
  }
}

export interface SampleTurn {
  /** `cyphor-auto` and the other Cyphor names, or `provider:model`. */
  model: string
  prompt: string
  priority: RoutePriority
  disabled: readonly string[]
  godMax: number
  /** How much faster than normal the demo model is running (the browser tests use this). 1 is normal. */
  speed: number
  signal: AbortSignal
  onMeta: (patch: Partial<Message>) => void
}

/**
 * Shows how this message would be routed: for a normal model, the chip under the reply; for God Mode, the panel
 * filling in. Resolves when the reply may start streaming, with a function to call once it has finished.
 * Rejects with an AbortError if the turn is stopped on the way.
 */
export async function playSampleRouting(t: SampleTurn): Promise<() => void> {
  const { providers, models } = world()
  const targets = usableTargets(models, providers, t.disabled)
  const nothing = () => {}
  // Every provider is switched off: the demo model simply answers.
  if (!targets.length) return nothing

  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (t.signal.aborted) return reject(new DOMException("Aborted", "AbortError"))
      const timer = setTimeout(() => {
        t.signal.removeEventListener("abort", stop)
        resolve()
      }, ms / Math.max(1, t.speed))
      const stop = () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      }
      t.signal.addEventListener("abort", stop, { once: true })
    })

  if (t.model === "cyphor-god") {
    const panel = planCouncil(targets, { prompt: t.prompt, hasImages: false, estTokens: 0, max: t.godMax })
    const members: CouncilMember[] = panel.map((p) => ({
      key: p.profile.key,
      provider: p.profile.provider,
      providerLabel: p.provider.def.label,
      model: p.profile.id,
      name: p.profile.name,
      status: "pending",
    }))

    if (panel.length >= 2) {
      const show = (phase: CouncilInfo["phase"], extra: Partial<CouncilInfo> = {}) => t.onMeta({ council: { phase, members: members.map((m) => ({ ...m })), note: NOT_REAL, ...extra } })
      show("drafting")
      // The quickest models are the first to hand in a draft.
      const order = members.map((_, i) => i).sort((a, b) => panel[b].profile.scores.speed - panel[a].profile.scores.speed || a - b)
      for (const i of order) {
        await wait(520)
        members[i].status = "done"
        show("drafting")
      }

      const chair = chairOrder(targets, 1)[0]
      const named = { provider: chair.profile.provider, providerLabel: chair.provider.def.label, model: chair.profile.id, name: chair.profile.name + MARK }
      show("synthesizing", { chair: named })
      await wait(900)
      t.onMeta({ route: routeOf({ target: chair, reason: "", score: 0 }, "council", undefined, `God Mode: ${panel.length} of ${panel.length} providers drafted, and ${chair.profile.name} merged them.`) })
      return () => show("done", { chair: named })
    }
    // Fewer than two providers can answer, so, as on the server, the normal route answers instead.
    t.onMeta({ council: { phase: "fallback", members, note: "God Mode needs at least two connected providers that can answer. The normal route answered instead." } })
  }

  try {
    const plan = planRoute({ model: t.model === "cyphor-god" ? "cyphor-auto" : t.model, prompt: t.prompt, hasImages: false, estTokens: 0, priority: t.priority, targets, providers, maxCandidates: 1 })
    const first = plan.candidates[0]
    if (first) t.onMeta({ route: routeOf(first, plan.kind === "direct" ? "direct" : "auto", plan.task) })
  } catch {
    // A model that is not on the sample list: the demo model answers without a route chip.
  }
  return nothing
}
