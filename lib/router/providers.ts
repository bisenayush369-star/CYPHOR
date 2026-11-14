/**
 * Which providers are switched on. Each one is switched on by a key in the environment (see .env.example).
 * The list of providers itself is in provider-defs.ts, which has no Node code, so the browser can read it too.
 * Nothing here holds a secret: only the names of the variables to read.
 *
 * Base URLs that could not be checked against live documentation can be changed with <PROVIDER>_BASE_URL,
 * and the list of models can be pinned with <PROVIDER>_MODELS (comma separated) when the provider does not
 * list them or lists too many.
 */
import { readEnv, readList, type Env } from "./env"
import { PROVIDERS, type ProviderDef } from "./provider-defs"

export { isProviderId, PROVIDER_BY_ID, PROVIDERS, type ProviderDef } from "./provider-defs"

/** The web search tool is not a chat provider, so it is described on its own. */
export const WEB_KEY_ENV = ["TINYFISH_API_KEY", "TINYFISH_KEY"] as const

export interface ResolvedProvider {
  def: ProviderDef
  /** Empty when the provider needs none (a local server). */
  apiKey: string
  /** May still contain {account} for Cloudflare. */
  baseUrl: string
  /** The key (or, for the custom server, the address) is set. */
  configured: boolean
  /** Pinned model ids from the environment. */
  pinned: string[]
  /** What is missing, in words. */
  needs?: string
  /** The variable that holds the key, for the status screen. */
  keyEnvName: string
}

/** Looks at the environment and says which providers are switched on. Pure, so tests can pass their own env. */
export function resolveProviders(env: Env = process.env): ResolvedProvider[] {
  return PROVIDERS.map((def) => {
    const apiKey = readEnv(def.keyEnv, env) ?? ""
    const baseUrl = (readEnv(def.baseUrlEnv, env) ?? def.baseUrl).replace(/\/+$/, "")
    const pinned = readList(def.modelsEnv, env)
    const configured = def.id === "custom" ? !!baseUrl : !!apiKey
    let needs: string | undefined
    if (def.id === "cloudflare" && configured && baseUrl.includes("{account}") && !readEnv(["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"], env)) {
      needs = "CLOUDFLARE_ACCOUNT_ID (or a token that is allowed to read your account)"
    }
    return { def, apiKey, baseUrl, configured, pinned, needs, keyEnvName: def.keyEnv[0] }
  })
}

/** Headers every request to a provider needs. */
export function providerHeaders(def: ProviderDef, apiKey: string, env: Env = process.env): Record<string, string> {
  if (def.protocol === "anthropic") {
    const headers: Record<string, string> = { "x-api-key": apiKey, "anthropic-version": readEnv(["ANTHROPIC_VERSION"], env) ?? "2023-06-01" }
    const workspace = readEnv(["ANTHROPIC_WORKSPACE_ID"], env)
    if (workspace) headers["anthropic-workspace-id"] = workspace
    return headers
  }
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (def.id === "openrouter") {
    // OpenRouter shows these in its dashboard and rankings. Harmless anywhere else.
    headers["HTTP-Referer"] = readEnv(["APP_URL"], env) ?? "http://localhost:3000"
    headers["X-Title"] = "Cyphor"
  }
  return headers
}
