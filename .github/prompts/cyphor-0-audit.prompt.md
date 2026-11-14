---
description: Check which Cyphor files are already in this project and which step to start with. Changes nothing.
name: cyphor-0-audit
argument-hint: nothing needed
agent: agent
---

# Audit: where does this project stand?

Change nothing. Do not create, edit, move or delete any file, and do not run `npm install`.

1. Run `node docs/tools/verify-files.mjs` in the project root and show me its whole output.
2. Explain it in plain words as a short table with one row per step (1 Tooling and shared basics, 2 Database, proxy and conversation API, 3 LLM router, God Mode and chat API, 4 Screens, components and browser logic, 5 Browser tests): how many required files are OK, MISSING, DIFFERENT or REVIEW.
3. Say which step to start with: the first step that has a MISSING or DIFFERENT required file. The checker prints the prompt to run for it. If every required file is OK, say so and suggest `/cyphor-6-final-check`.
4. List every warning and failure the checker printed (a `middleware.ts`, a `src/` folder, a `.gitignore` that does not ignore `LLM.env`, missing Copilot files) and what to do about each, using `docs/TROUBLESHOOTING.md`.
5. Never open `LLM.env`, `.env.llm` or `.env.local`. Say only whether the checker found `LLM.env`.

Do not start any step. I will run the next prompt myself.
