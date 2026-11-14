/**
 * Asks each connected provider which models it has and turns the answers into profiles.
 * The result is kept for ten minutes (CATALOG_TTL_SEC) and refreshed in the background.
 * A provider that cannot be listed falls back to a short built-in list, so one slow provider never blocks a chat.
 */
import { readEnv, readInt, type Env } from "./env"
import { byStrength, classify, type ListedModel } from "./profiles"
import { providerHeaders, resolveProviders, type ResolvedProvider } from "./providers"
import type { ModelProfile, ProviderId, ProviderStatus } from "./types"
import { ProviderError, explainStatus, readError } from "../openai"
import { isAbort } from "../retry"

export interface Snapshot {
  at: number
  statuses: ProviderStatus[]
  models: ModelProfile[]
}

export interface LoadOptions {
  fetchImpl?: typeof fetch
  env?: Env
  signal?: AbortSignal
  /** How long one provider may take to list its models. */
  timeoutMs?: number
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {})
const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

async function getJson(url: string, headers: Record<string, string>, o: LoadOptions): Promise<unknown> {
  const f = o.fetchImpl ?? fetch
  const timeout = AbortSignal.timeout(o.timeoutMs ?? 8000)
  const signal = o.signal ? AbortSignal.any([o.signal, timeout]) : timeout
  let res: Response
  try {
    res = await f(url, { headers, signal })
  } catch (e) {
    if (o.signal?.aborted) throw e
    throw new ProviderError(isAbort(e) ? "The provider took too long to list its models." : "Could not reach the provider.")
  }
  if (!res.ok) throw new ProviderError(explainStatus(res.status, await readError(res)), { status: res.status })
  try {
    return await res.json()
  } catch {
    throw new ProviderError("The provider sent a model list that could not be read.")
  }
}

/** Turns the many shapes of "list models" answers (OpenAI, OpenRouter, Mistral, Cohere, Cloudflare, Anthropic) into one. */
export function parseModelList(json: unknown): ListedModel[] {
  const root = obj(json)
  const arr: unknown[] = Array.isArray(json) ? json : Array.isArray(root.data) ? root.data : Array.isArray(root.models) ? root.models : Array.isArray(root.result) ? root.result : []
  const out: ListedModel[] = []
  for (const raw of arr) {
    if (typeof raw === "string") {
      out.push({ id: raw })
      continue
    }
    const m = obj(raw)
    const id = String(m.id ?? m.name ?? "").trim()
    if (!id) continue
    if (m.active === false) continue // Groq marks retired models
    const caps = obj(m.capabilities)
    if (caps.completion_chat === false) continue // Mistral lists embedding and moderation models too
    if (Array.isArray(m.endpoints) && m.endpoints.length && !m.endpoints.includes("chat")) continue // Cohere

    const arch = obj(m.architecture)
    const pricing = obj(m.pricing)
    const params = Array.isArray(m.supported_parameters) ? m.supported_parameters : []
    const modalities = Array.isArray(arch.input_modalities) ? arch.input_modalities : []
    const props = Array.isArray(m.properties) ? m.properties.map(obj) : [] // Cloudflare
    const cfContext = num(props.find((p) => p.property_id === "context_window")?.value)

    const display = m.display_name ?? m.displayName ?? (m.id !== undefined && typeof m.name === "string" ? m.name : undefined)
    const listed: ListedModel = { id }
    if (typeof display === "string") listed.name = display
    const ctx = num(m.context_length) ?? num(m.max_context_length) ?? num(m.context_window) ?? num(m.max_input_tokens) ?? num(m.inputTokenLimit) ?? num(m.max_model_len) ?? cfContext
    if (ctx) listed.context = ctx
    if (modalities.length) listed.vision = modalities.includes("image")
    else if (typeof caps.vision === "boolean") listed.vision = caps.vision
    else if (obj(caps.image_input).supported === true) listed.vision = true
    if (params.length) listed.thinking = params.includes("reasoning") || params.includes("include_reasoning")
    else if (obj(caps.thinking).supported === true) listed.thinking = true
    if (id.endsWith(":free") || (pricing.prompt !== undefined && Number(pricing.prompt) === 0 && Number(pricing.completion) === 0)) listed.free = true
    out.push(listed)
  }
  return out
}

/** The Cloudflare account id, from the environment or looked up from the token. */
const accountIds = new Map<string, string>()

export async function resolveBase(p: ResolvedProvider, o: LoadOptions = {}): Promise<string> {
  if (!p.baseUrl.includes("{account}")) return p.baseUrl
  const env = o.env ?? process.env
  let id = readEnv(["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"], env) ?? accountIds.get(p.def.id)
  if (!id) {
    const json = obj(await getJson("https://api.cloudflare.com/client/v4/accounts", providerHeaders(p.def, p.apiKey, env), o).catch(() => null))
    const first = Array.isArray(json.result) ? obj(json.result[0]) : {}
    if (typeof first.id === "string") accountIds.set(p.def.id, (id = first.id))
  }
  if (!id) throw new ProviderError("Cloudflare needs CLOUDFLARE_ACCOUNT_ID. Add it next to the key.")
  return p.baseUrl.replace("{account}", encodeURIComponent(id))
}

async function listModels(p: ResolvedProvider, o: LoadOptions): Promise<ListedModel[]> {
  const env = o.env ?? process.env
  const headers = providerHeaders(p.def, p.apiKey, env)
  const base = await resolveBase(p, o)

  if (p.def.id === "anthropic") {
    const root = base.replace(/\/v1$/, "")
    const out: ListedModel[] = []
    let after = ""
    for (let page = 0; page < 3; page++) {
      const json = obj(await getJson(`${root}/v1/models?limit=100${after ? `&after_id=${encodeURIComponent(after)}` : ""}`, headers, o))
      out.push(...parseModelList(json))
      if (json.has_more === true && typeof json.last_id === "string") after = json.last_id
      else break
    }
    return out
  }
  if (p.def.id === "cohere") {
    // The OpenAI-compatible address has no model list. Cohere's own API does.
    return parseModelList(await getJson("https://api.cohere.com/v1/models?page_size=100&endpoint=chat", headers, o))
  }
  if (p.def.id === "cloudflare") {
    const url = base.replace(/\/ai\/v1$/, "/ai/models/search?task=Text%20Generation&per_page=100")
    return parseModelList(await getJson(url, headers, o))
  }
  return parseModelList(await getJson(`${base}/models`, headers, o))
}

interface Loaded {
  status: ProviderStatus
  models: ModelProfile[]
}

async function loadProvider(p: ResolvedProvider, o: LoadOptions): Promise<Loaded> {
  const { def } = p
  const status: ProviderStatus = {
    id: def.id,
    label: def.label,
    keyEnv: p.keyEnvName,
    configured: p.configured,
    ok: null,
    modelCount: 0,
    docs: def.docs,
    needs: p.needs,
  }
  if (!p.configured) return { status, models: [] }

  const t0 = Date.now()
  let listed: ListedModel[] = []
  let force = false

  if (p.pinned.length) {
    // You named the models. No need to ask the provider, and nothing is filtered out.
    listed = p.pinned.map((id) => ({ id }))
    force = true
    status.ok = true
  } else {
    try {
      listed = await listModels(p, o)
      status.ok = true
      status.latencyMs = Date.now() - t0
    } catch (e) {
      if (o.signal?.aborted) throw e
      status.ok = false
      status.error = e instanceof Error ? e.message : "Could not list models."
      if (def.id === "custom") status.error += " Set LLM_MODEL to the model you want."
    }
  }

  let models = listed.map((m) => classify(def.id, m, force)).filter((m): m is ModelProfile => m !== null)
  // OpenRouter lists hundreds of paid models. Only the free ones are used unless you pin others.
  if (def.id === "openrouter" && !force) models = models.filter((m) => m.free)
  models.sort(byStrength)
  if (!force) models = models.slice(0, def.maxModels)

  if (!models.length && def.seed.length) {
    models = def.seed.map((id) => classify(def.id, { id }, true)).filter((m): m is ModelProfile => m !== null)
    if (status.ok) {
      status.ok = false
      status.error = "The provider listed no chat models, so a built-in list is used."
    }
  }
  status.modelCount = models.length
  return { status, models }
}

/** Lists every connected provider in parallel. A failure in one never stops the others. */
export async function loadCatalog(providers: ResolvedProvider[], o: LoadOptions = {}): Promise<Snapshot> {
  const loaded = await Promise.all(providers.map((p) => loadProvider(p, o)))
  return {
    at: Date.now(),
    statuses: loaded.map((l) => l.status),
    models: loaded.flatMap((l) => l.models).sort(byStrength),
  }
}

/* ---------------------------------------------------------------- */
/* Cache                                                             */
/* ---------------------------------------------------------------- */

interface CacheEntry {
  signature: string
  value?: Snapshot
  loading?: Promise<Snapshot>
}
const holder = globalThis as typeof globalThis & { __cyphorCatalog?: CacheEntry }

/** Changes when keys, addresses or pinned models change, so an edited LLM.env is noticed. */
function signatureOf(providers: ResolvedProvider[]) {
  const hash = (s: string) => {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
  }
  return providers.map((p) => `${p.def.id}|${p.configured}|${p.baseUrl}|${p.pinned.join(",")}|${hash(p.apiKey)}`).join(";")
}

/** The current catalog. Served from memory; a stale copy is returned at once while a new one loads behind it. */
export async function getCatalog(opts: { refresh?: boolean; env?: Env } = {}): Promise<Snapshot> {
  const env = opts.env ?? process.env
  const providers = resolveProviders(env)
  const signature = signatureOf(providers)
  const ttl = readInt("CATALOG_TTL_SEC", 600, env) * 1000

  let entry = holder.__cyphorCatalog
  if (!entry || entry.signature !== signature) entry = holder.__cyphorCatalog = { signature }

  const reload = () => {
    const current = entry!
    current.loading ??= loadCatalog(providers, { env })
      .then((v) => {
        current.value = v
        return v
      })
      .finally(() => {
        current.loading = undefined
      })
    return current.loading
  }

  if (opts.refresh) return reload()
  if (!entry.value) return reload()
  if (Date.now() - entry.value.at > ttl) void reload().catch(() => {})
  return entry.value
}

/** Forget the cached catalog (used by tests and the refresh button). */
export function clearCatalog() {
  holder.__cyphorCatalog = undefined
}

export function providerById(providers: ResolvedProvider[], id: ProviderId) {
  return providers.find((p) => p.def.id === id)
}
