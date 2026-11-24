# Acceptance ledger

This lists each thing you asked for, where it lives, what shows that it works, and what was not tested. Every claim points at a file or a command, so you can check it. It was last checked on 2026-11-20 against the code as shipped.

Status words:

- **Done, tested.** A test in this repository fails if it stops working.
- **Done, partly tested.** Built and exercised. The gap is named under "Not tested".
- **Built, not tested live.** The code is complete. Its tests use stand-ins (fake providers, an in-memory Postgres, a fake Google setting), so the first run with your own accounts is the first real check.

## Summary

| # | You asked for | Status |
| --- | --- | --- |
| 1 | Model choosing like Claude's menu | Done, tested |
| 2 | A cyberpunk look, with a new logo, background and overall UI | Done, partly tested |
| 3 | Incognito mode removed | Done, tested in part |
| 4 | Login with Google or by hand | Email and password: done, tested. Google: built, not tested live |
| 5 | Your Neon database | Built, not tested live |
| 6 | Connected to your LLM router and its model APIs | Built, not tested live |
| 7 | Artifacts and a preview like Claude's, a code side, and one-click copy | Done, partly tested |
| 8 | Think properly before answering | Done, tested with the demo model and with stand-in providers |
| 9 | Every colour of Cyberpunk 2077 and its genre | Done, tested |
| 10 | A moving city behind the chat that looks real | Done, partly tested |
| 11 | A choice to keep the city or not | Done, tested |
| 12 | Without the city, a different theme on every refresh | Done, tested |
| 13 | Your engineering and design directives | Followed, with the exceptions listed in section 13 |

## 1. Model choosing like Claude's menu

**Where.** `components/model-picker.tsx`, `components/model-parts.tsx`, `components/model-library.tsx`, `lib/router/effort.ts`.

**What you get.** One button in the composer shows the model and the effort. It opens a panel with the Cyphor models (Auto, Swift, Core, Deep, Code and God Mode), each with a line about what it is for and a check beside the one in use. Below them is an Effort row (Low, Medium, High) and More models, which lists every model your connected providers offer, with search. The three views replace each other inside one panel, so a phone never gets a second layer on top.

**Evidence.**

- `tests/e2e/router.spec.ts`, "the model picker and library": each Cyphor name says which model it would use right now, and the library lists every model of the connected providers and filters by provider.
- `tests/e2e/thinking.spec.ts`: the Effort view, and a choice that is kept after a reload.
- axe scans of the picker, the library and the Effort view in both schemes (`router.spec.ts`, `thinking.spec.ts`).

**Not tested.** There is no side-by-side comparison with Claude's own menu. It was built from your screenshot.

## 2. A cyberpunk look, with a new logo, background and overall UI

The reference is Cyberpunk 2077, taken for its colours and its shapes only. No game artwork, logo or typeface is used.

**Where.** `DESIGN.md`, `app/globals.css`, `app/cyber.css` (the chamfered shapes), `components/brand.tsx` (the new mark: an angular C with cut corners and a cyan signal through it), `components/backdrop.tsx`, `components/skyline.tsx` (the picture on the login screen).

**Evidence.**

- `npx @google/design.md lint DESIGN.md` reports 0 errors, 0 warnings and 1 info.
- axe-core reports no violations (WCAG 2.0, 2.1 and 2.2 A and AA, plus its best-practice rules).
  - `a11y.spec.ts` scans the home screen, a chat with a table, a chat with code, an artifact and its code view, a broken preview, the command palette (desktop only) and every settings section, in light and dark, on a desktop and a phone.
  - `router.spec.ts` and `thinking.spec.ts` scan the model picker, the model library, Router settings, a God Mode reply, a reply with web sources, the Effort view and a reply with its thinking open and folded, in light and dark.
  - `login.spec.ts` (both tabs, and with an error showing) and `city.spec.ts` (the first-run question and Appearance settings) scan in one colour scheme each.
- `tests/unit/palettes.test.ts` fails if secondary, signal or danger text falls under 4.5:1 on any surface in any theme.
- Nothing scrolls sideways from 320 px to 1920 px (`app.spec.ts`).

**Not tested.** Whether it looks right to you. There is no screenshot comparison, and the Impeccable detector was not run. One gap is known and recorded in `DESIGN.md`: the resting edge of a text field is about 1.5:1 against its surface, under the 3:1 that WCAG 1.4.11 asks for when the edge is the only mark of a field. Every field also has a label or placeholder, and its edge lights up on focus.

## 3. Incognito mode removed

**Evidence.** The interface has no incognito control and no setting for it. A search of `app/`, `components/`, `lib/`, `db/` and `tests/` finds the word in two places, both for older data: `lib/store.ts` deletes the old `incognitoByDefault` switch from saved settings, and `tests/unit/import.test.ts` checks that an old backup's incognito flag is not restored.

**Not tested.** No browser test checks that the control is gone. The source search is the evidence.

## 4. Login with Google or by hand

**Where.** `app/login/page.tsx`, `components/login-screen.tsx`, `lib/auth.ts` and `app/api/auth/[...all]/route.ts` (Better Auth), `proxy.ts` (sends signed-out visitors to the login page and answers the API with a 401).

**Evidence.**

- `tests/e2e/login.spec.ts`:
  - A signed-out visitor is sent to the login page and brought back after signing in.
  - The page offers Sign in and Create account, and offers Google only when it is set up. The tabs move with the arrow keys.
  - Creating an account signs you in, greets you by name and survives a reload. Mistakes are named and the cursor goes to them. An address that already has an account is told to sign in.
  - Signing out locks the app again. A wrong password is refused in plain words, and an unknown account gets the same answer.
  - One person's chats are not shown to the next person who signs in on the same browser.
  - axe scans cover both tabs and an error state.
- `tests/unit/auth.test.ts`, on an in-memory Postgres: only a hash of the password is stored, a made-up cookie is nobody, sign-out ends the session in the database, a sign-in request from another site is refused, and two people's sessions stay apart. For Google, the person is sent to Google with a return address that points back at this app, and the button is not offered until both settings exist.
- `tests/unit/api-routes.test.ts`: a live server with no session secret says so on screen, and nobody can sign in until it is set.

**Not tested.** A real Google sign-in. It needs your client ID and secret, and the return address registered in Google Cloud (the steps are in `.env.example`). There is no email sending, so there is no email confirmation and no "forgot password".

## 5. Your Neon database

**Where.** `db/index.ts`, `db/schema.ts`, `drizzle.config.ts`. Paste the string from Neon's Connect dialog into `DATABASE_URL`. On a Neon address Cyphor checks the server's certificate (`sslmode=verify-full`) whatever `sslmode` the string says. It creates its own tables on the first connection. `DB_AUTO_MIGRATE=0` turns that off, and `npm run db:push` is the manual route.

**Evidence.** `tests/unit/server-lib.test.ts`, "the database": the tables made on first use have exactly the columns the code expects, making them twice changes nothing and loses nothing, a missing database gives a message that says what to do, and a Neon address is told apart from a local one and gets the encryption it needs. The same SQL runs in the other tests on PGlite, a Postgres that runs inside the test process.

**Not tested.** A real Neon project. Nothing here has connected through Neon's pooler, measured a cold start or reached its connection limit. The pool holds 5 connections per server process.

## 6. Connected to your LLM router and its model APIs

**Where.** `lib/router/` (providers, model profiles, planner, failover, health, God Mode, the web tool and the `LLM.env` reader), `app/api/chat/route.ts`, `app/api/models/route.ts`, `components/settings/router.tsx`.

It reads the names in `.env.example` from `LLM.env` or the environment: eleven providers (Gemini, Groq, OpenRouter, Z.ai, NVIDIA, Cohere, Anthropic, Meta, Mistral, AionLabs and Cloudflare), a server of your own through `LLM_BASE_URL`, and TinyFish for web search.

**Evidence.**

- `tests/unit/router.test.ts` and `router-pure.test.ts`, against fake providers over HTTP: which models are found, which one answers, what happens when one fails, what God Mode does with a partial panel, and that a key never comes back out.
- `tests/e2e/router.spec.ts`, in the browser and over the API, against three fake providers (the shapes of Groq, Mistral and Anthropic) and a fake web search:
  - The provider list shows each variable name and never a key. Test sends one message and says how it went.
  - Auto routing says who answered and why. A model picked by name answers.
  - God Mode asks every provider and shows one merged answer and who took part, including a panel where some were too slow or failed.
  - Web search lists the pages a reply was based on.
  - A provider that repeats its key back never gets it onto the page or into the saved chat.
  - A request with no sign-in is refused before anything goes to a provider.

**Not tested.** Any real key or provider. A provider's real model list, streaming format and limits can differ from the documentation that was read. The addresses for Z.ai, NVIDIA, Meta, Mistral and AionLabs were not checked against live documentation, and `ZAI_BASE_URL`, `NVIDIA_BASE_URL`, `META_BASE_URL`, `MISTRAL_BASE_URL` and `AIONLABS_BASE_URL` override them. The scores behind Auto routing are estimates, and the screens say so.

## 7. Artifacts and a preview like Claude's, a code side, and one-click copy

**Where.** `lib/parse.ts` and `lib/artifact/detect.ts` (finding artifacts in a reply), `lib/artifact/srcdoc.ts` (the page the sandboxed frame loads), `components/artifact-card.tsx`, `artifact-panel.tsx` and `artifact-view.tsx`, `public/artifact/` (the React runtime and Tailwind's browser build, served by Cyphor itself; see `public/artifact/README.md`).

**What you get.** A reply that carries an `<artifact>` tag, or a whole page or component in a code block, becomes a card in the chat and a side panel with Preview and Code. Full screen on a wide screen adds Split, which shows the code and the preview side by side. Copy code puts the whole file on the clipboard in one click, and Download saves it under its own name. A preview that breaks shows its error and offers Fix with Cyphor. The kinds are web page, React component, SVG, Mermaid diagram, Markdown and code.

**Evidence.**

- `tests/e2e/artifacts.spec.ts`:
  - Copy code puts the whole file on the clipboard, from the panel and from the card in the chat.
  - The Code view opens on line 1 and says how long the file is. Download uses the artifact's own name.
  - Full screen offers Split on a wide screen, and a small screen never does. The panel opens by itself while a page is being written and follows the code.
  - A React component runs with Tailwind, icons and a chart. An SVG shows as an image and keeps its source in the Code view.
  - A whole page in a plain code block still becomes a card and a preview, and ordinary code stays an ordinary code block.
  - A broken preview shows its error, and Fix with Cyphor brings a second version that works.
  - A diagram engine whose hash does not match is refused, and the panel says so.
- `tests/e2e/app.spec.ts`: a build request opens a live preview whose frame allows scripts and does not allow `same-origin`, so a preview cannot reach your session or your chats.
- `tests/unit/artifacts.test.ts`, 40 tests: reading the tag, promoting code fences, half-written tags, identifiers and versions, the preview page's rules (no network, only the listed libraries), and source that tries to close the script tag.

**Not tested.** Drawing a Mermaid diagram. The network where the tests ran could not reach the CDN, so that test skipped itself and only the refusal of a wrong hash ran. Whether jsDelivr serves exactly the bytes npm publishes was not checked. Clipboard behaviour in browsers other than Chromium. Real models' artifact output beyond the shapes the unit tests cover.

## 8. Think properly before answering

**Where.** `lib/router/effort.ts` (the levels and their wording), `lib/prompt.ts` (the system prompt), `lib/openai.ts` and `lib/router/anthropic.ts` (a provider's own reasoning), `lib/parse.ts`, `components/thinking.tsx`, `components/model-picker.tsx`, `components/settings/capabilities.tsx`.

**How it works.** Effort has three levels. Medium is the default and asks the model to think the question through inside `<thinking>` tags before it answers. High asks for careful reasoning and a check of the result, and moves the default routing toward quality. Low asks for a short, direct reply, moves the default routing toward speed and skips the thinking, except on Cyphor Deep, which always thinks first. A routing priority chosen in Router settings wins over what Effort suggests. The reasoning shows live in a Thinking block that is open while the model works and folds to "Thought for 4s" when the answer starts. A click opens it again. A model that reasons on its own (an OpenAI-style `reasoning_content` or `reasoning` field, or Anthropic's extended thinking) lands in the same block.

**Evidence.**

- `tests/unit/effort.test.ts`, 10 tests: the three levels, Medium as the default, which levels reason first, what each does to routing and to the prompt, and that a request with no effort or an unknown one falls back to Medium.
- `tests/unit/reasoning-stream.test.ts`, 14 tests:
  - Provider reasoning (both field names, and Anthropic's `thinking_delta`) comes out inside `<thinking>`, the tag closes if the stream ends early, and the text survives being split across chunks.
  - What comes out reads as a thinking block and then an answer.
  - Anthropic's request asks for thinking only when it is wanted, and a model that refuses it is asked again without it.
  - These tests were checked by breaking the code four ways and watching one fail each time.
- `tests/e2e/thinking.spec.ts`: Medium is the default. The block is open while the model works and folded afterwards. The thought sits above the answer. Low shows no block. Cyphor Deep on Low still thinks. High is kept after a reload and can be set from the model menu or from Settings. axe scans (light and dark) cover the Effort view and a reply with its thinking open and folded.

**Not tested.** A real model. The demo model and the fake providers follow the rules by construction. A real model that ignores the request for `<thinking>` tags and has no reasoning field of its own answers without a Thinking block. Cyphor asks for the thinking and shows it. It cannot force a model to do it.

## 9. Every colour of Cyberpunk 2077 and its genre

**What.** Eight genre colours: yellow `#fcee09`, cyan `#00f0ff`, red `#ff003c`, magenta `#ff2a6d`, violet `#9d4dff`, blue `#2f6bff`, orange `#ff7a00` and green `#39ff88`. Yellow is the main action and the logo, cyan is focus and anything live, and red is danger. All eight appear in the code colours, the lights of the city and the themes. Provider nodes use five of them. Red and yellow stay out because they mean "failing" and "resting", and magenta stays out because it reads as red beside them. `DESIGN.md` lists the job of each colour.

**Evidence.** `tests/unit/palettes.test.ts`, "all eight genre colours are used: in the themes, the city lights and the code colours". `tests/unit/provider-hue.test.ts`: every provider hue is a genre colour, neighbours in the list differ, and the assignment never changes.

**Not tested, and a limit.** "Every colour in the game" is not a fixed set. These eight are a reading of the game's palette and of the genre. No colour was sampled from the game's artwork. With more than five providers connected, two can share a colour, and the name is always beside it.

## 10. A moving city behind the chat

**What.** A night city drawn with three.js (WebGL) behind every chat: a wet, mirror-like street of towers with lit windows and neon edges, signs and billboards, lamps and rooftop beacons, cars and flying cars with head and tail lights, rain, fog and a bloom pass. New blocks are built as old ones pass behind the camera, so the street does not repeat. The colours follow the current theme. A quality governor lowers the detail (high, medium, low) when frames are slow, and switches the city off, with the reason shown in Settings, if low is still too slow. With reduced motion or Effects off it draws one still frame. It loads as its own chunk, after the page has painted. It shows in the dark scheme only.

**Where.** `lib/scene/city/` (`layout.ts` the streets and buildings, `engine.ts` the drawing, `glsl.ts` the shaders, `atlas.ts` the sign pictures, `governor.ts` the quality, `rng.ts` the seeded randomness) and `components/city-background.tsx`. `TOOLKIT.md` lists the other tools that were considered.

**Evidence.**

- `tests/unit/city-layout.test.ts`, 15 tests: a block built from one seed is always the same, buildings stay off the road and do not overlap, very tall towers carry a red roof light, walkways join two towers and stay out of the road, and lamps stand on the pavement.
- `tests/unit/city-governor.test.ts`, 17 tests: it leaves a smooth 30 or 60 frames a second alone, steps down on slow frames, forgets a bad stretch, and treats a ten second gap as a sleeping tab.
- `tests/e2e/city.spec.ts`: the choice is remembered and Settings says what the city is doing. On a machine that draws WebGL on the CPU, the page says why there is no city and offers the themes. Pinned to low quality with reduced motion, the city starts and draws one frame.

**Not tested.** How the city looks and runs on a real graphics card. It was drawn here only by a software renderer, where Cyphor refuses it by default and the tests pin `?city=low`. Frame rate, battery use on a phone, and whether it looks real to you are unknown. The light-scheme message in Settings has no browser test. If the city runs badly on your machine, switch it off in Settings under Appearance.

## 11. A choice to keep the city or not

**What.** The first time the home screen opens, a card asks "Keep the moving city?" with the city already running behind it. "No city, change themes" turns it off. Settings under Appearance has the same choice later. The answer is kept in the browser, one copy for each account, so a new browser asks again.

**Where.** `components/scene-choice.tsx`, `components/settings/appearance.tsx`.

**Evidence.** `tests/e2e/city.spec.ts`: a new account is asked once and the question does not come back, the question can be read and answered with the keyboard, and Settings switches between the city and no city. axe scans cover the question and the Appearance section.

## 12. Without the city, a different theme on every refresh

**What.** Eight themes: Night City, Redline, Neon Rain, Afterglow, Toxic, Voltage, Solar Flare and Violet Dusk. "Every refresh" picks a different theme on each page load and never the one shown last time. A short inline script sets the theme before the first paint, so the page does not flash. You can pin one theme in Settings under Appearance, and it stays after a reload.

**Where.** `lib/scene/palettes.ts`, `app/palettes.css` (generated by `npm run build:palettes`), `lib/no-flash.ts`, `lib/palette.ts`, `components/settings/palette-picker.tsx`.

**Evidence.**

- `tests/unit/palettes.test.ts`: rotation never repeats the theme shown last, whatever the dice say, and the generated stylesheet matches its source.
- `tests/unit/no-flash.test.ts`: rotation uses every theme, avoids the last one even across a closed tab, and still works with storage blocked. The script is plain ES5 so that old browsers can run it.
- `tests/e2e/city.spec.ts`: every reload shows a different theme from the one before, and a theme you pick stays after a reload until you choose Every refresh again.

**Not tested.** Browsers other than Chromium.

## 13. Your engineering and design directives

| Directive | What was done |
| --- | --- |
| Audit before changing | The project and the twelve repositories in your list were read first. `TOOLKIT.md` records each one, what it changed and what was left out. |
| Reuse what exists | The UI is built from 47 shadcn/ui components (new-york style). The existing store, router and API were extended. |
| Design system | `DESIGN.md`, in the design.md format, lints clean. |
| Responsive | The browser tests run at 1440 x 900, 768 x 1024 and 390 x 844. Nothing scrolls sideways from 320 px to 1920 px. |
| Separate verified from untested | This file, and the "Not tested" lines above. |
| Ask before installs, credentials and paid services | The packages the features need (Better Auth, Drizzle, pg, three.js and others) are in `package.json`. Ponytail, 21st.dev (it needs your key and your approval) and the unlazy scripts were not installed. The ledger format from unlazy is used for this file. No key was asked for, written to a file or shown. |
| Figma | The Figma server is registered in `.mcp.json` and needs your sign-in. No Figma file is part of this delivery. |
| Lint | No linter is configured. The checks are the type check, the unit tests, the production build and the browser tests. |

## What was run

| Check | Command | Result on 2026-11-20 |
| --- | --- | --- |
| Types | `npx tsc --noEmit --incremental false` | No errors |
| Unit tests | `npm run test:unit` | 355 tests, 355 pass |
| Production build | `npm run build` | Builds. The first run after an install can exit with an error although the build finished (it prints a notice about the Next.js advisories). A second run is clean. |
| Browser tests | `npm run test:e2e` against the production build | 337 pass, 0 fail, 58 skipped, across desktop, tablet and phone |
| Design file | `npx @google/design.md lint DESIGN.md` | 0 errors, 0 warnings, 1 info |
| Dependencies | `npm audit` | 6 advisories against Next.js 16.4.3, all fixed in 16.4.5 and later, and moderate ones in two development tools (`drizzle-kit` and `shadcn`). The README says how to apply the fix and why the other two are left alone. |

The browser tests were run as several commands against one build, because the machine they ran on limits a single command to ten minutes. They were not run as one `npm run test:e2e`. The 58 skips are tests that only make sense on some screens (a hardware keyboard, the docked panel, the share sheet on touch screens, API checks that do not depend on screen size, and tablet repeats of scans that the desktop and phone runs already cover) and the diagram test that needs the CDN. Each says why when it skips.

## Not tested, in one place

- A live Neon database, a real Google sign-in, and any real provider key. The first run with your own values is the first real check: one sign-up, one Google sign-in and one message to each provider you use.
- The city on a real graphics card: how it looks, its frame rate and its battery use.
- Drawing a Mermaid diagram, and whether jsDelivr serves the bytes npm publishes.
- Any browser other than Chromium.
- Deployment to a host, including the return address Google needs on a real domain.
- Tap-target sizes on a real phone. The 40 px minimum is a rule in `DESIGN.md`, and no test measures it.
- A real model's behaviour for thinking and artifacts.
- The resting edge of form fields, which is under the 3:1 of WCAG 1.4.11 (see section 2).
- The Impeccable detector, which was not run. Ponytail and 21st.dev, which were not installed.
- A Next.js advisory about forwarded `fetch` responses, which was not assessed.
- Email confirmation and password reset, which do not exist.
- `@gsap/react` is installed and unused.

## To run it again

```bash
npx tsc --noEmit --incremental false
npm run test:unit
npm run build
npm run test:e2e                  # builds, starts three servers, runs the browser suite
SKIP_BUILD=1 npm run test:e2e     # reuses the build you already made
npx @google/design.md lint DESIGN.md
npm audit
```

If Playwright cannot find its browser, run `npx playwright install chromium`, or set `PW_CHROMIUM_PATH=/path/to/chrome` (and `PW_NO_SANDBOX=1` when running as root). `README.md` has the rest.
