/**
 * Colour themes. The stylesheet is generated from lib/scene/palettes.ts, so these check that the two agree, that every
 * genre colour is used, that text stays readable in every theme, and that "change on every refresh" really changes.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, test } from "node:test"
import { contrast, darkenTo, hexToRgb, lightenTo, luminance, mix, rgbToHex } from "../../lib/scene/color.ts"
import { DARK, INK, LIGHT, MUTED_FOREGROUND, paletteCss, resolve, tokens } from "../../lib/scene/palette-css.ts"
import {
  CP_COLORS,
  CP_COLOR_NAMES,
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_IDS,
  isPaletteId,
  isPalettePref,
  paletteById,
  pickPalette,
} from "../../lib/scene/palettes.ts"

describe("colour maths", () => {
  test("contrast of black on white is 21 and of a colour with itself is 1", () => {
    assert.equal(Math.round(contrast("#000000", "#ffffff")), 21)
    assert.equal(contrast("#fcee09", "#fcee09"), 1)
  })

  test("hex round trips and mixing", () => {
    assert.deepEqual(hexToRgb("#0af"), [0, 170, 255])
    assert.equal(rgbToHex(...hexToRgb("#fcee09")), "#fcee09")
    assert.equal(mix("#000000", "#ffffff", 0.5), "#808080")
    assert.ok(luminance("#ffffff") > luminance("#808080"))
  })

  test("darkenTo and lightenTo reach the ratio they were asked for", () => {
    const onLight = darkenTo("#00f0ff", "#eceff5", 4.5)
    assert.ok(contrast(onLight, "#eceff5") >= 4.5, onLight)
    const onDark = lightenTo("#2f6bff", "#070910", 5.5)
    assert.ok(contrast(onDark, "#070910") >= 5.5, onDark)
    // A colour that already passes is left alone.
    assert.equal(darkenTo("#10131c", "#eceff5", 4.5), "#10131c")
  })
})

describe("the theme table", () => {
  test("eight themes, unique ids, in the order the id list gives", () => {
    assert.equal(PALETTES.length, 8)
    assert.deepEqual(PALETTES.map((p) => p.id), [...PALETTE_IDS])
    assert.equal(new Set(PALETTE_IDS).size, PALETTE_IDS.length)
    assert.equal(PALETTES[0].id, DEFAULT_PALETTE)
  })

  test("every theme has a name, a note, and valid colours", () => {
    for (const p of PALETTES) {
      assert.ok(p.name.length > 2 && p.note.length > 10, p.id)
      const colours = [p.primary, p.signal, p.heat, ...p.city.lights, ...p.city.sky, p.city.fog, p.city.head, p.city.tail]
      for (const c of colours) assert.match(c, /^#[0-9a-f]{6}$/i, `${p.id}: ${c}`)
      assert.equal(p.city.lights.length, 6)
      assert.equal(p.city.sky.length, 3)
    }
  })

  test("no two themes lead with the same primary and signal pair", () => {
    const pairs = PALETTES.map((p) => `${p.primary}/${p.signal}`)
    assert.equal(new Set(pairs).size, pairs.length)
  })

  test("all eight genre colours are used: in the themes, the city lights and the code colours", () => {
    const inThemes = new Set<string>()
    for (const p of PALETTES) for (const c of [p.primary, p.signal, p.heat, ...p.city.lights]) inThemes.add(c.toLowerCase())
    for (const name of CP_COLOR_NAMES) assert.ok(inThemes.has(CP_COLORS[name]), `${name} is never used by a theme`)

    const css = readFileSync(new URL("../../app/palettes.css", import.meta.url), "utf8")
    for (const name of CP_COLOR_NAMES) assert.match(css, new RegExp(`--c-${name}:`), `--c-${name} missing`)
    // Each kind of token in code gets a different genre colour.
    const dark = Object.values(tokens().dark)
    assert.equal(new Set(dark).size, dark.length)
  })

  test("isPaletteId / isPalettePref / paletteById", () => {
    for (const id of PALETTE_IDS) {
      assert.equal(isPaletteId(id), true)
      assert.equal(isPalettePref(id), true)
      assert.equal(paletteById(id).id, id)
    }
    assert.equal(isPalettePref("rotate"), true)
    assert.equal(isPaletteId("rotate"), false)
    for (const v of ["", "Night City", null, undefined, 4, {}]) assert.equal(isPalettePref(v), false, String(v))
    assert.equal(paletteById("nope").id, DEFAULT_PALETTE)
  })
})

describe("generated stylesheet", () => {
  test("app/palettes.css matches what the generator writes (run `npm run build:palettes` if this fails)", () => {
    const onDisk = readFileSync(new URL("../../app/palettes.css", import.meta.url), "utf8")
    assert.equal(onDisk, paletteCss())
  })

  test("every theme except the home one gets a dark block and a light block", () => {
    const css = paletteCss()
    for (const p of PALETTES.slice(1)) {
      assert.ok(css.includes(`html.dark[data-palette="${p.id}"]`), `${p.id} dark`)
      assert.ok(css.includes(`html:not(.dark)[data-palette="${p.id}"]`), `${p.id} light`)
    }
    // Night City is the base look in globals.css, so it has no override.
    assert.ok(!css.includes(`data-palette="${DEFAULT_PALETTE}"`))
  })

  test("the stylesheet never leaks a placeholder", () => {
    const css = paletteCss()
    assert.ok(!/undefined|NaN|\[object/.test(css))
  })
})

describe("readability in every theme", () => {
  const FOREGROUND = "#e8ecf6"

  test("dark: body text, muted text and links pass on every surface the theme tints", () => {
    for (const p of PALETTES) {
      const r = resolve(p)
      const s = p.id === DEFAULT_PALETTE ? DARK : r.dark.surfaces
      const MUTED = p.id === DEFAULT_PALETTE ? MUTED_FOREGROUND : r.dark.mutedForeground
      for (const k of ["background", "card", "secondary", "accent", "muted"] as const) {
        assert.ok(contrast(FOREGROUND, s[k]) >= 9, `${p.id} text on ${k}`)
        assert.ok(contrast(MUTED, s[k]) >= 4.5, `${p.id} muted text on ${k}: ${contrast(MUTED, s[k]).toFixed(2)}`)
      }
      assert.ok(contrast(r.dark.link, s.background) >= 7, `${p.id} link`)
      assert.ok(contrast(r.dark.link, s.card) >= 6, `${p.id} link on card`)
      assert.ok(contrast(r.dark.heat, s.card) >= 4.5, `${p.id} danger text`)
      const signal = p.id === DEFAULT_PALETTE ? p.signal : r.dark.signal
      assert.ok(contrast(signal, s.background) >= 4.5, `${p.id} signal on background`)
      assert.ok(contrast(signal, s.card) >= 4.5, `${p.id} signal on card`)
    }
  })

  test("dark: the main button is readable (ink on the primary colour)", () => {
    for (const p of PALETTES) assert.ok(contrast(INK, p.primary) >= 4.5, `${p.id}: ${contrast(INK, p.primary).toFixed(2)}`)
  })

  test("light: signal, link and danger colours pass on paper, and the primary shows on the ink button", () => {
    for (const p of PALETTES) {
      const r = resolve(p)
      assert.ok(contrast(r.light.signal, LIGHT.background) >= 4.5, `${p.id} signal`)
      assert.ok(contrast(r.light.link, LIGHT.background) >= 6, `${p.id} link`)
      assert.ok(contrast(r.light.heat, LIGHT.background) >= 4.5, `${p.id} danger`)
      assert.ok(contrast(p.primary, "#10131c") >= 4.5, `${p.id} primary on ink: ${contrast(p.primary, "#10131c").toFixed(2)}`)
    }
  })

  test("code colours pass on the code background in both themes", () => {
    const t = tokens()
    for (const [name, hex] of Object.entries(t.dark)) assert.ok(contrast(hex, DARK.code) >= 5.5, `dark ${name}`)
    for (const [name, hex] of Object.entries(t.light)) assert.ok(contrast(hex, LIGHT.code) >= 4.5, `light ${name}`)
  })
})

describe("Night City's own values in globals.css", () => {
  // The home theme is written by hand in globals.css rather than generated, so the checks above (which use the
  // generator) cannot see it. These read the stylesheet itself.
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")
  const block = (selector: string): Record<string, string> => {
    const start = css.indexOf(`\n${selector} {`)
    assert.ok(start >= 0, `${selector} block not found`)
    const end = css.indexOf("\n}", start)
    return Object.fromEntries([...css.slice(start, end).matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]))
  }
  const light = block(":root")
  const dark = block(".dark")

  test("light: text, signal, link and danger colours pass on the page and on a card", () => {
    for (const surface of ["background", "card"] as const) {
      for (const name of ["foreground", "muted-foreground", "signal", "heat", "destructive"] as const) {
        assert.ok(contrast(light[name], light[surface]) >= 4.5, `light ${name} on ${surface}: ${contrast(light[name], light[surface]).toFixed(2)}`)
      }
      assert.ok(contrast(light.link, light[surface]) >= 6, `light link on ${surface}: ${contrast(light.link, light[surface]).toFixed(2)}`)
    }
    assert.ok(contrast(light["primary-foreground"], light.primary) >= 4.5, "light button")
  })

  test("dark: text, signal, link and danger colours pass on the page and on a card", () => {
    for (const surface of ["background", "card"] as const) {
      for (const name of ["foreground", "muted-foreground", "signal", "heat", "destructive"] as const) {
        assert.ok(contrast(dark[name], dark[surface]) >= 4.5, `dark ${name} on ${surface}: ${contrast(dark[name], dark[surface]).toFixed(2)}`)
      }
      assert.ok(contrast(dark.link, dark[surface]) >= 7, `dark link on ${surface}: ${contrast(dark.link, dark[surface]).toFixed(2)}`)
    }
    assert.ok(contrast(dark["primary-foreground"], dark.primary) >= 4.5, "dark button")
  })

  test("the focus ring is at least 3:1 on the page in both schemes", () => {
    assert.ok(contrast(light.ring, light.background) >= 3, `light ring: ${contrast(light.ring, light.background).toFixed(2)}`)
    assert.ok(contrast(dark.ring, dark.background) >= 3, `dark ring: ${contrast(dark.ring, dark.background).toFixed(2)}`)
  })
})

describe("change on every refresh", () => {
  test("a fixed theme is returned as it is", () => {
    for (const id of PALETTE_IDS) assert.equal(pickPalette(id, "toxic", () => 0.3), id)
  })

  test("an unknown preference falls back to the home theme", () => {
    for (const v of ["", "nope", null, undefined, 7]) assert.equal(pickPalette(v, null, () => 0.9), DEFAULT_PALETTE)
  })

  test("rotate never repeats the theme shown last time, whatever the dice say", () => {
    for (const last of PALETTE_IDS) {
      const seen = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        const got = pickPalette("rotate", last, () => i / 1000)
        assert.notEqual(got, last)
        seen.add(got)
      }
      // ...and every other theme can come up.
      assert.equal(seen.size, PALETTE_IDS.length - 1, `after ${last}`)
    }
  })

  test("rotate with nothing remembered can pick any of them", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(pickPalette("rotate", null, () => i / 1000))
    assert.equal(seen.size, PALETTE_IDS.length)
  })

  test("random() at the very top of its range stays inside the list", () => {
    assert.ok(isPaletteId(pickPalette("rotate", null, () => 0.9999999)))
    assert.ok(isPaletteId(pickPalette("rotate", "toxic", () => 1)))
  })
})
