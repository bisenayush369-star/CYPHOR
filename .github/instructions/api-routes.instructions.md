---
description: Rules for the HTTP routes under app/api
applyTo: 'app/api/**'
---

# API routes

The contract of every route is in `docs/API.md`. Keep that page and the code in step.

- Every route file starts with `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- Start every handler with `guard(req, name, perMinute, "ENV_NAME")` from `lib/http.ts`. When `gate.ok` is false, return `gate.response`. When it is true you have `gate.ownerId` (the visitor id) and `gate.headers` (the rate-limit headers; put them on your responses).
- Read a body with `readJson(req, maxBytes)`. It never throws: when `ok` is false, return its `response`.
- Answer errors with `apiError(status, code, message, headers)`, which produces `{ "error": { "code", "message" } }`. Use the existing codes: `no_visitor`, `bad_body`, `bad_json`, `bad_request`, `not_found`, `conflict`, `too_large`, `rate_limited`, `catalog_failed`.
- Validate everything a client sends with `lib/chat-messages.ts` (`checkChat`, `checkChatRequest`, `LIMITS`). Ids match `^[A-Za-z0-9_-]{1,64}$`. Never trust a client's `childIds` or `activeChildId`.
- Every database read or write is limited to `ownerId`. A conversation that is missing and one that belongs to someone else both answer `404 not_found`.
- Anything that may contain provider text and leaves the server as words goes through `scrubSecrets` first.
- After a change: update `docs/API.md`, add a test in `tests/unit/server-lib.test.ts`, run `npx tsc --noEmit` and `npm run test:unit`.
