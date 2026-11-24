import { expect, test } from "@playwright/test"
import { ARTIFACT_PROMPT, TABLE_PROMPT, artifactPanel, isDocked, open, openSettings, scan, send, waitForReply } from "./helpers"

const SETTINGS_TABS = ["General", "Appearance", "Model", "Router", "Capabilities", "Styles", "Connectors", "Privacy", "Usage", "Shortcuts"]

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${scheme})`, () => {
    test.use({ colorScheme: scheme })

    test.beforeEach(async ({ page }) => {
      await open(page)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    })

    test("home", async ({ page }) => {
      await scan(page, "home")
    })

    test("a chat with a table", async ({ page }) => {
      await send(page, TABLE_PROMPT)
      await waitForReply(page)
      await scan(page, "chat with a table")
    })

    test("a chat with code", async ({ page }) => {
      await send(page, "Write a TypeScript debounce function and explain how it works")
      await waitForReply(page)
      await scan(page, "chat with code")
    })

    test("an artifact", async ({ page }) => {
      await send(page, ARTIFACT_PROMPT)
      await waitForReply(page)
      if (!isDocked(page)) await page.getByRole("button", { name: /^Open .*(caesar|cipher)/i }).first().click()
      await expect(artifactPanel(page)).toBeVisible()
      await expect(artifactPanel(page).locator("iframe")).toBeVisible()
      await scan(page, "artifact")
    })

    test("an artifact's code view", async ({ page }) => {
      await send(page, ARTIFACT_PROMPT)
      await waitForReply(page)
      if (!isDocked(page)) await page.getByRole("button", { name: /^Open .*(caesar|cipher)/i }).first().click()
      const panel = artifactPanel(page)
      await expect(panel).toBeVisible()
      await expect(panel.getByRole("radio", { name: "Code" })).toBeEnabled()
      await panel.getByRole("radio", { name: "Code" }).click()
      await expect(panel.getByLabel("Artifact source")).toBeVisible()
      await scan(page, "artifact code view")
    })

    test("a preview that has an error", async ({ page }) => {
      await send(page, "Show me a preview that breaks")
      await waitForReply(page)
      if (!isDocked(page)) await page.getByRole("button", { name: /^Open Counter/ }).first().click()
      await expect(artifactPanel(page).getByRole("alert")).toBeVisible({ timeout: 30_000 })
      await scan(page, "preview error")
    })

    test("the command palette", async ({ page }) => {
      test.skip(!isDocked(page), "opened from the drawer on small screens, which the phone run of other states covers")
      await page.keyboard.press("Control+k")
      await expect(page.getByPlaceholder("Search chats or type a command")).toBeVisible()
      await scan(page, "command palette")
    })

    for (const tab of SETTINGS_TABS) {
      test(`settings: ${tab}`, async ({ page }) => {
        await openSettings(page, tab)
        await scan(page, `settings: ${tab}`)
      })
    }
  })
}
