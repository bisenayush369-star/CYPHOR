import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import {
  ARTIFACT_PROMPT,
  PROMPT,
  TABLE_PROMPT,
  artifactPanel,
  composer,
  horizontalOverflow,
  isDocked,
  open,
  openSettings,
  reload,
  send,
  settings,
  settle,
  waitForReply,
} from "./helpers"

// Every test gets a fresh browser profile, so each one starts from an empty app.
test.beforeEach(async ({ page }) => {
  await open(page)
})

test.describe("home", () => {
  test("greets you and offers a composer and prompt ideas", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(composer(page)).toBeVisible()
    await expect(page.getByRole("button", { name: "Write", exact: true })).toBeVisible()
  })

  test("focuses the composer on a desktop, but not on touch (no surprise keyboard)", async ({ page, isMobile }) => {
    if (isMobile) await expect(composer(page)).not.toBeFocused()
    else await expect(composer(page)).toBeFocused()
  })

  test("nothing scrolls sideways from 320 px to 1920 px", async ({ page, isMobile }) => {
    test.skip(isMobile, "resizes the window itself, so the desktop run covers it")
    for (const width of [320, 360, 390, 430, 600, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await horizontalOverflow(page), `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0)
    }
  })
})

test.describe("chat", () => {
  test("streams a reply, then lets you rate it and try again", async ({ page }) => {
    await open(page, "/?speed=4") // slow enough to catch the Stop button
    await send(page, PROMPT)
    await expect(page.getByRole("button", { name: "Stop reply" })).toBeVisible()
    await waitForReply(page)

    const good = page.getByRole("button", { name: "Good reply" })
    await good.click()
    await expect(good).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("button", { name: "Try again" }).last().click()
    await expect(page.getByText("2 / 2").first()).toBeVisible()
    await waitForReply(page)
    await page.getByRole("button", { name: "Previous version" }).last().click()
    await expect(page.getByText("1 / 2").first()).toBeVisible()
  })

  test("editing your message starts a new branch and keeps the old one", async ({ page, isMobile }) => {
    await send(page, PROMPT)
    await waitForReply(page)

    const mine = page.locator('[data-role="user"]').first()
    if (!isMobile) await mine.hover()
    await mine.getByRole("button", { name: "Edit message" }).click()
    await page.getByLabel("Edit your message").fill("Explain public-key encryption, but keep it short")
    await page.getByRole("button", { name: "Save and resend" }).click()
    await expect(page.getByText("2 / 2").first()).toBeVisible()
    await waitForReply(page)

    await page.getByRole("button", { name: "Previous version" }).first().click()
    await expect(page.getByText(PROMPT, { exact: true }).first()).toBeVisible()
  })

  test("keeps the conversation across a reload and names the tab after it", async ({ page }) => {
    await send(page, PROMPT)
    await waitForReply(page)
    await expect(page).toHaveTitle(/Explain how/)

    await reload(page)
    await expect(page.getByText(PROMPT, { exact: true }).first()).toBeVisible()
    await expect(page).toHaveTitle(/Explain how/)
  })

  test("a table in a reply scrolls on its own instead of widening the page", async ({ page }) => {
    await send(page, TABLE_PROMPT)
    await waitForReply(page)
    await expect(page.getByRole("table").first()).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })
})

test.describe("artifacts", () => {
  test("a build request opens a sandboxed live preview that works", async ({ page }) => {
    await send(page, ARTIFACT_PROMPT)
    await waitForReply(page)

    const panel = artifactPanel(page)
    if (!isDocked(page)) {
      // On small screens the page stays put until you open the card.
      await expect(panel).toHaveCount(0)
      await page.getByRole("button", { name: /^Open .*(caesar|cipher)/i }).first().click()
    }
    await expect(panel).toBeVisible()

    const frame = panel.locator("iframe")
    await expect(frame).toHaveAttribute("sandbox", /allow-scripts/)
    await expect(frame).not.toHaveAttribute("sandbox", /allow-same-origin/)

    const app = panel.frameLocator("iframe")
    await app.locator("textarea, input[type=text]").first().fill("Hello World")
    await expect(app.locator("#out")).toContainText("Khoor Zruog")

    await panel.getByRole("radio", { name: "Code" }).click()
    await expect(panel.locator("pre").first()).toBeVisible()
    await panel.getByRole("radio", { name: "Preview" }).click()
    await expect(frame).toBeVisible()

    await page.getByRole("button", { name: isDocked(page) ? "Close" : "Back to chat", exact: true }).click()
    await expect(panel).toHaveCount(0)
  })

  test("full screen can be left with Escape", async ({ page }) => {
    test.skip(!isDocked(page), "full screen is for the docked panel")
    await send(page, ARTIFACT_PROMPT)
    await waitForReply(page)

    const panel = artifactPanel(page)
    await page.getByRole("button", { name: "Full screen" }).click()
    await expect(panel).toHaveCSS("position", "fixed")
    await page.keyboard.press("Escape")
    await expect(panel).not.toHaveCSS("position", "fixed")
  })
})

test.describe("settings", () => {
  test("opens on the current section and a single Escape closes it", async ({ page }) => {
    test.skip(!isDocked(page), "uses the keyboard shortcut")
    await openSettings(page)
    await expect(settings(page).getByRole("tab", { name: "General" })).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(settings(page)).toBeHidden()
  })

  test("every section opens and none scrolls sideways", async ({ page }) => {
    const sections: [tab: string, heading: string][] = [
      ["General", "General"],
      ["Appearance", "Appearance"],
      ["Model", "Model"],
      ["Router", "Router"],
      ["Capabilities", "Capabilities"],
      ["Styles", "Styles"],
      ["Connectors", "Connectors"],
      ["Privacy", "Privacy and data"],
      ["Usage", "Usage"],
      ["Shortcuts", "Keyboard shortcuts"],
    ]
    await openSettings(page)
    for (const [tab, heading] of sections) {
      await settings(page).getByRole("tab", { name: tab }).click()
      await expect(settings(page).getByRole("heading", { level: 3, name: heading })).toBeVisible()
      expect(await horizontalOverflow(page), `${tab} scrolls sideways`).toBeLessThanOrEqual(0)
    }
  })

  test("a theme choice applies at once and survives a reload", async ({ page }) => {
    await openSettings(page, "Appearance")
    await settings(page).locator("label", { hasText: /^Dark$/ }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)

    await reload(page)
    await expect(page.locator("html")).toHaveClass(/dark/)
  })

  test("your name changes the greeting", async ({ page }) => {
    await openSettings(page)
    await settings(page).getByLabel("What should Cyphor call you?").fill("Ayush")
    await settings(page).getByRole("button", { name: "Close settings" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ayush")
  })

  test("your own LLM form masks the API key and explains where it lives", async ({ page }) => {
    await openSettings(page, "Model")
    await settings(page).locator("label", { hasText: "Your own LLM" }).click()

    const key = settings(page).getByLabel("API key", { exact: true })
    await key.fill("sk-test-123")
    await expect(key).toHaveAttribute("type", "password")
    await settings(page).getByRole("button", { name: "Show API key" }).click()
    await expect(key).toHaveAttribute("type", "text")
    await expect(settings(page).getByText("The key stays in this browser")).toBeVisible()
  })
})

test.describe("keyboard", () => {
  test.skip(({ isMobile }) => isMobile, "needs a hardware keyboard")

  test("Ctrl+K finds a chat by its text and opens it", async ({ page }) => {
    await send(page, "Write a TypeScript debounce function and explain how it works")
    await waitForReply(page)
    await open(page) // back to the home screen; chats live in this browser and survive the reload

    await page.keyboard.press("Control+k")
    await page.getByPlaceholder("Search chats or type a command").fill("debounce")
    await page.getByRole("option", { name: /debounce/i }).first().click()
    await expect(page).toHaveURL(/\/chat\/c_/)
  })

  test("Ctrl+K can open Settings", async ({ page }) => {
    await page.keyboard.press("Control+k")
    await page.getByPlaceholder("Search chats or type a command").fill("settings")
    await page.keyboard.press("Enter")
    await expect(settings(page)).toBeVisible()
  })
})

test.describe("your data", () => {
  test.skip(({ isMobile }) => isMobile, "downloads and file pickers are covered on the desktop run")

  test("a backup never contains the API key, and importing it brings the chats back", async ({ page }) => {
    await send(page, PROMPT)
    await waitForReply(page)

    await openSettings(page, "Model")
    await settings(page).locator("label", { hasText: "Your own LLM" }).click()
    await settings(page).getByLabel("API key", { exact: true }).fill("sk-secret-do-not-export")

    await settings(page).getByRole("tab", { name: "Privacy" }).click()
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      settings(page).getByRole("button", { name: "Export everything" }).click(),
    ])
    const file = test.info().outputPath("backup.json")
    await download.saveAs(file)
    const text = readFileSync(file, "utf8")
    expect(text).not.toContain("sk-secret-do-not-export")
    expect(JSON.parse(text).app).toBe("cyphor-chat")

    await settings(page).getByRole("button", { name: "Delete chats" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete all chats" }).click()
    await expect(page.locator('a[href^="/chat/"]')).toHaveCount(0)

    await settings(page).locator("input[type=file]").setInputFiles(file)
    await page.keyboard.press("Escape")
    await expect(page.locator('a[href^="/chat/"]')).toHaveCount(1)
  })
})

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("nothing loops and content is visible straight away", async ({ page }) => {
    await settle(page)
    const loops = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity).length
    )
    expect(loops).toBe(0)
    await expect(page.locator(".rise-3")).toHaveCSS("opacity", "1")
  })
})
