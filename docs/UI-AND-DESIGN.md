# UI and design

What the screens are, what each setting does, the keyboard shortcuts, the effects, and where the colours and type live. For the tokens themselves, `DESIGN.md` in the project root is the source of truth; this page says how the app uses them.

## 1. Screens

| Address | Screen | File |
| --- | --- | --- |
| `/` | The empty new-chat screen: greeting, starter prompts, the message box | `app/page.tsx` |
| `/chat` | The list of saved conversations | `app/chat/page.tsx` |
| `/chat/<id>` | One conversation | `app/chat/[id]/page.tsx` |
| `/projects` | The list of projects | `app/projects/page.tsx` |
| `/projects/<id>` | One project: its own instructions and its chats | `app/projects/[id]/page.tsx` |
| `/artifacts` | Every artifact from every chat | `app/artifacts/page.tsx` |

Every screen is drawn inside one shell (`components/shell.tsx`). The pieces:

- **Sidebar** (`app-sidebar.tsx`). Docked from 1024 px wide (the `lg` breakpoint); below that it opens as a drawer, so tablets keep a full-width chat. `Cmd/Ctrl + B` shows or hides it.
- **Message box** (`composer.tsx`). Text, files (drag them in; up to 20 per message), the `+` menu with the web search, research and thinking switches, and a chip for each switch that is on.
- **Model menu** (`model-picker.tsx`) lists Cyphor Auto, Swift, Core, Deep, Code and God Mode, and says which real model each one would use right now. **Model library** (`model-library.tsx`) lists every model of every connected provider with its tier and scores; a model of a provider that is switched off is shown dimmed, and still can be picked.
- **Reply** (`message.tsx`). Markdown with code blocks, a collapsible thinking block, a note of how the reply was routed (`route-info.tsx`: the model that answered, the God Mode council, web sources), copy, retry, edit, thumbs and branch arrows for edited or retried versions.
- **Artifact panel** (`artifact-panel.tsx`). A reply can contain an `<artifact>`; on screens 1024 px or wider it opens beside the chat by itself.
- **Command palette** (`command-palette.tsx`), `Cmd/Ctrl + K`: search chats and run commands.
- **Settings** (`components/settings/dialog.tsx`), `Cmd/Ctrl + ,`: ten tabs (next section).

## 2. Settings, tab by tab

| Tab | What is in it |
| --- | --- |
| General | Your display name. Send with Enter. Open thinking blocks by default. |
| Appearance | Theme: Light, Dark, Match device. Chat font: Serif, Sans, Easy to read. Effects: Full, Subtle, Off. |
| Model | Source: **Cyphor server** (the default, through this app's server) or **Your own LLM** (straight from the browser to a base URL and key you type). Model list, temperature, maximum reply length, system prompt. |
| Router | Which providers are connected and a Test button for each. Routing priority: Balanced, Fastest, Best quality, Free first. God Mode panel size, 2 to 6 (default 4). Whether web search has a key. The four set-up steps. |
| Capabilities | Extended thinking and Artifacts. Web search, Research and Memory (a list of notes that is added to the system prompt). The same switches are in the `+` menu of the message box. |
| Styles | Built-in response styles (Normal, Concise, Explanatory, Formal, Learning) and your own. |
| Connectors | A switch for each of five example apps (cloud drive, code repository, calendar, email, notes). They add an entry to the `+` menu and show the flow, but fetch nothing: reading from those services needs an integration on your server, and none is built. |
| Privacy | Server copy (on by default), Incognito, export and import of a backup, delete saved chats, erase everything. |
| Usage | What is stored on this device: chats, projects, messages, artifacts, storage used. Nothing here is billed. |
| Shortcuts | The list below. |

The defaults are in `DEFAULT_SETTINGS` (`lib/defaults.ts`). Settings are stored in the browser only (`cyphor:v1`); they are not on the server.

## 3. Keyboard shortcuts

`Mod` is `Cmd` on a Mac and `Ctrl` elsewhere.

| Keys | Does |
| --- | --- |
| `Mod + K` | Search chats and run commands |
| `Mod + Shift + O` | Start a new chat |
| `Mod + ,` | Open settings |
| `Mod + B` | Show or hide the sidebar |
| `/` | Jump to the message box (when you are not typing in a field) |
| `Esc` | Close a dialog, menu or full-screen artifact |
| `Enter` | Send (or `Mod + Enter`, when "Send with Enter" is off; then `Enter` adds a line) |
| `Shift + Enter` | New line (when "Send with Enter" is on) |

## 4. Effects and motion

Settings > Appearance > Effects has three levels, kept on `<html data-effects>`:

- **Full**: the cipher disk, the sweep when the theme changes, entrances and message transitions.
- **Subtle**: short fades only.
- **Off**: no animation.

If the device asks for reduced motion (`prefers-reduced-motion`), the level is forced to Off whatever the setting says (`effectsLevel` in `lib/motion.ts`), and the page says so. The motion library, GSAP with its text plugin, is loaded after the first paint, so it stays out of the first download; until it arrives, text appears instantly. The cipher disk (`components/cipher-disk.tsx`) is the one signature object of the design; it has 26 notches (`NOTCHES` in `lib/motion.ts`).

## 5. Colour, type, spacing

- **Two themes.** Light is "Paper" (warm off-white, deep teal primary `#166657`); dark is "Slate" (cool charcoal, lighter teal primary `#5fb5a3`); a brass accent is shared. The exact values are in `DESIGN.md` and are set as CSS variables in `app/globals.css`. The theme is applied to `<html>` by a tiny script (`lib/no-flash.ts`) before React starts, so there is no flash of the wrong theme.
- **Type.** Replies are set in Literata (a serif); the interface in Schibsted Grotesk; code in Spline Sans Mono; Atkinson Hyperlegible Next is the "Easy to read" option. The fonts are packages (`@fontsource-variable/*`), served by the app itself, so nothing is fetched from a font host.
- **Shape and space.** A 4 px spacing unit and a rounded scale from 6 px to 24 px (`DESIGN.md` has the table).
- **Tailwind 4** reads its configuration from CSS. There is no `tailwind.config.js`; tokens are in `app/globals.css` and the PostCSS plugin is in `postcss.config.mjs`.

## 6. Responsive and accessible

- The layout was checked at three sizes: desktop 1440 x 900, tablet 768 x 1024 and phone 390 x 844 (the browser tests run all three).
- On a touch screen controls grow to a comfortable size (`pointer-coarse:` styles).
- Every icon-only button must have a label: `IconButton` (`components/icon-button.tsx`) requires a `label` prop and uses it for the accessible name and the tooltip.
- Colour is never the only signal: the router's status chips carry an icon and words.
- axe-core runs in the browser tests on the desktop and phone sizes.

## 7. Rules when you change the interface

1. Use the tokens (`bg-background`, `text-muted-foreground`, `border` and the rest). Do not write a colour as a hex value in a component; change the token in `app/globals.css` and `DESIGN.md` together.
2. Do not restyle files in `components/ui/`. They are shadcn's. Style from the app's own components, or add a variant.
3. Keep every icon button labelled, and keep focus visible.
4. Respect the effects level: new motion must be silent when `effectsLevel()` is `off`.
5. Check the three sizes after a layout change. `npm run test:e2e` does it for you ([TESTING.md](./TESTING.md)).
6. If you add a setting, add its default to `DEFAULT_SETTINGS` ([ARCHITECTURE.md](./ARCHITECTURE.md) section 7).

More about the tools used to build the design (shadcn, the Figma, shadcn and Playwright MCP servers, `DESIGN.md`) is in `TOOLKIT.md` in the project root.
