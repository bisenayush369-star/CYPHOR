import { expect, test, type Page } from "@playwright/test"
import { ARTIFACT_PROMPT, artifactPanel, horizontalOverflow, isDocked, open, send, waitForReply } from "./helpers"

/**
 * Artifacts: a reply that makes something you can run opens beside the chat with a live preview, the source, and a
 * button that copies all of it. The built-in demo model writes every kind (web page, React app, diagram, SVG), a page in
 * a plain code block with no tag, and a preview that is broken on purpose.
 */

const REACT_PROMPT = "Make a React component that charts letter frequency"
const DIAGRAM_PROMPT = "Draw a flowchart of how a Caesar encoder works"
const SVG_PROMPT = "Draw an SVG badge with a cipher wheel"
const FENCED_PROMPT = "Write a Pomodoro timer as one html file"
const BROKEN_PROMPT = "Show me a preview that breaks"
const CODE_PROMPT = "Write a TypeScript debounce function and explain how it works"

/** Where the diagram engine is loaded from (lib/artifact/srcdoc.ts pins the version and checks its hash). */
const MERMAID_GLOB = "**/npm/mermaid@*/dist/mermaid.min.js"
const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.min.js"

test.use({ permissions: ["clipboard-read", "clipboard-write"] })

test.beforeEach(async ({ page }) => {
  await open(page)
})

const card = (page: Page, name: RegExp) => page.getByRole("button", { name }).first()
const readClipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText())

/**
 * Brings the artifact on screen and switches to its preview. A wide screen opens the panel by itself while the model
 * writes; a small one waits for the card to be tapped.
 */
async function showPreview(page: Page, name: RegExp) {
  const panel = artifactPanel(page)
  if (!isDocked(page)) await card(page, name).click()
  await expect(panel).toBeVisible()
  const preview = panel.getByRole("radio", { name: "Preview" })
  await expect(preview).toBeEnabled({ timeout: 30_000 })
  await preview.click()
  return panel
}

test.describe("the panel", () => {
  test("Copy code puts the whole file on the clipboard", async ({ page }) => {
    await send(page, ARTIFACT_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open .*caesar/i)

    const copy = panel.getByRole("button", { name: "Copy code", exact: true })
    await copy.click()
    await expect(panel.getByRole("button", { name: "Copied" })).toBeVisible()
    const text = await readClipboard(page)
    expect(text.startsWith("<!doctype html>")).toBe(true)
    expect(text.trimEnd().endsWith("</html>")).toBe(true)
    expect(text.length).toBeGreaterThan(3000)

    // The button is on screen, and on a touch screen big enough for a finger.
    const box = await panel.getByRole("button", { name: /^Cop(y|ied)/ }).first().boundingBox()
    const width = page.viewportSize()!.width
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    if (!isDocked(page)) expect(box!.height).toBeGreaterThanOrEqual(36)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })

  test("the card in the chat copies the code too", async ({ page }) => {
    await send(page, ARTIFACT_PROMPT)
    await waitForReply(page)
    await page.getByRole("button", { name: "Copy code", exact: true }).first().click()
    expect((await readClipboard(page)).startsWith("<!doctype html>")).toBe(true)
  })

  test("the code view opens on the first line and says how long the file is", async ({ page }) => {
    await send(page, ARTIFACT_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open .*caesar/i)
    await panel.getByRole("radio", { name: "Code" }).click()

    const source = panel.getByLabel("Artifact source")
    await expect(source).toContainText("<!doctype html>")
    await expect(panel.getByText(/\d+ lines · /)).toBeVisible()
    const scroller = panel.locator("div.overflow-auto").first()
    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0)
  })

  test("Download saves the file under the artifact's own name", async ({ page }) => {
    test.skip(!isDocked(page), "touch screens hand the file to the share sheet instead")
    await send(page, ARTIFACT_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open .*caesar/i)
    const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Download" }).click()])
    expect(download.suggestedFilename()).toBe("caesar-workbench.html")
  })

  test("full screen offers Split: the code and the preview side by side", async ({ page }) => {
    test.skip(!isDocked(page), "full screen is for the docked panel")
    await send(page, ARTIFACT_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open .*caesar/i)

    // The docked panel is too narrow to read both halves, so it does not offer the choice.
    await expect(panel.getByRole("radio", { name: "Split" })).toHaveCount(0)
    await panel.getByRole("button", { name: "Full screen" }).click()
    await page.getByRole("radio", { name: "Split" }).click()
    await expect(page.getByLabel("Artifact source")).toBeVisible()
    await expect(panel.frameLocator("iframe").locator("h1")).toContainText("Caesar")
  })

  test("a small screen never offers Split", async ({ page }) => {
    test.skip(isDocked(page), "this is about narrow screens")
    await send(page, ARTIFACT_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open .*caesar/i)
    await expect(panel.getByRole("radio", { name: "Split" })).toHaveCount(0)
  })

  test("the panel opens by itself while the page is written, and follows the code", async ({ page }) => {
    test.skip(!isDocked(page), "only wide screens open the panel on their own")
    test.setTimeout(120_000)
    // The demo model at a quarter of its speed, so the writing can be watched.
    await open(page, "/?speed=0.25")
    await send(page, ARTIFACT_PROMPT)

    const panel = artifactPanel(page)
    await expect(panel).toBeVisible({ timeout: 30_000 })
    await expect(panel.getByRole("radio", { name: "Code" })).toHaveAttribute("aria-checked", "true")
    await expect(panel.getByRole("radio", { name: "Preview" })).toBeDisabled()
    await expect(panel.getByText("Writing", { exact: true })).toBeVisible()
    await expect(page.getByText("Writing…")).toBeVisible()

    const scroller = panel.locator("div.overflow-auto").first()
    const first = await scroller.evaluate((el) => el.scrollTop)
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 15_000 }).toBeGreaterThan(first + 200)
    expect(await scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(60)

    await waitForReply(page)
    await expect(panel.getByRole("radio", { name: "Preview" })).toBeEnabled()
    await panel.getByRole("radio", { name: "Preview" }).click()
    await expect(panel.frameLocator("iframe").locator("textarea").first()).toBeVisible()
  })
})

test.describe("each kind of artifact", () => {
  test("a React component runs with Tailwind, icons and a chart", async ({ page }) => {
    await send(page, REACT_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open Letter frequency/)

    const app = panel.frameLocator("iframe")
    await expect(app.locator("textarea")).toBeVisible({ timeout: 30_000 })
    await expect(app.locator(".recharts-bar-rectangle").first()).toBeVisible({ timeout: 30_000 })
    // Tailwind's classes took effect: the heading is the size text-xl asks for.
    expect(await app.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(19)
    await app.locator("textarea").fill("eeee ee")
    await expect(app.getByText("6 letters")).toBeVisible()

    await panel.getByRole("button", { name: "Copy code", exact: true }).click()
    const code = await readClipboard(page)
    expect(code).toContain('import { useMemo, useState } from "react"')
    expect(code).toContain("export default function FrequencyAnalyzer")
  })

  test("a diagram is drawn", async ({ page, request }) => {
    const reachable = await request.get(MERMAID_CDN, { timeout: 8_000 }).then((r) => r.ok(), () => false)
    test.skip(!reachable, "the diagram engine's CDN cannot be reached from this machine")
    await send(page, DIAGRAM_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open How the Caesar encoder works/)
    await expect(panel.frameLocator("iframe").locator(".node").first()).toBeVisible({ timeout: 30_000 })
    expect(await panel.frameLocator("iframe").locator(".node").count()).toBeGreaterThanOrEqual(9)
  })

  test("a diagram engine that does not match its pinned hash is refused, and the panel says so", async ({ page }) => {
    // Anything but the published file fails the integrity check, so it is never run.
    await page.route(MERMAID_GLOB, (route) =>
      route.fulfill({ body: "window.mermaid = { initialize() {}, render: async () => ({ svg: '<svg id=\"tampered\"></svg>' }) }", contentType: "application/javascript", headers: { "access-control-allow-origin": "*" } })
    )
    await send(page, DIAGRAM_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open How the Caesar encoder works/)
    await expect(panel.getByRole("alert")).toContainText("diagram engine", { timeout: 30_000 })
    await expect(panel.frameLocator("iframe").locator("#tampered")).toHaveCount(0)
    // Asking the model to fix a connection problem would be wrong, so there is no such button.
    await expect(panel.getByRole("button", { name: "Fix with Cyphor" })).toHaveCount(0)
  })

  test("an SVG shows as an image and keeps its source in the Code view", async ({ page }) => {
    await send(page, SVG_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open Cipher wheel badge/)
    const image = panel.getByRole("img", { name: "Cipher wheel badge" })
    await expect(image).toBeVisible()
    expect(await image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    await panel.getByRole("radio", { name: "Code" }).click()
    await expect(panel.getByLabel("Artifact source")).toContainText("<svg")
  })
})

test.describe("models that do not use the tag", () => {
  test("a whole web page in a plain code block still becomes a card and a preview", async ({ page }) => {
    await send(page, FENCED_PROMPT)
    await waitForReply(page)
    await expect(card(page, /^Open Pomodoro timer/)).toBeVisible()
    // The source lives in the panel, not pasted into the conversation.
    await expect(page.locator("#main")).not.toContainText("document.getElementById")

    const panel = await showPreview(page, /^Open Pomodoro timer/)
    const app = panel.frameLocator("iframe")
    await expect(app.locator("#time")).toHaveText("25:00")
    await app.locator("#go").click()
    await expect(app.locator("#time")).toHaveText(/^24:5\d$/, { timeout: 8_000 })
  })

  test("ordinary code stays an ordinary code block", async ({ page }) => {
    await send(page, CODE_PROMPT)
    await waitForReply(page)
    await expect(page.locator("pre").first()).toBeVisible()
    await expect(page.getByRole("button", { name: /^Open .+ (Web page|React app|SVG image|Diagram|Document|Code)(, version \d+)?$/ })).toHaveCount(0)
  })
})

test.describe("when a preview breaks", () => {
  test("the panel shows the error, and Fix with Cyphor brings a second version that works", async ({ page }) => {
    test.setTimeout(120_000)
    await send(page, BROKEN_PROMPT)
    await waitForReply(page)
    const panel = await showPreview(page, /^Open Counter with a bug/)

    const alert = panel.getByRole("alert")
    await expect(alert).toContainText("Cannot read properties of undefined", { timeout: 30_000 })
    await panel.getByRole("button", { name: "Fix with Cyphor" }).click()

    // The error goes back to the model as a message, and its answer arrives as version 2 of the same artifact.
    const versions = panel.getByRole("combobox", { name: "Version" })
    await expect(versions).toBeVisible({ timeout: 60_000 })
    await expect(alert).toHaveCount(0, { timeout: 60_000 })
    const app = panel.frameLocator("iframe")
    await app.getByRole("button", { name: "Add one" }).click()
    await expect(app.getByText("1 earlier values")).toBeVisible()

    // Version 1 is still there, with its error.
    await versions.click()
    await expect(page.getByRole("option")).toHaveCount(2)
    await page.getByRole("option", { name: "Version 1" }).click()
    await expect(panel.getByRole("alert")).toContainText("Cannot read properties of undefined", { timeout: 30_000 })
  })
})
