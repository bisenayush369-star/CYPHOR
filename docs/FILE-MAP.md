# File map

Every file in `cyphor-chat.zip` except three compiled `.pyc` files: 356 files, 170 of them required to run the app. They are grouped by the step of [APPLY-GUIDE.md](./APPLY-GUIDE.md) that needs them, with one line on what each one does. The same list with each file's fingerprint is in `docs/manifest.json`, which is what `docs/tools/verify-files.mjs` reads.

- **Lines** is the number of lines in the delivered file, so you can see at a glance when a file was cut short.
- **Optional** files are not needed to run the app.
- **Merge by hand** marks settings files you may have changed yourself. Keep your own changes, and add the Cyphor parts. See [APPLY-GUIDE.md](./APPLY-GUIDE.md) section 4.
- The paths are written with forward slashes, the way the checker prints them. They work in Windows PowerShell too.

## Step 1: Tooling and shared basics (15 files, 12 required)

Settings and the shared types. Nothing here depends on a later step.

| File | Lines | What it does |
| --- | --- | --- |
| `.env.example` | 75 | Every setting name with its default and a comment, and no values. Copy the names you need into `LLM.env` (keys) or `.env.local` (everything else). (merge by hand if you changed it) |
| `.gitignore` | 21 | Keeps `LLM.env`, `.env.llm`, `.env.local`, the local database (`.data/`), `node_modules/`, build output and test output out of git. (merge by hand if you changed it) |
| `.mcp.json` | 16 | Registers the shadcn, Playwright and Figma MCP servers for Claude Code. Neither the app nor Copilot uses it. (optional) |
| `components.json` | 21 | shadcn/ui settings: style `new-york`, Tailwind CSS variables, `lucide` icons, and the `@/components`, `@/lib` and `@/lib/hooks` aliases. (merge by hand if you changed it) |
| `drizzle.config.ts` | 16 | Settings for the optional `npm run db:generate`, `db:push` and `db:studio` commands. The app creates its own tables and does not need them. |
| `lib/env.d.ts` | 2 | Declares the `__STANDALONE__` flag that only the single-file preview build sets. |
| `lib/router/types.ts` | 160 | Types shared by the router (server) and the screens: providers, tiers, scores, `RouteInfo`, `CouncilInfo`, `StreamEvent`, `CatalogResponse`. Types only, no imports. |
| `lib/types.ts` | 128 | Types of the browser data: messages, chats, projects, attachments, settings and model definitions. |
| `lib/utils.ts` | 151 | Small helpers: `cn`, ids, time and size formatting, `downloadBlob` (saving a file) and `copyText`. |
| `next-env.d.ts` | 7 | Written by Next.js. Do not edit it. (optional) |
| `next.config.ts` | 10 | Next.js settings: strict mode, no `X-Powered-By` header, and the libsql client kept out of the server bundle (it ships a native binary). (merge by hand if you changed it) |
| `package-lock.json` | 11114 | The exact package versions that were installed and tested. `npm ci` installs from it. (optional) (merge by hand if you changed it) |
| `package.json` | 67 | Package list, scripts and the Node version the project needs (`>=22.18`). (merge by hand if you changed it) |
| `postcss.config.mjs` | 3 | Turns on Tailwind CSS 4 (`@tailwindcss/postcss`). (merge by hand if you changed it) |
| `tsconfig.json` | 27 | TypeScript settings: strict, unused imports and variables are errors, types need `import type`, and `@/*` points at the project root. (merge by hand if you changed it) |

## Step 2: Database, proxy and conversation API (14 files)

The database, the visitor and password gate, rate limits and the saved-conversation API. Depends on step 1.

| File | Lines | What it does |
| --- | --- | --- |
| `app/api/conversations/[id]/route.ts` | 108 | One saved conversation: `GET` loads it, `PUT` replaces it, `PATCH` changes title, star, project or model, `DELETE` removes it. |
| `app/api/conversations/route.ts` | 86 | The saved conversations: `GET` lists them, `POST` creates an empty one, `DELETE` removes all of this browser's conversations. |
| `db/index.ts` | 86 | Opens the libsql/SQLite database and creates the tables on first use (`BOOTSTRAP_SQL`). |
| `db/schema.ts` | 57 | drizzle table definitions: `conversations` and `messages`. |
| `lib/basic-auth.ts` | 57 | Reads `CYPHOR_BASIC_AUTH` and checks a sign-in header against it. |
| `lib/chat-messages.ts` | 532 | Converts a chat between the browser's tree, database rows and model messages, and validates what clients send (`LIMITS`, `checkChat`, `checkChatRequest`). |
| `lib/http.ts` | 51 | The shared front door of the API: `apiError`, `guard` (visitor id and rate limits) and `readJson` (size-capped body). |
| `lib/models/page.ts` | 38 | The six Cyphor model names, `DEFAULT_MODEL_ID`, and the helpers that accept a Cyphor model or a `provider:model` id. |
| `lib/rate-limit.ts` | 121 | In-memory rate limiter and the `X-RateLimit-*` headers. |
| `lib/retry.ts` | 114 | Retry with exponential backoff and full jitter, `HttpError` and `Retry-After` parsing. |
| `proxy.ts` | 129 | Runs before every request: password gate, anonymous visitor cookie, cross-site write refusal and security headers. |
| `tests/unit/basic-auth.test.ts` | 168 | 17 tests of the password gate in `proxy.ts`. |
| `tests/unit/register.mjs` | 38 | Lets `node --test` load the project's TypeScript: `@/` aliases, imports without an extension, and `next/server`. |
| `tests/unit/server-lib.test.ts` | 413 | 33 tests: retry, rate limits, chat conversion and validation, router metadata checks and the database. |

## Step 3: LLM router, God Mode and chat API (20 files)

The LLM router, God Mode and the chat and models API. Depends on steps 1 and 2.

| File | Lines | What it does |
| --- | --- | --- |
| `app/api/chat/route.ts` | 274 | `POST /api/chat`: answers one message and streams the reply as lines of JSON. Saves the turn as it goes. |
| `app/api/models/route.ts` | 39 | `GET /api/models`: connected providers, their models and what each Cyphor name uses now. `POST`: tests one provider's key. |
| `lib/mock.ts` | 613 | The built-in demo model. It answers when no provider is connected, and in the single-file preview. |
| `lib/openai.ts` | 256 | Streaming client for OpenAI-style chat APIs, `ProviderError`, and the fix-up for `max_tokens` against `max_completion_tokens`. |
| `lib/router/anthropic.ts` | 156 | Client for Anthropic's own Messages API, turned into plain text pieces. |
| `lib/router/catalog.ts` | 263 | Asks each provider for its models, turns the answers into profiles, and keeps them for 10 minutes. |
| `lib/router/env.ts` | 100 | Reads `LLM.env` and `.env.llm`, helpers that read variables, and `scrubSecrets`. |
| `lib/router/godmode.ts` | 196 | God Mode: choose a panel, draft in parallel, let a chair merge, and fall back when a step fails. |
| `lib/router/health.ts` | 83 | Remembers which providers and models are failing and rests them for a while. |
| `lib/router/index.ts` | 139 | The one import the API routes need: `prepare`, `catalogResponse`, `testProvider` and re-exports. |
| `lib/router/planner.ts` | 278 | Chooses the model: task detection, scoring, the Cyphor models, and panel and chair selection. |
| `lib/router/profiles.ts` | 302 | Rates a model from its id: tier and four scores, guesses for vision, thinking and context, display names. |
| `lib/router/provider-defs.ts` | 195 | The twelve provider definitions: names, key variables, addresses and starter models. No secrets. |
| `lib/router/providers.ts` | 65 | Which providers are switched on (from the environment) and the request headers of each. |
| `lib/router/router.ts` | 217 | Runs a plan: calls the model, fails over before the first word, records health. |
| `lib/router/web.ts` | 150 | TinyFish web search and page reading for grounded answers. |
| `lib/sse.ts` | 64 | Reads a server-sent-events stream. |
| `tests/unit/helpers/fake-provider.ts` | 142 | A small fake AI provider server that the router tests talk to. |
| `tests/unit/router-pure.test.ts` | 520 | 59 tests of the pure router parts: ratings, task detection, scoring, planning, health, env reading and key hiding, web parsing. |
| `tests/unit/router.test.ts` | 438 | 28 tests of the router against the fake provider: the model catalog, routing, failover, God Mode and testing a provider. |

## Step 4: Screens, components and browser logic (117 files, 47 of them the shadcn components)

Every screen, component and piece of browser logic, and the tests that need them. Depends on steps 1 to 3.

| File | Lines | What it does |
| --- | --- | --- |
| `components/ui/*.tsx` | 47 files | The shadcn/ui components (accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button-group, button, card, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty, form, hover-card, input-group, input, kbd, label, menubar, navigation-menu, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toast, toggle-group, toggle, tooltip). Library code: change the app's own components first. `components/ui/sidebar.tsx` is shadcn's sidebar, and the storage key `cyphor:sidebar` is set there. |
| `app/artifacts/page.tsx` | 8 | `/artifacts`: every artifact across chats. |
| `app/chat/[id]/page.tsx` | 6 | `/chat/<id>`: one conversation. |
| `app/chat/page.tsx` | 9 | `/chat`: the list of saved conversations. |
| `app/globals.css` | 514 | Design tokens (colours, type, spacing, motion), the reading surface and the syntax colours. (merge by hand if you changed it) |
| `app/icon.svg` | 1 | The favicon. |
| `app/layout.tsx` | 37 | Root layout: page title and description, viewport and theme colour, the no-flash script and the app shell. (merge by hand if you changed it) |
| `app/not-found.tsx` | 13 | The page for an address that does not exist. |
| `app/page.tsx` | 6 | `/`: the empty new-chat screen. |
| `app/projects/[id]/page.tsx` | 5 | `/projects/<id>`: one project. |
| `app/projects/page.tsx` | 8 | `/projects`: the list of projects. |
| `components/app-header.tsx` | 166 | Top bar: sidebar button, incognito mark and the chat's menu (move, rename, share, star and more). |
| `components/app-sidebar.tsx` | 326 | Sidebar: new chat, search, links to Chats, Projects and Artifacts, the chat list by day, starred chats, and a menu that opens Settings and Shortcuts. |
| `components/artifact-card.tsx` | 62 | The compact artifact card in a chat. Opening it docks the artifact beside the chat. |
| `components/artifact-panel.tsx` | 196 | The artifact panel: preview and code tabs, versions, copy, download, full screen. Docked on wide screens, an overlay on small ones. |
| `components/artifact-view.tsx` | 76 | Runs a generated page in a sandboxed frame with a strict content security policy. |
| `components/brand.tsx` | 24 | The logo mark and the wordmark. |
| `components/chat-view.tsx` | 130 | One conversation screen: the thread, the composer and the scrolling. |
| `components/cipher-disk.tsx` | 79 | The 26-notch cipher dial, the app's signature element. |
| `components/code-block.tsx` | 98 | Highlighted code with a copy button. |
| `components/command-palette.tsx` | 114 | The `Ctrl/Cmd + K` search and commands. |
| `components/composer.tsx` | 426 | The message box: attachments, options menu, web search and research switches, send and stop. |
| `components/dialogs.tsx` | 183 | The rename, share/export and new-project dialogs. |
| `components/home.tsx` | 137 | The new-chat screen: greeting and prompt ideas. |
| `components/icon-button.tsx` | 41 | Icon button with a tooltip and a toggle state. |
| `components/keys.tsx` | 14 | Shows a keyboard shortcut as separate keys. |
| `components/markdown.tsx` | 53 | Renders model output as Markdown. Raw HTML in the text is not interpreted. |
| `components/message.tsx` | 345 | One message: text, thinking, artifacts and the actions under it (copy, rate, retry, edit, versions, route chip). |
| `components/model-library.tsx` | 198 | The dialog that lists every model the connected providers offer, with tiers and scores. |
| `components/model-parts.tsx` | 96 | Small pieces for models: icons, provider mark, tier badge, score bars and tags. |
| `components/model-picker.tsx` | 128 | The model menu: the Cyphor models with what each uses now, and a way into the library. |
| `components/pages.tsx` | 679 | The Chats, Projects, Project and Artifacts screens. |
| `components/route-info.tsx` | 179 | The route chip, the God Mode council panel and the web source list under a reply. |
| `components/save-report.ts` | 13 | The toasts that say how a file save went. |
| `components/settings/appearance.tsx` | 133 | Settings, Appearance: theme, chat font and effects level. |
| `components/settings/capabilities.tsx` | 117 | Settings, Capabilities: switches, with the ones that need a backend listed apart. |
| `components/settings/connectors.tsx` | 53 | Settings, Connectors: a list of examples. Choosing one says it needs a backend. |
| `components/settings/dialog.tsx` | 110 | The settings dialog and its tab strip. |
| `components/settings/general.tsx` | 47 | Settings, General: your name and writing options. |
| `components/settings/model.tsx` | 381 | Settings, Model: where replies come from, your own LLM address, default model, reply length and standing instructions. |
| `components/settings/parts.tsx` | 148 | Shared building blocks of the settings pages (`Pane`, `Group`, `Field`, `ToggleRow`, ...). |
| `components/settings/privacy.tsx` | 209 | Settings, Privacy and data: server copy, incognito, backup export and import, delete. |
| `components/settings/router.tsx` | 270 | Settings, Router: provider status by variable name, key test, routing priority, God Mode panel size, web search. |
| `components/settings/shortcuts.tsx` | 49 | Settings, Shortcuts: the keyboard list. |
| `components/settings/styles.tsx` | 121 | Settings, Styles: response styles and your own. |
| `components/settings/usage.tsx` | 85 | Settings, Usage: how much browser storage the chats use. |
| `components/shell.tsx` | 366 | The frame around every screen: sidebar, header, artifact panel, command palette, settings, toasts. |
| `components/thinking.tsx` | 38 | The collapsible "thinking" block of a reply. |
| `lib/actions.ts` | 144 | What a click does: start a chat, send, edit, retry and stop a reply (one controller per chat). |
| `lib/catalog.ts` | 131 | What the screens know about the server: `useCatalog`, demo mode, model descriptions, connected providers. |
| `lib/defaults.ts` | 138 | Built-in response styles, connector examples, starter prompts and `DEFAULT_SETTINGS`. |
| `lib/export.ts` | 58 | Turns a chat or everything into Markdown or JSON for download. |
| `lib/files.ts` | 64 | Reads a chosen file into an attachment (text, or an image shrunk to a data URL). |
| `lib/hooks/use-media.ts` | 22 | Hooks for media queries: desktop width and coarse pointer. |
| `lib/hooks/use-mobile.ts` | 20 | Hook: is the screen below the `lg` breakpoint (1024 px)? |
| `lib/hooks/use-stick-to-bottom.ts` | 59 | Keeps a scrolling area pinned to the bottom while a reply streams. |
| `lib/import.ts` | 153 | Reads a backup file and returns only data that is safe to put in the store. |
| `lib/motion.ts` | 53 | The effects level (full, subtle, off) and helpers for the text-decode effect and the dial's notches. |
| `lib/no-flash.ts` | 21 | The small script that sets theme, font and effects on `<html>` before React starts. |
| `lib/parse.ts` | 212 | Splits a reply into text, thinking and artifact segments, and tracks artifact versions. |
| `lib/prompt.ts` | 58 | Builds the system prompt sent with every request. |
| `lib/provider.ts` | 164 | Starts a reply: through this app's `/api/chat`, straight to your own address, or the demo model in the preview. |
| `lib/route.ts` | 73 | The screens and the one place that turns a path into a screen name and back. |
| `lib/sample-catalog.ts` | 179 | Example providers and routing that only the single-file preview shows. Nothing is called. |
| `lib/store.ts` | 438 | The browser's data store (zustand, saved under `cyphor:v1`): chats as trees, projects and settings. |
| `lib/sync.ts` | 182 | Keeps a copy of saved chats on the server through `/api/conversations`. The browser stays the main copy. |
| `lib/theme.ts` | 101 | Applies the theme to `<html>` and runs the dial sweep when it changes. |
| `lib/ui.ts` | 119 | Screen state that is not saved (open dialogs, settings tab, artifact view) and the shortcut labels (`isMac`, `MOD`). |
| `tests/unit/import.test.ts` | 147 | 10 tests of backup import. |
| `tests/unit/sample-catalog.test.ts` | 203 | 14 tests of the preview's sample providers and routing. |
| `tests/unit/save-file.test.ts` | 122 | 9 tests of saving a file in the browser and in the preview's page frame. |

## Step 5: Browser tests (7 files)

The browser tests. They build the app and start their own servers. Depends on steps 1 to 4.

| File | Lines | What it does |
| --- | --- | --- |
| `playwright.config.ts` | 59 | Playwright setup: desktop, tablet and phone projects, and the three test servers. |
| `tests/e2e/a11y.spec.ts` | 54 | axe-core accessibility scans of the main screens and every settings section, light and dark. |
| `tests/e2e/app.spec.ts` | 266 | The browser suite for the app: send, stream, stop, edit, artifacts, settings, themes, backup, layout from 320 to 1920 px. |
| `tests/e2e/fake-llm.mjs` | 125 | A fake AI provider and web search for the browser tests. It never sees a real key. |
| `tests/e2e/helpers.ts` | 125 | Shared helpers and selectors for the browser tests. |
| `tests/e2e/router.spec.ts` | 572 | The browser tests of the router: providers, picker, routing, God Mode, web sources, failover and the API. |
| `tests/e2e/servers.mjs` | 104 | Builds the app and starts the three servers the browser tests need (ports 4173, 4174, 4599). |

## Project docs (optional) (5 files, 0 required)

Not needed to run the app.

| File | Lines | What it does |
| --- | --- | --- |
| `DESIGN.md` | 385 | The design system: tokens, type, spacing, motion and component rules. (optional) |
| `README.md` | 224 | The project's own readme. (optional) |
| `TOOLKIT.md` | 77 | Which design and agent tools were evaluated and what was left out. (optional) |
| `file-tree.txt` | 14671 | Every file, who imports whom, and what each route pulls in. Rewritten by `npm run tree`. (optional) |
| `scripts/file-tree.mjs` | 317 | Writes `file-tree.txt`. (optional) |

## Single-file preview build (optional) (6 files, 0 required)

Only for `npm run build:preview`, the one-file demo. Not needed to run the app.

| File | Lines | What it does |
| --- | --- | --- |
| `preview/index.html` | 23 | Page for the single-file preview build. (optional) |
| `preview/main.tsx` | 50 | Starts the app inside the preview, with the demo model. (optional) |
| `preview/preview.css` | 18 | The few styles the preview adds on top of the app's. (optional) |
| `preview/shims/link.tsx` | 15 | Stand-in for `next/link` in the preview. (optional) |
| `preview/shims/navigation.ts` | 46 | Stand-in for `next/navigation` in the preview. (optional) |
| `preview/vite.config.ts` | 29 | Builds the whole app into one HTML file (`npm run build:preview`). (optional) |

## Optional: design skills for Claude Code (172 files)

A snapshot of the UI UX Pro Max skill and the skills that came with it. They are git-ignored, they are not part of the app, and Copilot does not use them. The zip also has three compiled `__pycache__/*.pyc` files in `.claude/skills/ui-ux-pro-max/scripts/__pycache__/`; they are not in the file list and can be deleted.

| Folder | Files |
| --- | --- |
| `.claude/skills/banner-design/` | 2 |
| `.claude/skills/brand/` | 18 |
| `.claude/skills/design/` | 35 |
| `.claude/skills/design-system/` | 27 |
| `.claude/skills/slides/` | 6 |
| `.claude/skills/ui-styling/` | 16 |
| `.claude/skills/ui-ux-pro-max/` | 68 |

