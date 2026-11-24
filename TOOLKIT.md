# Toolkit

What was evaluated for Cyphor, what the project uses, what each of the 12 repositories actually contributed, and what was left out and why.

**None of the 12 repositories was installed.** Each was cloned shallowly into a scratch folder and judged from its README, manifests, hook scripts and licence. Where a claim below comes from a file in a repository, it says so. The verdicts are mine and are about this project: a Next.js chat app, not a reverse-engineering or scraping job.

Three things were run, and all three are one-off commands that add nothing to `package.json`:

- UI UX Pro Max's own local search script (`.claude/skills/ui-ux-pro-max/scripts/search.py`), which reads a database inside the skill folder.
- `npx @google/design.md lint DESIGN.md`, which fetches Google's design-file linter from npm into npm's cache and checks `DESIGN.md`. It reports 0 errors and 0 warnings.
- The project's own Playwright suite, with axe-core, against a production build.

## What the project uses

| Tool | State | How |
|---|---|---|
| shadcn/ui | In use | 47 components in `components/ui` (style `new-york-v4`, one `radix-ui` package), set up by `components.json`. The look was layered on top: chamfered shapes (`.cut`), HUD labels, per-theme colours. |
| `DESIGN.md` | In use, rewritten | The source of truth for colours, type, shapes, layout, motion and accessibility. It describes the Cyberpunk 2077 look, the eight themes and the city. |
| three.js | In use | The moving city (`lib/scene/city`). Renderer, `Reflector` for the wet road, `EffectComposer` with `RenderPass`, `UnrealBloomPass`, a custom `ShaderPass` and `OutputPass`, `BufferGeometryUtils` for merged geometry. Signs and windows are drawn onto canvas textures (`atlas.ts`) and the layout is procedural and seeded (`layout.ts`, `rng.ts`). It loads as its own chunk, only when the city is switched on. |
| GSAP | In use | `gsap` (`lib/motion.ts`), loaded lazily by the shell: the sidebar's chat-title decode. The reduced-motion preference is honoured. |
| Better Auth, Neon (Postgres), drizzle | In use | Sign-in with email and password, and Google when its keys are set. Accounts, sessions and chats live in Postgres. See the README. |
| Playwright and axe-core | In use | `npm run test:e2e`: desktop, tablet and phone, light and dark, with accessibility scans. In the sandbox the browser draws WebGL on the CPU, so the city is tested pinned and with motion reduced (see below). |
| shadcn MCP | Wired, not started | `.mcp.json` runs `npx shadcn@latest mcp`. Claude Code asks you to approve a project MCP server the first time. |
| Playwright MCP | Wired, not started | `.mcp.json` runs `npx @playwright/mcp@latest`. |
| Figma MCP | Wired, needs sign-in | `.mcp.json` points at `https://mcp.figma.com/mcp`. Sign in from `/mcp` in Claude Code. |
| Frontend design skill | Used in the session | Anthropic's `frontend-design` skill guided the first direction. It is not copied into the repo. |
| UI UX Pro Max | In use | Its skills are in `.claude/skills/` (`ui-ux-pro-max`, `ui-styling`, `design-system`, `brand`, `design`, `banner-design`, `slides`). It is a snapshot: upstream has changed since. |

The reference document you linked held four links only: threeui.com, tasteskill.dev, 21st.dev and gsap.com. GSAP is used. The other three are not (see 21st.dev below).

## The 12 repositories

| # | Repository | Kind | What it is | Install | What it runs, and what to watch | Overlap | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `morluto/rea` | MCP server + CLI (`rea-agents`) | Reverse engineering of binaries, apps and runtime behaviour through one MCP. | `npx rea-agents setup` | Drives Ghidra, Hopper, IDA or Kuna on whatever you point it at, and can install Hopper after approval. Its DISCLAIMER limits use to analysis you are authorised to do. | None | **Skip.** Nothing in a chat UI needs it. |
| 2 | `DietrichGebert/ponytail` | Plugin (Claude Code, Codex, Copilot CLI, Cursor, Pi, OpenCode, others) | Rules that push the agent to write less code and less prose, plus `/ponytail-review`, `-audit`, `-debt`, `-gain`. | Two `/plugin` commands, sent as two separate prompts (see below) | Two small Node lifecycle hooks run on their own, and hooks in Claude Code run outside the model's command approval. Its "band" part keeps a per-project CSV with a row per task in `~/.config/ponytail/band`, and sends rows to a webhook only if you set one. A hook can start a detached importer that reads past sessions. | Part of "no overengineering, fewer tokens" in your directives | **Optional, not installed.** It needs a client-side command, your directives say to ask before installing, and its hooks are worth reading first. |
| 3 | `Nutlope/hallmark` | Agent skill, also a Claude Code plugin | A design skill with fifty themes that builds a page and lints it against a floor in a real browser. | `npx skills add nutlope/hallmark -g` | Browser checks need `puppeteer-core` and Chrome. `install-hook.mjs` can add an edit-time hook to `.claude/settings.json`. | `frontend-design`, UI UX Pro Max, Impeccable, unslop | **Not used.** Its themes would replace the Cyberpunk 2077 direction you asked for. |
| 4 | `pbakaus/impeccable` | Skill + CLI + engine binary | Design commands (`polish`, `bolder`, `critique`, `audit`) and a detector that flags generic "AI" design in code or a rendered page. | `npx impeccable install` | The installer offers a design hook that scans every UI file the agent edits. Its README says hooks run outside model approval and that the first edit can download an engine into `~/.impeccable/bin/`. It fetches a catalogue of design directions from impeccable.style; telemetry can be turned off. | UI UX Pro Max, Hallmark, unslop | **Rules used by hand, detector not run.** See below. `npx impeccable detect app components` is the one command I would run next. It downloads a native binary, so it needs your approval. |
| 5 | `nextlevelbuilder/ui-ux-pro-max-skill` | Skill + CLI (`uipro`) with a local design database | Searchable styles, palettes, font pairings, UX guidelines and stack notes, with a search script. | Plugin, or `uipro init --ai claude` | Local data and a local script. No key, no network to search. | The design skills above | **Used.** Already in `.claude/skills/`; its search script was run for this round. |
| 6 | `cathrynlavery/diagram-design` | Agent skill, also a plugin | Draws diagrams as one self-contained HTML + SVG file in your brand. | `npx skills add cathrynlavery/diagram-design` | Instructions and local scripts. No key. | Mermaid, Figma's diagram tool | **Not used.** The README has a short Mermaid diagram, which GitHub draws without a tool. |
| 7 | `blader/humanizer` | Skill / plugin | Rewrites AI-sounding prose so it reads like a person, using Wikipedia's "Signs of AI writing". | `/plugin marketplace add blader/humanizer`, then `/plugin install humanizer@humanizer` (Claude Code 2.1.142 or newer) | Text instructions and a scripts folder. | None for code | **Used as a checklist** on the interface text and the new documents. See below. The skill itself was not installed. |
| 8 | `onyx-dot-app/onyx` | Standalone application | A self-hosted AI chat and enterprise-search platform (Docker or Kubernetes). | `curl -fsSL https://onyx.app/install_onyx.sh \| bash`, or Docker or Helm | Runs a multi-service stack that connects to company data. The installer pipes a remote script into bash, so read it first. Its licence is mixed: the core is MIT, and a directory of enterprise code is under a separate licence. | It is an alternative to Cyphor, not a tool for it | **Reference only.** Read, nothing copied. |
| 9 | `mvanhorn/last30days-skill` | Skill / plugin, plus an MCP server and a Gemini extension | Researches the last 30 days across Reddit, X, YouTube and the web. | `/plugin marketplace add mvanhorn/last30days-skill` | The widest permission surface of the twelve: it can read browser cookies (it asks first), uses API keys, and installs or calls helper CLIs such as `yt-dlp` and `gh`. | The app's web grounding (TinyFish) and Claude's own search | **Not applicable.** |
| 10 | `D4Vinci/Scrapling` | Python library + CLI + MCP server + agent skill | A scraping framework with stealth browsers, Cloudflare Turnstile handling and spiders. | `pip install "scrapling[all]"`, then a browser download | Launches browsers. It is built to get past bot protection, so site terms and robots.txt matter before any use. | The router's TinyFish web tool | **Not applicable.** Wrong language and wrong job. |
| 11 | `Leonxlnx/unlazy` | Skill with runnable gate scripts | Completion discipline: write an acceptance ledger first, run reviewed checks, reverify returned work, report only what the evidence supports. | `npx skills add Leonxlnx/unlazy` | Scripts run your checks. Approvals live in `~/.unlazy/approved`, and its README says "approval is consent, not a sandbox". It also has a stop hook. | Your directives' own verification step | **Practice used, scripts not installed.** The ledger is `docs/ACCEPTANCE.md`. |
| 12 | `heydamir/unslop` | Agent skill (Claude Code, Codex, Antigravity) | Audits AI-looking UI, then fixes spacing, colour, icons, copy, type, layout, details, visuals and motion in that order. Can also write a story video of the screen being cleaned up. | Copy `skills/unslop` into `.claude/skills/` (a file copy; nothing is fetched) | The skill itself is instructions. The optional story video needs Playwright and ffmpeg, and the optional image step calls an image service you connect (a paid service). | Impeccable, Hallmark, UI UX Pro Max | **Checklist used by hand.** Not copied into the project. **Licence: CC BY 4.0**, by Damir Sokolovsky ([@heydamir](https://x.com/heydamir), [github.com/heydamir/unslop](https://github.com/heydamir/unslop)). Anything adapted from it needs that credit. |

The directive wrote `LeonxInx/unlazy`. The owner is `Leonxlnx`: the sixth letter is a lowercase L, not a capital I, so the address as written points at a different name.

## What each repository contributed this round

**UI UX Pro Max.** Its search script was run for `cyberpunk neon dark hud` (style), `cyberpunk neon game` (colour) and three UX queries (loading and streaming, reduced motion, focus and touch targets). What it said and what was done with it:

- It lists a *Cyberpunk UI* style and a *HUD / sci-fi* style: neon on near-black, thin lines, scanlines, a glitch effect, bracket corners. Taken: hairlines, corner brackets on focus, faint scanlines, one glitch on the wordmark and greeting.
- Its colour entry is Matrix green and magenta on `#0D0D0D`. **Not taken.** You asked for Cyberpunk 2077, so the palette is that game's yellow, cyan and red, with all eight genre colours used (see `DESIGN.md`).
- It recommends monospace type and a dark theme only. **Not taken** for the reading text, because replies need to be comfortable to read for long stretches. Code is monospace. The light theme stays because it was already there and some people want it.
- Its UX rules on reduced motion, visible focus, loading feedback and touch targets are met in the design (see `DESIGN.md`). The browser tests cover reduced motion, keyboard use and the streaming states; no test measures tap-target size.

**Impeccable.** The detector was not run (it downloads a native binary). Its rule catalogue (`crates/foundation/src/registry.rs`) and its `craft-floor.md` were read and used as a hand checklist over `app/`, `components/` and the CSS. Found and fixed:

- A 2 px coloured stripe on the side of the first-run note (`side-tab`). It is now an icon beside the text.
- A 2 px rail on the thinking text, now 1 px. (The side border on a reply's blockquote stays: the detector exempts quotes.)
- An overshoot easing on the round buttons and in the demo artifact (`bounce-easing`). Both are now an exponential ease-out.
- A status dot that pulsed all the time (`pulsing-dot`). It is static now.
- A blinking cursor after the home greeting (`blinking-cursor`). Removed, with its CSS.
- Always-on glows around the login and error cards (`dark-glow`). Removed. The composer's focus light stays, because it shows state.
- HUD plates at 10.9 px (`undersized-ui-text`). Now 11.5 px. The provider tile's letters were 10 px (now 11), and the 16 px tile in the reply footer shows colour only.
- Headings and paragraphs now use `text-wrap: balance` and `pretty` (`unbalanced-heading`, `straggler`).

Flagged by the catalogue and **kept on purpose**, because your brief pins a Cyberpunk 2077 world and the craft floor says a committed visual world wins except for its explicit bans:

- Cyan on a dark ground (`ai-color-palette`). Cyan is one of the game's signature colours.
- Coloured corner washes, a faint grid and scanlines on the plain background (`radial-halo`, `codex-grid-background`, `repeating-stripes-gradient`). They are what makes the eight themes visibly different at a glance when the city is off.
- The yellow and black hazard stripe (`repeating-stripes-gradient`), used once, on the God Mode composer.
- Capital HUD labels with wide tracking. They are the game's menu style and appear only on tabs, buttons, plates and short group labels, never above a heading (`kicker-above-heading` is the one explicit ban, and it is not triggered).

Not checked: `nested-cards` and `monotonous-spacing` have no cheap text search, and the detector was not run, so treat those two as unreviewed.

Checked: the reading measure, in Chromium on one demo reply. It came to 86 to 95 characters a line, 91 on average, at 16.5 px in a 688 px column (46 rem less its side padding), and about 45 on a 390 px phone. Desktop is over the 75 the craft floor suggests, and it was left as it is. Five full lines is a small sample.

**unslop.** Its audit list (`references/signs.md`) and nine passes were read. Applied by hand as a review of the interface text: no emoji, no exclamation marks, no hype words and no em dashes were found in any interface string (a scripted scan of `app/`, `components/` and `lib/`); labels are short; there are no invented claims. Deliberate differences from it: it wants chrome with no glow and sentence-case labels, and the Cyberpunk 2077 direction uses a focus glow and capital HUD labels; it discourages greeting headlines, and the home greeting is kept because it is the Claude-style start screen you asked to match. Its one-bright-moment idea is how the city is used: the city is the rich part and the interface around it stays ink and one accent.

**humanizer.** Its list of patterns (`SKILL.md`, sections A to F) was used as a checklist when writing `README.md`, `DESIGN.md`, `docs/ACCEPTANCE.md` and this file: no "not X but Y" staging, no stacks of three, no inflated significance, no sales words. The skill was not run on the text, so it is a self-review, not a tool result.

**unlazy.** The practice, not the scripts: `docs/ACCEPTANCE.md` lists each thing you asked for, the evidence for it, and what is not tested.

**Not used:** Hallmark (its themes would replace your direction), diagram-design, Rea, last30days, Scrapling. **Reference only:** Onyx. **Not installed, waiting for you:** Ponytail and the Impeccable detector.

## The smallest effective toolkit

1. **shadcn/ui** and **`DESIGN.md`**, for components and decisions.
2. **UI UX Pro Max**, as the one design reference skill.
3. **Playwright** (the test suite, and the MCP when you want to drive a browser by hand), for responsive and accessibility checks.
4. **Figma MCP**, only when a design file is the source.
5. **shadcn MCP**, to browse components when adding one.

Optional: Impeccable's `detect` as a one-off design audit, and Ponytail if you want terser agent output.

## 21st.dev

The command in the brief was `npx @21st-dev/cli@latest install <client> --api-key <key>`. It was not run: `<client>` and `<key>` were never filled in, and installing with a key needs your approval.

That form is the older one. It is in the README of `@21st-dev/cli` 0.0.29, where clients are `cursor`, `windsurf`, `cline`, `claude`, `witsy` and `enconvo`, and the key comes from the 21st.dev Magic Console. The current documentation (help.21st.dev/cli/setup) describes a different flow:

```bash
npx @21st-dev/cli@latest init --client claude           # prints the MCP config
npx @21st-dev/cli@latest init --client claude --write   # writes it into .mcp.json
npx @21st-dev/cli@latest login                          # signs in; no key on the command line
```

Clients there are `cursor`, `vscode`, `devin` (`windsurf` still works), `claude` and `codex`. The page shows these as `21st init ...`; the `npx` form is the same command and was not run. Check the page before you run either, and never paste a key into a chat or commit it. Use components one at a time and read what each adds.

## Ponytail

Both commands from the brief are still in Ponytail's `INSTALL.md`:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Send them as two separate prompts. They are Claude Code slash commands, so they can only run in your own Claude Code, not from here. Before you do, read `hooks/` in the repository: the plugin registers Node lifecycle hooks that run on their own, and the hook for tracking tasks writes a CSV under `~/.config/ponytail/band`. `node` must be on your PATH for them to work.

## Credit

The unslop skill is © Damir Sokolovsky, licensed CC BY 4.0, and was used as a reading checklist. Nothing from it is copied into this project. Cyberpunk 2077 is the property of CD PROJEKT RED; only its colours and the idea of its shapes are referenced, and no game asset, logo, typeface or artwork is used.

## How this was checked

Read and listed, not executed: each README's install section, manifests, hook and script names, and licences. Ponytail's hook scripts were searched for network, process and file use. Impeccable's rule registry and craft floor were read in full for the rules named above. The three commands listed at the top were run. The interface-text scan was a script over string literals in `app/`, `components/` and `lib/` that looked for emoji, exclamation marks, em dashes, hype words and title-case labels. Nothing else here was verified by running the tools, so treat "overlap" and "verdict" as judgement, and the install lines as quoted, not tested.
