import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createGovernor, GOVERNOR, type Verdict } from "../../lib/scene/city/governor.ts"

/** Feeds frames of one length and returns the first verdict that is not "keep" (and how many frames it took). */
function run(g: ReturnType<typeof createGovernor>, dtMs: number, frames: number, atLowest = false) {
  for (let i = 1; i <= frames; i++) {
    const v = g.frame(dtMs, atLowest)
    if (v !== "keep") return { verdict: v, at: i }
  }
  return { verdict: "keep" as Verdict, at: frames }
}

describe("city governor", () => {
  it("leaves a smooth 60 and 30 frames a second alone", () => {
    for (const dt of [16.7, 33.3]) {
      const g = createGovernor()
      assert.equal(run(g, dt, 2000).verdict, "keep")
      assert.equal(run(g, dt, 2000, true).verdict, "keep")
    }
  })

  it("does not judge the first frames: a slow shader compile on start is normal", () => {
    const g = createGovernor()
    assert.equal(g.frame(2500, false), "keep")
    assert.equal(g.frame(900, false), "keep")
    assert.equal(run(g, 16.7, 600).verdict, "keep")
  })

  it("goes straight to the lowest quality when frames take a second each", () => {
    const g = createGovernor()
    const r = run(g, 3000, 20)
    assert.equal(r.verdict, "lowest")
    assert.equal(r.at, GOVERNOR.warm + 2)
  })

  it("stops when it is already at the lowest quality and frames still take a second", () => {
    const g = createGovernor()
    const r = run(g, 3000, 20, true)
    assert.equal(r.verdict, "give-up")
    assert.equal(r.at, GOVERNOR.warm + 2)
  })

  it("steps down once after three frames of 200 ms in a row", () => {
    const g = createGovernor()
    run(g, 16.7, GOVERNOR.warm)
    assert.equal(g.frame(260, false), "keep")
    assert.equal(g.frame(260, false), "keep")
    assert.equal(g.frame(260, false), "down")
  })

  it("stops after three frames of 200 ms in a row at the lowest quality", () => {
    const g = createGovernor()
    run(g, 16.7, GOVERNOR.warm)
    assert.equal(g.frame(260, true), "keep")
    assert.equal(g.frame(260, true), "keep")
    assert.equal(g.frame(260, true), "give-up")
  })

  it("forgets a bad stretch as soon as a good frame arrives", () => {
    // Two long frames, then half a second of smooth ones, over and over: never three long frames in a row, and the average stays above 24.
    const g = createGovernor()
    run(g, 16.7, GOVERNOR.warm)
    for (let i = 0; i < 50; i++) {
      assert.equal(g.frame(260, false), "keep")
      assert.equal(g.frame(260, false), "keep")
      assert.equal(run(g, 16.7, 30).verdict, "keep")
    }
  })

  it("does step down when long frames keep coming, even with a good frame between them", () => {
    // Two long frames out of every three is about 6 frames a second: the average rule catches what the streak rule cannot.
    const g = createGovernor()
    run(g, 16.7, GOVERNOR.warm)
    let verdict: Verdict = "keep"
    for (let i = 0; i < 20 && verdict === "keep"; i++) {
      for (const dt of [260, 260, 16.7]) {
        const v = g.frame(dt, false)
        if (v !== "keep") verdict = v
      }
    }
    assert.equal(verdict, "down")
  })

  it("steps down when the average stays under 24 frames a second", () => {
    const g = createGovernor()
    const r = run(g, 50, 400) // 20 frames a second
    assert.equal(r.verdict, "down")
    // two half-second windows of 12 frames each, after the warm-up
    assert.ok(r.at <= GOVERNOR.warm + 2 * Math.ceil(GOVERNOR.windowMs / 50), `took ${r.at} frames`)
  })

  it("keeps a slow middle at the lowest quality instead of stopping", () => {
    const g = createGovernor()
    assert.equal(run(g, 55, 2000, true).verdict, "keep") // about 18 frames a second
  })

  it("stops at the lowest quality when the average stays under 12 frames a second", () => {
    const g = createGovernor()
    assert.equal(run(g, 125, 400, true).verdict, "give-up") // 8 frames a second
  })

  it("ignores one slow window between good ones", () => {
    const g = createGovernor()
    run(g, 16.7, GOVERNOR.warm)
    for (let round = 0; round < 20; round++) {
      assert.equal(run(g, 50, 12).verdict, "keep") // one window at 20 fps
      assert.equal(run(g, 16.7, 40).verdict, "keep") // then a good one
    }
  })

  it("treats a ten second gap as a sleeping tab, not a slow city", () => {
    const g = createGovernor()
    run(g, 16.7, 100)
    assert.equal(g.frame(30_000, false), "keep")
    assert.equal(g.frame(1500, false), "keep") // warm-up again
    assert.equal(g.frame(1500, false), "keep")
    assert.equal(g.frame(16.7, false), "keep")
    assert.equal(run(g, 16.7, 300).verdict, "keep")
  })

  it("settle() forgets what was measured and skips the frames that follow", () => {
    const g = createGovernor()
    run(g, 16.7, GOVERNOR.warm)
    assert.equal(g.frame(260, false), "keep")
    assert.equal(g.frame(260, false), "keep")
    g.settle()
    assert.equal(g.frame(260, false), "keep") // warm-up
    assert.equal(g.frame(260, false), "keep") // warm-up
    assert.equal(g.frame(260, false), "keep") // first judged
    assert.equal(g.frame(260, false), "keep")
    assert.equal(g.frame(260, false), "down")
  })

  it("ignores frame times that are not positive numbers", () => {
    const g = createGovernor()
    for (const bad of [0, -5, Number.NaN]) assert.equal(g.frame(bad, false), "keep")
  })

  it("reports a smoothed frame rate that follows the measured one", () => {
    const g = createGovernor()
    run(g, 16.7, 200)
    assert.ok(g.fps > 55 && g.fps < 62, `fps ${g.fps}`)
    run(g, 100, 6, true)
    assert.ok(g.fps < 40, `fps ${g.fps}`)
  })

  it("walks a hopeless machine from high to nothing in a handful of frames", () => {
    const g = createGovernor()
    let quality = 2 // high
    let frames = 0
    let gaveUp = false
    while (!gaveUp && frames < 200) {
      frames++
      const v = g.frame(3000, quality === 0)
      if (v === "lowest") {
        quality = 0
        g.settle()
      } else if (v === "down") {
        quality -= 1
        g.settle()
      } else if (v === "give-up") gaveUp = true
    }
    assert.ok(gaveUp)
    assert.equal(quality, 0)
    assert.ok(frames <= 2 * (GOVERNOR.warm + 2), `took ${frames} frames`)
  })
})
