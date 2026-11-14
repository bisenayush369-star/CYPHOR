---
description: Run every check on the finished project and report the results in a table. Changes nothing.
name: cyphor-6-final-check
argument-hint: nothing needed
agent: agent
---

# Final check

Change nothing. Run each command, wait for it to finish, and report what it actually printed. Do not guess a result, and do not fix anything. If a check fails, say which one and quote the first error.

| # | Check | Command | Passing looks like |
| --- | --- | --- | --- |
| 1 | Files | `node docs/tools/verify-files.mjs` | Every required file is OK. REVIEW on a settings file is fine. Exit code 0. |
| 2 | Types | `npx tsc --noEmit` | No output at all. |
| 3 | Unit tests | `npm run test:unit` | The summary says `pass 170` and `fail 0`. |
| 4 | Build | `npm run build` | Ends with the route list and no error. |

The browser tests (`npm run test:e2e`) are slow and need `npx playwright install chromium` once. Run them only if I ask.

Then:

1. Print a table with the columns check, command, result (pass or fail) and the one line of output that proves it.
2. If anything failed, say which step of `docs/APPLY-GUIDE.md` it points to and which prompt I should run (for one stray file, `/cyphor-fix-file`). Do not run it.
3. Say whether the checker found `LLM.env`, without opening it.
