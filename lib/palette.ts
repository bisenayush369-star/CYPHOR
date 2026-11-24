import { useSyncExternalStore } from "react"
import { PALETTE_LAST_KEY } from "./no-flash"
import { DEFAULT_PALETTE, isPaletteId, paletteById, pickPalette, type Palette, type PaletteId, type PalettePref } from "./scene/palettes"

/** Fired on `window` whenever the colour theme on screen changes. The city listens, so it recolours without rebuilding. */
export const PALETTE_EVENT = "cyphor:palette"

/** The theme on screen right now. The first-paint script (lib/no-flash.ts) sets it on <html> before anything draws. */
export function activePaletteId(): PaletteId {
  if (typeof document === "undefined") return DEFAULT_PALETTE
  const v = document.documentElement.dataset.palette
  return isPaletteId(v) ? v : DEFAULT_PALETTE
}

export function activePalette(): Palette {
  return paletteById(activePaletteId())
}

/** Shows a theme right now and remembers it as "the one shown last", which "rotate" avoids next time. */
export function showPalette(id: PaletteId) {
  if (typeof document === "undefined") return
  document.documentElement.dataset.palette = id
  try {
    localStorage.setItem(PALETTE_LAST_KEY, id)
  } catch {
    /* storage can be blocked */
  }
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT, { detail: id }))
}

/**
 * Applies the saved preference. A fixed theme is shown as it is. "rotate" picks a different theme at once when
 * you have just chosen it (`reroll`), and otherwise leaves the one this page load already picked.
 */
export function applyPalettePref(pref: PalettePref, reroll: boolean) {
  if (isPaletteId(pref)) {
    if (activePaletteId() !== pref) showPalette(pref)
    return
  }
  if (reroll) showPalette(pickPalette("rotate", activePaletteId()))
}

function subscribe(cb: () => void) {
  window.addEventListener(PALETTE_EVENT, cb)
  return () => window.removeEventListener(PALETTE_EVENT, cb)
}

/** The theme on screen, as React state. Always the default on the server and during hydration. */
export function usePaletteId(): PaletteId {
  return useSyncExternalStore(subscribe, activePaletteId, () => DEFAULT_PALETTE)
}
