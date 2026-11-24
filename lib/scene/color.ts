/** Small colour helpers for the palette tooling (contrast checks, tints). Hex in, hex out. */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

/** `t` of the way from `a` to `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

function channel(v: number) {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Darkens `hex` toward black until it reaches `ratio` against `bg` (for text and icons on the light theme). */
export function darkenTo(hex: string, bg: string, ratio: number): string {
  let out = hex
  for (let i = 0; i <= 100 && contrast(out, bg) < ratio; i++) out = mix(hex, "#000000", i / 100)
  return out
}

/** Lightens `hex` toward white until it reaches `ratio` against `bg` (for text and icons on the dark theme). */
export function lightenTo(hex: string, bg: string, ratio: number): string {
  let out = hex
  for (let i = 0; i <= 100 && contrast(out, bg) < ratio; i++) out = mix(hex, "#ffffff", i / 100)
  return out
}

/** `rgb(r g b / a)`, the form the stylesheet uses for washes and glows. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}
