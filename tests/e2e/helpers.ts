import AxeBuilder from "@axe-core/playwright"
import { expect, type Locator, type Page } from "@playwright/test"

export const PROMPT = "Explain how public-key encryption works with a real-world analogy"
export const ARTIFACT_PROMPT = "Build a small Caesar cipher tool I can try in the browser"
export const TABLE_PROMPT = "Compare Caesar and Vigenère in a table"

/** From 1024 px the sidebar is docked and artifacts open beside the chat. Below that they are a drawer and a full-screen page. */
export const isDocked = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024

/** The demo model answers 20 times faster with ?speed=20, which keeps the suite quick without changing what is tested. */
export const FAST = "/?speed=20"

export const composer = (page: Page) => page.getByLabel("Message to Cyphor")
export const settings = (page: Page) => page.getByRole("dialog", { name: "Settings" })
export const artifactPanel = (page: Page) => page.locator('section[aria-label^="Artifact"]')

/**
 * Resolves once the shell is live, which the app marks with data-ready on the page. Until then a key press
 * goes nowhere, because the shortcuts are only listening after the page has started.
 */
export const appReady = (page: Page) => expect(page.locator("html")).toHaveAttribute("data-ready", "true")

/** Opens a page and waits for the shell, so the next key press is not lost to a page that is still starting. */
export async function open(page: Page, url = FAST) {
  await page.goto(url)
  await appReady(page)
}

/** Reloads the page and waits for the shell again. */
export async function reload(page: Page) {
  await page.reload()
  await appReady(page)
}

/** Appears under a reply once it has finished streaming. */
const finishedReply = (page: Page) => page.getByRole("button", { name: "Try again" }).last()

/** Sends with the Send button, which also works on touch screens where Enter adds a new line. */
export async function send(page: Page, text: string) {
  await composer(page).fill(text)
  await page.getByRole("button", { name: "Send message" }).click()
  await expect(page).toHaveURL(/\/chat\/c_/)
}

export async function waitForReply(page: Page) {
  await expect(finishedReply(page)).toBeVisible({ timeout: 60_000 })
}

/** Opens Settings the way a person would on this screen: the shortcut on a desktop, the account menu in the drawer elsewhere. */
export async function openSettings(page: Page, tab?: string) {
  await appReady(page)
  if (isDocked(page)) {
    await page.keyboard.press("Control+,")
  } else {
    await page.getByRole("button", { name: "Open sidebar" }).click()
    await page.getByRole("button", { name: /account menu/i }).click()
    await page.getByRole("menuitem", { name: /Settings/ }).click()
  }
  await expect(settings(page)).toBeVisible()
  if (tab) await settings(page).getByRole("tab", { name: tab }).click()
}

/** Resolves once nothing that has an end is still animating, so contrast and layout checks see the final state. */
export async function settle(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity).length
      )
    )
    .toBe(0)
}

/** How far the page is wider than the screen. Zero means nothing scrolls sideways. */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

/** WCAG 2.0, 2.1 and 2.2 levels A and AA, plus axe's own best-practice rules. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]

/**
 * Runs axe on the page as it is now. Every violation is reported, not just the first.
 * `within` limits the scan to one part of the page. An open menu needs that: Radix hides the rest of the page
 * from screen readers while a menu is open, so the page-wide rules (landmarks, a heading) cannot apply to it.
 */
export async function scan(page: Page, state: string, within?: string) {
  await settle(page)
  const axe = new AxeBuilder({ page }).withTags(AXE_TAGS)
  const { violations } = await (within ? axe.include(within) : axe).analyze()
  expect.soft(
    violations.map((v) => `${v.id} x${v.nodes.length}: ${v.help}`),
    `axe violations: ${state}`
  ).toEqual([])
}

/**
 * Everything inside `root` that sticks out past the edge of the screen, unless it sits in something that
 * is meant to scroll sideways or is shortened with an ellipsis on purpose. An empty list means nothing is cut
 * off. (The page's own scroll width cannot see inside a dialog, which is fixed to the screen.)
 */
export function beyondScreen(root: Locator): Promise<string[]> {
  return root.evaluate((el) => {
    const width = document.documentElement.clientWidth
    const found: string[] = []
    for (const node of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
      const r = node.getBoundingClientRect()
      if (r.width <= 1 || r.height <= 1) continue
      if (r.right <= width + 0.5 && r.left >= -0.5) continue
      let onPurpose = false
      for (let up: HTMLElement | null = node.parentElement; up; up = up === el ? null : up.parentElement) {
        const style = getComputedStyle(up)
        if (style.overflowX === "auto" || style.overflowX === "scroll" || (style.overflowX !== "visible" && style.textOverflow === "ellipsis")) {
          onPurpose = true
          break
        }
      }
      if (!onPurpose) found.push(`${node.tagName.toLowerCase()}.${String(node.className).split(" ").slice(0, 3).join(".")} ends at ${Math.round(r.right)}px of ${width}px`)
    }
    return found.slice(0, 8)
  })
}
