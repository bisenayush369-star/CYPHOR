/**
 * Decides when the city should draw less, or stop altogether.
 *
 * It judges the time between animation frames, because that is what the person feels: a frame that takes a second
 * freezes the whole page, not only the city. There is no WebGL in here, so the rules can be tested on their own.
 *
 *  - The first frames after a start, a resize or a quality change are not judged. They compile shaders and allocate buffers.
 *  - Two frames of a second or more in a row: this machine cannot draw the city at all. Go straight to the lowest quality, or stop if it is already there.
 *  - Three frames of 200 ms or more in a row: step down one quality, or stop if it is already at the lowest.
 *  - Otherwise the average over about half a second. Under 24 frames a second twice in a row steps down. At the lowest quality, under 12 twice in a row stops.
 *  - A gap of ten seconds or more means the tab was asleep, not that the city is slow. It is forgotten.
 *
 * Quality never goes back up inside a session: a city that flickers between two looks is worse than a steady lower one.
 */

export type Verdict = "keep" | "down" | "lowest" | "give-up"

export const GOVERNOR = {
  /** Frames after a start or a change that are not judged. */
  warm: 2,
  /** A frame this long, twice in a row, means the machine cannot do it. */
  severeMs: 1000,
  /** A frame this long, three times in a row, means one step down. */
  jankMs: 200,
  /** How long the average is taken over. */
  windowMs: 600,
  /** An average under this, twice in a row, means one step down. */
  slowFps: 24,
  /** At the lowest quality, an average under this, twice in a row, means stop. */
  giveUpFps: 12,
  /** A gap this long is a sleeping tab. */
  sleepMs: 10_000,
} as const

export interface Governor {
  /** Smoothed frames a second, for display and tests. */
  readonly fps: number
  /** Something changed (start, resize, new quality): forget what was measured and skip the next few frames. */
  settle(): void
  /** One animation frame. `dtMs` is the time since the previous one; `atLowest` is whether quality can go no lower. */
  frame(dtMs: number, atLowest: boolean): Verdict
}

export function createGovernor(): Governor {
  let warm: number = GOVERNOR.warm
  let severe = 0
  let jank = 0
  let slow = 0
  let span = 0
  let count = 0
  let smooth = 60

  function forget() {
    severe = 0
    jank = 0
    slow = 0
    span = 0
    count = 0
  }

  return {
    get fps() {
      return smooth
    },
    settle() {
      warm = GOVERNOR.warm
      forget()
    },
    frame(dtMs, atLowest) {
      if (!(dtMs > 0)) return "keep"
      if (dtMs >= GOVERNOR.sleepMs) {
        warm = GOVERNOR.warm
        forget()
        return "keep"
      }
      smooth = smooth * 0.9 + (1000 / Math.max(1, dtMs)) * 0.1
      if (warm > 0) {
        warm--
        return "keep"
      }

      severe = dtMs >= GOVERNOR.severeMs ? severe + 1 : 0
      if (severe >= 2) {
        forget()
        return atLowest ? "give-up" : "lowest"
      }
      jank = dtMs >= GOVERNOR.jankMs ? jank + 1 : 0
      if (jank >= 3) {
        forget()
        return atLowest ? "give-up" : "down"
      }

      span += dtMs
      count++
      if (span < GOVERNOR.windowMs) return "keep"
      const avg = (count * 1000) / span
      span = 0
      count = 0
      slow = avg < GOVERNOR.slowFps ? slow + 1 : 0
      if (slow < 2) return "keep"
      slow = 0
      if (!atLowest) return "down"
      return avg < GOVERNOR.giveUpFps ? "give-up" : "keep"
    },
  }
}
