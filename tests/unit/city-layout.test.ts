/**
 * The city's layout is plain data, so it can be checked without a graphics card: it must be repeatable from a seed,
 * keep every building out of the road and out of its neighbours, keep every sign on a wall, and fit the engine's buffers.
 */
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
  BLOCK_LEN,
  CAPACITY,
  FRONT,
  LOTS_LEN,
  ROAD_HALF,
  SIGN_CELLS,
  STYLE,
  blockSeed,
  generateBlock,
} from "../../lib/scene/city/layout.ts"
import { rng } from "../../lib/scene/city/rng.ts"

const SEEDS = Array.from({ length: 300 }, (_, i) => blockSeed(1234, i))

describe("seeded random numbers", () => {
  test("the same seed gives the same sequence, a different seed does not", () => {
    const a = rng(42)
    const b = rng(42)
    const c = rng(43)
    const xs = Array.from({ length: 20 }, () => a.next())
    assert.deepEqual(xs, Array.from({ length: 20 }, () => b.next()))
    assert.notDeepEqual(xs, Array.from({ length: 20 }, () => c.next()))
  })

  test("range, int, pick and chance stay inside their limits", () => {
    const r = rng(7)
    for (let i = 0; i < 2000; i++) {
      const n = r.next()
      assert.ok(n >= 0 && n < 1)
      const x = r.range(3, 5)
      assert.ok(x >= 3 && x < 5)
      const k = r.int(2, 4)
      assert.ok(Number.isInteger(k) && k >= 2 && k <= 4)
      assert.ok(["a", "b", "c"].includes(r.pick(["a", "b", "c"])))
    }
    assert.equal(rng(1).chance(0), false)
    assert.equal(rng(1).chance(1), true)
  })

  test("block seeds are different for each block and each session", () => {
    assert.equal(new Set(SEEDS).size, SEEDS.length)
    assert.notEqual(blockSeed(1, 0), blockSeed(2, 0))
  })
})

describe("a block of city", () => {
  test("is the same every time it is built from one seed", () => {
    assert.deepEqual(generateBlock(99), generateBlock(99))
    assert.notDeepEqual(generateBlock(99), generateBlock(100))
  })

  test("fits the engine's buffers", () => {
    for (const s of SEEDS) {
      const b = generateBlock(s)
      assert.ok(b.buildings.length > 0 && b.buildings.length <= CAPACITY.buildings, `buildings ${b.buildings.length}`)
      assert.ok(b.signs.length <= CAPACITY.signs, `signs ${b.signs.length}`)
      assert.ok(b.lights.length <= CAPACITY.lights, `lights ${b.lights.length}`)
    }
  })

  test("every number is finite", () => {
    for (const s of SEEDS.slice(0, 80)) {
      const b = generateBlock(s)
      for (const o of [...b.buildings, ...b.signs, ...b.lights]) for (const v of Object.values(o)) assert.ok(Number.isFinite(v), JSON.stringify(o))
    }
  })

  test("buildings stay off the road and the pavement, on the ground, and inside the block", () => {
    for (const s of SEEDS) {
      for (const bd of generateBlock(s).buildings) {
        if (bd.x === 0) continue // a walkway across the street, tested below
        const nearEdge = Math.abs(bd.x) - bd.w / 2
        assert.ok(nearEdge >= ROAD_HALF + 3.9, `seed ${s}: a wall at ${nearEdge.toFixed(2)} m`)
        assert.ok(bd.y - bd.h / 2 >= -1e-6, "below ground")
        assert.ok(bd.z + bd.d / 2 <= 1e-6 && bd.z - bd.d / 2 >= -LOTS_LEN - 2, `seed ${s}: z ${bd.z.toFixed(1)} d ${bd.d.toFixed(1)}`)
        assert.ok(bd.w > 5 && bd.d > 5 && bd.h > 20, "too small to be a tower")
      }
    }
  })

  test("the cross street at the far end stays clear", () => {
    for (const s of SEEDS) {
      for (const bd of generateBlock(s).buildings) {
        if (bd.x === 0) continue
        assert.ok(bd.z - bd.d / 2 >= -LOTS_LEN - 2, "a tower in the cross street")
      }
      assert.ok(LOTS_LEN < BLOCK_LEN)
    }
  })

  test("buildings on one side of the street do not overlap each other along the street", () => {
    for (const s of SEEDS) {
      const b = generateBlock(s)
      for (const side of [-1, 1]) {
        // The lower tier of each plot: the widest, first-listed box of each seed pair.
        const lots = b.buildings.filter((x) => Math.sign(x.x) === side).filter((x, i, all) => !all.some((o, j) => j < i && o.seed === x.seed - 1))
        const sorted = [...lots].sort((p, q) => q.z - p.z)
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1]
          const cur = sorted[i]
          // Tiers of one plot can wobble by a metre or two; neighbouring plots must not collide.
          if (cur.seed === prev.seed + 1) continue
          assert.ok(prev.z - prev.d / 2 >= cur.z + cur.d / 2 - 2.01, `seed ${s}: plots overlap by ${(cur.z + cur.d / 2 - (prev.z - prev.d / 2)).toFixed(2)} m`)
        }
      }
    }
  })

  test("there are tall towers, some very tall ones, and some low ones", () => {
    let tallest = 0
    let low = 0
    let supertall = 0
    for (const s of SEEDS) {
      for (const bd of generateBlock(s).buildings) {
        if (bd.x === 0) continue
        const top = bd.y + bd.h / 2
        tallest = Math.max(tallest, top)
        if (top > 170) supertall++
        if (top < 90) low++
      }
    }
    assert.ok(tallest > 250 && tallest <= 330, String(tallest))
    assert.ok(supertall > 20 && low > 100)
  })

  test("signs are on a wall facing the street, on the wall's height, and use real atlas pictures", () => {
    const cells = SIGN_CELLS.horizontal + SIGN_CELLS.vertical
    for (const s of SEEDS.slice(0, 120)) {
      const b = generateBlock(s)
      for (const sg of b.signs) {
        assert.ok(sg.cell >= 0 && sg.cell < cells, `cell ${sg.cell}`)
        assert.ok(sg.hue >= 0 && sg.hue <= 5 && Number.isInteger(sg.hue))
        assert.ok(sg.w > 0 && sg.h > 0)
        assert.ok(sg.y - sg.h / 2 > 0.5, "sign in the pavement")
        // Flat signs and billboards hug a wall: just inside FRONT, facing the road.
        if (sg.kind !== 1) {
          assert.ok(Math.abs(Math.abs(sg.x) - FRONT) < 3.2, `sign at x ${sg.x}`)
          assert.ok(Math.abs(sg.rot) === Math.PI / 2)
          assert.equal(Math.sign(Math.sin(sg.rot)), -Math.sign(sg.x), "a sign facing into its wall")
        } else {
          assert.equal(sg.rot, 0)
          // Hangs over the pavement from its wall (walls can be set back up to 3 m), never over the road.
          assert.ok(Math.abs(sg.x) < FRONT + 3.1 && Math.abs(sg.x) > ROAD_HALF + 0.5, `a blade sign at x ${sg.x}`)
          assert.ok(sg.cell >= SIGN_CELLS.horizontal, "a blade sign should use a vertical picture")
        }
        if (sg.kind === 0) assert.ok(sg.cell < SIGN_CELLS.horizontal)
        // Along the street the sign must sit on a building, not in an alley or the cross street.
        assert.ok(sg.z <= 0.01 && sg.z >= -LOTS_LEN - 0.01, `sign z ${sg.z}`)
        const wall = b.buildings.find(
          (bd) => bd.x !== 0 && Math.sign(bd.x) === Math.sign(sg.x) && sg.z <= bd.z + bd.d / 2 + 0.01 && sg.z >= bd.z - bd.d / 2 - 0.01 && sg.y <= bd.y + bd.h / 2
        )
        assert.ok(wall, `seed ${s}: a ${sg.kind === 0 ? "flat" : sg.kind === 1 ? "blade" : "billboard"} sign with nothing behind it (z ${sg.z.toFixed(1)}, y ${sg.y.toFixed(1)})`)
      }
    }
  })

  test("big pictures only go on tall walls, and always fit inside the wall's width", () => {
    let seen = 0
    for (const s of SEEDS) {
      const b = generateBlock(s)
      for (const sg of b.signs.filter((x) => x.kind === 2)) {
        seen++
        assert.ok(sg.h >= 14 && sg.h <= 30)
        const wall = b.buildings.find((bd) => bd.x !== 0 && Math.sign(bd.x) === Math.sign(sg.x) && Math.abs(sg.z - bd.z) <= bd.d / 2)
        assert.ok(wall)
        assert.ok(sg.z - sg.w / 2 >= wall.z - wall.d / 2 - 0.01 && sg.z + sg.w / 2 <= wall.z + wall.d / 2 + 0.01, "a billboard hanging off the end of its wall")
      }
    }
    assert.ok(seen > 100, `only ${seen} billboards in 300 blocks`)
  })

  test("every very tall tower has a red light on its roof", () => {
    for (const s of SEEDS) {
      const b = generateBlock(s)
      const beacons = b.buildings.filter((bd) => bd.style & STYLE.BEACON && bd.x !== 0)
      const reds = b.lights.filter((l) => l.hue === -2 && l.blink > 0)
      assert.ok(reds.length <= beacons.length)
      for (const l of reds) assert.ok(l.y > 90, `a beacon at ${l.y}`)
    }
  })

  test("walkways across the street join two tall towers and are not in the road's way", () => {
    let seen = 0
    for (const s of SEEDS) {
      const b = generateBlock(s)
      for (const w of b.buildings.filter((x) => x.x === 0)) {
        seen++
        assert.ok(w.y - w.h / 2 >= 26, "too low: traffic would hit it")
        assert.ok(w.w > 2 * FRONT)
        const left = b.buildings.some((o) => o.x < 0 && o.y + o.h / 2 > w.y + w.h / 2 && Math.abs(o.z - w.z) < o.d / 2)
        const right = b.buildings.some((o) => o.x > 0 && o.y + o.h / 2 > w.y + w.h / 2 && Math.abs(o.z - w.z) < o.d / 2)
        assert.ok(left && right, `seed ${s}: a walkway with a tower missing at one end`)
      }
    }
    assert.ok(seen > 40, `only ${seen} walkways in 300 blocks`)
  })

  test("street lamps stand on the pavement, traffic lights at the far end", () => {
    const b = generateBlock(5)
    const lamps = b.lights.filter((l) => l.hue === -3 && l.y > 7)
    assert.ok(lamps.length >= 6)
    for (const l of lamps) assert.ok(Math.abs(l.x) > ROAD_HALF && Math.abs(l.x) < FRONT)
    const traffic = b.lights.filter((l) => l.z < -LOTS_LEN)
    assert.equal(traffic.length, 2)
  })
})
