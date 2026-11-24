---
description: Rules for the HTTP routes under app/api
applyTo: 'app/api/**'
---

# API routes

The routes are `app/api/chat`, `app/api/models`, `app/api/conversations` (and `[id]`) and `app/api/auth/[...all]` (Better Auth). `lib/http.ts` holds the shared front door and the error shape. Keep `README.md` ("Project layout") in step when a route is added.

- Every route file starts with `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- Start every handler except `app/api/auth/[...all]` (Better Auth's own handler) with `guard(req, name, perMinute, "ENV_NAME")` from `lib/http.ts`. `name` is `"api"`, `"chat"` or `"god"`. When `gate.ok` is false, return `gate.response`. When it is true you have `gate.ownerId` (the signed-in user's id), `gate.user` and `gate.headers` (the rate-limit headers; put them on your responses).
- Read a body with `readJson(req, maxBytes)`. It never throws: when `ok` is false, return its `response`.
- Answer errors with `apiError(status, code, message, headers)`, which produces `{ "error": { "code", "message" } }`. Use the existing codes: `unauthorized`, `bad_body`, `bad_json`, `bad_request`, `not_found`, `conflict`, `too_large`, `rate_limited`, `catalog_failed`, `db_unavailable`, `auth_unavailable`. A server that is not set up answers 503 with `db_not_configured` or `auth_not_configured`; `setupProblem(e)` in `lib/http.ts` makes that response.
- Validate everything a client sends with `lib/chat-messages.ts` (`checkChat`, `checkChatRequest`, `LIMITS`). Ids match `^[A-Za-z0-9_-]{1,64}$`. Never trust a client's `childIds` or `activeChildId`.
- Every database read or write is limited to `ownerId`. A conversation that is missing and one that belongs to someone else both answer `404 not_found`.
- `proxy.ts` refuses a write to `/api` that comes from another site (`sameOrigin`). Do not weaken that check.
- Anything that may contain provider text and leaves the server as words goes through `scrubSecrets` first.
- After a change: add a test in `tests/unit/api-routes.test.ts` or `tests/unit/server-lib.test.ts`, run `npx tsc --noEmit --incremental false` and `npm run test:unit`.
