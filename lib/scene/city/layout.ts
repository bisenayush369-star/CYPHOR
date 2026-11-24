import { rng, type Rng } from "./rng"

/**
 * The shape of the city, as plain data. One "block" is a stretch of street with the towers on both sides, a cross street
 * at the far end and the signs, lamps and rooftop lights that go with them. The engine builds as many blocks as it can
 * see, and builds a new one whenever one passes behind the camera, so the street never repeats.
 *
 * Coordinates are in metres and local to the block: x across the street (0 is the middle of the road), y up from the
 * pavement, z along the street, from 0 at the near end to -BLOCK_LEN at the far end.
 *
 * Nothing here touches WebGL, so tests/unit/city-layout.test.ts can check it in plain Node.
 */

export const BLOCK_LEN = 96
/** The frontage with buildings on it. The rest of the block is the cross street. */
export const LOTS_LEN = 72
export const ROAD_HALF = 9
export const WALK = 4
/** Where the street-facing walls start. */
export const FRONT = ROAD_HALF + WALK

/** Style flags for a building. */
export const STYLE = {
  NEON_EDGES: 1,
  CROWN: 2,
  GLASS: 4,
  BRUTAL: 8,
  BEACON: 16,
  FINS: 32,
} as const

export interface Building {
  /** Centre of the box. */
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  seed: number
  style: number
  /** How many of its windows are lit, 0 to 1. */
  lit: number
}

/** 0 flat on a wall, 1 blade (sticks out into the street), 2 billboard with moving picture. */
export type SignKind = 0 | 1 | 2

export interface Sign {
  kind: SignKind
  x: number
  y: number
  z: number
  w: number
  h: number
  /** Turn about the vertical axis, radians. 0 faces +z (toward the camera). */
  rot: number
  /** Which picture of the sign atlas. */
  cell: number
  /** Which of the theme's six city lights. */
  hue: number
  seed: number
}

/** A point of light. `hue` is 0..5 for a theme light, or one of the LIGHT_* constants. */
export interface Light {
  x: number
  y: number
  z: number
  hue: number
  size: number
  /** Blinks per second, 0 for steady. */
  blink: number
}

export const LIGHT_WARM = -1
export const LIGHT_RED = -2
export const LIGHT_SODIUM = -3

export interface Block {
  seed: number
  buildings: Building[]
  signs: Sign[]
  lights: Light[]
}

/** How many pictures the sign atlas has: 48 horizontal, 16 vertical. */
export const SIGN_CELLS = { horizontal: 48, vertical: 16 } as const

/** Most buildings, signs and lights one block can hold. The engine sizes its buffers from these. */
export const CAPACITY = { buildings: 30, signs: 72, lights: 40 } as const

function building(r: Rng, side: 1 | -1, z0: number, z1: number, front: number, h: number, tiers: boolean): Building[] {
  const w = z0 - z1
  const d = r.range(18, 44)
  const seed = Math.floor(r.next() * 1e6)
  const lit = r.range(0.22, 0.78)
  let style = 0
  if (r.chance(0.38)) style |= STYLE.NEON_EDGES
  if (r.chance(0.3)) style |= STYLE.CROWN
  if (r.chance(0.28)) style |= STYLE.GLASS
  else if (r.chance(0.25)) style |= STYLE.BRUTAL
  if (h > 90) style |= STYLE.BEACON
  if (r.chance(0.18)) style |= STYLE.FINS

  const out: Building[] = []
  const cx = side * (front + d / 2)
  const cz = (z0 + z1) / 2
  if (tiers && h > 120) {
    const h1 = h * r.range(0.45, 0.65)
    out.push({ x: cx, y: h1 / 2, z: cz, w: d, h: h1, d: w, seed, style, lit })
    const shrink = r.range(0.62, 0.85)
    const d2 = d * shrink
    const w2 = w * r.range(0.68, 0.9)
    // The upper tier sits toward the back of the plot, so the front wall steps in. It stays inside the plot's length.
    const cx2 = side * (front + d - d2 / 2 - r.range(0, 2))
    const room = (w - w2) / 2
    const cz2 = cz + Math.max(-room, Math.min(room, r.range(-1.5, 1.5)))
    out.push({ x: cx2, y: h1 + (h - h1) / 2, z: cz2, w: d2, h: h - h1, d: w2, seed: seed + 1, style, lit })
  } else {
    out.push({ x: cx, y: h / 2, z: cz, w: d, h, d: w, seed, style, lit })
  }
  return out
}

/** A tower height: mostly mid-rise, some tall, a few very tall. */
function towerHeight(r: Rng): number {
  const roll = r.next()
  if (roll < 0.14) return r.range(180, 320)
  if (roll < 0.5) return r.range(90, 180)
  return r.range(38, 90)
}

export function generateBlock(seed: number): Block {
  const r = rng(seed)
  const block: Block = { seed, buildings: [], signs: [], lights: [] }

  for (const side of [-1, 1] as const) {
    // Split the frontage into lots, with the occasional narrow alley between them.
    let z = 0
    for (;;) {
      const left = LOTS_LEN + z
      if (left < 12) break
      let width = Math.min(left, r.range(14, 30))
      if (left - width < 14) width = left
      const lotEnd = z - width
      const alley = r.chance(0.4) && left - width > 18 ? r.range(2.5, 6) : 0
      const front = FRONT + (r.chance(0.3) ? r.range(1, 3) : 0)
      const h = towerHeight(r)
      const parts = building(r, side, z, lotEnd, front, h, true)
      block.buildings.push(...parts)

      // Signs sit just in front of the wall that faces the street.
      const faceX = side * (front - 0.06)
      const wallH = parts[0].h

      // Shop signs, low enough to read from the road.
      const flats = r.int(1, 4)
      for (let i = 0; i < flats; i++) {
        const w = r.range(2.6, 7)
        block.signs.push({
          kind: 0,
          x: faceX,
          y: r.range(3.6, Math.min(20, wallH - 2)),
          z: lotEnd + w / 2 + r.next() * Math.max(0.5, width - w),
          w,
          h: r.range(1.1, 2.4),
          rot: side > 0 ? -Math.PI / 2 : Math.PI / 2,
          cell: r.int(0, SIGN_CELLS.horizontal - 1),
          hue: r.int(0, 5),
          seed: Math.floor(r.next() * 1e6),
        })
      }

      // Blade signs stick out over the pavement and read from along the street.
      const blades = r.int(0, 2)
      for (let i = 0; i < blades; i++) {
        const bh = r.range(3.2, 7.5)
        block.signs.push({
          kind: 1,
          x: side * (front - r.range(1.0, 2.2)),
          y: r.range(7, Math.max(8, Math.min(30, wallH - bh))),
          z: lotEnd + 1.2 + r.next() * Math.max(0.5, width - 2.4),
          w: bh * r.range(0.26, 0.34),
          h: bh,
          rot: 0,
          cell: SIGN_CELLS.horizontal + r.int(0, SIGN_CELLS.vertical - 1),
          hue: r.int(0, 5),
          seed: Math.floor(r.next() * 1e6),
        })
      }

      // A big moving picture on the taller towers.
      const bh = r.range(14, 30)
      if (wallH > bh + 14 && r.chance(0.55)) {
        const bw = Math.min(width - 3, bh * r.range(0.5, 0.8))
        block.signs.push({
          kind: 2,
          x: side * (front - 0.1),
          y: r.range(bh / 2 + 8, wallH - bh / 2 - 2),
          z: lotEnd + bw / 2 + 1 + r.next() * Math.max(0.5, width - bw - 2),
          w: bw,
          h: bh,
          rot: side > 0 ? -Math.PI / 2 : Math.PI / 2,
          cell: 0,
          hue: r.int(0, 5),
          seed: Math.floor(r.next() * 1e6),
        })
      }

      // The red lights on the roof of anything very tall.
      const top = parts[parts.length - 1]
      if (top.style & STYLE.BEACON) {
        block.lights.push({ x: top.x, y: top.y + top.h / 2 + 1.5, z: top.z, hue: LIGHT_RED, size: 3.2, blink: r.range(0.45, 0.9) })
      }

      z = lotEnd - alley
    }

    // Street lamps down the pavement, one every 24 m.
    for (let lz = -6; lz > -LOTS_LEN; lz -= 24) {
      block.lights.push({ x: side * (ROAD_HALF + 0.6), y: 7.6, z: lz, hue: LIGHT_SODIUM, size: 1.2, blink: 0 })
    }
  }

  // A walkway across the street between two towers that are both tall enough.
  if (r.chance(0.65)) {
    const left = block.buildings.filter((b) => b.x < 0)
    const right = block.buildings.filter((b) => b.x > 0)
    const options: { z: number; span: number; y: number }[] = []
    for (const a of left) {
      for (const b of right) {
        const lo = Math.max(a.z - a.d / 2, b.z - b.d / 2)
        const hi = Math.min(a.z + a.d / 2, b.z + b.d / 2)
        const y = r.range(30, 62)
        if (hi - lo >= 9 && a.h + (a.y - a.h / 2) > y + 8 && b.h + (b.y - b.h / 2) > y + 8) options.push({ z: (lo + hi) / 2, span: hi - lo, y })
      }
    }
    if (options.length) {
      const o = r.pick(options)
      const len = Math.min(o.span - 2, r.range(9, 16))
      block.buildings.push({ x: 0, y: o.y, z: o.z, w: FRONT * 2 + 6, h: r.range(3.5, 6), d: len, seed: Math.floor(r.next() * 1e6), style: STYLE.GLASS | STYLE.NEON_EDGES, lit: r.range(0.35, 0.6) })
    }
  }

  // The cross street: traffic lights at the corners.
  const lightZ = -(LOTS_LEN + 1.5)
  for (const side of [-1, 1] as const) {
    const state = r.pick([LIGHT_RED, 5, LIGHT_SODIUM] as const)
    block.lights.push({ x: side * (ROAD_HALF - 0.5), y: 6.2, z: lightZ, hue: state, size: 1.5, blink: 0 })
  }

  block.buildings.length = Math.min(block.buildings.length, CAPACITY.buildings)
  block.signs.length = Math.min(block.signs.length, CAPACITY.signs)
  block.lights.length = Math.min(block.lights.length, CAPACITY.lights)
  return block
}

/** The seed for the nth block built in a session. */
export function blockSeed(session: number, n: number): number {
  return (Math.imul(session ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n + 1, 0xc2b2ae35)) >>> 0
}
