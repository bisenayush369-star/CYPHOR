---
description: Rules for the LLM router and God Mode
applyTo: 'lib/router/**'
---

# Router and God Mode

How it works is in `docs/ROUTER-AND-GOD-MODE.md`. Read the invariants in section 13 before changing behaviour.

- **Pure logic stays pure.** `planner.ts`, `profiles.ts`, `health.ts` and `types.ts` do no network and no file access. `types.ts` has no imports at all, because the screens import it too.
- **Provider definitions are data** in `provider-defs.ts`: names, key variable names, addresses, starter models. Never put a key or a key fragment in this folder.
- **Read the environment through `readEnv`, `readInt` and `readList` with an `env` argument**, not from `process.env` inside the logic, so tests can pass their own.
- **A model the person names is never replaced.** `provider:model` gives a plan with exactly one candidate. Fail-over happens only before the first word arrives; an empty reply is an error (502).
- **Everything that leaves the server as words goes through `scrubSecrets`.**
- **God Mode degrades, it does not fail.** Fewer than two members, no drafts, one draft, or no chair each have a defined fallback. Keep them.
- After a change: add or update tests (`tests/unit/router-pure.test.ts` for logic, `tests/unit/router.test.ts` for behaviour against the fake provider), update `docs/ROUTER-AND-GOD-MODE.md`, run `npx tsc --noEmit` and `npm run test:unit`.
