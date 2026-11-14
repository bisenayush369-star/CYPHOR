import type { ModelDef } from "../types"

/**
 * The models Cyphor offers. The browser shows this list in the model picker, and the server
 * checks every /api/chat request against it. (The file lives at lib/models/page.ts to match
 * the project layout.)
 */
export const DEFAULT_MODELS: ModelDef[] = [
  { id: "cyphor-auto", name: "Cyphor Auto", description: "Picks the best connected model for each message", kind: "auto" },
  { id: "cyphor-swift", name: "Cyphor Swift", description: "Fastest answers, for quick questions", kind: "swift" },
  { id: "cyphor-core", name: "Cyphor Core", description: "Balanced for everyday work", kind: "core" },
  { id: "cyphor-deep", name: "Cyphor Deep", description: "Thinks longer on hard problems", kind: "deep" },
  { id: "cyphor-code", name: "Cyphor Code", description: "The strongest coder you have connected", kind: "code" },
  { id: "cyphor-god", name: "God Mode", description: "Every connected provider answers, then one merged answer", kind: "god" },
]

export const DEFAULT_MODEL_ID = "cyphor-auto"

export const MODEL_IDS: ReadonlySet<string> = new Set(DEFAULT_MODELS.map((m) => m.id))

export function isKnownModel(id: unknown): id is string {
  return typeof id === "string" && MODEL_IDS.has(id)
}

/** "groq:llama-3.3-70b-versatile" names one model at one provider. Anything else must be a Cyphor model. */
export function parseDirectModel(id: string): { provider: string; model: string } | null {
  const i = id.indexOf(":")
  if (i <= 0) return null
  const provider = id.slice(0, i)
  const model = id.slice(i + 1)
  return /^[a-z0-9_-]+$/.test(provider) && model ? { provider, model } : null
}

/** An id this app does not know (one picked while using your own endpoint, say) falls back to the default model. */
export function resolveModelId(id: unknown): string {
  if (isKnownModel(id)) return id
  return typeof id === "string" && parseDirectModel(id) ? id : DEFAULT_MODEL_ID
}
