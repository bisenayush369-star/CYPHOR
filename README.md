# Cyphor Chat

A Claude-style chat app for your own LLM keys. Streaming replies, branching conversations, artifacts with live preview, projects, a command palette and ten settings sections, designed to work the same on a phone, a tablet and a desktop. It is a Next.js app: the screens run in the browser, and a small server holds your provider keys and talks to the providers for you.

Three things go beyond a single-model chat:

- **A router.** Put the keys of every provider you have in one file. Cyphor lists their models, judges each by what it is good at, and picks one for every message. If the first choice fails before it has said anything, it moves to the next.
- **Models told apart by ability.** Each model gets a tier (flagship down to mini) and four scores out of ten (reasoning, coding, writing, speed). The scores are estimates from the model's family and size, not benchmark results, so they say where to start. The picker and the library show them, and **Cyphor Auto, Swift, Core, Deep and Code** are names for "the best connected model for that job right now".
- **God Mode.** One strong model from each connected provider answers at the same time. A chair model then merges the drafts into one reply, and the screen shows who was asked, who answered and who merged.

With nothing connected, a built-in **demo model** answers so every screen can be tried straight away.

The look is documented in [`DESIGN.md`](./DESIGN.md): warm paper by day, cool slate by night, serif replies, and a 26-notch cipher dial as the one signature object. [`TOOLKIT.md`](./TOOLKIT.md) records which design and agent tools were evaluated and what was left out.

## Run it

Needs Node **22.18 or newer** (the unit tests run TypeScript directly).

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the build on port 3000
```

Chats are saved in a SQLite file at `.data/cyphor.db`, created on first use. Nothing else needs setting up.

## Connect your providers

Create a file named `LLM.env` next to `package.json`, with one line for each provider you have a key for. Leave out the ones you do not have.

```text
GROQ_API_KEY=<your key>
MISTRAL_API_KEY=<your key>
```

`LLM.env` is git-ignored and is read only by the server. The browser is never sent a key, only the *name* of each variable. After editing the file, restart the server or press **Refresh** in **Settings → Router**.

| Provider | Variable | Also accepted |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | |
| Google Gemini | `GEMINI_API_KEY` | `GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` |
| Groq | `GROQ_API_KEY` | |
| OpenRouter | `OPENROUTER_API_KEY` | |
| Z.AI (GLM) | `ZAI_API_KEY` | `Z_AI_API_KEY`, `ZHIPU_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` | `NVIDIA_NIM_API_KEY` |
| Cohere | `COHERE_API_KEY` | `CO_API_KEY` |
| Mistral | `MISTRAL_API_KEY` | |
| Meta Llama | `META_API_KEY` | `LLAMA_API_KEY` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` and `CLOUDFLARE_ACCOUNT_ID` | `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN` |
| AionLabs | `AIONLABS_API_KEY` | `AION_API_KEY` |
| Your own server (Ollama, LM Studio, vLLM…) | `LLM_BASE_URL`, optionally `LLM_API_KEY` and `LLM_MODELS` | |
| Web search (not a chat model) | `TINYFISH_API_KEY` | `TINYFISH_KEY` |

A real environment variable always wins over `LLM.env`. Base URLs that could not be checked against live documentation can be changed with `<PROVIDER>_BASE_URL`, and any provider's model list can be pinned with `<PROVIDER>_MODELS` (comma separated). [`.env.example`](./.env.example) lists every name and holds no key.

**Settings → Router** shows each connected provider by the name of its variable, lets you send one tiny test message to prove a key works, and lets you switch a provider off without deleting its key. It also sets the routing priority (balanced, fastest, best quality, free first) and the God Mode panel size.

### How a message is routed

| Pick in the model menu | What happens |
| --- | --- |
| **Cyphor Auto** | Judges the message (general, code, reasoning, creative or quick) and picks the connected model that suits it best, weighted by your priority. |
| **Cyphor Swift, Core, Deep, Code** | The fastest, the balanced, the deepest-thinking and the strongest-coding model you have connected. The menu says which one each is *right now*. |
| **God Mode** | The panel described above. |
| **A model by name** (from the library) | Exactly that model. If it fails, you are told. It never quietly switches to another one. |

For the Cyphor names, a failure *before the first word* moves on to the next candidate, and the chip under the reply says it switched. A failure after text has started is shown as an error, because the words already on screen cannot be taken back. Providers that fail repeatedly are rested for a while: a rejected key for five minutes, a missing model for ten, a rate limit only for that model. Every reply keeps a small chip saying which model wrote it and why.

Two honest limits. **God Mode multiplies your usage:** every message costs about as many requests as the panel size plus one. And **no provider has been called live from this repository's tests**: they run against fake servers (see [Tests](#tests)), so the first real message is the first real check of each provider's address and key.

### Web search

With `TINYFISH_API_KEY` set, the **Web search** and **Research** switches in the composer ground the reply in pages found on the web, and the sources appear under it. Without the key the reply says so instead of pretending.

### Your own LLM, straight from the browser

**Settings → Model → Your own LLM** talks from the browser directly to an OpenAI-style address you type in. That keeps the key in this browser's storage, so use it for a server on your own machine, not for a paid key. For a paid key, use `LLM.env`.

## Keep it private

- **Keys stay on the server.** They are read from `LLM.env` or the environment, never sent to the browser, and every error message passes through a filter that hides a key a provider repeats back. `LLM.env` and `.env.llm` are git-ignored. If a key was ever pasted into a chat, a screenshot or a commit, rotate it.
- **There are no accounts.** A cookie gives each browser an anonymous id so saved chats belong to the browser that made them. Anyone who can open the address can use your keys. On your own machine that is fine. **Before you serve it anywhere other people can reach, set a password:**

  ```text
  CYPHOR_BASIC_AUTH=name:password
  ```

  Put it in `.env.local` or the real environment. Every page and API call then asks for it (the browser shows its own sign-in box). Wrong guesses are counted per address. After 10 in a minute (`RATE_LIMIT_AUTH_PER_MIN`) that address is turned away until the oldest of them is a minute old, even if its next guess is right. The address is read from `X-Forwarded-For` when a proxy sets it, so that header must be set by a proxy you trust. A value that is set but is not `name:password` locks the app with a 503 instead of opening it. This is one shared password, not user accounts, and Basic sign-in sends it with every request, so serve the app over HTTPS. The static bundles under `/_next/static` and the icon are not behind it. To add real accounts, replace the visitor id in [`proxy.ts`](./proxy.ts).
- **Requests are limited** per visitor and per address: 20 chats a minute, 120 other calls, and 6 God Mode messages (`RATE_LIMIT_CHAT_PER_MIN`, `RATE_LIMIT_API_PER_MIN`, `RATE_LIMIT_GOD_PER_MIN`). The counters live in memory, so they are per server process.
- **Writes must come from this site.** A request that changes anything and carries an `Origin` from another site is refused with a 403.

## Settings reference

All optional. Put them in `.env.local` (or the real environment), not in `LLM.env`.

| Variable | Default | What it does |
| --- | --- | --- |
| `DATABASE_URL` | `file:./.data/cyphor.db` | SQLite file, or a Turso URL (`libsql://…`) |
| `DATABASE_AUTH_TOKEN` | | Turso token |
| `CYPHOR_BASIC_AUTH` | off | `name:password`, see above |
| `ROUTER_FIRST_BYTE_MS` | 25000 | How long to wait for a first word before trying another model |
| `CATALOG_TTL_SEC` | 600 | How long the model lists are remembered |
| `GODMODE_MAX_PANEL` | 6 | Most providers asked at once (the settings slider goes up to this; its default is 4) |
| `GODMODE_DRAFT_MS` | 45000 | Stop waiting for drafts after this long |
| `GODMODE_GRACE_MS` | 8000 | Extra wait for slow providers once enough drafts are in |
| `RATE_LIMIT_CHAT_PER_MIN` | 20 | Chat requests per visitor per minute |
| `RATE_LIMIT_API_PER_MIN` | 120 | Other API calls per visitor per minute |
| `RATE_LIMIT_GOD_PER_MIN` | 6 | God Mode messages per visitor per minute |
| `RATE_LIMIT_AUTH_PER_MIN` | 10 | Wrong passwords per address per minute |
| `APP_URL` | `http://localhost:3000` | The public address, sent to OpenRouter as the referrer |
| `LLM_ENV_DISABLE` | | `1` ignores `LLM.env`, so automated tests never pick up real keys |

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run typecheck` | `tsc --noEmit` (TypeScript 7, about ten seconds) |
| `npm run test:unit` | Node's test runner: router, God Mode, rate limits, password gate, database, backup import |
| `npm run test:e2e` | Playwright and axe-core in a real browser (see [Tests](#tests)) |
| `npm test` | Both |
| `npm run db:generate`, `db:push`, `db:studio` | drizzle-kit, configured by `drizzle.config.ts`. The app does not need them: it creates its own tables. Set `DATABASE_URL` in your shell first if you do not use the default file. |
| `npm run tree` | Rewrites `file-tree.txt`: every file, who imports whom, and what each route pulls in (about 10,000 lines, because each route repeats its whole tree) |
| `npm run build:preview` | One self-contained `dist-preview/index.html` that opens straight from disk, with a demo model and no server |

There is no linter configured. Type errors, the unit tests, the production build and the browser tests are the checks.

## Project layout

```text
app/                   Next.js App Router
  page.tsx             /          the empty "new chat" screen
  chat/ projects/ artifacts/      the other screens
  api/chat/            POST: one reply, streamed as lines of JSON
  api/conversations/   saved chats
  api/models/          GET: what is connected and what each Cyphor name means now. POST: test one provider
  globals.css          design tokens, reading surface, motion, syntax colours
components/            screens and pieces
  ui/                  47 shadcn components (new-york style, Tailwind v4)
  settings/            the ten settings sections, Router among them
db/                    drizzle schema and the libsql connection
lib/
  router/              providers, model profiles, planner, failover, health, God Mode, web tool, LLM.env reader
  store.ts, sync.ts    chats, projects and settings in the browser, and their copy on the server
  catalog.ts           what the server says it can do, for the screens
  mock.ts              the demo model
proxy.ts               runs before every request: password, visitor cookie, cross-site check, headers
scripts/file-tree.mjs  writes file-tree.txt
tests/
  unit/                node:test
  e2e/                 Playwright, axe-core, fake providers
preview/               what the single-file preview build needs
.claude/skills/        UI UX Pro Max and the skills that came with it (git-ignored)
.mcp.json              shadcn, Playwright and Figma MCP servers for Claude Code
DESIGN.md  TOOLKIT.md  file-tree.txt
```

## Tests

```bash
npm run test:unit     # no network and no browser
npm run test:e2e      # builds the app, starts three servers, runs the browser suite
```

The browser suite runs on a desktop (1440 × 900), a tablet (768 × 1024) and a phone (390 × 844). It covers sending, streaming, stopping, rating, retrying, editing into a new branch, reloading, artifacts and their sandbox, every settings section, theme switching, the command palette, backup export and import, reduced motion, and that nothing scrolls sideways from 320 px to 1920 px. A second spec runs axe-core (WCAG 2.0, 2.1 and 2.2 A and AA plus best-practice rules, light and dark) over the main screens and every settings section. A third covers the router: the provider list, the picker and library, automatic routing, a fixed model, God Mode (including a partial panel), web sources, failover and failures, and the API itself.

**No real key or provider is used.** `tests/e2e/servers.mjs` starts three servers:

| Port | What |
| --- | --- |
| 4173 | Cyphor with nothing connected, so the demo model answers |
| 4174 | Cyphor with three fake providers connected (Groq, Mistral and Anthropic shapes) and a fake web search |
| 4599 | The fake providers themselves. What one does is decided by what you write to it |

Notes:

- First run on a new machine: `npx playwright install chromium`.
- `SKIP_BUILD=1 npm run test:e2e` reuses the build you already made.
- `BASE_URL=http://localhost:3000 npm run test:e2e` tests a server you started yourself and builds nothing. The router tests then run only when `ROUTER_URL` points at a Cyphor that has providers connected.
- If Playwright cannot find its browser, set `PW_CHROMIUM_PATH=/path/to/chrome`, and `PW_NO_SANDBOX=1` when running as root, as in a container.
- The demo model answers 20 times faster when the address ends in `?speed=20`. The tests use that; normal use is unaffected.

## Design tools

| Tool | State |
| --- | --- |
| **Frontend design** | Guided the whole look: a deliberate palette, type pairing and one signature element instead of template defaults. Written down in `DESIGN.md`. |
| **shadcn/ui** | 47 components in `components/ui`, configured by `components.json`. Add more with `npx shadcn@latest add <name>`. |
| **shadcn MCP** | Registered in `.mcp.json` (`npx shadcn@latest mcp`). |
| **Figma MCP** | Registered in `.mcp.json` as `https://mcp.figma.com/mcp`. In Claude Code run `/mcp`, choose **figma** and **Authenticate**. |
| **Playwright MCP** | Registered in `.mcp.json` (`npx @playwright/mcp@latest`). The project's own Playwright suite is what runs the checks above. |
| **DESIGN.md** | The source of truth for tokens, type, spacing, motion and component rules. `npx @google/design.md lint DESIGN.md` checks it. |
| **UI UX Pro Max** | A snapshot of [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) in `.claude/skills/`. Try `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "chat app" --stack shadcn`. |
| **GSAP** | `gsap` and `@gsap/react` drive the entrance and hover motion, and honour reduced motion. |
| **21st.dev** | Not installed: it needs your sign-in. The current documentation uses `npx @21st-dev/cli@latest init --client claude --write`, then `login`. The `install <client> --api-key <key>` form is the older one. |
| **Ponytail** | Not installed. It is a Claude Code plugin (`/plugin marketplace add DietrichGebert/ponytail`, then `/plugin install ponytail@ponytail`, as two separate prompts), and it registers hooks that run on their own, so read them first. |

The first time you open the project in Claude Code it asks you to approve the servers in `.mcp.json`. [`TOOLKIT.md`](./TOOLKIT.md) explains what was evaluated and why most of it was left out.

## Keyboard

| Keys | Does |
| --- | --- |
| `Ctrl/Cmd + K` | Search chats and run commands |
| `Ctrl/Cmd + Shift + O` | New chat |
| `Ctrl/Cmd + ,` | Settings |
| `Ctrl/Cmd + B` | Show or hide the sidebar |
| `/` | Jump to the message box |
| `Enter` / `Shift + Enter` | Send / new line (switchable in Settings) |
| `Esc` | Close a dialog, a menu or full-screen artifact |

## Making it yours

- **Name and storage key:** `components/brand.tsx`, and `cyphor:v1` in `lib/store.ts`.
- **The Cyphor model names:** `lib/models/page.ts`. What a model is told (your name, style, custom instructions, memories, a project's files, the `<artifact …>` tag) is built in `lib/prompt.ts`.
- **Another provider:** add an entry to `lib/router/providers.ts`. Anything that speaks the OpenAI chat format needs only a name, a variable and a base URL.
- **Real accounts:** replace the visitor id in `proxy.ts`. The routes read it with `getOwnerId()`, so nothing else has to change.

## Good to know

- Chats, projects and settings live in this browser (`localStorage`, key `cyphor:v1`). Unless you turn it off in **Settings → Privacy and data**, a copy of every non-incognito chat is also kept in the app's database, so a reply finishes saving even if the tab is closed. **Incognito** chats are never saved anywhere.
- Theme switching uses the View Transitions API for the dial sweep. Browsers without it switch instantly.
- Effects can be Full, Subtle or Off in **Settings → Appearance**. The system's reduced-motion setting is honoured automatically.
