/** A small seeded random generator (mulberry32), so a block of city is the same every time it is built from the same seed. */
export interface Rng {
  /** 0 up to, not including, 1. */
  next(): number
  /** Between `a` and `b`. */
  range(a: number, b: number): number
  /** A whole number from `a` to `b`, both included. */
  int(a: number, b: number): number
  pick<T>(items: readonly T[]): T
  chance(p: number): boolean
}

export function rng(seed: number): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
  }
}
