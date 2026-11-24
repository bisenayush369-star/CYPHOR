---
description: Run every check on the finished project and report the results in a table. Changes nothing.
name: cyphor-2-final-check
argument-hint: nothing needed
agent: agent
---

# Final check

Change nothing. Run each command, wait for it to finish, and report what it actually printed. Do not guess a result, and do not fix anything. If a check fails, say which one and quote the first error.

| # | Check | Command | Passing looks like |
| --- | --- | --- | --- |
| 1 | Files | `node docs/tools/verify-files.mjs` | Every required file is OK. REVIEW on a settings file is fine. Exit code 0. |
| 2 | Types | `npx tsc --noEmit --incremental false` | No output at all. |
| 3 | Unit tests | `npm run test:unit` | The summary says `pass 355` and `fail 0`. |
| 4 | Build | `npm run build` | Ends with the route list and no error. |

If the build prints the route list and then stops with `SecurityFatalError: Your version of Next.js is affected by a known security vulnerability`, run it once more and report both runs. Do not run `next upgrade` or update Next.js.

The browser tests (`npm run test:e2e`) are slow and need `npx playwright install chromium` once. Run them only if I ask.

Then:

1. Print a table with the columns check, command, result (pass or fail) and the one line of output that proves it.
2. If anything failed, say which section of `docs/APPLY-GUIDE.md` it points to and which prompt I should run (`/cyphor-1-apply` for missing or different files, `/cyphor-fix-file` for one stray file). Do not run it.
3. Say whether the checker found `LLM.env`, without opening it.
4. End with what these checks do not cover. `docs/ACCEPTANCE.md`, the section "Not tested, in one place", lists it: a live Neon database, Google sign-in, real provider keys, the city on a real graphics card, and non-Chromium browsers.
