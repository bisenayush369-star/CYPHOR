---
description: Rules for unit and browser tests
applyTo: 'tests/**'
---

# Tests

How to run them and what is covered is in `docs/TESTING.md`.

- **Never delete, skip or weaken a failing test to make it pass.** Fix the code, or change the test when the behaviour was meant to change, and say so. A skip needs a reason string, as the existing ones have.
- **No real keys and no real network.** Keys in tests are obviously fake. The router tests talk to the local fake provider (`tests/unit/helpers/fake-provider.ts`); the browser tests use `tests/e2e/fake-llm.mjs`. The browser servers set `LLM_ENV_DISABLE=1` so a developer's `LLM.env` is never read.
- **Pass the environment in as an object** (`env`) instead of changing `process.env`.
- Unit tests use Node's `node:test` and `node:assert`, and run with `npm run test:unit`. They import project files with the `@/` alias, which `tests/unit/register.mjs` resolves.
- Browser tests run at desktop (1440 x 900), tablet (768 x 1024) and phone (390 x 844). Write a test so it passes at all three, or skip it on purpose with a reason.
- The counts in `docs/TESTING.md` and `docs/APPLY-GUIDE.md` must match reality: after adding or removing a test, say what the new totals are.
