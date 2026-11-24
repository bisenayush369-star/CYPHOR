import { apiError, guard, readJson } from "@/lib/http"
import { catalogResponse, testProvider } from "@/lib/router"
import { isProviderId } from "@/lib/router/providers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET  /api/models           which providers are connected, which models they offer and what each Cyphor model uses now.
 *                            Add ?refresh=1 to ask the providers again (and to re-read LLM.env),
 *                            and ?disabled=a,b to leave out providers the person switched off.
 * POST /api/models {provider} sends one tiny message to that provider to prove its key works.
 *
 * Nothing here returns a key, or any part of one: only the name of the variable that holds it.
 */
export async function GET(req: Request) {
  const gate = await guard(req, "api", 120, "RATE_LIMIT_API_PER_MIN")
  if (!gate.ok) return gate.response
  const params = new URL(req.url).searchParams
  const refresh = params.get("refresh") === "1"
  const disabled = (params.get("disabled") ?? "").split(",").filter(isProviderId).slice(0, 16)
  try {
    return Response.json(await catalogResponse({ refresh, disabled }), { headers: { ...gate.headers, "Cache-Control": "no-store" } })
  } catch (e) {
    console.error("[api/models]", e)
    return apiError(500, "catalog_failed", "Could not read the model list.", gate.headers)
  }
}

export async function POST(req: Request) {
  // Testing sends a real request to a paid service, so it has the strict allowance of a chat message.
  const gate = await guard(req, "chat", 20, "RATE_LIMIT_CHAT_PER_MIN")
  if (!gate.ok) return gate.response
  const body = await readJson(req, 2000)
  if (!body.ok) return body.response
  const id = typeof body.value === "object" && body.value !== null ? (body.value as { provider?: unknown }).provider : undefined
  if (typeof id !== "string" || !isProviderId(id)) return apiError(400, "bad_request", "Say which provider to test.", gate.headers)
  return Response.json(await testProvider(id, { signal: req.signal }), { headers: { ...gate.headers, "Cache-Control": "no-store" } })
}
