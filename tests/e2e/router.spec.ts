import { expect, test, type Page } from "@playwright/test"
import { beyondScreen, composer, horizontalOverflow, open, openSettings, reload, scan, send, settings, waitForReply } from "./helpers"

/**
 * The router, God Mode and web sources, in the browser and over the API.
 *
 * These run against Cyphor with three fake providers connected (Groq, Mistral and Anthropic) and a fake web
 * search, which tests/e2e/servers.mjs starts on port 4174. Every key is made up and nothing reaches a real
 * service. What a fake provider does is decided by what you write to it (see fake-llm.mjs).
 *
 * Real failures (a provider that is down, a rate limit, a slow first byte) are tested in tests/unit/router.test.ts,
 * where the timing can be controlled. Here, the screens that show a failure are tested with the server's answer
 * scripted, so no browser test ever puts a provider to rest for the tests running next to it.
 */
const ROUTER_URL = process.env.ROUTER_URL ?? "http://127.0.0.1:4174"

test.skip(!!process.env.BASE_URL && !process.env.ROUTER_URL, "Set ROUTER_URL to a Cyphor that has providers connected to run these.")
test.use({ baseURL: ROUTER_URL })

/** Anything that looks like one of the made-up keys the test servers were started with. */
const LEAK = /e2e-(groq|mistral|anthropic|tinyfish)-key/

const CONNECTED = [
  { label: "Groq", env: "GROQ_API_KEY" },
  { label: "Mistral", env: "MISTRAL_API_KEY" },
  { label: "Anthropic", env: "ANTHROPIC_API_KEY" },
]
const NOT_CONNECTED = ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "ZAI_API_KEY", "NVIDIA_API_KEY", "COHERE_API_KEY", "META_API_KEY", "CLOUDFLARE_API_KEY", "AIONLABS_API_KEY", "LLM_BASE_URL"]

const modelButton = (page: Page) => page.getByRole("button", { name: /^Model: .+\. Change model$/ })

async function openPicker(page: Page) {
  await modelButton(page).click()
  await expect(page.getByRole("menu")).toBeVisible()
}

async function useModel(page: Page, name: RegExp) {
  await openPicker(page)
  await page.getByRole("menuitemradio", { name }).click()
}

/** Picks one model by its own name from the library, the way a person does. Returns the name it picked. */
async function pickFromLibrary(page: Page, search: string) {
  await openPicker(page)
  await page.getByRole("menuitem", { name: "Browse all models" }).click()
  const library = page.getByRole("dialog", { name: "Models" })
  await library.getByLabel("Search models").fill(search)
  const use = library.getByRole("button", { name: /^Use / })
  await expect(use).toHaveCount(1)
  const name = (await use.getAttribute("aria-label"))!.replace(/^Use /, "")
  await use.click()
  await expect(library).toBeHidden()
  await expect(modelButton(page)).toHaveAttribute("aria-label", `Model: ${name}. Change model`)
  return name
}

/** Turns on Web search or Research from the + menu in the message box. */
async function turnOn(page: Page, option: "Web search" | "Research") {
  await page.getByRole("button", { name: "Add files, connectors and tools" }).click()
  await page.getByRole("menuitemcheckbox", { name: option }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: `${option} is on. Turn off` })).toBeVisible()
}

/** Makes the server's answers to the next messages exactly these lines, for a screen that is hard to reach for real. */
async function script(page: Page, ...replies: object[][]) {
  let n = 0
  await page.route("**/api/chat", (route) => {
    const events = replies[Math.min(n++, replies.length - 1)]
    return route.fulfill({ status: 200, contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n" })
  })
}

const providerRow = (page: Page, env: string) => settings(page).getByRole("list", { name: "Connected providers" }).getByRole("listitem").filter({ hasText: env })

/** The button that folds the God Mode panel in and out. Its name starts with the title and goes on with the summary. */
const councilToggle = (page: Page, summary: RegExp) => page.getByRole("button", { name: new RegExp(`^God Mode\\b.*${summary.source}`) })

test.describe("in the browser", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test.describe("Router settings", () => {
    test("lists each connected provider by the name of its variable, and never shows a key", async ({ page }) => {
      await openSettings(page, "Router")
      const pane = settings(page)
      await expect(pane.getByRole("heading", { level: 3, name: "Router" })).toBeVisible()

      const rows = pane.getByRole("list", { name: "Connected providers" }).getByRole("listitem")
      await expect(rows).toHaveCount(CONNECTED.length)
      for (const { label, env } of CONNECTED) {
        const row = providerRow(page, env)
        await expect(row).toContainText(label)
        await expect(row).toContainText("Connected")
        await expect(row).toContainText(/\d+ models? · listed in/)
      }
      await expect(pane.getByRole("status").filter({ hasText: /^3 of \d+ connected$/ })).toBeVisible()
      await expect(pane).toContainText("Ready: two or more providers can answer.")
      await expect(pane).toContainText("Ready. Switch on Web search")

      expect(await page.content()).not.toMatch(LEAK)
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(LEAK)
    })

    test("lists the providers that are not connected, with the variable each one reads", async ({ page }) => {
      await openSettings(page, "Router")
      const pane = settings(page)
      const toggle = pane.getByRole("button", { name: `Not connected (${NOT_CONNECTED.length})` })
      await expect(toggle).toHaveAttribute("aria-expanded", "false")
      await toggle.click()
      const list = pane.getByRole("list", { name: "Providers that are not connected" })
      for (const env of NOT_CONNECTED) await expect(list.getByText(env, { exact: true })).toBeVisible()

      const docs = pane.getByRole("link", { name: /^Docs for .*opens in a new tab$/ })
      await expect(docs).toHaveCount(NOT_CONNECTED.length)
      for (const link of await docs.all()) {
        await expect(link).toHaveAttribute("target", "_blank")
        await expect(link).toHaveAttribute("rel", /noopener/)
      }
    })

    test("Test sends one message to a provider and says how it went", async ({ page }) => {
      await openSettings(page, "Router")
      const row = providerRow(page, "GROQ_API_KEY")
      await row.getByRole("button", { name: "Test" }).click()
      await expect(row.getByText(/^Works\. .+ answered in \d+\.\d s\.$/)).toBeVisible()
      await expect(row).toContainText("Connected")
    })

    test("Refresh asks the server again", async ({ page }) => {
      await openSettings(page, "Router")
      const asked = page.waitForRequest((r) => r.url().includes("/api/models?") && r.url().includes("refresh=1"))
      await settings(page).getByRole("button", { name: "Refresh" }).click()
      await asked
      await expect(settings(page).getByRole("status").filter({ hasText: /^3 of \d+ connected$/ })).toBeVisible()
    })

    test("switching providers off leaves God Mode short of a panel", async ({ page }) => {
      await openSettings(page, "Router")
      const pane = settings(page)
      await expect(pane).toContainText("Ready: two or more providers can answer.")
      await pane.getByRole("switch", { name: "Use Groq" }).click()
      await pane.getByRole("switch", { name: "Use Mistral" }).click()
      await expect(pane.getByText("Needs two connected providers.")).toBeVisible()
      await expect(pane.getByText("Switched off")).toHaveCount(2)
      await expect(providerRow(page, "ANTHROPIC_API_KEY")).toContainText("Connected")

      await pane.getByRole("button", { name: "Close settings" }).click()
      await openPicker(page)
      const god = page.getByRole("menuitemradio", { name: /God Mode/ })
      await expect(god).toBeDisabled()
      await expect(god).toContainText("Needs two connected providers.")
    })

    test("the routing priority and the panel size are kept across a reload", async ({ page }) => {
      await openSettings(page, "Router")
      await settings(page).getByRole("radio", { name: /Best quality/ }).click()
      await settings(page).getByRole("slider", { name: "God Mode panel size" }).press("Home")
      await expect(settings(page).getByText("Panel size: 2 providers")).toBeVisible()

      await reload(page)
      await openSettings(page, "Router")
      await expect(settings(page).getByRole("radio", { name: /Best quality/ })).toBeChecked()
      await expect(settings(page).getByText("Panel size: 2 providers")).toBeVisible()
    })

    test("nothing is cut off at this screen width", async ({ page }) => {
      await openSettings(page, "Router")
      await settings(page).getByRole("button", { name: /^Not connected/ }).click()
      await expect(settings(page).getByRole("list", { name: "Providers that are not connected" })).toBeVisible()
      expect(await beyondScreen(settings(page))).toEqual([])
    })
  })

  test.describe("the model picker and library", () => {
    test("say which model each Cyphor model would use right now", async ({ page }) => {
      await openPicker(page)
      for (const name of [/Cyphor Auto/, /Cyphor Swift/, /Cyphor Core/, /Cyphor Deep/, /Cyphor Code/]) {
        await expect(page.getByRole("menuitemradio", { name })).toContainText(/Now: (Groq|Mistral|Anthropic) · \S/)
      }
      await expect(page.getByRole("menuitemradio", { name: /God Mode/ })).toBeEnabled()
    })

    test("the library lists every model of the connected providers, and filters by provider", async ({ page }) => {
      await openPicker(page)
      await page.getByRole("menuitem", { name: "Browse all models" }).click()
      const library = page.getByRole("dialog", { name: "Models" })
      // Each card holds small lists of its own (tags, scores), so count only the cards.
      const cards = library.getByRole("list", { name: "Models" }).locator(":scope > li")
      await expect(cards).toHaveCount(6)
      await expect(library).toContainText("6 of 6 models")

      const filter = library.getByRole("group", { name: "Filter by provider" })
      await filter.getByRole("button", { name: /^Groq/ }).click()
      await expect(cards).toHaveCount(2)
      for (const card of await cards.all()) await expect(card).toContainText("Groq")
      await expect(filter.getByRole("button", { name: /^Groq/ })).toHaveAttribute("aria-pressed", "true")

      await filter.getByRole("button", { name: /^All/ }).click()
      await library.getByLabel("Search models").fill("no-such-model")
      await expect(library).toContainText("No model matches")
      expect(await beyondScreen(library)).toEqual([])
    })
  })

  test.describe("replies", () => {
    test("auto routing answers from a connected provider and says who and why", async ({ page }) => {
      await send(page, "Tell me a fun fact about otters")
      await waitForReply(page)

      const chip = page.getByRole("button", { name: /^Answered by .+\. Chosen by Cyphor\. Show details$/ })
      await expect(chip).toBeVisible()
      const provider = /, (Groq|Mistral|Anthropic)\. Chosen by Cyphor/.exec((await chip.getAttribute("aria-label")) ?? "")?.[1]
      expect(provider, "the chip names one of the connected providers").toBeTruthy()
      // The words in the reply come from the provider the chip names, so the chip is telling the truth.
      await expect(page.getByText(new RegExp(`${provider} here\\. You asked: Tell me a fun fact about otters`))).toBeVisible()

      await chip.click()
      const details = page.getByRole("dialog").filter({ hasText: "Chosen by Cyphor" })
      await expect(details).toBeVisible()
      await expect(details).toContainText(provider!)
    })

    test("a model picked by name answers, and the reply says you chose it", async ({ page }) => {
      const name = await pickFromLibrary(page, "mistral-large")
      await send(page, "Say hello")
      await waitForReply(page)
      await expect(page.getByText(/Mistral here\. You asked: Say hello/)).toBeVisible()
      await expect(page.getByRole("button", { name: `Answered by ${name}, Mistral. Chosen by you. Show details` })).toBeVisible()
    })

    test("God Mode asks every provider, then shows one merged answer and who took part", async ({ page }) => {
      await useModel(page, /God Mode/)
      await expect(modelButton(page)).toHaveAttribute("aria-label", "Model: God Mode. Change model")
      await send(page, "Explain recursion in one paragraph")
      await waitForReply(page)
      await expect(page.getByText("Merged answer from the panel.")).toBeVisible()

      const toggle = councilToggle(page, /3 of 3 answered, merged by \S/)
      await expect(toggle).toBeVisible()
      await expect(toggle, "folded away once the panel has finished").toHaveAttribute("aria-expanded", "false")
      await toggle.click()
      for (const { label } of CONNECTED) await expect(page.getByText(new RegExp(`^${label}\\b`)).first()).toBeVisible()
      await expect(page.getByText("Drafting")).toHaveCount(0)
    })

    test("the panel size in Router settings decides how many providers God Mode asks", async ({ page }) => {
      await openSettings(page, "Router")
      await settings(page).getByRole("slider", { name: "God Mode panel size" }).press("Home")
      await expect(settings(page).getByText("Panel size: 2 providers")).toBeVisible()
      await settings(page).getByRole("button", { name: "Close settings" }).click()

      await useModel(page, /God Mode/)
      await send(page, "Explain recursion in one paragraph")
      await waitForReply(page)
      await expect(councilToggle(page, /2 of 2 answered/)).toBeVisible()
    })

    for (const option of ["Web search", "Research"] as const) {
      test(`${option} lists the pages the reply was based on`, async ({ page }) => {
        await turnOn(page, option)
        await send(page, "What is new in Next.js 16?")
        await waitForReply(page)
        await expect(page.getByText(/Web results were provided \[1\]\./)).toBeVisible()

        const sources = page.getByRole("link", { name: /Example \d/ })
        await expect(sources).toHaveCount(3)
        await expect(sources.first()).toHaveAttribute("href", "https://example.com/e2e-1")
        for (const link of await sources.all()) {
          await expect(link).toHaveAttribute("target", "_blank")
          await expect(link).toHaveAttribute("rel", /noopener/)
        }
      })
    }

    test("a provider that repeats its key back never gets it onto the page or into the saved chat", async ({ page }) => {
      await pickFromLibrary(page, "llama-3.3")
      await send(page, "ECHO_KEY please")
      const alert = page.getByRole("alert").filter({ hasText: "Couldn't get a reply" })
      await expect(alert).toBeVisible()
      await expect(alert).toContainText("[key hidden]")
      await expect(alert.getByRole("button", { name: "Check the router" })).toBeVisible()

      expect(await page.content()).not.toMatch(LEAK)
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(LEAK)

      // The copy the server kept says the same, and does not have the key either.
      const id = /\/chat\/(c_[\w-]+)/.exec(page.url())![1]
      const saved = () => page.request.get(`/api/conversations/${id}`).then((r) => r.text())
      await expect.poll(saved).toContain("[key hidden]")
      expect(await saved()).not.toMatch(LEAK)
    })
  })

  test.describe("when a reply goes wrong (the server's answer is scripted)", () => {
    test("an error says what happened and leads to the router settings", async ({ page }) => {
      await script(page, [{ type: "error", message: "Every provider failed. The last one said: The fake provider is down.", status: 502 }])
      await send(page, "Hello")
      const alert = page.getByRole("alert").filter({ hasText: "Couldn't get a reply" })
      await expect(alert).toContainText("The fake provider is down.")
      await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible()

      await alert.getByRole("button", { name: "Check the router" }).click()
      await expect(settings(page).getByRole("tab", { name: "Router" })).toHaveAttribute("aria-selected", "true")
    })

    test("a reply that switched models says so", async ({ page }) => {
      await script(page, [
        { type: "route", route: { mode: "fallback", provider: "mistral", providerLabel: "Mistral", model: "mistral-large-latest", name: "Mistral Large", reason: "Groq did not answer, so Cyphor moved on to Mistral Large.", task: "general" } },
        { type: "text", text: "An answer from the second choice." },
        { type: "done" },
      ])
      await send(page, "Hello")
      await waitForReply(page)
      await expect(page.getByText("An answer from the second choice.")).toBeVisible()

      await page.getByRole("button", { name: "Answered by Mistral Large, Mistral. Switched after a failure. Show details" }).click()
      await expect(page.getByRole("dialog")).toContainText("Groq did not answer, so Cyphor moved on to Mistral Large.")
    })

    test("a God Mode panel shows who answered, who was too slow and who failed", async ({ page }) => {
      const member = (provider: string, label: string, name: string, extra: object) => ({ key: `${provider}:${name}`, provider, providerLabel: label, model: name, name, ...extra })
      await script(page, [
        {
          type: "council",
          council: {
            phase: "done",
            members: [
              member("groq", "Groq", "Llama 3.3 70B", { status: "done", ms: 900, snippet: "A short draft." }),
              member("mistral", "Mistral", "Mistral Large", { status: "timeout" }),
              member("anthropic", "Anthropic", "Claude Sonnet 4.5", { status: "failed", error: "The provider said no." }),
            ],
            chair: { provider: "groq", providerLabel: "Groq", model: "Llama 3.3 70B", name: "Llama 3.3 70B" },
            note: "One provider was too slow and one failed.",
          },
        },
        { type: "text", text: "Merged from what was available." },
        { type: "done" },
      ])
      await send(page, "Hello")
      await waitForReply(page)

      await councilToggle(page, /1 of 3 answered, merged by Llama 3\.3 70B/).click()
      await expect(page.getByText("Too slow", { exact: true })).toBeVisible()
      await expect(page.getByText("Failed", { exact: true })).toBeVisible()
      await expect(page.getByText("The provider said no.")).toBeVisible()
      await expect(page.getByText("A short draft.")).toBeVisible()
      await expect(page.getByText("One provider was too slow and one failed.")).toBeVisible()
    })

    test("long names, many sources and a long unbroken word never push the page sideways", async ({ page }) => {
      const LONG = "an-extremely-long-name-with-no-spaces-in-it-".repeat(4)
      const member = (provider: string, label: string, extra: object) => ({ key: `${provider}:${LONG}`, provider, providerLabel: label, model: LONG, name: LONG, ...extra })
      await script(
        page,
        [
          { type: "web", query: "q", sources: [1, 2, 3, 4, 5, 6].map((n) => ({ title: LONG, url: `https://example.com/long-${n}`, site: LONG, snippet: LONG })), note: "Only some of the pages could be read, so parts of this answer may be out of date." },
          {
            type: "council",
            council: {
              phase: "done",
              members: [member("groq", "Groq", { status: "done", ms: 1200, snippet: LONG }), member("mistral", "Mistral", { status: "failed", error: LONG }), member("anthropic", "Anthropic", { status: "timeout" })],
              chair: { provider: "groq", providerLabel: "Groq", model: LONG, name: LONG },
              note: "A note about the panel.",
            },
          },
          { type: "text", text: `A reply with one very long word: ${LONG}` },
          { type: "done" },
        ],
        [
          { type: "route", route: { mode: "direct", provider: "groq", providerLabel: "Groq", model: LONG, name: LONG, reason: "You chose it." } },
          { type: "text", text: "A second reply." },
          { type: "done" },
        ]
      )
      await send(page, "Hello")
      await waitForReply(page)
      await councilToggle(page, /answered/).click()
      await page.getByRole("button", { name: "Show all 6" }).click()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
      expect(await beyondScreen(page.locator('[data-role="assistant"]'))).toEqual([])

      await composer(page).fill("And again")
      await page.getByRole("button", { name: "Send message" }).click()
      const chip = page.getByRole("button", { name: /^Answered by an-extremely-long-name/ })
      await expect(chip).toBeVisible()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
      expect(await beyondScreen(page.locator('[data-role="assistant"]').last())).toEqual([])
    })
  })

  for (const scheme of ["light", "dark"] as const) {
    test.describe(`accessibility with providers connected (${scheme})`, () => {
      test.use({ colorScheme: scheme })
      test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name === "tablet", "the desktop and phone scans cover the sizes either side")
      })

      test("Router settings", async ({ page }) => {
        await openSettings(page, "Router")
        await settings(page).getByRole("button", { name: /^Not connected/ }).click()
        await expect(settings(page).getByRole("list", { name: "Connected providers" })).toBeVisible()
        await scan(page, "Router settings")
      })

      test("the model picker", async ({ page }) => {
        await openPicker(page)
        await expect(page.getByRole("menuitemradio", { name: /Cyphor Auto/ })).toContainText("Now:")
        await scan(page, "model picker", '[role="menu"]')
      })

      test("the model library", async ({ page }) => {
        await openPicker(page)
        await page.getByRole("menuitem", { name: "Browse all models" }).click()
        await expect(page.getByRole("dialog", { name: "Models" }).getByRole("list", { name: "Models" })).toBeVisible()
        await scan(page, "model library")
      })

      test("a God Mode reply with its panel open", async ({ page }) => {
        await useModel(page, /God Mode/)
        await send(page, "Explain recursion in one paragraph")
        await waitForReply(page)
        await councilToggle(page, /3 of 3 answered/).click()
        await expect(page.getByText(/^Anthropic\b/).first()).toBeVisible()
        await scan(page, "God Mode reply")
      })

      test("a reply with web sources and its route details", async ({ page }) => {
        await turnOn(page, "Web search")
        await send(page, "What is new in Next.js 16?")
        await waitForReply(page)
        await expect(page.getByRole("link", { name: /Example 1/ })).toBeVisible()
        await page.getByRole("button", { name: /^Answered by / }).click()
        await expect(page.getByRole("dialog").filter({ hasText: "Chosen by Cyphor" })).toBeVisible()
        await scan(page, "reply with sources and route details")
      })
    })
  }
})

/* ------------------------------------------------------------------ */

test.describe("the API", () => {
  test.skip(({ isMobile }) => isMobile, "the screen size does not matter here, so the desktop run is enough")

  const body = (text: string, model = "cyphor-auto") => ({
    chatId: null,
    assistantId: "m_api_reply",
    model,
    system: "",
    thread: [{ id: "m_api_user", parentId: null, role: "user", content: text, createdAt: Date.now() }],
  })
  type Event = { type: string; [key: string]: unknown }
  const lines = (text: string) =>
    text
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as Event)

  test("GET /api/models names the variables and never returns a key", async ({ request }) => {
    const res = await request.get("/api/models")
    expect(res.status()).toBe(200)
    expect(res.headers()["cache-control"]).toContain("no-store")
    const text = await res.text()
    expect(text).not.toMatch(LEAK)

    const catalog = JSON.parse(text)
    expect(catalog.mode).toBe("router")
    const connected = catalog.providers.filter((p: { configured: boolean }) => p.configured).map((p: { id: string }) => p.id)
    expect(connected.sort()).toEqual(["anthropic", "groq", "mistral"])
    expect(catalog.providers.find((p: { id: string }) => p.id === "groq").keyEnv).toBe("GROQ_API_KEY")
    expect(catalog.godReady).toBe(true)
    expect(catalog.web).toMatchObject({ configured: true, keyEnv: "TINYFISH_API_KEY" })
    expect(catalog.models).toHaveLength(6)
    expect(catalog.virtual["cyphor-auto"]).toBeTruthy()
  })

  test("?disabled= leaves providers out of every pick and out of God Mode", async ({ request }) => {
    const catalog = await (await request.get("/api/models?disabled=groq,mistral")).json()
    expect(catalog.godReady).toBe(false)
    const picks = Object.values(catalog.virtual).filter(Boolean) as { provider: string }[]
    expect(picks.length).toBeGreaterThan(0)
    for (const pick of picks) expect(pick.provider).toBe("anthropic")
  })

  test("testing a provider sends it one message and reports back without the key", async ({ request }) => {
    const res = await request.post("/api/models", { data: { provider: "groq" } })
    expect(res.status()).toBe(200)
    const text = await res.text()
    expect(text).not.toMatch(LEAK)
    expect(JSON.parse(text)).toMatchObject({ ok: true })
  })

  test("testing a provider that does not exist is a 400 that says what to do", async ({ request }) => {
    const res = await request.post("/api/models", { data: { provider: "not-a-provider" } })
    expect(res.status()).toBe(400)
    expect((await res.json()).error.message).toBe("Say which provider to test.")
  })

  test("POST /api/chat streams the route, the text and the end as lines of JSON", async ({ request }) => {
    const res = await request.post("/api/chat", { data: body("Say hello to the router") })
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("application/x-ndjson")
    expect(res.headers()["x-cyphor-model"]).toBe("cyphor-auto")

    const events = lines(await res.text())
    expect(events[0].type).toBe("route")
    expect(events.at(-1)?.type).toBe("done")
    expect(events.some((e) => e.type === "error")).toBe(false)
    const route = events[0].route as { mode: string; providerLabel: string }
    expect(route.mode).toBe("auto")
    const reply = events.filter((e) => e.type === "text").map((e) => e.text).join("")
    expect(reply).toBe(`${route.providerLabel} here. You asked: Say hello to the router`)
  })

  test("POST /api/chat with God Mode runs a panel of every provider and merges it", async ({ request }) => {
    const res = await request.post("/api/chat", { data: body("Explain recursion in one paragraph", "cyphor-god") })
    expect(res.status()).toBe(200)
    const events = lines(await res.text())
    expect(events.some((e) => e.type === "error")).toBe(false)
    expect(events.at(-1)?.type).toBe("done")

    const councils = events.filter((e) => e.type === "council").map((e) => e.council as { phase: string; members: { provider: string; status: string }[]; chair?: unknown })
    expect(councils.length).toBeGreaterThan(1)
    expect(councils[0].phase).toBe("drafting")
    const last = councils.at(-1)!
    expect(last.phase).toBe("done")
    expect(last.members.map((m) => m.provider).sort()).toEqual(["anthropic", "groq", "mistral"])
    expect(last.members.every((m) => m.status === "done")).toBe(true)
    expect(last.chair).toBeTruthy()
    expect(events.filter((e) => e.type === "text").map((e) => e.text).join("")).toBe("Merged answer from the panel.")
  })

  test("POST /api/chat with web search sends the sources first, then a reply that used them", async ({ request }) => {
    const res = await request.post("/api/chat", { data: { ...body("What is new in Next.js 16?"), web: "search" } })
    const events = lines(await res.text())
    const web = events.find((e) => e.type === "web") as Event & { sources: { url: string }[] }
    expect(web.sources.map((s) => s.url)).toEqual(["https://example.com/e2e-1", "https://example.com/e2e-2", "https://example.com/e2e-3"])
    expect(events.indexOf(web)).toBeLessThan(events.findIndex((e) => e.type === "text"))
    expect(events.filter((e) => e.type === "text").map((e) => e.text).join("")).toContain("Web results were provided [1].")
  })

  test("POST /api/chat hides a key that a provider repeats back", async ({ request }) => {
    const res = await request.post("/api/chat", { data: body("ECHO_KEY please", "groq:llama-3.3-70b-versatile") })
    const text = await res.text()
    expect(text).not.toMatch(LEAK)
    const error = lines(text).find((e) => e.type === "error")
    expect(error?.message).toContain("[key hidden]")
  })

  test("POST /api/chat with a model that is not connected says so instead of guessing", async ({ request }) => {
    const res = await request.post("/api/chat", { data: body("Hello", "gemini:gemini-2.5-pro") })
    const events = lines(await res.text())
    const error = events.find((e) => e.type === "error")
    expect(error, "a model that is not connected must not be answered by another one").toBeTruthy()
    expect(events.some((e) => e.type === "text")).toBe(false)
  })

  test("POST /api/chat with a body that is not a conversation is a 400", async ({ request }) => {
    const res = await request.post("/api/chat", { data: { model: "cyphor-auto" } })
    expect(res.status()).toBe(400)
    expect((await res.json()).error.message).toMatch(/thread/)
  })

  test("a write that comes from another site is refused", async ({ request }) => {
    const res = await request.post("/api/chat", { data: body("Hello"), headers: { Origin: "https://evil.example" } })
    expect(res.status()).toBe(403)
    expect((await res.json()).error.code).toBe("forbidden")
  })
})
