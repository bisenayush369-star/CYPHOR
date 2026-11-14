import { defineConfig } from "@playwright/test"

/**
 * End-to-end and accessibility tests, run on a desktop, a tablet and a phone viewport.
 *
 *   npm run test:e2e     builds the app and starts three servers (tests/e2e/servers.mjs), then runs everything:
 *                          http://127.0.0.1:4173   Cyphor with nothing connected, so the built-in demo model answers
 *                          http://127.0.0.1:4174   Cyphor with fake providers connected (router, God Mode, web sources)
 *                          http://127.0.0.1:4599   the fake providers themselves
 *   SKIP_BUILD=1 npm run test:e2e                  reuses the build you already made
 *   BASE_URL=http://localhost:3000 ROUTER_URL=... npm run test:e2e
 *                                                  uses servers you started yourself (nothing is built or started;
 *                                                  the router tests run only when ROUTER_URL is given too)
 *
 * If Playwright cannot find its own browser, point it at one you have:
 *   PW_CHROMIUM_PATH=/path/to/chrome   (add PW_NO_SANDBOX=1 when running as root, for example in a container)
 * No real key or network is used: the providers are fakes and every key in the tests is made up.
 */
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173"
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath,
      args: process.env.PW_NO_SANDBOX ? ["--no-sandbox"] : [],
    },
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "node tests/e2e/servers.mjs",
        url: "http://127.0.0.1:4173/api/models",
        reuseExistingServer: !process.env.CI,
        timeout: 420_000,
      },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    {
      name: "tablet",
      testIgnore: /a11y/,
      use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
    },
    {
      name: "phone",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
})
