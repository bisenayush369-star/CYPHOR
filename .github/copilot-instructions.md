# Cyphor: instructions for Copilot

Cyphor is a chat app for LLMs with a Cyberpunk 2077 look: Next.js 16 (App Router), React 19, TypeScript 7, Tailwind 4, shadcn/ui, zustand 5, Better Auth and Drizzle on Neon Postgres. A router sends each message to the best of up to twelve LLM providers, and God Mode makes several of them answer together. `README.md` describes the whole app. `DESIGN.md` holds the design rules, `TOOLKIT.md` lists the tools behind it, and `docs/ACCEPTANCE.md` says what was tested and what was not.

## Commands

- `npx tsc --noEmit --incremental false` must print nothing. (The flag keeps an old `tsconfig.tsbuildinfo` from hiding an error.)
- `npm run test:unit` must end with `pass 355` and `fail 0` when every file is in place.
- `npm run build` must succeed. With Next.js 16.4.3 a run can print the whole route list and then stop with `SecurityFatalError: Your version of Next.js is affected by a known security vulnerability`. That is a notice about the installed version, not a failed build: run the command again and it continues. Updating Next.js removes the cause (`npm update next`), but that is an install, so ask first.
- `npm run test:e2e` runs the browser tests. It is slow because it builds the app first, and it needs Chromium (`npx playwright install chromium`).
- `node docs/tools/verify-files.mjs` compares this folder with the delivered files and prints OK, MISSING, DIFFERENT or REVIEW for each. Add `--list missing` or `--list different` for just the paths.

## When asked to apply files from a reference folder

1. **Copy, do not rewrite.** Copy each file with a terminal command (`cp` on macOS and Linux; on Windows a .NET call such as `[IO.File]::Copy(source, target, $true)`, or `Copy-Item -LiteralPath`, because square brackets in paths like `app/api/conversations/[id]/route.ts` are wildcards for the usual PowerShell file commands) so its content is identical to the reference. Never retype a file from memory, shorten it, reformat it, or "improve" it.
2. **Prove it.** After the copy run the checker and `npx tsc --noEmit --incremental false`, and quote what they printed. Do not say "applied" or "done" without that output.
3. **Settings files** (`package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/globals.css`, `components.json`, `postcss.config.mjs`, `package-lock.json`): never overwrite one that exists and differs. Show the difference and ask.
4. **Report plainly**: copied, already identical, skipped (and why), failed. If something could not be done, say so.

## Code rules

- Imports use the `@/` alias for the project root. Use `import type` for types. Unused imports, variables and parameters are compile errors here, not warnings.
- Next.js 16: the gate in front of every request is `proxy.ts`. Never add `middleware.ts` (the build fails when both exist). Keep `app/`, `components/`, `lib/` and `db/` in the project root: no `src/`, no `pages/`.
- Tailwind 4: tokens live in `app/globals.css`. `app/palettes.css` is generated from `lib/scene/palettes.ts` by `npm run build:palettes`; never edit it by hand. Do not create `tailwind.config.js`. Use token classes, not hex colours.
- `components/ui/` is shadcn library code. Do not restyle it. Add components with `npx shadcn@latest add <name>`.
- Every API route except `app/api/auth/[...all]` (Better Auth's own handler) starts with `guard(...)` and, when it reads a body, `readJson(...)` from `lib/http.ts` and answers errors with `apiError(status, code, message)`. The error shape is `{ "error": { "code", "message" } }`. `guard` answers 401 `unauthorized` when nobody is signed in, and gives the handler `ownerId`, the id of the signed-in user.
- Database: `db/schema.ts` and `BOOTSTRAP_SQL` in `db/index.ts` change together. A unit test compares them. The app uses Neon Postgres (`DATABASE_URL`); tests and trial runs use PGlite (`DATABASE_URL=pglite://memory`).
- Sign-in: Better Auth, configured in `lib/auth.ts`. `BETTER_AUTH_SECRET` signs sessions and is never written into a file that is committed.
- Router: provider definitions are in `lib/router/provider-defs.ts`. A model the person names as `provider:model` is never replaced by another one.
- `public/artifact/runtime.js` and `public/artifact/tailwind.js` are built or copied files. Do not edit them by hand. `public/artifact/README.md` says how each one is made.
- Tests: when behaviour changes, change or add tests. Never delete, skip or weaken a failing test to make it pass. Tests use no real network and no real key.

## Secrets

- Never open, print, copy, paste, commit or attach `LLM.env`, `.env.llm`, `.env.local` or any key. Talk about variable names only. Text that leaves the server goes through `scrubSecrets` first.
- Ask before installing packages, deleting files, or using any paid or external service. Never run an install command that needs an API key.

## Where things are

| Need | File |
| --- | --- |
| How to put the files in | `docs/APPLY-GUIDE.md` |
| What the app is, how to set it up, the file layout | `README.md` |
| Colours, type, shapes, motion, accessibility | `DESIGN.md` |
| What was tested and what was not | `docs/ACCEPTANCE.md` |
| Which tools were used, installed or left out | `TOOLKIT.md` |
| How the preview runtime is made | `public/artifact/README.md` |
