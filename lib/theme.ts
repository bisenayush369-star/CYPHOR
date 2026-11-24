import type { ChatFont, EffectsLevel, ThemePref } from "./types"

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/** Writes the theme to <html> (class for Tailwind, data attribute for other consumers). */
export function applyThemeDom(pref: ThemePref) {
  const t = resolveTheme(pref)
  const root = document.documentElement
  root.classList.toggle("dark", t === "dark")
  root.dataset.theme = t
  root.style.colorScheme = t
  const meta = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  meta.forEach((m) => m.setAttribute("content", t === "dark" ? "#090b12" : "#eceff5"))
}

export function applyAppearance(font: ChatFont, effects: EffectsLevel) {
  const root = document.documentElement
  root.dataset.font = font
  root.dataset.effects = effects
}

function motionAllowed() {
  return (
    document.documentElement.dataset.effects !== "off" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

let sweeping: ThemePref | null = null

/**
 * Looks outward from a point in the viewport and finds the shortest stretch of directions (degrees clockwise from up)
 * that contains at least 96% of the screen area. The dial sweep spends its time there.
 */
export function bulkArc(px: number, py: number, w: number, h: number) {
  const N = 180
  const weight: number[] = []
  let total = 0
  for (let i = 0; i < N; i++) {
    const a = ((i * 360) / N) * (Math.PI / 180)
    const dx = Math.sin(a)
    const dy = -Math.cos(a)
    const tx = dx > 0 ? (w - px) / dx : dx < 0 ? -px / dx : Infinity
    const ty = dy > 0 ? (h - py) / dy : dy < 0 ? -py / dy : Infinity
    const t = Math.max(0, Math.min(tx, ty))
    weight.push(t * t) // area of a thin wedge grows with the square of its length
    total += t * t
  }
  let best = { start: 0, len: N }
  for (let s = 0; s < N; s++) {
    let sum = 0
    for (let len = 1; len <= N; len++) {
      sum += weight[(s + len - 1) % N]
      if (sum >= 0.96 * total) {
        if (len < best.len) best = { start: s, len }
        break
      }
    }
  }
  return { from: (best.start * 360) / N, span: (best.len * 360) / N }
}

/**
 * Switches theme with a dial sweep that starts at the pointer (View Transitions API).
 * Falls back to an instant switch where the API or motion is unavailable.
 */
export function transitionTheme(pref: ThemePref, origin: { x: number; y: number } | null, commit: () => void) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<unknown> }
  }
  if (!doc.startViewTransition || !motionAllowed()) {
    applyThemeDom(pref)
    commit()
    return
  }
  // A second call for the same theme while the sweep is running (a click that also fires a change event) is ignored,
  // so it can't restart the sweep from somewhere else.
  if (sweeping === pref) return
  sweeping = pref
  const root = document.documentElement
  const w = window.innerWidth
  const h = window.innerHeight
  const px = origin ? origin.x : w / 2
  const py = origin ? origin.y : h / 2
  const arc = bulkArc(px, py, w, h)
  root.style.setProperty("--sweep-x", `${(px / w) * 100}%`)
  root.style.setProperty("--sweep-y", `${(py / h) * 100}%`)
  root.style.setProperty("--sweep-from", `${arc.from}deg`)
  root.style.setProperty("--sweep-bulk", `${Math.min(358, arc.span + 2)}deg`)
  const t = doc.startViewTransition(() => {
    applyThemeDom(pref)
    commit()
  })
  const done = () => {
    sweeping = null
  }
  t.finished.then(done, done)
}
