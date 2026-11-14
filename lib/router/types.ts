/**
 * The vocabulary shared by the router (server) and the screens that show it (browser).
 * Types only: nothing here may import Node or browser APIs.
 */

/** Every chat provider the router can talk to. `custom` is any OpenAI-compatible server you run yourself. */
export type ProviderId =
  | "gemini"
  | "groq"
  | "openrouter"
  | "zai"
  | "nvidia"
  | "cohere"
  | "anthropic"
  | "meta"
  | "cloudflare"
  | "mistral"
  | "aionlabs"
  | "custom"

/** How big and capable a model is, from the strongest down to the smallest. */
export type Tier = "flagship" | "strong" | "balanced" | "fast" | "mini"

/** What a message is mostly about. Auto routing picks the model that suits it. */
export type Task = "general" | "code" | "reasoning" | "creative" | "quick"

/** 0 to 10. Higher is better. Speed is how quickly a reply starts and finishes, not how smart it is. */
export interface Scores {
  reasoning: number
  coding: number
  writing: number
  speed: number
}

export interface ModelProfile {
  /** `${provider}:${id}`. This is also what a chat stores when you pick the model yourself. */
  key: string
  provider: ProviderId
  /** The id sent to the provider, exactly as it lists it. */
  id: string
  name: string
  tier: Tier
  scores: Scores
  /** Tokens, when the provider says. */
  context: number | null
  vision: boolean
  /** Reasons step by step before it answers. */
  thinking: boolean
  free: boolean
  /** Short labels for the screen: "Coding", "Vision", "1M context"... */
  tags: string[]
}

export interface ProviderStatus {
  id: ProviderId
  label: string
  /** Name of the environment variable that holds the key. Never the key itself. */
  keyEnv: string
  configured: boolean
  /** true: the last check worked. false: it failed. null: not checked yet. */
  ok: boolean | null
  modelCount: number
  latencyMs?: number
  error?: string
  /** Temporarily skipped after repeated failures. */
  coolingDown?: boolean
  /** Seconds until it is tried again. */
  coolingSec?: number
  docs: string
  /** Set when a value the router needs (an account id, say) is missing. */
  needs?: string
  /** Set only in the single-file preview, where this provider is an example: nothing is connected and nothing is called. */
  sample?: boolean
}

/** Which model one of the Cyphor model names stands for right now. */
export interface VirtualPick {
  provider: ProviderId
  providerLabel: string
  model: string
  key: string
  name: string
  reason: string
}

export interface RouteInfo {
  /** auto: chosen by the router. direct: you picked the model. fallback: the first choice failed. council: God Mode. */
  mode: "auto" | "direct" | "fallback" | "council"
  provider: ProviderId
  providerLabel: string
  model: string
  name: string
  reason: string
  /** What the message was judged to be about, when the router decided. */
  task?: Task
}

export interface CouncilMember {
  key: string
  provider: ProviderId
  providerLabel: string
  model: string
  name: string
  status: "pending" | "done" | "failed" | "timeout"
  ms?: number
  chars?: number
  /** The first words of its draft. */
  snippet?: string
  error?: string
}

export interface CouncilInfo {
  phase: "drafting" | "synthesizing" | "done" | "fallback"
  members: CouncilMember[]
  chair?: { provider: ProviderId; providerLabel: string; model: string; name: string }
  note?: string
}

export interface WebSource {
  title: string
  url: string
  site?: string
  snippet?: string
}

export type WebMode = "off" | "search" | "research"
export type RoutePriority = "balanced" | "speed" | "quality" | "free"

/** One line of the /api/chat response stream. */
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "route"; route: RouteInfo }
  | { type: "council"; council: CouncilInfo }
  | { type: "web"; query: string; sources: WebSource[]; note?: string }
  | { type: "error"; message: string; status?: number; retryAfterSec?: number }
  | { type: "done" }

/** What a saved assistant message remembers about how it was made. */
export interface MessageMeta {
  route?: RouteInfo
  council?: CouncilInfo
  sources?: WebSource[]
  /** A note from the server about the web step, such as "web search needs a TinyFish key". */
  webNote?: string
}

/** The answer of GET /api/models. */
export interface CatalogResponse {
  /** router: at least one provider key is set. demo: nothing is connected, so the built-in demo model answers. */
  mode: "router" | "demo"
  at: number
  providers: ProviderStatus[]
  /** Models of the providers that have a key, best first. */
  models: ModelProfile[]
  /** What each Cyphor model name would use right now. null when nothing can serve it. */
  virtual: Record<string, VirtualPick | null>
  web: { configured: boolean; keyEnv: string }
  /** God Mode needs at least two providers that can answer. */
  godReady: boolean
}
