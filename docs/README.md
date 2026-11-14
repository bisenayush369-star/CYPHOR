# Cyphor Chat: documentation pack

This pack goes with `cyphor-chat.zip`. The zip holds the project. This pack tells you, and GitHub Copilot, exactly what the project contains, which files to put where, in which order, and how to prove they arrived. It exists because Copilot did not apply the changes as they were described: a written map and a checker leave less to guess.

The pack changes no code. It adds documents, Copilot instruction and prompt files, and one checker script.

## Start here

1. Put the contents of this pack in your project root (next to `package.json`): `AGENTS.md`, `.github/` and `docs/`.
2. Read [APPLY-GUIDE.md](./APPLY-GUIDE.md) and follow it. Path A copies the files yourself. Path B asks Copilot to do it step by step.
3. Run `node docs/tools/verify-files.mjs`. It says which of the 356 files are in your folder, which are missing and which differ from the delivered ones.

## The documents

| Page | Read it when |
| --- | --- |
| [APPLY-GUIDE.md](./APPLY-GUIDE.md) | You want the files in your project. Ordered steps, copy commands for macOS, Linux and Windows, the five checks that prove it worked, why Copilot skips changes. |
| [FILE-MAP.md](./FILE-MAP.md) | You need to know what a file is for, or which step it belongs to. Every file of the project, grouped by step, one line each. |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | You want the shape of the app: browser, server, database, how a message travels, how conversations are saved and synced, and where to change what. |
| [API.md](./API.md) | You call or change the HTTP routes. Fields, limits, error codes, the streaming format. |
| [ROUTER-AND-GOD-MODE.md](./ROUTER-AND-GOD-MODE.md) | You work on the multi-provider router: how a model is picked, rated, failed over, and how God Mode makes several providers answer together. |
| [UI-AND-DESIGN.md](./UI-AND-DESIGN.md) | You change screens, settings, shortcuts, colours, type or motion. |
| [TESTING.md](./TESTING.md) | You run or add tests. Commands, the numbers measured, what is not tested. |
| [ENV-AND-SECURITY.md](./ENV-AND-SECURITY.md) | You set keys and limits, or put the app where other people can reach it. |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Something does not work. |

## What is in this pack

```text
AGENTS.md                              the essential rules for any AI coding agent, pointing to the Copilot file below
.github/copilot-instructions.md        rules Copilot loads on every request
.github/instructions/                  5 rule files that apply to one folder each (api, router, components, tests, db)
.github/prompts/                       8 prompts you run in Copilot Chat by typing /
docs/                                  these pages
docs/manifest.json                     every project file with its SHA-256 fingerprint
docs/tools/verify-files.mjs            the checker (plain Node, no packages to install)
```

The prompts, in the order to use them: `/cyphor-0-audit`, `/cyphor-1-foundation`, `/cyphor-2-server`, `/cyphor-3-router`, `/cyphor-4-interface`, `/cyphor-5-tests`, `/cyphor-6-final-check`, and `/cyphor-fix-file` for one stray file.

## The checker in one minute

```bash
node docs/tools/verify-files.mjs                          # the whole project
node docs/tools/verify-files.mjs --only server            # one step
node docs/tools/verify-files.mjs --list missing           # just the paths that are not there
node docs/tools/verify-files.mjs --list different         # just the paths that are not the same
node docs/tools/verify-files.mjs --json                   # the whole report for a script
node docs/tools/verify-files.mjs --help
```

It needs only Node 16 or newer (tried with 16.20 and 22.23), and it tells you if your Node is too old for the project itself (22.18 or newer). It reads files named in the manifest and compares fingerprints. It never opens `LLM.env` or any other file whose name starts with `.env`; `.env.example` is only checked for being there. It also checks that your `.gitignore` keeps `LLM.env` out of git, and warns about a leftover `middleware.ts`, `src/` or `pages/`.

## The project in numbers

- `cyphor-chat.zip` holds 359 files. 356 of them are in the manifest and the checker: 170 are needed to run the app, and the rest are optional (docs, the one-file preview build, design skills for Claude Code). The other three are compiled `.pyc` files that can be deleted.
- Five build steps: 15, 14, 20, 117 and 7 files. Each step passes the type check on its own once the earlier ones are in.
- 170 unit tests (50 after step 2, 137 after step 3).
- Next.js 16, React 19, TypeScript 7, Tailwind 4, shadcn/ui, zustand 5, drizzle with SQLite, twelve model providers behind one router.

## What was and was not tested

Measured on the delivered files:

- The type check passes, the 170 unit tests pass, and the production build succeeds.
- Each of the five steps was built up from nothing in a scratch folder: the type check passed at every step and the unit test counts were 50 and 137 at steps 2 and 3, 170 from step 4.
- The browser suite (Playwright and axe-core) ran on desktop, tablet and phone sizes with no failures. [TESTING.md](./TESTING.md) has the counts.

Not tested:

- No real provider was called. The router was tested against fake providers, so a real provider can still differ in small ways (error wording, model lists). Test yours with the button in Settings > Router.
- The Windows commands in [APPLY-GUIDE.md](./APPLY-GUIDE.md) (`robocopy`, `Expand-Archive`, the PowerShell copy line) were not run on Windows, because the work was done on Linux. The macOS and Linux commands were run against a scratch copy of the project. If a Windows command fails, copy the files with File Explorer instead and use the checker to see what is still missing.
- The Figma design tokens were written but not read back.
- The hosted one-file preview cannot download files (the host blocks it). That is a limit of the host, and the project itself is not affected.

## Known small mismatches in the project

These are in the delivered files. They change nothing at run time, and the pack documents them instead of editing the project.

- A comment in `db/index.ts` says `tests/unit/db.test.ts` fails when `BOOTSTRAP_SQL` and `db/schema.ts` drift. That file does not exist. The check the comment means is real, but it lives in `tests/unit/server-lib.test.ts` (the test "the tables made on first use have exactly the columns the code expects").
- `README.md` says to add a provider in `lib/router/providers.ts`. The provider list is in `lib/router/provider-defs.ts`.
- The zip contains three compiled `__pycache__/*.pyc` files under `.claude/skills/ui-ux-pro-max/scripts/`. They are not needed and can be deleted.
