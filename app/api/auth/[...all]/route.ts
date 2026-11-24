import { toNextJsHandler } from "better-auth/next-js"
import { getAuth } from "@/lib/auth"
import { apiError, setupProblem } from "@/lib/http"

/** Everything under /api/auth: sign up, sign in, sign out, the Google redirect and the session lookup. */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Verb = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

function handle(verb: Verb) {
  return async (req: Request) => {
    try {
      const auth = await getAuth()
      return await toNextJsHandler(auth)[verb](req)
    } catch (e) {
      const setup = setupProblem(e)
      if (setup) return setup
      console.error("[auth]", e instanceof Error ? e.message : e)
      return apiError(500, "auth_unavailable", "Sign-in is not available right now. Check the server log.")
    }
  }
}

export const GET = handle("GET")
export const POST = handle("POST")
export const PATCH = handle("PATCH")
export const PUT = handle("PUT")
export const DELETE = handle("DELETE")
