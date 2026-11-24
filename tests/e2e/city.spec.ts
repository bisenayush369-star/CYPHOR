import { expect, test, type Page } from "@playwright/test"
import { FAST, open, openSettings, reload, scan, settings } from "./helpers"

/**
 * The first-run question, the moving city and the colour themes.
 *
 * Most machines that run these tests have no graphics card (the browser falls back to drawing WebGL on the CPU), where
 * the city is refused on purpose: it could not draw a frame fast enough to be anything but a freeze. So what the tests
 * check about "Keep the city" is that Cyphor either runs it or says, in words, why it does not, and the pinned
 * `?city=low` run (see components/city-background.tsx) checks that the city really starts and draws.
 */

const question = (page: Page) => page.getByRole("region", { name: "Keep the moving city?" })
const keepCity = (page: Page) => question(page).getByRole("button", { name: "Keep the city" })
const noCity = (page: Page) => question(page).getByRole("button", { name: "No city, change themes" })
const palette = (page: Page) => page.locator("html").getAttribute("data-palette")
const scene = (page: Page) => page.locator("html").getAttribute("data-scene")
const cityStatus = (page: Page) => settings(page).getByTestId("city-status")

/** Everything the city can say about itself (lib/scene/status.ts). */
const SAYS_SOMETHING = /Starting the city|Running at (low|medium|high) quality|one still frame|WebGL|CPU|keep up|dropped the scene|night scene|couldn't start/

/** The same test the app uses to refuse a CPU renderer. */
const drawsOnTheCpu = (page: Page) =>
  page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2")
    const info = gl?.getExtension("WEBGL_debug_renderer_info")
    return !!gl && !!info && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)))
  })

test.describe("the first question", () => {
  test("a new account is asked once, and the question does not come back", async ({ page }) => {
    await open(page, FAST, "first-run")
    await expect(question(page)).toBeVisible()
    await expect(keepCity(page)).toBeVisible()
    await expect(noCity(page)).toBeVisible()

    await noCity(page).click()
    await expect(question(page)).toHaveCount(0)
    await reload(page)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(question(page)).toHaveCount(0)
  })

  test("the question can be read and answered with the keyboard", async ({ page }) => {
    await open(page, FAST, "first-run")
    await keepCity(page).focus()
    await page.keyboard.press("Tab")
    await expect(noCity(page)).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(question(page)).toHaveCount(0)
  })

  test("it has no accessibility violations", async ({ page }) => {
    await open(page, FAST, "first-run")
    await expect(question(page)).toBeVisible()
    await scan(page, "the first-run question")
  })
})

test.describe("keeping the city", () => {
  test("is remembered, and Settings says what the city is doing", async ({ page }) => {
    await open(page, FAST, "first-run")
    await keepCity(page).click()
    await expect(question(page)).toHaveCount(0)

    await reload(page)
    expect(await scene(page)).toBe("city")
    await openSettings(page, "Appearance")
    await expect(settings(page).getByRole("radio", { name: /Moving city/ })).toBeChecked()
    await expect(cityStatus(page)).toHaveText(SAYS_SOMETHING)
  })

  test("on a machine that draws on the CPU, says why there is no city and offers the themes instead", async ({ page }) => {
    await open(page, FAST, "first-run")
    test.skip(!(await drawsOnTheCpu(page)), "this machine has a graphics card, so the city runs here")

    const why = question(page).getByRole("status")
    await expect(why).toContainText("draws graphics on the CPU")
    await expect(why).toContainText("different colour theme on every refresh")
    await keepCity(page).click()
    await openSettings(page, "Appearance")
    await expect(cityStatus(page)).toContainText("draws graphics on the CPU")
    // Nothing is covering the page with a scene that is not there.
    await expect(page.locator(".city")).toHaveCount(0)
  })

  test.describe("pinned, with motion reduced", () => {
    // One still frame is drawn and then nothing moves, so this is quick even where the browser draws WebGL on the CPU.
    test.use({ reducedMotion: "reduce" })

    test("the city starts and draws one still frame behind the page", async ({ page }) => {
      test.setTimeout(150_000)
      await open(page, `${FAST}&city=low`, "first-run")
      await keepCity(page).click()
      const city = page.locator('.city[data-state="ready"]')
      await expect(city).toHaveCount(1, { timeout: 120_000 })
      await expect(city.locator("canvas")).toHaveCount(1)
      await expect(city).toHaveAttribute("aria-hidden", "true")

      await openSettings(page, "Appearance")
      await expect(cityStatus(page)).toContainText("one still frame, because motion is reduced")
      // The chat still reads and answers over it.
      await settings(page).getByRole("button", { name: "Close settings" }).click()
      await page.getByLabel("Message to Cyphor").fill("Say hello")
      await page.getByRole("button", { name: "Send message" }).click()
      await expect(page).toHaveURL(/\/chat\/c_/)
      await expect(page.getByRole("button", { name: "Try again" }).last()).toBeVisible({ timeout: 60_000 })
    })
  })
})

test.describe("no city, new theme on every refresh", () => {
  test("every reload shows a different theme from the one before", async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, FAST, "first-run")
    await noCity(page).click()
    await expect(question(page)).toHaveCount(0)

    const seen: string[] = []
    for (let i = 0; i < 7; i++) {
      await reload(page)
      seen.push((await palette(page)) ?? "none")
    }
    expect(await scene(page)).toBe("off")
    for (let i = 1; i < seen.length; i++) expect(seen[i], `load ${i + 1} repeated load ${i}: ${seen.join(", ")}`).not.toBe(seen[i - 1])
    expect(new Set(seen).size, `seven refreshes should show at least three themes: ${seen.join(", ")}`).toBeGreaterThanOrEqual(3)
    expect(seen.every((p) => p !== "none")).toBe(true)
  })
})

test.describe("Settings > Appearance", () => {
  test("a theme you pick stays after a reload, and Every refresh gives it up again", async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, FAST) // signed in, city off, default theme
    await openSettings(page, "Appearance")
    const themes = settings(page).getByRole("radiogroup", { name: "Colour theme" })
    await themes.getByText("Redline", { exact: true }).click()
    await expect(themes.getByRole("radio", { name: /Redline/ })).toBeChecked()

    await reload(page)
    expect(await palette(page)).toBe("redline")
    await reload(page)
    expect(await palette(page)).toBe("redline")

    await openSettings(page, "Appearance")
    await settings(page).getByRole("radiogroup", { name: "Colour theme" }).getByText("Every refresh", { exact: true }).click()
    await expect(settings(page).getByRole("radiogroup", { name: "Colour theme" }).getByRole("radio", { name: /Every refresh/ })).toBeChecked()
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      await reload(page)
      seen.push((await palette(page)) ?? "none")
    }
    expect(new Set(seen).size, `four refreshes should not all look the same: ${seen.join(", ")}`).toBeGreaterThanOrEqual(2)
  })

  test("the background can be switched between the moving city and none", async ({ page }) => {
    await open(page, FAST)
    await openSettings(page, "Appearance")
    const background = settings(page).getByRole("radiogroup", { name: "Background" })
    await expect(background.getByRole("radio", { name: /No background/ })).toBeChecked()
    await expect(cityStatus(page)).toBeEmpty()

    await background.getByText("Moving city", { exact: true }).click()
    await expect(background.getByRole("radio", { name: /Moving city/ })).toBeChecked()
    await expect(cityStatus(page)).toHaveText(SAYS_SOMETHING)

    await background.getByText("No background", { exact: true }).click()
    await expect(background.getByRole("radio", { name: /No background/ })).toBeChecked()
    await expect(cityStatus(page)).toBeEmpty()
    // Switching the city off is also the choice to see a new theme each time.
    await expect(settings(page)).toContainText("A different theme loads each time you refresh.")
  })

  test("it has no accessibility violations", async ({ page }) => {
    await open(page, FAST)
    await openSettings(page, "Appearance")
    await expect(settings(page).getByRole("radiogroup", { name: "Colour theme" })).toBeVisible()
    await scan(page, "Appearance settings", '[role="dialog"]')
  })
})
