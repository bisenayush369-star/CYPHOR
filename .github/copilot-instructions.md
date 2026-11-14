# Cyphor Chat: instructions for Copilot

Cyphor Chat is a Claude-style chat app: Next.js 16 (App Router), React 19, TypeScript 7, Tailwind 4, shadcn/ui, zustand 5, drizzle with SQLite. A router sends each message to the best of up to twelve LLM providers, and God Mode makes several of them answer together. The project documents are in `docs/`. Start with `docs/README.md`.

## Commands

- `npx tsc --noEmit` must print nothing.
- `npm run test:unit` must end with `pass 170` and `fail 0` when every step is applied.
- `npm run build` must succeed.
- `npm run test:e2e` runs the browser tests. It is slow because it builds the app first.
- `node docs/tools/verify-files.mjs` compares this folder with the delivered files and prints OK, MISSING, DIFFERENT or REVIEW for each. Add `--only <step>` and `--list missing` or `--list different` for just the paths.

## When asked to apply files from a reference folder

1. **Copy, do not rewrite.** Copy each file with a terminal command (`cp` on macOS and Linux; on Windows a .NET call such as `[IO.File]::Copy(source, target, $true)`, or `Copy-Item -LiteralPath`, because square brackets in paths like `app/api/conversations/[id]/route.ts` are wildcards for the usual PowerShell file commands) so its content is identical to the reference. Never retype a file from memory, shorten it, reformat it, or "improve" it.
2. **One step at a time, in order**: foundation, server, router, interface, e2e (`docs/APPLY-GUIDE.md`). Each step compiles only when the earlier ones are in.
3. **Prove it.** After each step run the checker and `npx tsc --noEmit`, and quote what they printed. Do not say "applied" or "done" without that output.
4. **Settings files** (`package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/globals.css`, `components.json`, `postcss.config.mjs`, `package-lock.json`): never overwrite one that exists and differs. Show the difference and ask.
5. **Report plainly**: copied, already identical, skipped (and why), failed. If something could not be done, say so.

## Code rules

- Imports use the `@/` alias for the project root. Use `import type` for types. Unused imports and variables are compile errors here, not warnings.
- Next.js 16: the gate in front of every request is `proxy.ts`. Never add `middleware.ts` (the build fails when both exist). Keep `app/`, `components/`, `lib/` and `db/` in the project root: no `src/`, no `pages/`.
- Tailwind 4: tokens live in `app/globals.css`. Do not create `tailwind.config.js`. Use token classes, not hex colours.
- `components/ui/` is shadcn library code. Do not restyle it. Add components with `npx shadcn@latest add <name>`.
- API routes start with `guard(...)` and `readJson(...)` from `lib/http.ts`, answer errors with `apiError(status, code, message)`, and validate with `lib/chat-messages.ts`. The error shape is `{ "error": { "code", "message" } }`.
- Database: `db/schema.ts`, `BOOTSTRAP_SQL` and `LATER_COLUMNS` in `db/index.ts` change together. A unit test compares them.
- Router: provider definitions are in `lib/router/provider-defs.ts`. A model the person names as `provider:model` is never replaced by another one.
- Tests: when behaviour changes, change or add tests. Never delete, skip or weaken a failing test to make it pass. Tests use no real network and no real key.

## Secrets

- Never open, print, copy, paste, commit or attach `LLM.env`, `.env.llm`, `.env.local` or any key. Talk about variable names only. Text that leaves the server goes through `scrubSecrets` first.
- Ask before installing packages, deleting files, or using any paid or external service. Never run an install command that needs an API key.

## Where things are

| Need | File |
| --- | --- |
| How to put the files in | `docs/APPLY-GUIDE.md` |
| What each file is for | `docs/FILE-MAP.md` |
| Shape of the app, data, sync | `docs/ARCHITECTURE.md` |
| HTTP routes and the stream format | `docs/API.md` |
| Router and God Mode | `docs/ROUTER-AND-GOD-MODE.md` |
| Screens, settings, design | `docs/UI-AND-DESIGN.md` |
| Tests | `docs/TESTING.md` |
| Keys, limits, security | `docs/ENV-AND-SECURITY.md` |
| Something broke | `docs/TROUBLESHOOTING.md` |
