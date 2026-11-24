---
description: Rules for the LLM router, God Mode and the thinking stream
applyTo: 'lib/router/**,lib/openai.ts,lib/sse.ts'
---

# Router, God Mode and thinking

`README.md` describes the behaviour ("Connect your AI providers", "The model menu and thinking", "How a message is routed"). Keep it in step when behaviour changes.

- **Pure logic stays pure.** `planner.ts`, `profiles.ts`, `health.ts`, `effort.ts` and `types.ts` do no network and no file access. `types.ts` imports nothing and `effort.ts` imports only types, because the screens use both.
- **Provider definitions are data** in `provider-defs.ts`: names, key variable names, addresses, starter models. The browser imports that file too. Never put a key or part of a key in this folder.
- **Read the environment through `readEnv`, `readInt` and `readList` from `lib/router/env.ts`, with an `env` argument**, not from `process.env` inside the logic, so tests can pass their own. `LLM_ENV_DISABLE=1` makes the app ignore `LLM.env`.
- **A model the person names is never replaced.** `provider:model` gives a plan with exactly one candidate. Fail-over to the next candidate happens only before the first word arrives; after that a failure is shown as an error. An empty reply is an error (502).
- **Everything that leaves the server as words goes through `scrubSecrets`.**
- **God Mode degrades, it does not fail.** Fewer than two usable providers, or no draft at all, hands the message to the normal route; one draft is shown as it is; no chair means the best draft is shown. Keep all four.
- **Thinking goes into `<thinking>...</thinking>`.** `parseOpenAiSse` (`lib/openai.ts`) wraps a provider's `reasoning_content` or `reasoning` in that tag and closes it when the stream ends. `lib/router/anthropic.ts` does the same for `thinking_delta`: it asks Anthropic to think only when the request says so and `max_tokens` is at least 2048, and sends the message again without it when a model refuses. The chat route decides with `thinkingFor` (in `effort.ts`), the router asks only models whose profile can think, and God Mode drafts never ask for thinking. `lib/parse.ts` turns the tag into the Thinking block on screen.
- **Effort** (`low`, `medium`, `high`) lives in `effort.ts`. Medium is the default. A routing preference chosen in Settings wins over what effort suggests.
- After a change: add or update tests (`tests/unit/router-pure.test.ts` for logic, `tests/unit/router.test.ts` for behaviour against the fake provider, `tests/unit/effort.test.ts` and `tests/unit/reasoning-stream.test.ts` for effort and thinking), then run `npx tsc --noEmit --incremental false` and `npm run test:unit`.
