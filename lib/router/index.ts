/**
 * The one import the API routes need. Everything else in this folder is a part of it:
 *
 *   env        reads LLM.env
 *   providers  who the providers are and which variable holds each key
 *   profiles   what a model is good at, worked out from its id
 *   catalog    asks each provider for its models
 *   health     remembers which providers are failing
 *   planner    chooses the model (Auto, Swift, Core, Deep, Code or one you name)
 *   router     calls it and fails over
 *   godmode    asks several providers and merges the answers
 *   web        TinyFish search for grounded answers
 */
import { clearCatalog, getCatalog, type Snapshot } from "./catalog"
import { loadLlmEnv, scrubSecrets, type Env } from "./env"
import { providerRest } from "./health"
import { chairOrder, pickVirtual, usableTargets, VIRTUAL_KINDS, type Target } from "./planner"
import { resolveProviders, WEB_KEY_ENV, type ResolvedProvider } from "./providers"
import { callModel, trackedCall } from "./router"
import type { CatalogResponse, ProviderId, ProviderStatus, VirtualPick } from "./types"
import { webConfigured } from "./web"

export { loadLlmEnv } from "./env"
export { runGod } from "./godmode"
export { classifyTask, estimateTokens, hasImages, planRoute } from "./planner"
export { runPlan } from "./router"
export type { GodEvent } from "./godmode"
export type { RouterEvent } from "./router"
export { searchQuery, webGround, webConfigured, WEB_RULES } from "./web"

export interface RouterContext {
  providers: ResolvedProvider[]
  snapshot: Snapshot
  /** The models that may answer right now. */
  targets: Target[]
  /** At least one provider has a key. When false the built-in demo model answers. */
  configured: boolean
}

/** Reads LLM.env, lists the models (from memory after the first time) and says what can answer. */
export async function prepare(opts: { disabled?: readonly string[]; env?: Env } = {}): Promise<RouterContext> {
  loadLlmEnv()
  const env = opts.env ?? process.env
  const providers = resolveProviders(env)
  const configured = providers.some((p) => p.configured)
  if (!configured) return { providers, snapshot: { at: Date.now(), statuses: [], models: [] }, targets: [], configured: false }

  const snapshot = await getCatalog({ env })
  const disabled = opts.disabled ?? []
  let targets = usableTargets(snapshot.models, providers, disabled)
  // If every model is resting after failures, try them anyway rather than refuse.
  if (!targets.length) targets = usableTargets(snapshot.models, providers, disabled, { ignoreRest: true })
  return { providers, snapshot, targets, configured: true }
}

/** The answer of GET /api/models. */
export async function catalogResponse(opts: { refresh?: boolean; env?: Env; disabled?: readonly string[] } = {}): Promise<CatalogResponse> {
  loadLlmEnv({ force: opts.refresh })
  const env = opts.env ?? process.env
  const providers = resolveProviders(env)
  const configured = providers.some((p) => p.configured)
  const snap = configured ? await getCatalog({ env, refresh: opts.refresh }) : { at: Date.now(), statuses: [], models: [] }

  const listed: ProviderStatus[] = configured ? snap.statuses : resolveProviders(env).map((p): ProviderStatus => ({ id: p.def.id, label: p.def.label, keyEnv: p.keyEnvName, configured: false, ok: null, modelCount: 0, docs: p.def.docs }))
  const statuses = listed.map((s) => {
    const rest = providerRest(s.id)
    const safe = s.error ? { ...s, error: scrubSecrets(s.error, env) } : s
    return rest > 0 ? { ...safe, coolingDown: true, coolingSec: Math.ceil(rest / 1000) } : safe
  })

  // Providers the person switched off in settings do not count, so "Now: …" matches what a message would really use.
  const targets = usableTargets(snap.models, providers, opts.disabled ?? [], { ignoreRest: true })
  const virtual: Record<string, VirtualPick | null> = {}
  for (const id of Object.keys(VIRTUAL_KINDS)) {
    if (id === "cyphor-god") {
      const chair = chairOrder(targets, 1)[0]
      virtual[id] = chair
        ? { provider: chair.profile.provider, providerLabel: chair.provider.def.label, model: chair.profile.id, key: chair.profile.key, name: chair.profile.name, reason: "Merges the drafts of every connected provider." }
        : null
    } else virtual[id] = pickVirtual(id, targets, providers)
  }
  return {
    mode: configured ? "router" : "demo",
    at: snap.at,
    providers: statuses,
    models: snap.models,
    virtual,
    web: { configured: webConfigured(env), keyEnv: WEB_KEY_ENV[0] },
    godReady: new Set(targets.map((t) => t.profile.provider)).size >= 2,
  }
}

export interface TestResult {
  ok: boolean
  model?: string
  latencyMs?: number
  reply?: string
  error?: string
}

/** One tiny request to a provider, to prove that the key and the address work. */
export async function testProvider(id: ProviderId, opts: { env?: Env; fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<TestResult> {
  loadLlmEnv()
  const env = opts.env ?? process.env
  const providers = resolveProviders(env)
  const provider = providers.find((p) => p.def.id === id)
  if (!provider?.configured) return { ok: false, error: `No key is set. Add ${provider?.keyEnvName ?? "the key"} to LLM.env.` }
  if (provider.needs) return { ok: false, error: `Missing ${provider.needs}.` }

  const snap = await getCatalog({ env, refresh: true })
  // The quickest model that does not think first: the cheapest way to get an answer.
  const target = usableTargets(snap.models, providers, [], { ignoreRest: true })
    .filter((t) => t.profile.provider === id)
    .sort((a, b) => Number(a.profile.thinking) - Number(b.profile.thinking) || b.profile.scores.speed - a.profile.scores.speed)[0]
  if (!target) return { ok: false, error: scrubSecrets(snap.statuses.find((s) => s.id === id)?.error ?? "The provider has no models to test.", env) }

  const t0 = Date.now()
  const timeout = AbortSignal.timeout(20_000)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  try {
    let reply = ""
    for await (const piece of trackedCall(target, {
      wire: [{ role: "user", content: "Reply with the single word: ok" }],
      temperature: 0,
      maxTokens: 64,
      thinking: false,
      signal,
      fetchImpl: opts.fetchImpl,
      env,
    })) {
      reply += piece
    }
    return { ok: true, model: target.profile.name, latencyMs: Date.now() - t0, reply: scrubSecrets(reply.replace(/<\/?thinking>/g, "").trim(), env).slice(0, 60) }
  } catch (e) {
    return { ok: false, model: target.profile.name, error: scrubSecrets(e instanceof Error ? e.message : "The test failed.", env) }
  }
}

export { callModel, clearCatalog }
