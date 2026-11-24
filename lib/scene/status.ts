import { useSyncExternalStore } from "react"

/**
 * What the moving city is doing right now, so Settings can say so in plain words instead of leaving someone with a
 * background that quietly never appears. The city component writes it; nothing else does.
 */
export type CityReason =
  /** The browser has no WebGL, or it is switched off. */
  | "no-webgl"
  /** WebGL works, but only on the CPU (hardware acceleration is off), which is far too slow for this scene. */
  | "software"
  /** It started, but the machine could not hold a steady frame rate even at the lowest quality. */
  | "slow"
  /** The graphics driver dropped the drawing surface. */
  | "lost"
  /** Something else went wrong while starting. */
  | "error"
  /** The city is a night scene, so it only shows in the dark theme. */
  | "light-theme"

export type CityQuality = "low" | "medium" | "high"

export type CityStatus =
  | { state: "off" }
  | { state: "loading" }
  | { state: "ready"; quality: CityQuality; still: boolean }
  | { state: "unavailable"; reason: CityReason }

const OFF: CityStatus = { state: "off" }
let status: CityStatus = OFF
const listeners = new Set<() => void>()

export function setCityStatus(next: CityStatus) {
  status = next
  for (const l of listeners) l()
}

export function getCityStatus(): CityStatus {
  return status
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useCityStatus(): CityStatus {
  return useSyncExternalStore(subscribe, getCityStatus, () => OFF)
}

/** One line for Settings. Empty when there is nothing to say. */
export function describeCityStatus(s: CityStatus): string {
  switch (s.state) {
    case "loading":
      return "Starting the city."
    case "ready":
      return s.still ? "Showing one still frame, because motion is reduced." : `Running at ${s.quality} quality. It lowers itself if your device struggles.`
    case "unavailable":
      switch (s.reason) {
        case "no-webgl":
          return "This browser can't run it (WebGL is off or missing), so the plain background is shown."
        case "software":
          return "This browser draws graphics on the CPU (hardware acceleration is off), which is too slow for the city, so the plain background is shown."
        case "slow":
          return "This device couldn't keep up, so the plain background is shown in this tab. Open Cyphor in a new tab to try the city again."
        case "lost":
          return "The graphics driver dropped the scene. Reload the page to bring the city back."
        case "light-theme":
          return "The city is a night scene and shows in the dark theme. Switch to dark to see it."
        default:
          return "The city couldn't start, so the plain background is shown."
      }
    default:
      return ""
  }
}
