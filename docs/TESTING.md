# Testing

How to run the checks, what each one covers, the numbers that were measured, and what nothing tests.

## 1. The four checks

| Check | Command | What it proves |
| --- | --- | --- |
| Types | `npx tsc --noEmit` (or `npm run typecheck`) | Every file compiles. The config also rejects unused imports and variables, and a type imported without `import type`. |
| Unit tests | `npm run test:unit` | The server logic and the router, with no network and no browser. 170 tests. |
| Browser tests | `npm run test:e2e` | The real app in a real browser at three screen sizes, plus accessibility scans. It builds the app first, so it is the slow one. |
| Build | `npm run build` | The production build succeeds. |

`npm test` runs the unit tests and then the browser tests. It does not run the type check or the build, so run those yourself.

The scripts in `package.json`:

| Command | What `package.json` runs | Use |
| --- | --- | --- |
| `npm run dev` | `next dev` | Start the development server on http://localhost:3000 |
| `npm run build` | `next build` | Production build |
| `npm run start` | `next start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` | TypeScript check, no output files |
| `npm test` | `npm run test:unit && npm run test:e2e` | Unit tests, then browser tests (no type check, no build) |
| `npm run test:unit` | `node --import ./tests/unit/register.mjs --test "tests/unit/*.test.ts"` | Unit tests (Node's test runner, no network, no browser) |
| `npm run test:e2e` | `playwright test` | Browser tests with Playwright and axe-core |
| `npm run db:generate` | `drizzle-kit generate` | drizzle-kit: write migration files (optional) |
| `npm run db:push` | `drizzle-kit push` | drizzle-kit: apply the schema to the database (optional) |
| `npm run db:studio` | `drizzle-kit studio` | drizzle-kit: look at the data (optional) |
| `npm run tree` | `node scripts/file-tree.mjs` | Rewrite `file-tree.txt` |
| `npm run build:preview` | `vite build --config preview/vite.config.ts` | Build the one-file preview, `dist-preview/index.html` |

## 2. Unit tests

They use Node's own test runner. `tests/unit/register.mjs` lets Node load the project's TypeScript directly (it understands the `@/` import alias and imports without an extension). That is why Node 22.18 or newer is needed. The router tests talk to a small fake provider (`tests/unit/helpers/fake-provider.ts`) on the local machine, so they never touch the internet and never see a real key.

| File | Tests | Covers |
| --- | --- | --- |
| `tests/unit/basic-auth.test.ts` | 17 | The password gate in `proxy.ts` |
| `tests/unit/server-lib.test.ts` | 33 | Retry, rate limits, chat conversion and validation, router metadata checks, the database |
| `tests/unit/router-pure.test.ts` | 59 | Ratings, task detection, scoring, planning, health, env reading and key hiding, web parsing |
| `tests/unit/router.test.ts` | 28 | The router against the fake provider: catalog, routing, failover, God Mode, testing a provider |
| `tests/unit/import.test.ts` | 10 | Backup import |
| `tests/unit/sample-catalog.test.ts` | 14 | The preview's sample providers and routing |
| `tests/unit/save-file.test.ts` | 9 | Saving a file in the browser and in the preview's page frame |

Run one file: `node --import ./tests/unit/register.mjs --test tests/unit/server-lib.test.ts`.

When the steps of [APPLY-GUIDE.md](./APPLY-GUIDE.md) are built up one at a time, the count is 50 after step 2 (`basic-auth` and `server-lib`), 137 after step 3 (adds the two router files) and 170 after step 4.

Two things that trip people up:

- `node_modules` must be a real folder. If it is a symlink to another project's `node_modules`, the tests that import `next/server` fail with "NextRequest is not a constructor". Run `npm install` in the project itself.
- A test must never use a real key or a real network address. Keys in tests are obviously fake, and the environment is passed in as an object instead of read from the machine.

## 3. Browser tests

`npm run test:e2e` builds the app (unless `SKIP_BUILD=1`) and starts three servers (`tests/e2e/servers.mjs`):

| Port | What |
| --- | --- |
| 4173 | Cyphor with nothing connected, so the built-in demo model answers |
| 4174 | Cyphor with three fake providers connected (Groq, Mistral and Anthropic shapes) and a fake web search: routing, God Mode, web sources, failover |
| 4599 | The fake providers themselves (`tests/e2e/fake-llm.mjs`); what one does is decided by what the test writes to it |

It then runs three suites on three screen sizes (`playwright.config.ts`): desktop 1440 x 900, tablet 768 x 1024 and phone 390 x 844.

| File | Covers |
| --- | --- |
| `tests/e2e/app.spec.ts` | Send, stream, stop, edit and retry, artifacts, settings, themes, backup, and the layout from 320 to 1920 px wide |
| `tests/e2e/router.spec.ts` | Providers, the model picker, routing, God Mode, web sources, failover and the API |
| `tests/e2e/a11y.spec.ts` | axe-core scans of the main screens and every settings tab, in light and dark (not run on the tablet size) |

Some tests skip themselves on purpose, each with a reason in the code: one needs a hardware keyboard, one resizes the window itself, one needs the docked artifact panel, and so on.

Setting up and options (also written at the top of `playwright.config.ts`):

```bash
npx playwright install chromium         # once: downloads the browser Playwright uses
npm run test:e2e                        # build, start the three servers, run everything
SKIP_BUILD=1 npm run test:e2e           # reuse the build you already made
BASE_URL=http://localhost:3000 ROUTER_URL=http://localhost:3001 npm run test:e2e
                                        # use servers you started yourself; nothing is built or started,
                                        # and the router tests run only when ROUTER_URL is given too
PW_CHROMIUM_PATH=/path/to/chrome npm run test:e2e    # use a browser you already have
PW_NO_SANDBOX=1 npm run test:e2e                     # add when running as root, for example in a container
```

The ports can be changed with `DEMO_PORT`, `ROUTER_PORT` and `FAKE_LLM_PORT`. With `CI` set, a failed test is retried once and an HTML report is written to `playwright-report/`.

## 4. Measured results

Measured when the project was delivered, on the files in the zip:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | No errors, also at each of the five steps built up from nothing |
| `npm run test:unit` | 170 passed, 0 failed |
| `npm run build` | Succeeded |
| Browser tests, desktop | 89 passed |
| Browser tests, tablet | 32 passed, 27 skipped by design |
| Browser tests, phone | 70 passed, 19 skipped by design |

No browser test failed. A fresh unzip followed by `npm ci` passed the type check, the 170 unit tests and the build.

## 5. What nothing tests

- A **real provider**. Every test uses fakes. Differences in a real provider's error wording or model list are not covered. Use the Test button in Settings > Router with your own keys.
- **Real web search.** The browser tests use a fake. Your TinyFish key is untested here.
- **Several servers.** Rate limits and provider health are kept in memory in each process, so they are tested for one process only.
- **Turso.** The database tests use SQLite files and in-memory databases.
- **Safari and Firefox.** The browser tests run Chromium only.
- **The hosted one-file preview** downloading files: the host blocks downloads.

## 6. When you change something

| You changed | Run |
| --- | --- |
| Any TypeScript | `npx tsc --noEmit` |
| `proxy.ts`, `lib/http.ts`, `lib/chat-messages.ts`, `db/`, an API route | `npm run test:unit` (add a test in `server-lib.test.ts`) |
| `lib/router/` | `npm run test:unit` (`router-pure.test.ts` for logic, `router.test.ts` for behaviour against the fake provider) |
| A screen or a component | `npm run test:e2e`, at least the desktop and phone projects: `npx playwright test --project=desktop --project=phone` |
| Colours or contrast | `npx playwright test a11y` |

Never delete a failing test or loosen it to make it pass. Fix the code, or change the test when the behaviour was meant to change, and say so.
