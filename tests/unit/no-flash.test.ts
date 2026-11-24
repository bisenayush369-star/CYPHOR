/**
 * The first-paint script (lib/no-flash.ts) decides the colour theme before anything draws, and "change on every
 * refresh" depends on it. It is plain ES5 pasted into <head>, so these run it the way a browser would: in a sandbox
 * with a fake page, fake storage and nothing else.
 */
import assert from "node:assert/strict"
import { runInNewContext } from "node:vm"
import { describe, test } from "node:test"
import { NO_FLASH_SCRIPT, PALETTE_LAST_KEY } from "../../lib/no-flash.ts"
import { PALETTE_IDS } from "../../lib/scene/palettes.ts"

interface Page {
  dataset: Record<string, string>
  classes: Set<string>
  scheme: string
  storage: Map<string, string>
}

/** One page load: storage in, the attributes the script put on <html> out. Storage is returned so the next load can reuse it. */
function load(opts: { appearance?: unknown; raw?: string; last?: string; dark?: boolean; blocked?: boolean; storage?: Map<string, string> } = {}): Page {
  const storage = opts.storage ?? new Map<string, string>()
  if (opts.raw !== undefined) storage.set("cyphor:appearance", opts.raw)
  else if (opts.appearance !== undefined) storage.set("cyphor:appearance", JSON.stringify(opts.appearance))
  if (opts.last !== undefined) storage.set(PALETTE_LAST_KEY, opts.last)

  const page: Page = { dataset: {}, classes: new Set(), scheme: "", storage }
  const root = {
    dataset: page.dataset,
    classList: {
      toggle(name: string, on: boolean) {
        if (on) page.classes.add(name)
        else page.classes.delete(name)
      },
    },
    style: {
      set colorScheme(v: string) {
        page.scheme = v
      },
    },
  }
  const localStorage = opts.blocked
    ? {
        getItem() {
          throw new Error("blocked")
        },
        setItem() {
          throw new Error("blocked")
        },
      }
    : {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
      }
  runInNewContext(NO_FLASH_SCRIPT, {
    document: { documentElement: root },
    localStorage,
    window: { matchMedia: () => ({ matches: opts.dark ?? true }) },
    JSON,
    Math,
  })
  return page
}

describe("first paint: the basics", () => {
  test("a first visit is the dark home theme with the city on", () => {
    const p = load()
    assert.equal(p.dataset.theme, "dark")
    assert.ok(p.classes.has("dark"))
    assert.equal(p.scheme, "dark")
    assert.equal(p.dataset.font, "sans")
    assert.equal(p.dataset.effects, "full")
    assert.equal(p.dataset.scene, "city")
    assert.equal(p.dataset.palette, "night-city")
  })

  test("saved theme, font and effects are copied across", () => {
    const p = load({ appearance: { theme: "light", chatFont: "serif", effects: "subtle" } })
    assert.equal(p.dataset.theme, "light")
    assert.ok(!p.classes.has("dark"))
    assert.equal(p.scheme, "light")
    assert.equal(p.dataset.font, "serif")
    assert.equal(p.dataset.effects, "subtle")
  })

  test('"system" follows the device', () => {
    assert.equal(load({ appearance: { theme: "system" }, dark: true }).dataset.theme, "dark")
    assert.equal(load({ appearance: { theme: "system" }, dark: false }).dataset.theme, "light")
  })

  test("the scene is on unless it was turned off", () => {
    assert.equal(load({ appearance: { scene: "off" } }).dataset.scene, "off")
    for (const v of ["city", "", "on", null, 3]) assert.equal(load({ appearance: { scene: v } }).dataset.scene, "city", String(v))
  })

  test("damaged or blocked storage still gives a usable page", () => {
    for (const p of [load({ raw: "{not json" }), load({ raw: "null" }), load({ raw: "[1,2]" }), load({ blocked: true })]) {
      assert.equal(p.dataset.theme, "dark")
      assert.equal(p.dataset.palette, "night-city")
      assert.equal(p.dataset.scene, "city")
    }
  })
})

describe("first paint: colour themes", () => {
  test("a fixed theme is used on every load", () => {
    for (const id of PALETTE_IDS) {
      const storage = new Map<string, string>()
      for (let i = 0; i < 3; i++) assert.equal(load({ appearance: { palette: id }, storage }).dataset.palette, id)
    }
  })

  test("an unknown theme name falls back to the home theme", () => {
    for (const v of ["nope", "NIGHT-CITY", "", null, 4]) assert.equal(load({ appearance: { palette: v } }).dataset.palette, "night-city", String(v))
  })

  test("rotate gives a different theme on every refresh, and uses all of them", () => {
    const storage = new Map<string, string>()
    let previous: string | undefined
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const got = load({ appearance: { scene: "off", palette: "rotate" }, storage }).dataset.palette
      assert.ok((PALETTE_IDS as readonly string[]).includes(got), got)
      assert.notEqual(got, previous, `load ${i} repeated ${got}`)
      previous = got
      seen.add(got)
    }
    assert.equal(seen.size, PALETTE_IDS.length)
  })

  test("rotate avoids the theme that was shown last, even across a closed tab", () => {
    for (const last of PALETTE_IDS) {
      for (let i = 0; i < 40; i++) assert.notEqual(load({ appearance: { palette: "rotate" }, last }).dataset.palette, last)
    }
  })

  test("the theme it chose is remembered as the last one", () => {
    const p = load({ appearance: { palette: "rotate" } })
    assert.equal(p.storage.get(PALETTE_LAST_KEY), p.dataset.palette)
    const fixed = load({ appearance: { palette: "toxic" } })
    assert.equal(fixed.storage.get(PALETTE_LAST_KEY), "toxic")
  })

  test("rotate still works when storage is blocked (it just cannot remember)", () => {
    const p = load({ appearance: { palette: "rotate" }, blocked: true })
    // With blocked storage the saved appearance cannot be read either, so this is the plain default.
    assert.equal(p.dataset.palette, "night-city")
  })

  test("the script is plain ES5: no arrow functions, let/const, template strings or optional chaining", () => {
    assert.ok(!/=>|\blet\b|\bconst\b|`|\?\./.test(NO_FLASH_SCRIPT), "modern syntax in the first-paint script")
  })
})
