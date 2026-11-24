/**
 * Provider colours: stable, from the genre palette, never the two colours the router strip keeps for "failing" and "resting".
 */
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { PROVIDERS } from "../../lib/router/provider-defs.ts"
import { CP_COLOR_NAMES } from "../../lib/scene/palettes.ts"
import { HUE_BG, hueOf, hueVar, PROVIDER_HUES } from "../../lib/scene/hue.ts"

describe("provider hues", () => {
  test("every hue is a colour of the genre palette, and red, yellow and magenta (which reads as red) are not among them", () => {
    for (const h of PROVIDER_HUES) assert.ok((CP_COLOR_NAMES as string[]).includes(h), h)
    for (const reserved of ["red", "yellow", "magenta"]) assert.ok(!(PROVIDER_HUES as readonly string[]).includes(reserved), reserved)
  })

  test("every provider the router knows has a hue, and it never changes", () => {
    for (const p of PROVIDERS) {
      assert.ok((PROVIDER_HUES as readonly string[]).includes(hueOf(p.id)), p.id)
      assert.equal(hueOf(p.id), hueOf(p.id))
    }
  })

  test("neighbours in the provider list do not share a colour", () => {
    for (let i = 1; i < PROVIDERS.length; i++) assert.notEqual(hueOf(PROVIDERS[i].id), hueOf(PROVIDERS[i - 1].id), `${PROVIDERS[i - 1].id} / ${PROVIDERS[i].id}`)
  })

  test("the first providers each get a different colour, and every colour is used", () => {
    const first = PROVIDERS.slice(0, PROVIDER_HUES.length).map((p) => hueOf(p.id))
    assert.equal(new Set(first).size, PROVIDER_HUES.length)
  })

  test("an unknown provider gets a stable colour from the same set", () => {
    for (const id of ["acme", "my-local-llama", "", "ünïcode"]) {
      assert.equal(hueOf(id), hueOf(id))
      assert.ok((PROVIDER_HUES as readonly string[]).includes(hueOf(id)), id)
    }
    const spread = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map(hueOf))
    assert.ok(spread.size >= 3, "unknown names should not all land on one colour")
  })

  test("the CSS value follows the theme and the class names are written out in full", () => {
    for (const h of PROVIDER_HUES) {
      assert.equal(hueVar(h), `var(--c-${h})`)
      assert.equal(HUE_BG[h], `bg-cp-${h}`)
    }
    assert.deepEqual(Object.keys(HUE_BG).sort(), [...PROVIDER_HUES].sort())
  })
})
