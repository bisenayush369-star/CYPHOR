---
description: Rules for unit and browser tests
applyTo: 'tests/**,playwright.config.ts'
---

# Tests

`README.md` ("Tests") says how to run them. `docs/ACCEPTANCE.md` says what was run and what was not.

- **Never delete, skip or weaken a failing test to make it pass.** Fix the code, or change the test when the behaviour was meant to change, and say so. A skip needs a reason string, as the existing ones have.
- **No real keys and no real network.** Keys in tests are obviously fake. The router tests talk to the local fake provider (`tests/unit/helpers/fake-provider.ts`); the browser tests use `tests/e2e/fake-llm.mjs`. The browser servers (`tests/e2e/servers.mjs`) blank every provider key, set `LLM_ENV_DISABLE=1` and keep accounts and chats in PGlite inside the process (`pglite://memory`), so a developer's own keys and database are never touched.
- **Pass the environment in as an object** (`env`) instead of changing `process.env`.
- Unit tests use `node:test` and `node:assert` and run with `npm run test:unit`. They import project files with the `@/` alias, which `tests/unit/register.mjs` resolves.
- Browser tests run in Chromium at desktop (1440 x 900), tablet (768 x 1024) and phone (390 x 844). Write a test so it passes at all three, or skip it on purpose with a reason.
- Browser tests make their own account with `signUp` in `tests/e2e/helpers.ts`. They start with the moving city off and the default theme chosen, unless the test is about the city or the first-run question. A machine without a GPU refuses the city by default, so a test that needs it opens the page with `city=low`.
- The counts in `docs/ACCEPTANCE.md` must match reality: after adding or removing a test, say what the new totals are.
