# Cyphor: instructions for AI coding agents

The full rules are in `.github/copilot-instructions.md`. Read that file before you change anything. The essentials:

- Cyphor is a Next.js 16 chat app (App Router, TypeScript 7, Tailwind 4, shadcn/ui, Better Auth and Drizzle on Neon Postgres) with a router over up to twelve LLM providers. `README.md` describes it, `DESIGN.md` holds the design rules and `docs/ACCEPTANCE.md` says what is tested and what is not.
- Bring files in by **copying** them from the reference folder with a terminal command. Never retype, shorten or "improve" them.
- Prove each change: run `node docs/tools/verify-files.mjs`, `npx tsc --noEmit --incremental false` and `npm run test:unit`, and quote the output. Do not say "done" without it.
- Never open, print, copy or commit `LLM.env`, `.env.llm`, `.env.local` or any key.
- Do not overwrite settings files that already exist and differ (`package.json`, `tsconfig.json`, ...). Show the difference and ask.
