import { expect, test, type Page } from "@playwright/test"
import { appReady, isDocked, open, reload, scan } from "./helpers"

/**
 * Signing in and out. The accounts live in the test server's own in-memory database (tests/e2e/servers.mjs), and Google
 * is not set up there, which is also what a fresh checkout looks like.
 */

const PASSWORD = "correct-horse-battery"
let made = 0
const newEmail = () => `login-${process.pid}-${Date.now()}-${made++}@example.com`

const nameField = (page: Page) => page.getByLabel("Name", { exact: true })
const emailField = (page: Page) => page.getByLabel("Email", { exact: true })
const passwordField = (page: Page) => page.getByLabel("Password", { exact: true })
/** The form's own message. (Next.js also keeps an empty role="alert" in the page to announce route changes.) */
const alert = (page: Page) => page.getByRole("tabpanel").getByRole("alert")

async function createAccount(page: Page, email: string, name = "Ada Lovelace", password = PASSWORD) {
  await page.getByRole("tab", { name: "Create account" }).click()
  await nameField(page).fill(name)
  await emailField(page).fill(email)
  await passwordField(page).fill(password)
  await page.getByRole("button", { name: "Create account", exact: true }).click()
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await emailField(page).fill(email)
  await passwordField(page).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
}

/** Signs out the way a person does: from the account menu (the sidebar is a drawer on small screens). */
async function signOutFromMenu(page: Page) {
  if (!isDocked(page)) await page.getByRole("button", { name: "Open sidebar" }).click()
  await page.getByRole("button", { name: /account menu/i }).click()
  await page.getByRole("menuitem", { name: /Sign out/ }).click()
}

test.describe("signed out", () => {
  test("a visitor who is not signed in is sent to the login page and brought back after signing in", async ({ page }) => {
    await page.goto("/projects")
    await expect(page).toHaveURL(/\/login\?next=%2Fprojects$/)
    await createAccount(page, newEmail())
    await expect(page).toHaveURL(/\/projects$/)
    await appReady(page)
    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible()
  })

  test("the login page offers sign in and create account, with Google only when it is set up", async ({ page }) => {
    await open(page, "/login", "signed-out")
    await expect(page.getByRole("heading", { name: "Sign in to Cyphor", level: 1 })).toBeAttached()
    const tabs = page.getByRole("tablist", { name: "Account" })
    await expect(tabs.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true")
    await expect(tabs.getByRole("tab", { name: "Create account" })).toHaveAttribute("aria-selected", "false")
    await expect(nameField(page)).toHaveCount(0) // only when creating an account
    // The test server has no Google keys and runs the production build, which hides the button instead of showing a dead one.
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0)
  })

  test("the tabs move with the arrow keys", async ({ page }) => {
    await open(page, "/login", "signed-out")
    const signInTab = page.getByRole("tab", { name: "Sign in" })
    const createTab = page.getByRole("tab", { name: "Create account" })
    await signInTab.focus()
    await page.keyboard.press("ArrowRight")
    await expect(createTab).toBeFocused()
    await expect(createTab).toHaveAttribute("aria-selected", "true")
    await expect(nameField(page)).toBeVisible()
    await page.keyboard.press("ArrowLeft")
    await expect(signInTab).toBeFocused()
    await expect(signInTab).toHaveAttribute("aria-selected", "true")
  })

  test("a signed-out request to the API is refused with a 401 and no data", async ({ request }) => {
    const chats = await request.get("/api/conversations")
    expect(chats.status()).toBe(401)
    const models = await request.get("/api/models")
    expect(models.status()).toBe(401)
    const chat = await request.post("/api/chat", { data: { model: "cyphor-auto", thread: [] } })
    expect(chat.status()).toBe(401)
    expect((await chat.json()).error.code).toBeTruthy()
  })
})

test.describe("creating an account", () => {
  test("signs you in, greets you by name, and a reload keeps you signed in", async ({ page }) => {
    await open(page, "/login", "signed-out")
    await createAccount(page, newEmail(), "Ada Lovelace")
    await expect(page).toHaveURL(/\/(\?.*)?$/)
    await appReady(page)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada")

    await reload(page)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada")
    await page.goto("/login")
    await expect(page).not.toHaveURL(/\/login/) // already signed in, so the login page sends you on
  })

  test("says what is wrong, and puts the cursor there", async ({ page }) => {
    await open(page, "/login", "signed-out")
    await page.getByRole("tab", { name: "Create account" }).click()

    await page.getByRole("button", { name: "Create account", exact: true }).click()
    await expect(alert(page)).toHaveText("Enter your name.")
    await expect(nameField(page)).toBeFocused()

    await nameField(page).fill("Ada")
    await emailField(page).fill("not-an-email")
    await page.getByRole("button", { name: "Create account", exact: true }).click()
    await expect(alert(page)).toHaveText("Enter a valid email address.")
    await expect(emailField(page)).toBeFocused()

    await emailField(page).fill(newEmail())
    await passwordField(page).fill("short")
    await page.getByRole("button", { name: "Create account", exact: true }).click()
    await expect(alert(page)).toHaveText("Use at least 8 characters for the password.")
    await expect(passwordField(page)).toBeFocused()
    await expect(passwordField(page)).toHaveAttribute("aria-invalid", "true")
  })

  test("an email that already has an account is told to sign in instead", async ({ page, request, baseURL }) => {
    const email = newEmail()
    const made = await request.post("/api/auth/sign-up/email", { headers: { origin: baseURL! }, data: { name: "First", email, password: PASSWORD } })
    expect(made.ok()).toBe(true)

    await open(page, "/login", "signed-out")
    await createAccount(page, email, "Second")
    await expect(alert(page)).toHaveText("An account with that email already exists. Sign in instead.")
    await expect(emailField(page)).toBeFocused()
  })

  test("the password can be shown and hidden", async ({ page }) => {
    await open(page, "/login", "signed-out")
    await passwordField(page).fill(PASSWORD)
    await expect(passwordField(page)).toHaveAttribute("type", "password")
    const toggle = page.getByRole("button", { name: "Show password" })
    await toggle.click()
    await expect(passwordField(page)).toHaveAttribute("type", "text")
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true")
    await page.getByRole("button", { name: "Hide password" }).click()
    await expect(passwordField(page)).toHaveAttribute("type", "password")
  })
})

test.describe("signing in and out", () => {
  test("signing out returns to the login page, and the app stays locked until someone signs in again", async ({ page }) => {
    await open(page, "/login", "signed-out")
    const email = newEmail()
    await createAccount(page, email)
    await appReady(page)

    await signOutFromMenu(page)
    await expect(page).toHaveURL(/\/login$/) // no ?next=, so the next person does not land on this person's page
    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)

    await signIn(page, email)
    await appReady(page)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada")
  })

  test("a wrong password is refused in plain words and keeps the email", async ({ page, request, baseURL }) => {
    const email = newEmail()
    const made = await request.post("/api/auth/sign-up/email", { headers: { origin: baseURL! }, data: { name: "Grace", email, password: PASSWORD } })
    expect(made.ok()).toBe(true)

    await open(page, "/login", "signed-out")
    await signIn(page, email, "not-the-password")
    await expect(alert(page)).toHaveText("That email and password do not match an account.")
    await expect(emailField(page)).toHaveValue(email)
    await expect(passwordField(page)).toBeFocused()
    await expect(page).toHaveURL(/\/login/)
  })

  test("an account that does not exist gets the same answer, so nobody can use the form to find out who has one", async ({ page }) => {
    await open(page, "/login", "signed-out")
    await signIn(page, newEmail())
    await expect(alert(page)).toHaveText("That email and password do not match an account.")
  })

  test("one person's chats are not shown to the next person who signs in on the same browser", async ({ page }) => {
    await open(page, "/login", "signed-out")
    await createAccount(page, newEmail(), "First Person")
    await appReady(page)
    await page.getByLabel("Message to Cyphor").fill("A private question")
    await page.getByRole("button", { name: "Send message" }).click()
    await expect(page).toHaveURL(/\/chat\/c_/)
    await expect(page.getByRole("button", { name: "Try again" }).last()).toBeVisible({ timeout: 60_000 })

    await signOutFromMenu(page)
    await expect(page).toHaveURL(/\/login$/)
    await createAccount(page, newEmail(), "Second Person")
    await appReady(page)
    await expect(page).toHaveURL(/\/(\?.*)?$/) // the home screen, not the first person's chat
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Second")
    await expect(page.getByText("A private question")).toHaveCount(0)
    await expect(page.getByRole("link", { name: /A private question/ })).toHaveCount(0)
  })
})

test.describe("accessibility", () => {
  for (const tab of ["Sign in", "Create account"] as const) {
    test(`the login page, on the ${tab} tab, has no violations`, async ({ page }) => {
      await open(page, "/login", "signed-out")
      await page.getByRole("tab", { name: tab }).click()
      await scan(page, `login, ${tab}`)
    })
  }

  test("the login page with an error showing has no violations", async ({ page }) => {
    await open(page, "/login", "signed-out")
    await signIn(page, newEmail(), "not-the-password")
    await expect(alert(page)).toBeVisible()
    await scan(page, "login with an error")
  })
})
