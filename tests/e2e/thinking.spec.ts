import { expect, test, type Page } from "@playwright/test"
import { PROMPT, open, openSettings, reload, scan, send, settings, waitForReply } from "./helpers"

/**
 * Thinking first. A reply works the question through before it answers, shows that work live in a folding Thinking
 * block, and the Effort setting (Low, Medium, High) decides how hard it tries. These run against the built-in demo
 * model, which follows the same rules as a real provider: Low answers at once, the other levels think first, and
 * Cyphor Deep always thinks first.
 */

const modelButton = (page: Page) => page.getByRole("button", { name: /^Model: .+\. Change model$/ })
const picker = (page: Page) => page.getByRole("dialog", { name: "Choose a model" })

/** The block above a reply: "Thinking" while the model works, "Thought for 4s" afterwards. */
const thinkingBlock = (page: Page) => page.getByRole("button", { name: /^Thinking/ })
const thoughtBlock = (page: Page) => page.getByRole("button", { name: /^Thought (for|it through)/ })

async function chooseEffort(page: Page, level: "Low" | "Medium" | "High") {
  await modelButton(page).click()
  await picker(page).getByRole("button", { name: /^Effort/ }).click()
  await picker(page).getByRole("option", { name: new RegExp(`^${level}`) }).click()
  await page.keyboard.press("Escape")
  await expect(picker(page)).toBeHidden()
}

test.describe("the default effort", () => {
  test("is Medium, and a reply thinks before it answers, then folds the thinking away", async ({ page }) => {
    await open(page, "/?speed=2") // slow enough to catch the thinking while it is being written
    await expect(modelButton(page)).toHaveAccessibleName(/ Medium\. Change model$/)

    await send(page, PROMPT)
    // One check, not two: the block only says "Thinking" until the answer starts, so a second look could come too late.
    await expect(thinkingBlock(page)).toHaveAttribute("aria-expanded", "true") // open while it works, so it can be read as it arrives
    await waitForReply(page)

    const done = thoughtBlock(page)
    await expect(done).toBeVisible()
    await expect(done).toHaveAttribute("aria-expanded", "false") // folded away once the answer has started
    await expect(thinkingBlock(page)).toHaveCount(0)

    // The reasoning is still there to read.
    await done.click()
    await expect(done).toHaveAttribute("aria-expanded", "true")
    const reasoning = page.locator(`[id="${await done.getAttribute("aria-controls")}"]`)
    await expect(reasoning).toContainText(/\w{4,}/)
  })

  test("the thinking sits above the answer", async ({ page }) => {
    await open(page)
    await send(page, PROMPT)
    await waitForReply(page)
    const block = await thoughtBlock(page).boundingBox()
    const answer = await page.locator('[data-role="assistant"]').last().getByText(/Imagine a mailbox with a slot/).boundingBox()
    expect(block && answer && block.y < answer.y).toBe(true)
  })
})

test.describe("Low", () => {
  test("answers at once, with no thinking block", async ({ page }) => {
    await open(page)
    await chooseEffort(page, "Low")
    await expect(modelButton(page)).toHaveAccessibleName(/ Low\. Change model$/)

    await send(page, PROMPT)
    await waitForReply(page)
    await expect(thinkingBlock(page)).toHaveCount(0)
    await expect(thoughtBlock(page)).toHaveCount(0)
  })

  test("still thinks first on Cyphor Deep, which is for hard problems", async ({ page }) => {
    await open(page)
    await chooseEffort(page, "Low")
    await modelButton(page).click()
    await picker(page).getByRole("option", { name: /^Cyphor Deep/ }).click()
    await page.keyboard.press("Escape")
    await expect(picker(page)).toBeHidden()

    await send(page, PROMPT)
    await waitForReply(page)
    await expect(thoughtBlock(page)).toBeVisible()
  })
})

test.describe("High", () => {
  test("is kept after a reload, and the reply thinks first", async ({ page }) => {
    await open(page)
    await chooseEffort(page, "High")
    await expect(modelButton(page)).toHaveAccessibleName(/ High\. Change model$/)

    await reload(page)
    await expect(modelButton(page)).toHaveAccessibleName(/ High\. Change model$/)

    await send(page, PROMPT)
    await waitForReply(page)
    await expect(thoughtBlock(page)).toBeVisible()
  })

  test("can also be chosen in Settings, under Capabilities", async ({ page }) => {
    await open(page)
    await openSettings(page, "Capabilities")
    await settings(page).getByRole("radio", { name: /^High/ }).click()
    await page.keyboard.press("Escape")
    await expect(settings(page)).toBeHidden()
    await expect(modelButton(page)).toHaveAccessibleName(/ High\. Change model$/)
  })
})

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${scheme})`, () => {
    test.use({ colorScheme: scheme })

    test("the Effort view of the model menu", async ({ page }) => {
      await open(page)
      await modelButton(page).click()
      await picker(page).getByRole("button", { name: /^Effort/ }).click()
      await expect(picker(page).getByRole("listbox", { name: "Effort" })).toBeVisible()
      await scan(page, "effort view")
    })

    test("a reply with its thinking open, and with it folded", async ({ page }) => {
      await open(page)
      await send(page, PROMPT)
      await waitForReply(page)
      await scan(page, "thinking folded")
      await thoughtBlock(page).click()
      await scan(page, "thinking open")
    })
  })
}
