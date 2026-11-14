# API reference

Every route the browser calls, with the exact fields, limits and error codes. Written from `proxy.ts`, `lib/http.ts`, `lib/chat-messages.ts` and the four route files under `app/api/`. If this page and the code disagree, the code is right and this page needs fixing.

| Route | Methods | File |
| --- | --- | --- |
| `/api/conversations` | GET, POST, DELETE | `app/api/conversations/route.ts` |
| `/api/conversations/{id}` | GET, PUT, PATCH, DELETE | `app/api/conversations/[id]/route.ts` |
| `/api/models` | GET, POST | `app/api/models/route.ts` |
| `/api/chat` | POST | `app/api/chat/route.ts` |

All four run on Node (`runtime = "nodejs"`) and are never cached (`dynamic = "force-dynamic"`). Bodies are JSON. The body is read as text and parsed; the `Content-Type` header is not checked.

## 1. Before a route runs: `proxy.ts`

Next.js 16 calls this file the proxy (it used to be `middleware.ts`). It runs for every request except static files: the matcher is `/((?!_next/static|_next/image|favicon.ico|icon.svg).*)`.

**Visitor id.** Every browser gets a random 40-character id in the cookie `cyphor_owner` (HttpOnly, SameSite=Lax, `Secure` on https, path `/`, one year). The proxy also copies it onto the request as the header `x-cyphor-owner`, replacing whatever the client sent, so a route can trust it even on the very first visit. Every saved conversation belongs to one visitor id, and a visitor can only see their own. A browser that loses its cookie starts again with a new id and cannot reach its old conversations. This is not an account system. To add one, replace the id in `proxy.ts` with your user id.

When you call the API with `curl`, keep the cookie, or each call is a new visitor:

```bash
curl -s -c jar.txt -b jar.txt http://localhost:3000/api/conversations
```

**Cross-site writes are refused.** For `/api/*`, any method other than GET, HEAD and OPTIONS is answered with `403 forbidden` ("Cross-site requests are not allowed.") when the request has an `Origin` header whose host differs from `x-forwarded-host` (or `host`). A request with no `Origin` header, such as `curl`, passes.

**Security headers** on every response the proxy lets through (the refusals described below do not have them): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. API responses also get `Cache-Control: no-store`.

**Optional shared password.** When `CYPHOR_BASIC_AUTH=name:password` is set, every page and API call needs HTTP Basic credentials, and the browser shows its own sign-in box. For `/api/*` the answers are JSON errors; for pages they are plain text.

| Status | `code` | When |
| --- | --- | --- |
| 401 | `unauthorized` | No or wrong credentials. Sent with `WWW-Authenticate: Basic realm="Cyphor", charset="UTF-8"`. |
| 429 | `rate_limited` | The same address sent too many wrong passwords. Default 10 a minute (`RATE_LIMIT_AUTH_PER_MIN`). It stays shut even for the right password until the minute passes. A request with no `Authorization` header is not counted as a wrong guess. |
| 503 | `locked` | The variable is set but is not written as `name:password`. The app locks instead of opening. |

The name cannot contain a colon (the first colon splits name from password); the password can.

## 2. Errors

Every error from the API has this shape, and the browser shows `error.message` as it is:

```json
{ "error": { "code": "bad_request", "message": "thread must be a non-empty list of messages." } }
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `no_visitor` | No visitor id on the request. Reload the page. |
| 400 | `bad_body` | The body could not be read. |
| 400 | `bad_json` | The body is not valid JSON. |
| 400 | `bad_request` | A field is missing or wrong. The message says which. |
| 401 | `unauthorized` | Password needed (section 1). |
| 403 | `forbidden` | Cross-site write (section 1). |
| 404 | `not_found` | The conversation does not exist, or belongs to another visitor. The two look the same, so ids cannot be probed. |
| 409 | `conflict` | `POST /api/conversations` with an id that another visitor already uses. |
| 413 | `too_large` | The body is bigger than the route allows. |
| 429 | `rate_limited` | Too many requests. Carries `Retry-After` (section 3). |
| 500 | `catalog_failed` | `GET /api/models` could not build the list. |
| 503 | `locked` | The password setting is broken (section 1). |

Once `POST /api/chat` has started streaming, the HTTP status is already 200. Problems after that arrive as an `error` line inside the stream (section 6).

## 3. Rate limits

Sliding window of 60 seconds, counted in memory in each server process.

| Name | Default per minute | Variable | Used by |
| --- | --- | --- | --- |
| `api` | 120 | `RATE_LIMIT_API_PER_MIN` | every `/api/conversations` call and `GET /api/models` |
| `chat` | 20 | `RATE_LIMIT_CHAT_PER_MIN` | `POST /api/chat` and `POST /api/models` (they share one allowance, because a provider test is a real paid request) |
| `god` | 6 | `RATE_LIMIT_GOD_PER_MIN` | `POST /api/chat` when God Mode is chosen and at least one provider is connected, in addition to `chat` |
| auth | 10 | `RATE_LIMIT_AUTH_PER_MIN` | wrong passwords per address |

Each call is counted twice: per visitor id, and per address with five times the allowance, so clearing cookies does not reset it. The address is the first value of `x-forwarded-for`, else `x-real-ip`, else `unknown`.

Successful responses from a limited route carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (Unix time in seconds), and so do most errors; the body errors `bad_body`, `bad_json` and `too_large` do not. A refused call also carries `Retry-After` (seconds) and the message "You're going a little fast. Try again in N seconds."

One process counts for itself. On several servers or serverless functions each one counts alone; swap `createRateLimiter` in `lib/rate-limit.ts` for Redis or Upstash there.

## 4. Conversations

A conversation is saved as a tree of messages (edits and retries are siblings), in the shape of `Chat` in `lib/types.ts`.

```ts
interface Chat {
  id: string
  title: string
  createdAt: number            // milliseconds since 1970
  updatedAt: number
  starred: boolean
  projectId: string | null
  model: string
  nodes: Record<string, Message>   // every message, by id
  rootChildIds: string[]
  rootActiveId: string | null
}
```

The list calls return a short form without messages:

```ts
interface ConversationSummary {
  id: string; title: string; starred: boolean; projectId: string | null
  model: string; createdAt: number; updatedAt: number; messageCount: number
}
```

An **id** is 1 to 64 characters from `A-Z a-z 0-9 _ -`. The browser makes them.

### GET /api/conversations

Returns `{ "conversations": ConversationSummary[] }`: this visitor's conversations, newest `updatedAt` first, at most 500.

### POST /api/conversations

Creates an empty conversation. Body (at most 64 KiB), every field optional:

| Field | Rule |
| --- | --- |
| `id` | An id. Default: `c_` and 12 random hex characters. |
| `title` | Trimmed, cut to 200 characters. Default `New chat`. |
| `starred` | Only `true` counts. |
| `projectId` | An id, or `null`. |
| `model` | Trimmed, cut to 80 characters. Default `cyphor-auto`. |

Answers `201 { "conversation": ConversationSummary }`. If the id already exists and is yours, it answers `200` with that conversation unchanged (its `messageCount` is reported as 0 there). If the id belongs to someone else: `409 conflict`. A bad id or project id: `400 bad_request`.

### DELETE /api/conversations

Deletes every conversation and message this visitor has saved. Answers `{ "deleted": <number of conversations> }`.

### GET /api/conversations/{id}

Answers `{ "chat": Chat }`. `404 not_found` if it is missing or not yours; `400 bad_request` if the id is invalid.

### PUT /api/conversations/{id}

Saves the whole conversation and replaces what was stored. Safe to repeat. Body (up to 12 MiB): `{ "chat": Chat }`. Answers `{ "ok": true, "updatedAt": number, "messageCount": number }`.

The chat is checked first, and the first problem found is returned as `400 bad_request`:

- `chat.id` must be a valid id and must equal the id in the address.
- `chat.nodes` must be an object with at most 2,000 messages. Each key must equal that message's `id`.
- Every `parentId` must point at a message in the same chat, and the tree must have no loop.
- The tree is rebuilt from the `parentId` links, so `childIds` and `rootChildIds` sent by the browser are not trusted. A missing or wrong `activeChildId` or `rootActiveId` is set to the newest child.
- A message with `status: "streaming"` is stored as `stopped`, because a saved reply cannot still be streaming.
- Image data (`dataUrl`) is not stored. Only the attachment's name, type, size and extracted text are kept.

The conversation row is updated (title, star, project, model, root, `updatedAt`) and all of its messages are replaced in one batch, in groups of 150 rows. Someone else's id answers `404 not_found`.

### PATCH /api/conversations/{id}

Changes the small things without sending messages. Body (up to 64 KiB), any of:

| Field | Rule |
| --- | --- |
| `title` | Trimmed, cut to 200 characters. Empty becomes `New chat`. |
| `starred` | Boolean. |
| `model` | A non-empty string, cut to 80 characters. |
| `projectId` | An id, or `null` to leave the project. Anything else is `400`. |

With none of them: `400 bad_request` ("Nothing to change."). Answers `{ "ok": true, "updatedAt": number }`.

### DELETE /api/conversations/{id}

Deletes the conversation and its messages. Answers `{ "ok": true }`.

## 5. Models

### GET /api/models

Says which providers are connected, which models they offer, and what each Cyphor model would use right now. Query parameters:

| Parameter | Effect |
| --- | --- |
| `refresh=1` | Ask the providers again (and read `LLM.env` again) instead of using the cached list. The list is cached for 10 minutes. |
| `disabled=a,b` | Leave these provider ids out, as if switched off in Settings. Unknown ids are ignored, at most 16. |

The answer (`CatalogResponse` in `lib/router/types.ts`), sent with `Cache-Control: no-store`:

| Field | Meaning |
| --- | --- |
| `mode` | `router` when at least one provider has a key, `demo` when none has (the built-in demo model answers). |
| `at` | When the list was made, in milliseconds since 1970. |
| `providers` | One `ProviderStatus` for each of the twelve providers (see below). Before any key is set, they are listed as not configured. |
| `models` | Every usable model of the connected providers, best first (`ModelProfile`, see below). |
| `virtual` | An object with one key per Cyphor model id (`cyphor-auto`, `cyphor-swift`, `cyphor-core`, `cyphor-deep`, `cyphor-code`, `cyphor-god`). The value says what that name would use now (`VirtualPick`), or is `null` when nothing can serve it. |
| `web` | `{ configured: boolean, keyEnv: "TINYFISH_API_KEY" }`: whether web search has a key. |
| `godReady` | `true` when the usable models come from at least two different providers, which God Mode needs. |

`ProviderStatus`:

| Field | Meaning |
| --- | --- |
| `id`, `label` | Provider id and display name. |
| `keyEnv` | The **name** of the variable that holds the key. Never the key. |
| `configured` | A key (or, for `custom`, an address) is set. |
| `ok` | `true` the last check worked, `false` it failed, `null` not checked yet. |
| `modelCount`, `latencyMs`, `error` | What the last model-list call found. `error` has secrets hidden. |
| `coolingDown`, `coolingSec` | Present when the provider is resting after failures, and for how many more seconds. |
| `docs` | Link to the provider's documentation. |
| `needs` | Set when something required is missing (Cloudflare's account id, for example). |
| `sample` | Only in the one-file preview, where providers are examples and nothing is called. |

`ModelProfile`:

| Field | Meaning |
| --- | --- |
| `key` | `provider:id`. This is what a chat stores when you pick that model yourself. |
| `provider`, `id`, `name` | Provider, the id sent to the provider, display name. |
| `tier` | `flagship`, `strong`, `balanced`, `fast` or `mini`. |
| `scores` | `reasoning`, `coding`, `writing`, `speed`, each 0 to 10. |
| `context` | Context length in tokens, or `null` when the provider does not say. |
| `vision`, `thinking`, `free` | Booleans. |
| `tags` | Short labels for the screen. |

`VirtualPick`: `provider`, `providerLabel`, `model`, `key`, `name`, `reason`.

Error: `500 catalog_failed`.

### POST /api/models

Tests one provider by sending it a tiny message ("Reply with the single word: ok", at most 64 tokens, temperature 0, 20 second limit) to its quickest model that does not think first. It uses the `chat` allowance.

Body (up to 2,000 bytes): `{ "provider": "<provider id>" }`. A missing or unknown id is `400 bad_request` ("Say which provider to test.").

Answers `200` with a `TestResult`, also when the provider fails:

```ts
interface TestResult {
  ok: boolean
  model?: string       // the model that was used
  latencyMs?: number
  reply?: string       // the first 60 characters of the answer, secrets hidden
  error?: string       // secrets hidden
}
```

Examples of `error`: no key is set (it names the variable to add to `LLM.env`), a required value is missing, the provider has no models, or the provider's own error text.

## 6. Chat: POST /api/chat

Answers one message and streams the reply.

### Request

Body up to 12 MiB. The route checks it with `checkChatRequest` in `lib/chat-messages.ts`.

| Field | Required | Rule |
| --- | --- | --- |
| `thread` | yes | The path through the conversation, from the first message down to the user message being answered: a non-empty list of at most 400 messages. The first has `parentId: null`, each next one has the previous one's `id` as `parentId`, and the last one has `role: "user"`. |
| `assistantId` | yes | An id the browser already gave the reply it is waiting for. |
| `model` | yes | A non-empty string, cut to 160 characters. Then `resolveModelId` accepts one of the six Cyphor ids or `provider:model`; any other value becomes `cyphor-auto`. |
| `chatId` | no | An id, or `null`/missing. `null` means "answer, but keep nothing" (incognito). |
| `system` | no | Text, at most 20,000 characters. Default empty. |
| `chat` | no | `{ title, starred, projectId, createdAt }`. Only used to create the conversation the first time this `chatId` is seen. The title defaults to `New chat`. |
| `temperature` | no | A number, kept between 0 and 2. Default 0.7. |
| `maxTokens` | no | A number, kept between 1 and 128,000 and rounded. Default 4096. |
| `thinking` | no | `true` asks models that can to reason first. Only `true` counts. |
| `noAccess` | no | Only `true` counts. Used by the demo model. |
| `web` | no | `off`, `search` or `research`. Anything else is `off`. |
| `priority` | no | `balanced`, `speed`, `quality` or `free`. Anything else is `balanced`. |
| `disabledProviders` | no | Provider ids the router must not choose on its own, each matching `a-z 0-9 _ -` and at most 32 characters, at most 16 of them. A model named as `provider:model` is still used. |
| `godMax` | no | The most providers God Mode asks, kept between 2 and 6. Default 4. |
| `speed` | no | Demo model only: 1 is normal speed, kept between 1 and 50. Automated tests use more. |

Each message in `thread` is checked too:

| Field | Rule |
| --- | --- |
| `id` | An id (required). |
| `parentId` | An id or `null`. |
| `role` | `user` or `assistant`. |
| `content` | Text, at most 400,000 characters. |
| `attachments` | At most 20. Each has `id` (at most 64 characters), `kind` (`image`, `text` or `file`), `name` (cut to 255), `mime` (cut to 100), `size`, optional `text` (cut to 200,000 characters), optional `unsupported`. An `image` may carry `dataUrl`: it must start with `data:image/` and be at most 8,000,000 characters. |
| other | `createdAt`, `model`, `activeChildId`, `feedback`, `status` (`streaming` is read as `stopped`), `error` (cut to 2,000), `thinkingMs`, and the router notes `route`, `council`, `sources`, `webNote`. |

The limits of this section, in one place:

| Limit (`LIMITS` in `lib/chat-messages.ts`) | Value | What it counts | When it is passed |
| --- | --- | --- | --- |
| `messagesPerChat` | 2,000 | Messages in one saved conversation | Saving a longer one is refused (400) |
| `threadMessages` | 400 | Messages on the path sent with one `/api/chat` request | A longer thread is refused (400) |
| `contentChars` | 400,000 | Characters in one message | A longer message is refused (400) |
| `systemChars` | 20,000 | Characters in the system prompt | A longer one is refused (400) |
| `titleChars` | 200 | Characters in a title | A longer title is cut |
| `attachmentsPerMessage` | 20 | Attachments on one message | More are refused (400) |
| `attachmentTextChars` | 200,000 | Characters of text kept from one attachment | A longer text is cut |
| `imageDataChars` | 8,000,000 | Characters of image data (a data URL) in one attachment | A larger image is refused (400) |
| `bodyBytes` | 12,582,912 bytes (12 MiB) | Largest request body the API routes accept | A larger body is refused (413) |

A minimal request:

```bash
curl -N -s -c jar.txt -b jar.txt -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"chatId":null,"assistantId":"a1","model":"cyphor-auto","thread":[{"id":"u1","parentId":null,"role":"user","content":"Say hello","createdAt":1700000000000}]}'
```

### Response

`200` with `Content-Type: application/x-ndjson; charset=utf-8`: one JSON object per line. The headers also include `Cache-Control: no-store, no-transform`, `X-Accel-Buffering: no`, the rate-limit headers, and `X-Cyphor-Model` with the model id the route used after `resolveModelId`.

| Line | When |
| --- | --- |
| `{"type":"route","route":RouteInfo}` | Which model is answering and why. Sent again if the first choice fails and another takes over. `route.mode` is `auto`, `direct`, `fallback` or `council`. Not sent by the demo model. |
| `{"type":"council","council":CouncilInfo}` | God Mode only: who has drafted, who is merging. Sent whenever the picture changes. `phase` is `drafting`, `synthesizing`, `done` or `fallback`; each member's `status` is `pending`, `done`, `failed` or `timeout`. |
| `{"type":"web","query":"...","sources":[...],"note":"..."}` | When `web` is `search` or `research`: what was searched and which pages were found. `note` explains a gap, for example that web search needs a TinyFish key. A missing key or a failed search never fails the chat. |
| `{"type":"text","text":"..."}` | A piece of the reply. Thinking arrives wrapped in `<thinking>` tags inside the text. |
| `{"type":"error","message":"...","status":502,"retryAfterSec":30}` | The reply failed. `status` and `retryAfterSec` appear when the provider gave them. Secrets are hidden. No `done` follows. |
| `{"type":"done"}` | The reply finished normally. |

For example (values are illustrative):

```
{"type":"route","route":{"mode":"auto","provider":"groq","providerLabel":"Groq","model":"example-model","name":"Example model","reason":"...","task":"general"}}
{"type":"text","text":"Hello"}
{"type":"text","text":" there!"}
{"type":"done"}
```

Errors found **before** streaming start use the normal error shape and status:

| Status | `code` | Cause |
| --- | --- | --- |
| 400 | `bad_json`, `bad_body`, `bad_request`, `no_visitor` | The body or the visitor id. |
| 404 | `not_found` | `chatId` belongs to another visitor ("That conversation does not belong to this browser."). |
| 413 | `too_large` | Body over 12 MiB. |
| 429 | `rate_limited` | The `chat` allowance, or the `god` allowance for God Mode. |

Errors **after** streaming starts are `error` lines. Two worth knowing: `status: 404` for a model chosen by hand as `provider:model` when that provider is unknown, has no key, or is missing something it needs ("The model ... is not available ..."), and `status: 503` when a Cyphor model is chosen and no connected model can answer at all. A model chosen by hand never falls back to another one.

### What the server does with the turn

1. **Checks and limits**, then `prepare()` loads the connected providers and the model catalog. See [ROUTER-AND-GOD-MODE.md](./ROUTER-AND-GOD-MODE.md).
2. **Saves the turn first** (only when `chatId` is not null). One batch creates the conversation if needed, stores the messages of `thread` that are not stored yet (it never overwrites an existing one), adds the assistant message with `status: "streaming"` and empty content, points the branch pointers at the new turn and updates `updatedAt`. If the database is down, the error is logged and the reply still streams; it just is not saved.
3. **Streams the reply.** The browser can close the tab at any moment: the stream is aborted and the reply is saved as `stopped`.
4. **Finishes the turn** in one batch: the final `content`, `status` (`done`, `stopped` or `error`), `error`, `thinkingMs` (how long until `</thinking>` appeared, only when the reply had thinking) and the notes of how it was made (route, council, sources, web note).

So a finished reply is in the database even if the tab closes a moment after the last word.

### Which model answers

| `model` | What happens |
| --- | --- |
| `cyphor-auto`, `cyphor-swift`, `cyphor-core`, `cyphor-deep`, `cyphor-code` | The router picks the best connected model for the message and keeps fallbacks. |
| `cyphor-god` | God Mode: several providers draft, one merges. `godMax` and `GODMODE_MAX_PANEL` limit how many are asked (the smaller wins). If fewer than two can answer, the normal route answers and a `council` line with `phase: "fallback"` says so. |
| `provider:model`, for example `groq:llama-3.3-70b-versatile` | Exactly that model. No fallback. A model the provider did not list still works if its provider is connected. |
| nothing connected | The built-in demo model (`lib/mock.ts`) answers, whatever the `model` says. The stream has only `text` and `done` lines. |

The full rules are in [ROUTER-AND-GOD-MODE.md](./ROUTER-AND-GOD-MODE.md).
