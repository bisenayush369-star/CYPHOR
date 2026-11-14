import { create } from "zustand"
import { DEFAULT_MODELS, parseDirectModel } from "./models/page"
import { STANDALONE } from "./provider"
import { prettyName } from "./router/profiles"
import type { CatalogResponse, ModelProfile, ProviderId, ProviderStatus } from "./router/types"
import { useStore } from "./store"
import type { ModelDef } from "./types"

/**
 * What the server says it can do: which providers are connected, which models they offer, and which model
 * each Cyphor model would use right now. It holds no secrets (the server sends variable names, never keys).
 */

export interface TestState {
  state: "running" | "ok" | "fail"
  text: string
}

interface CatalogStore {
  status: "idle" | "loading" | "ready" | "error"
  data: CatalogResponse | null
  error: string | null
  tests: Partial<Record<ProviderId, TestState>>
  /** Asks the server. `refresh` makes it ask the providers again and re-read LLM.env. */
  load: (refresh?: boolean) => Promise<void>
  /** Sends one tiny message to a provider to prove its key works. */
  test: (id: ProviderId) => Promise<void>
}

async function fail(res: Response) {
  try {
    const j = (await res.json()) as { error?: { message?: string } }
    if (j?.error?.message) return j.error.message
  } catch {
    /* not JSON */
  }
  return `The server returned ${res.status}.`
}

/** A request that arrives while one is running is not lost: it runs once the first one is done. */
let inflight = false
let again: { refresh: boolean } | null = null

export const useCatalog = create<CatalogStore>()((set, get) => ({
  status: "idle",
  data: null,
  error: null,
  tests: {},

  load: async (refresh = false) => {
    if (STANDALONE) {
      // No server, so nothing is connected. Four example providers are listed so the router screens have something
      // in them (see sample-catalog.ts). It is loaded only here, so the Next.js app never fetches it.
      const { sampleCatalog } = await import("./sample-catalog")
      set({ status: "ready", data: sampleCatalog(useStore.getState().settings.disabledProviders), error: null })
      return
    }
    if (inflight) {
      again = { refresh: refresh || !!again?.refresh }
      return
    }
    inflight = true
    set({ status: "loading", error: null })
    try {
      const q = new URLSearchParams()
      if (refresh) q.set("refresh", "1")
      const off = useStore.getState().settings.disabledProviders
      if (off.length) q.set("disabled", off.join(","))
      const res = await fetch(`/api/models${q.size ? `?${q}` : ""}`, { cache: "no-store" })
      if (!res.ok) throw new Error(await fail(res))
      set({ status: "ready", data: (await res.json()) as CatalogResponse })
    } catch (e) {
      // Keep whatever was loaded before. The picker still works with the Cyphor models.
      set({ status: "error", error: e instanceof Error ? e.message : "Could not reach the server." })
    } finally {
      inflight = false
      if (again) {
        const next = again
        again = null
        void get().load(next.refresh)
      }
    }
  },

  test: async (id) => {
    const put = (t: TestState) => set((s) => ({ tests: { ...s.tests, [id]: t } }))
    put({ state: "running", text: "Sending a test message…" })
    try {
      const res = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: id }) })
      if (!res.ok) throw new Error(await fail(res))
      const r = (await res.json()) as { ok: boolean; model?: string; latencyMs?: number; error?: string }
      put(r.ok ? { state: "ok", text: `Works. ${r.model ?? "A model"} answered in ${((r.latencyMs ?? 0) / 1000).toFixed(1)} s.` } : { state: "fail", text: r.error ?? "The test failed." })
      // The result changes what is shown (a rejected key rests the provider), so ask again.
      void get().load(true)
    } catch (e) {
      put({ state: "fail", text: e instanceof Error ? e.message : "The test failed." })
    }
  },
}))

/** True once the server has said that no provider is connected, so the built-in demo model answers. */
export function useDemoMode() {
  return useCatalog((s) => s.status === "ready" && s.data?.mode === "demo")
}

export interface ModelInfo {
  id: string
  name: string
  description?: string
  kind?: ModelDef["kind"]
  /** Set for a model picked by name. */
  profile?: ModelProfile
  providerLabel?: string
}

/** A readable description of any model id: a Cyphor model, a model of a connected provider, or one that has since gone. */
export function describeModel(id: string, data: CatalogResponse | null): ModelInfo {
  const virtual = DEFAULT_MODELS.find((m) => m.id === id)
  if (virtual) return { id, name: virtual.name, description: virtual.description, kind: virtual.kind }
  const direct = data?.models.find((m) => m.key === id)
  const label = (p: string) => data?.providers.find((x) => x.id === p)?.label
  if (direct) return { id, name: direct.name, profile: direct, providerLabel: label(direct.provider) }
  const parsed = parseDirectModel(id)
  if (parsed) return { id, name: prettyName(parsed.model), providerLabel: label(parsed.provider) ?? parsed.provider }
  return { id, name: id }
}

/** Only the providers that have a key. */
export function connectedProviders(data: CatalogResponse | null): ProviderStatus[] {
  return data?.providers.filter((p) => p.configured) ?? []
}
