---
description: Check which Cyphor files are already in this project and what is left to do. Changes nothing.
name: cyphor-0-audit
argument-hint: nothing needed
agent: agent
---

# Audit: where does this project stand?

Change nothing. Do not create, edit, move or delete any file, and do not run `npm install`.

1. Run `node docs/tools/verify-files.mjs` in the project root and show me its whole output.
2. Explain it in plain words as a short table with one row per group (foundation, server, router, interface, e2e, docs, preview, tooling): how many required files are OK, MISSING, DIFFERENT or REVIEW, and how many optional files are not in place.
3. Say what to do next. If a required file is MISSING or DIFFERENT, I run `/cyphor-1-apply`. If every required file is OK, say so and suggest `/cyphor-2-final-check`.
4. List every warning and failure the checker printed (a Node version that is too old, missing packages, a `middleware.ts` next to `proxy.ts`, a `src/` folder, a `.gitignore` that does not ignore `LLM.env`, missing Copilot files) and what to do about each, using the section "If something fails" in `docs/APPLY-GUIDE.md`.
5. Never open `LLM.env`, `.env.llm` or `.env.local`. Say only whether the checker found `LLM.env`.

Do not start anything else. I will run the next prompt myself.
