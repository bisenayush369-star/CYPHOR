# Cyphor

Cyphor is a chat app for the AI keys you already have, set in a night city. You sign in with an email address or a Google account. Your chats are kept in your own Neon database. Each message goes through a router that can use twelve providers, and the reply thinks before it answers. When a model builds something (a web page, a React component, a diagram, an SVG), it opens beside the chat with a live preview, the source, and one button that copies all of the code.

It is a Next.js app. The screens run in your browser. A small server keeps your provider keys, talks to the providers for you, and stores accounts and chats in Postgres. A key is never sent to the browser.

With no provider connected, a built-in demo model answers, so every screen can be tried straight away.

- **Sign-in.** Email and password, or Google. Accounts, sessions and chats live in Neon Postgres.
- **A model menu in the style of Claude's.** One button in the message box shows the model and the effort. It opens a small panel with the model in use, an Effort row, and a way into every model your providers offer, with search.
- **Thinking first.** At the default effort (Medium) and at High, the reply works the question through in a folding Thinking block before the answer. At Low it answers at once.
- **A router and God Mode.** One name picks the best connected model for each message and moves on to another if a provider fails. God Mode asks several providers at once and merges their drafts.
- **Artifacts.** Pages, React components, SVGs, diagrams and files open in a panel beside the chat with Preview, Code and Split views and a Copy code button.
- **The look.** Colours from Cyberpunk 2077 and the genre around it, in eight themes, with a live 3D night city behind the chat that you can keep or turn off. With the city off, a different theme loads on every refresh.

[`DESIGN.md`](./DESIGN.md) records the look: colours, type, shapes, motion and the contrast that was measured. [`TOOLKIT.md`](./TOOLKIT.md) records which design and agent tools were evaluated and what each one changed. [`docs/ACCEPTANCE.md`](./docs/ACCEPTANCE.md) lists each thing that was asked for next to the evidence for it, and says what has not been tested.

## Start here

You need Node 22.18 or newer (`node --version`) and a Neon database ([steps below](#make-the-neon-database)).

```bash
npm install
```

Create a file named `.env.local` next to `package.json` with your Neon connection string in it:

```text
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

```bash
npm run dev          # http://localhost:3000
```

Open <http://localhost:3000>. You arrive at the sign-in page. Choose **Create account** and you are in. The tables are created the first time the app connects, so there is nothing to migrate.

To look around before you have a Neon account, use `DATABASE_URL=pglite://./.data/pg`. That runs a Postgres inside the app and keeps it in the `.data` folder. It is for trying the app, not for a server other people use.

Add your provider keys when you are ready: [Connect your AI providers](#connect-your-ai-providers).

## Make the Neon database

1. Sign up at neon.com and create a project. Pick the region closest to where the app will run.
2. On the project page click **Connect**. Leave the branch, database and role on their defaults and keep **Connection pooling** switched on. The host in the string then contains `-pooler`.
3. Copy the string into `.env.local` as `DATABASE_URL`. When you put the app on a server, set the same value in that host's environment settings.

Things worth knowing:

- Paste the string as Neon shows it. Neon needs an encrypted connection, and Cyphor always checks the server's certificate on a Neon address (`sslmode=verify-full`), whichever `sslmode` the string says.
- Neon pauses a database that has been idle. The first request afterwards can take a few seconds while it wakes, and the app waits up to 20 seconds. If the connection fails, the screen says Cyphor can't reach its database, and the server log has the driver's reason.
- Each server process holds up to 5 connections (`DATABASE_POOL_MAX`). Neon limits connections and a serverless host starts many copies of the app, so keep this small.
- Cyphor creates six tables: `user`, `session`, `account` and `verification` for sign-in, and `conversations` and `messages` for chats. Set `DB_AUTO_MIGRATE=0` if you would rather manage them yourself with `npm run db:push`.

## Sign-in

- **Email and password.** At least 8 characters. Only a hash of the password is stored. Sessions last 30 days. No email is sent, so there is no email confirmation and no "forgot password" link yet. The sign-up form says to keep the password somewhere safe.
- **Google.** In the Google Cloud console open APIs & Services, then Credentials, and create an OAuth client ID of type Web application. Add the redirect URI `<your address>/api/auth/callback/google`, for example `http://localhost:3000/api/auth/callback/google` on your own machine. Put the client ID and secret in `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Until both are set, the button is switched off while you develop (it says why) and hidden on a live server.
- **Who sees what.** A signed-out visitor is sent to the sign-in page and returns to the page they asked for afterwards. API calls without a session answer 401. Every account has its own chats, projects and settings, and one account cannot read or change another's (the tests try this with a second account, and with a guessed conversation id).
- **On a live server** set `BETTER_AUTH_SECRET` (at least 32 characters; `openssl rand -base64 32` makes one) and `BETTER_AUTH_URL` (the public address, for example `https://chat.example.com`). Without the secret nobody can sign in, and the screen says which setting is missing. While you develop, a random secret is made for you and kept in `.data/auth-secret`. `TRUSTED_ORIGINS` adds more addresses that may sign in, separated by commas.
- Sign-in uses Better Auth's own rate limiter at its defaults. `AUTH_RATE_LIMIT=off` switches it off for tests.

## Connect your AI providers

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

**Settings → Router** shows each connected provider by the name of its variable, lets you send one tiny test message to prove a key works, and lets you switch a provider off without deleting its key. It also sets the routing priority (Balanced, Fastest, Best quality or Free first) and the God Mode panel size.

## The model menu and thinking

Click the model name in the message box. The panel shows the model in use with what it is for and a check mark, an **Effort** row, and **More models**, which lists every model your connected providers offer, with search. The three views replace each other inside the panel, so on a phone there is never a second layer on top of it.

| Pick in the model menu | What happens |
| --- | --- |
| **Cyphor Auto** | Judges the message (general, code, reasoning, creative or quick) and picks the connected model that suits it best, weighted by your priority. |
| **Cyphor Swift, Core, Deep, Code** | The fastest, the balanced, the deepest-thinking and the strongest-coding model you have connected. The menu says which one each is *right now*. |
| **God Mode** | One strong model from each connected provider answers at the same time, up to the panel size (4 by default, at most `GODMODE_MAX_PANEL`). A chair model then merges the drafts into one reply, and the screen shows who was asked, who answered and who merged. |
| **A model by name** (from More models) | Exactly that model. If it fails, you are told. It never quietly switches to another one. |

Each model gets a tier (flagship down to mini) and four scores out of ten (reasoning, coding, writing, speed). The scores are estimates from the model's family and size, not benchmark results, so they say where to start.

### Effort

| Effort | What it does |
| --- | --- |
| **Low** | Answers right away, short and direct. The router leans on the fastest models. |
| **Medium** (the default) | Thinks the question through before it answers. |
| **High** | Thinks deeply and checks its work. Models that can reason are used for it, and the router leans on quality. |

A routing priority you chose in Settings → Router wins over the one effort would pick. Cyphor Deep always thinks first, whatever the effort.

The thinking appears in a folding **Thinking** block above the answer. It shows a running time while the model works and reads "Thought for 8s" when it is done. Open it to read how the model got there. This works with any provider: the model is asked to put its reasoning inside `<thinking>` tags, and Cyphor shows that part in the block.

### How a message is routed

For the Cyphor names, a failure *before the first word* moves on to the next candidate, and the chip under the reply says it switched. A failure after text has started is shown as an error, because the words already on screen cannot be taken back. Providers that fail repeatedly are rested for a while: a rejected key for five minutes, a missing model for ten, a rate limit only for that model. Every reply keeps a small chip saying which model wrote it and why.

Two limits to know. **God Mode multiplies your usage:** every message costs about as many requests as the panel size plus one. And **no provider has been called live from this repository's tests.** They run against fake servers (see [Tests](#tests)), so the first real message is the first real check of each provider's address and key.

### Web search

With `TINYFISH_API_KEY` set, the **Web search** and **Research** switches in the message box ground the reply in pages found on the web, and the sources appear under it. Without the key the reply says so instead of pretending.

### Your own LLM, straight from the browser

**Settings → Model → Your own LLM** talks from the browser directly to an OpenAI-style address you type in. That keeps the key in this browser's storage, so use it for a server on your own machine, not for a paid key. For a paid key, use `LLM.env`.

## Artifacts

When a model writes something worth keeping, it puts it in an `<artifact>` block (the model is told how in `lib/prompt.ts`). The block becomes a card in the reply, and the artifact opens in a panel beside the chat on a wide screen, or over the chat on a small one.

- **Kinds.** Web pages (HTML), React components, SVG, Mermaid diagrams, Markdown and plain code. A reply can hold several, and when a model rewrites an artifact the panel keeps each version under **Version 1, 2, …**.
- **Views.** **Preview**, **Code** and **Split**. Split puts the code and the preview side by side. It appears when the panel is at least 880 px wide, which on most screens means full screen, and never on a phone.
- **Copy code** copies the whole file in one click. The same button is on the card in the chat. **Download** saves it under the artifact's own name, **Full screen** fills the window, and **Reload preview** runs it again.
- **How it runs.** HTML and React run inside a sandboxed frame that has no access to Cyphor, your chats or your cookies. The page in the frame cannot make network requests of its own or submit forms. It can load scripts, styles and fonts from a short list of CDNs (cdnjs, jsDelivr, unpkg, esm.sh, Tailwind, jQuery, Google APIs and Bootstrap), and images over https.
- **React artifacts** use a runtime that Cyphor serves itself from `public/artifact/`: React 19, a JSX compiler (sucrase), lucide-react icons, Recharts and clsx, plus Tailwind's browser build. They do not depend on a CDN. [`public/artifact/README.md`](./public/artifact/README.md) says where each file comes from and how to rebuild it.
- **Mermaid diagrams** load Mermaid 12.3.0 from jsDelivr with an integrity check, so they need an internet connection. If the file does not match its hash, the panel says so instead of running it.
- **When a preview breaks** the error is shown above it with a **Fix with Cyphor** button. It sends the error back to the model, which replies with a new version.

## The look

The colours come from Cyberpunk 2077 and the genre around it: cyan, yellow, magenta, red, orange, green, violet and blue. They colour the code, the provider marks and the icons as well as the interface. No picture, logo or artwork from the game is used. The city and every shape are drawn in code.

### Themes

Eight themes: **Night City** (the default), **Redline**, **Neon Rain**, **Afterglow**, **Toxic**, **Voltage**, **Solar Flare** and **Violet Dusk**. Pick one in **Settings → Appearance → Colour theme**, or choose **Every refresh** and a different theme loads each time you reload the page. It never repeats the one you saw last. The theme is applied before the first paint, so the page does not flash in the wrong colours.

### The moving city

Behind the chat there is a live night city: towers with lit windows and neon edges, signs (in Japanese lettering when your device has a Japanese font), rain, a wet street that reflects the lights, flying cars with their own lights, fog and glow. It is built from code with three.js on WebGL 2, with no model or image to download. Every start builds a different city, and blocks are rebuilt ahead of the view as the old ones pass, so the street does not repeat.

The first time you open the home screen Cyphor asks **Keep the moving city?** You can answer **Keep the city**, or **No city, change themes**, which turns the city off and shows a different theme on every refresh. You can change your mind in **Settings → Appearance → Background**.

A city that stutters is worse than no city, so Cyphor checks that it can run it:

- It does not start in the light theme (the city is a night scene), without WebGL 2, or when the browser draws graphics on the CPU. On a CPU renderer a frame takes seconds, and the page would freeze. The question and Settings say which of these it is.
- It starts at a quality level chosen for the device (low, medium or high) and watches the time between frames. If the device cannot keep up, it steps down one level, and it never steps back up in the same session. If even the lowest level is too slow, it stops and shows the plain background. The level it settled on is remembered for three days.
- It pauses while the tab is hidden. With **Effects** set to Subtle it moves slowly at half the frame rate, and with Effects Off, or when your device asks for reduced motion, it draws one still frame.
- `?city=low`, `?city=medium` or `?city=high` on the address fixes the quality for that tab and turns the checks off. It is meant for tests and screenshots.

## Keep it private

- **Keys stay on the server.** They are read from `LLM.env` or the environment, never sent to the browser, and every error message passes through a filter that hides a key a provider repeats back. `LLM.env` and `.env.llm` are git-ignored. If a key was ever pasted into a chat, a screenshot or a commit, rotate it.
- **Everyone signs in.** Pages send a signed-out visitor to the sign-in page and the API answers 401. Each account's chats are stored under that account. Anyone can create an account on a server that is open to the internet, so decide whether that is what you want. To keep a server to people you trust, set a shared password in front of the whole app as well:

  ```text
  CYPHOR_BASIC_AUTH=name:password
  ```

  Put it in `.env.local` or the real environment. Every page and API call then asks for it (the browser shows its own sign-in box) before the sign-in page appears. Wrong guesses are counted per address. After 10 in a minute (`RATE_LIMIT_AUTH_PER_MIN`) that address is turned away until the oldest of them is a minute old, even if its next guess is right. The address is read from `X-Forwarded-For` when a proxy sets it, so that header must be set by a proxy you trust. A value that is set but is not `name:password` locks the app with a 503 instead of opening it. This is one shared password, not user accounts, and Basic sign-in sends it with every request, so serve the app over HTTPS. The static files (`/_next/static`, `/_next/image`, the icon and `/artifact/`) are not behind it.
- **Requests are limited** for each signed-in person: 20 chats a minute, 120 other calls, and 6 God Mode messages (`RATE_LIMIT_CHAT_PER_MIN`, `RATE_LIMIT_API_PER_MIN`, `RATE_LIMIT_GOD_PER_MIN`). A second, wider limit by address (five times as many) stops a person getting a fresh allowance by signing up again. The counters live in memory, so they are per server process.
- **Writes must come from this site.** A request that changes anything and carries an `Origin` from another site is refused with a 403.
- **Your chats on the server** are stored in your own database, and the copy can be switched off in **Settings → Privacy and data**.

## Put it on the internet

Cyphor is a standard Next.js app, so a host that runs Node 22 or newer can serve it with `npm run build` and then `npm run start`. It has not been deployed to a host from here, so treat the first deploy as a test. Set these in the host's environment settings, not in a file you commit:

| Setting | Why |
| --- | --- |
| `DATABASE_URL` | Your Neon connection string. |
| `BETTER_AUTH_SECRET` | Signs sign-in sessions. Without it nobody can sign in. |
| `BETTER_AUTH_URL` | The public address, such as `https://chat.example.com`. Sign-in and Google both depend on it. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Only for Continue with Google. Add `https://chat.example.com/api/auth/callback/google` as a redirect URI in the Google console. |
| Your provider keys | The same names as in `LLM.env`. A host that builds from git never receives your git-ignored `LLM.env`, so set real environment variables there. |

The chat route is allowed to run for up to 300 seconds, and some hosts cap a request at less than that. A long God Mode answer needs a plan that allows it. Set `CYPHOR_BASIC_AUTH` as well if the server should not be open to anyone who finds it.

## Settings reference

All optional. Put them in `.env.local` (or the real environment), not in `LLM.env`.

| Variable | Default | What it does |
| --- | --- | --- |
| `DATABASE_URL` | none | A Postgres address. Neon, or `pglite://./.data/pg` (kept in a folder) or `pglite://memory` (gone when the server stops) |
| `DATABASE_POOL_MAX` | 5 | Connections each server process holds |
| `DB_AUTO_MIGRATE` | on | `0` stops the app creating its own tables |
| `BETTER_AUTH_SECRET` | made for you while developing | At least 32 characters. Required in production |
| `BETTER_AUTH_URL` | worked out from the request | The public address. `APP_URL` is read when this is not set, and is also sent to OpenRouter as the referrer (default `http://localhost:3000`) |
| `TRUSTED_ORIGINS` | none | More addresses allowed to sign in, comma separated |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | none | Turn on Continue with Google |
| `CYPHOR_BASIC_AUTH` | off | `name:password`, see above |
| `ROUTER_FIRST_BYTE_MS` | 25000 | How long to wait for a first word before trying another model |
| `CATALOG_TTL_SEC` | 600 | How long the model lists are remembered |
| `GODMODE_MAX_PANEL` | 6 | Most providers asked at once (the settings slider goes up to this; its default is 4) |
| `GODMODE_DRAFT_MS` | 45000 | Stop waiting for drafts after this long |
| `GODMODE_GRACE_MS` | 8000 | Extra wait for slow providers once enough drafts are in |
| `RATE_LIMIT_CHAT_PER_MIN` | 20 | Chat requests per person per minute |
| `RATE_LIMIT_API_PER_MIN` | 120 | Other API calls per person per minute |
| `RATE_LIMIT_GOD_PER_MIN` | 6 | God Mode messages per person per minute |
| `RATE_LIMIT_AUTH_PER_MIN` | 10 | Wrong shared passwords per address per minute |
| `LLM_ENV_DISABLE` | | `1` ignores `LLM.env`, so automated tests never pick up real keys |
| `AUTH_RATE_LIMIT` | | `off` turns off the sign-in rate limit. For tests only |

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run typecheck` | `tsc --noEmit` (TypeScript 7, about ten seconds) |
| `npm run test:unit` | Node's test runner: router, God Mode, effort, auth, API routes, rate limits, the city's quality rules and layout, themes, artifacts, backup import |
| `npm run test:e2e` | Playwright and axe-core in a real browser (see [Tests](#tests)) |
| `npm test` | Both |
| `npm run build:palettes` | Rewrites `app/palettes.css` from `lib/scene/palettes.ts`. A unit test fails if the file is stale |
| `npm run build:artifact-runtime` | Rebuilds `public/artifact/runtime.js`, the React runtime the artifact preview uses |
| `npm run db:generate`, `db:push`, `db:studio` | drizzle-kit, configured by `drizzle.config.ts`. The app does not need them: it creates its own tables. Set `DATABASE_URL` in your shell first |
| `npm run tree` | Rewrites `file-tree.txt`: every file, who imports whom, and what each route pulls in (about 10,000 lines, because each route repeats its whole tree) |
| `npm run build:preview` | One self-contained `dist-preview/index.html` that opens straight from disk, with a demo model, no sign-in and no server |

There is no linter configured. Type errors, the unit tests, the production build and the browser tests are the checks.

## Project layout

```text
app/                   Next.js App Router
  page.tsx             /          the new-chat screen
  login/               /login     sign in and create account
  chat/ projects/ artifacts/      the other screens
  api/auth/            Better Auth: sign-in, sign-out, Google, session
  api/chat/            POST: one reply, streamed as lines of JSON
  api/conversations/   saved chats
  api/models/          GET: what is connected and what each Cyphor name means now. POST: test one provider
  globals.css          Night City's colours, reading surface, motion, syntax colours
  cyber.css            the shapes: chamfered corners, brackets, plates, hazard stripe
  palettes.css         generated: the other seven themes (do not edit; npm run build:palettes)
components/            screens and pieces
  ui/                  47 shadcn components (new-york style, Tailwind v4)
  settings/            the ten settings sections, Router and Appearance among them
  city-background.tsx  starts, watches and stops the city
  scene-choice.tsx     the "Keep the moving city?" question
  model-picker.tsx     the model menu with Effort
  thinking.tsx         the folding Thinking block
  artifact-*.tsx       the card, the panel and the sandboxed view
db/                    drizzle schema and the Postgres connection (Neon, or PGlite for trying)
lib/
  auth.ts, session.ts  Better Auth, and who is calling
  account.ts           what the screens know about the signed-in person
  router/              providers, model profiles, planner, effort, failover, health, God Mode, web tool, LLM.env reader
  scene/               themes (palettes.ts), colour maths, the city (city/engine.ts, governor.ts, layout.ts) and its status
  artifact/            kind detection, and the page the sandboxed frame loads
  store.ts, sync.ts    chats, projects and settings in the browser, and their copy on the server
  catalog.ts           what the server says it can do, for the screens
  mock.ts              the demo model
proxy.ts               runs before every request: shared password, sign-in redirect, cross-site check, headers
public/artifact/       the React runtime and Tailwind's browser build for artifacts
scripts/               file-tree.mjs, build-palettes.mjs, build-artifact-runtime.mjs
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

The browser suite runs on a desktop (1440 × 900), a tablet (768 × 1024) and a phone (390 × 844). It is split into seven files:

| File | Covers |
| --- | --- |
| `app.spec.ts` | Sending, streaming, stopping, rating, retrying, editing into a new branch, reloading, every settings section, theme switching, the command palette, backup export and import, reduced motion, and that nothing scrolls sideways from 320 px to 1920 px |
| `login.spec.ts` | The redirect to sign-in and back, creating an account, signing in and out, wrong passwords, a second person on the same browser not seeing the first person's chats, the 401 for the API, and an axe scan of the login page |
| `thinking.spec.ts` | Medium thinks first with the Thinking block open while it works and folded after, Low answers at once, Cyphor Deep always thinks first, High is kept after a reload and can be set from the model menu or Settings, and axe scans of the Effort view and of a reply with its thinking open and folded |
| `artifacts.spec.ts` | Copy code, Download, Split, the panel following the code as it is written, React with Tailwind and a chart, SVG, a diagram (see the note below), a page in a plain code block, and Fix with Cyphor |
| `city.spec.ts` | The first-run question, the themes and the Every refresh rotation, Settings → Appearance, and the city itself (see the note below) |
| `router.spec.ts` | The provider list, the picker and library, automatic routing, a fixed model, God Mode (including a partial panel), web sources, failover and failures, and the API itself |
| `a11y.spec.ts` | axe-core (WCAG 2.0, 2.1 and 2.2 A and AA plus best-practice rules, light and dark) over the home screen, a chat with a table, a chat with code, an artifact and its code view, a preview with an error, the command palette and every settings section |

**No real key, provider, Neon database or Google account is used.** `tests/e2e/servers.mjs` starts three servers, and both Cyphor servers keep their data in memory (`DATABASE_URL=pglite://memory`):

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
- **About the city tests.** They were written and run on a machine with no graphics card, where the browser draws WebGL on the CPU and Cyphor refuses the city on purpose. There they check that the city either runs or says why it does not, and a pinned `?city=low` run with reduced motion checks that it starts and draws one frame. On a machine with a graphics card the test for the refusal skips itself. How smoothly the city runs on real graphics hardware has not been measured.
- **About the diagram test.** Drawing a Mermaid diagram needs the CDN, so that test skips itself on a machine that cannot reach it. It was skipped in the container these tests were run in, so the diagram path was checked there only for the refusal of a file with the wrong hash.
- Some tests skip themselves on a phone or tablet (a hardware keyboard, a file picker) or on a desktop (the drawer), and say why. The runs behind this README had 337 passes and no failures across the three sizes, and 58 skips of that kind.

## Tools behind it

[`TOOLKIT.md`](./TOOLKIT.md) has the full table of what was evaluated, what each tool changed and what was left out. In short:

| Tool | State |
| --- | --- |
| **shadcn/ui** | 47 components in `components/ui`, configured by `components.json`. Add more with `npx shadcn@latest add <name>`. |
| **shadcn, Playwright and Figma MCP** | Registered in `.mcp.json`. The first time you open the project in Claude Code it asks you to approve them. For Figma, run `/mcp`, choose **figma** and **Authenticate**. |
| **DESIGN.md** | The source of truth for colour, type, shape, motion and component rules. `npx @google/design.md lint DESIGN.md` checks it, and it passes with no errors or warnings. |
| **UI UX Pro Max** | A snapshot of [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) in `.claude/skills/`. Try `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "chat app" --stack shadcn`. |
| **Impeccable, unslop, humanizer, unlazy** | Their rule lists and practice were applied by hand to the interface, the writing and the acceptance ledger. The Impeccable detector was not run, and none of the four was installed. |
| **Hallmark, diagram-design, Rea, last30days-skill, Scrapling, Onyx** | Read and not used. Onyx is a reference only. |
| **21st.dev** | Not installed: it needs your sign-in. The current documentation uses `npx @21st-dev/cli@latest init --client claude --write`, then `login`. |
| **Ponytail** | Not installed. It is a Claude Code plugin that registers hooks which run on their own, so read them first. It needs your approval. |

## Keyboard

| Keys | Does |
| --- | --- |
| `Ctrl/Cmd + K` | Search chats and run commands |
| `Ctrl/Cmd + Shift + O` | New chat |
| `Ctrl/Cmd + ,` | Settings |
| `Ctrl/Cmd + B` | Show or hide the sidebar |
| `/` | Jump to the message box (when you are not typing in a field) |
| `Enter` / `Shift + Enter` | Send / new line (switchable in Settings) |
| `Esc` | Close a dialog, a menu or full-screen artifact |

## Making it yours

- **Name and storage key:** `components/brand.tsx`, and the `cyphor:v1` key in `lib/store.ts`.
- **Colours:** Night City is written by hand in `app/globals.css`. The other seven themes are in `lib/scene/palettes.ts`. After editing that file run `npm run build:palettes`.
- **The Cyphor model names:** `lib/models/page.ts`. What a model is told (your name, style, custom instructions, memories, a project's files, the effort and the `<artifact …>` tag) is built in `lib/prompt.ts` and `lib/router/effort.ts`.
- **Another provider:** add its id to `ProviderId` in `lib/router/types.ts` and an entry to `lib/router/provider-defs.ts`. Anything that speaks the OpenAI chat format needs only a name, a variable and a base URL.
- **The city:** `lib/scene/city/`. `layout.ts` decides the streets, `engine.ts` draws them, and `governor.ts` decides when to draw less.

## Good to know

- Chats, projects and settings live in this browser (`localStorage`, one copy for each account under the key `cyphor:v1:<user id>`). Unless you turn it off in **Settings → Privacy and data**, a copy of every chat is also kept in your database, so a reply finishes saving even if the tab is closed and your chats follow you to every device you sign in on.
- **Not tested live:** Neon, Google sign-in and real providers. The tests use an in-memory Postgres, a fake Google setting and fake providers. The first run with your own values is the first real check, so try one sign-up, one Google sign-in and one message to each provider you care about.
- The city draws only on a graphics card. A browser that draws WebGL on the CPU, which includes many virtual machines and some remote desktops, gets the themes instead.
- Mermaid diagrams need a network connection. The React runtime for artifacts is about 1.8 MB and loads only when a React artifact opens.
- **Update Next.js before you put the app on the internet.** `npm audit` reports six advisories against the installed Next.js 16.4.3, all fixed in 16.4.5 and later, and `next build` prints a reminder about it. `package.json` already allows the fix (`^16.4.3`), so `npm update next` followed by `npm run build` applies it. The advisories concern the `use cache` feature, the image optimizer, the Edge runtime and forwarded `fetch` responses. A search of the source found no use of the first three, and the last one was not assessed. This project did not make the upgrade, because it changes your dependencies and needs your approval. The first `next build` or `next dev` after an install can also end with an error even though the build finished; run the command again.
- `npm audit` also lists moderate advisories in `drizzle-kit` (through `esbuild`) and `shadcn` (through `minimatch`). Both are development dependencies that do not run on a server, and the fixes npm suggests are major version changes, so they were left alone.
- Theme switching uses the View Transitions API for the dial sweep. Browsers without it switch instantly.
- `gsap` drives the scrambled-text effect on chat titles in the sidebar (`lib/motion.ts`). `@gsap/react` is installed and unused, and `npm uninstall @gsap/react` removes it.
