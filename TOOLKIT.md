# Toolkit

What was evaluated for Cyphor Chat, what the project uses, and what was left out and why.

None of the 11 repositories was installed or run. Each was cloned shallowly into a scratch folder and judged from its README, manifests, hook scripts and licence. Where a claim below comes from a file in a repository, it says so. The verdicts are mine and are about this project: a Next.js chat app, not a reverse-engineering or scraping job.

## What the project uses

| Tool | State | How |
|---|---|---|
| shadcn/ui | In use | 47 components in `components/ui` (style `new-york-v4`, one `radix-ui` package), set up by `components.json`. |
| shadcn MCP | Wired, not started | `.mcp.json` runs `npx shadcn@latest mcp`. Claude Code asks you to approve a project MCP server the first time. |
| Playwright MCP | Wired, not started | `.mcp.json` runs `npx @playwright/mcp@latest`. The project's own `@playwright/test` suite is what ran the browser checks (`npm run test:e2e`). |
| Figma MCP | Wired, needs sign-in | `.mcp.json` points at `https://mcp.figma.com/mcp`. Sign in from `/mcp` in Claude Code. |
| `DESIGN.md` | In use | The source of truth for tokens, type, spacing, motion and component rules. |
| Frontend design skill | Used in the session | Anthropic's `frontend-design` skill guided the visual direction. It is not copied into the repo. |
| UI UX Pro Max | In use | Its skills are copied into `.claude/skills/` (`ui-ux-pro-max`, `ui-styling`, `design-system`, `brand`, `design`, `banner-design`, `slides`). It is a snapshot: upstream has changed since, and differs from this copy in about 55 files. |
| GSAP | In use | `gsap` and `@gsap/react` drive the entrance and hover motion. The reduced-motion preference is honoured, and a browser test checks it. |

The reference document you linked held four links only: threeui.com, tasteskill.dev, 21st.dev and gsap.com. GSAP is used. The other three are not (see 21st.dev below).

## The 11 repositories

| # | Repository | Kind | What it is | Install | What it runs, and what to watch | Overlap | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | `morluto/rea` | MCP server + CLI (`rea-agents`) | Reverse engineering of binaries, apps and runtime behaviour through one MCP. | `npx rea-agents setup` | Drives Ghidra, Hopper, IDA or Kuna on whatever you point it at, and can install Hopper after approval. Its DISCLAIMER limits use to analysis you are authorised to do. | None | **Skip.** Nothing in a chat UI needs it. |
| 2 | `DietrichGebert/ponytail` | Plugin (Claude Code, Codex, Copilot CLI, Cursor, Pi, OpenCode, others) | Rules that push the agent to write less code and less prose, plus `/ponytail-review`, `-audit`, `-debt`, `-gain`. | Two `/plugin` commands, sent as two separate prompts (see below) | Two small Node lifecycle hooks run on their own, and hooks in Claude Code run outside the model's command approval. Its "band" part keeps a per-project CSV with a row per task in `~/.config/ponytail/band`, and sends rows to a webhook only if you set one. A hook can start a detached importer that reads past sessions. | Part of "no overengineering, fewer tokens" in your directives | **Optional, not installed.** It needs a client-side command, and its hooks are worth reading first. |
| 3 | `Nutlope/hallmark` | Agent skill, also a Claude Code plugin | A design skill with fifty themes that builds a page and lints it against a floor in a real browser. | `npx skills add nutlope/hallmark -g` | Browser checks need `puppeteer-core` and Chrome. `install-hook.mjs` can add an edit-time hook to `.claude/settings.json`. | `frontend-design`, UI UX Pro Max, Impeccable | **Skip.** One design skill is enough. |
| 4 | `pbakaus/impeccable` | Skill + CLI + engine binary | Design commands (`polish`, `bolder`, `critique`, `audit`) and a detector that flags generic "AI" design in code or a rendered page. | `npx impeccable install` | The installer offers a design hook that scans every UI file the agent edits. Its README says hooks run outside model approval and that the first edit can download an engine into `~/.impeccable/bin/`. It fetches a catalogue of design directions from impeccable.style; telemetry can be turned off. | UI UX Pro Max, Hallmark | **Optional second opinion.** `npx impeccable detect app components` is the one thing here I would run. It downloads a binary, so I did not. |
| 5 | `nextlevelbuilder/ui-ux-pro-max-skill` | Skill + CLI (`uipro`) with a local design database | Searchable styles, palettes, font pairings, UX guidelines and stack notes, with a search script. | Plugin, or `uipro init --ai claude` | Local data and a local script. No key, no network to search. | The design skills above | **Use.** Already in `.claude/skills/`. |
| 6 | `cathrynlavery/diagram-design` | Agent skill, also a plugin | Draws diagrams as one self-contained HTML + SVG file in your brand. | `npx skills add cathrynlavery/diagram-design` | Instructions and local scripts. No key. | Mermaid, Figma's diagram tool | **Skip for now.** Worth it when the docs need diagrams. |
| 7 | `blader/humanizer` | Skill / plugin | Rewrites AI-sounding prose so it reads like a person, using Wikipedia's "Signs of AI writing". | `/plugin marketplace add blader/humanizer`, then `/plugin install humanizer@humanizer` (Claude Code 2.1.142 or newer) | Text instructions and a scripts folder. | None for code | **Skip.** Only useful for marketing copy. |
| 8 | `onyx-dot-app/onyx` | Standalone application | A self-hosted AI chat and enterprise-search platform (Docker or Kubernetes). | `curl -fsSL https://onyx.app/install_onyx.sh \| bash`, or Docker or Helm | Runs a multi-service stack that connects to company data. The installer pipes a remote script into bash, so read it first. Its licence is mixed. | It is an alternative to Cyphor, not a tool for it | **Not a toolkit item.** A feature reference at most. |
| 9 | `mvanhorn/last30days-skill` | Skill / plugin, plus an MCP server and a Gemini extension | Researches the last 30 days across Reddit, X, YouTube and the web. | `/plugin marketplace add mvanhorn/last30days-skill` | The widest permission surface of the eleven: it can read browser cookies (it asks first), uses API keys, and installs or calls helper CLIs such as `yt-dlp` and `gh`. | The app's web grounding (TinyFish) and Claude's own search | **Skip.** |
| 10 | `D4Vinci/Scrapling` | Python library + CLI + MCP server + agent skill | A scraping framework with stealth browsers, Cloudflare Turnstile handling and spiders. | `pip install "scrapling[all]"`, then a browser download | Launches browsers. It is built to get past bot protection, so site terms and robots.txt matter before any use. | The router's TinyFish web tool | **Skip.** Wrong language and wrong job. |
| 11 | `Leonxlnx/unlazy` | Skill with runnable gate scripts | Completion discipline: write an acceptance ledger first, run reviewed checks, reverify returned work, report only what the evidence supports. | `npx skills add Leonxlnx/unlazy` | Scripts run your checks. Approvals live in `~/.unlazy/approved`, and its README says "approval is consent, not a sandbox". It also has a stop hook. | Your directives' own verification step | **Skip.** The same practice is already followed here. |

The directive wrote `LeonxInx/unlazy`. The owner is `Leonxlnx`: the sixth letter is a lowercase L, not a capital I, so the address as written points at a different name.

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

## How this was checked

Read and listed, not executed: each README's install section, manifests, hook and script names, and licences. Ponytail's hook scripts were searched for network, process and file use. `package.json`, `.mcp.json` and the skills folder were compared with what is written above. Nothing here was verified by running the tools, so treat "overlap" and "verdict" as judgement, and the install lines as quoted, not tested.
