/**
 * Colour themes. Cyberpunk has a handful of colours that belong to it, and every one of them is used somewhere:
 *
 *   yellow   the main action, the logo, the hazard stripe
 *   cyan     focus, live state, links, network information
 *   red      danger and warnings
 *   magenta  hot pink neon: keywords in code, signs in the city
 *   violet   attributes in code, billboards and haze
 *   blue     tags in code, electric signs, the cold side of the sky
 *   orange   numbers in code, sodium lamps, the warm side of the sky
 *   green    strings in code, "go" states, data streams
 *
 * A theme picks which of them leads (the primary colour, the signal colour and the danger colour) and tints the
 * ink behind them; the other colours stay available to every theme. The city behind the chat reads the same table.
 *
 * The stylesheet for these themes (app/palettes.css) is generated from this file by `npm run build:palettes`, and a
 * test fails if the two drift apart.
 */

export const CP_COLORS = {
  yellow: "#fcee09",
  cyan: "#00f0ff",
  red: "#ff003c",
  magenta: "#ff2a6d",
  violet: "#9d4dff",
  blue: "#2f6bff",
  orange: "#ff7a00",
  green: "#39ff88",
} as const

export type CpColor = keyof typeof CP_COLORS
export const CP_COLOR_NAMES = Object.keys(CP_COLORS) as CpColor[]

export const PALETTE_IDS = ["night-city", "redline", "neon-rain", "afterglow", "toxic", "voltage", "solar", "violet-dusk"] as const
export type PaletteId = (typeof PALETTE_IDS)[number]

/** What the setting stores: one theme, or "rotate" for a different one on every page load. */
export type PalettePref = PaletteId | "rotate"

export interface CityColors {
  /** Six lights: windows, signs and billboards draw from these. */
  lights: [string, string, string, string, string, string]
  /** The sky from the top down to the horizon. */
  sky: [string, string, string]
  fog: string
  /** Car headlights and taillights. */
  head: string
  tail: string
}

export interface Palette {
  id: PaletteId
  name: string
  note: string
  /** The main action colour, and the fill of the logo mark. */
  primary: string
  /** Focus rings, live state, links. */
  signal: string
  /** Danger. */
  heat: string
  city: CityColors
}

const c = CP_COLORS

export const PALETTES: Palette[] = [
  {
    id: "night-city",
    name: "Night City",
    note: "Acid yellow on black, cyan signal, red for danger.",
    primary: c.yellow,
    signal: c.cyan,
    heat: c.red,
    city: { lights: [c.yellow, c.cyan, c.magenta, c.orange, c.violet, c.green], sky: ["#03040f", "#15093a", "#ff3c6e"], fog: "#1f0f3a", head: "#fff2c8", tail: c.red },
  },
  {
    id: "redline",
    name: "Redline",
    note: "Corporate red and black, with yellow as the signal.",
    primary: c.red,
    signal: c.yellow,
    heat: c.orange,
    city: { lights: [c.red, c.orange, c.yellow, "#ffe9e0", c.magenta, c.cyan], sky: ["#0a0305", "#2a0510", "#ff2a1a"], fog: "#2a0a10", head: "#ffe9d0", tail: c.red },
  },
  {
    id: "neon-rain",
    name: "Neon Rain",
    note: "Cyan lead, magenta signal, a blue wet night.",
    primary: c.cyan,
    signal: c.magenta,
    heat: c.red,
    city: { lights: [c.cyan, c.magenta, c.blue, c.violet, c.green, "#e8f6ff"], sky: ["#020816", "#08224a", "#1f7bff"], fog: "#07203a", head: "#e8f6ff", tail: c.magenta },
  },
  {
    id: "afterglow",
    name: "Afterglow",
    note: "Hot pink and violet, the warm end of the evening.",
    primary: c.magenta,
    signal: c.violet,
    heat: c.orange,
    city: { lights: [c.magenta, c.violet, c.orange, c.yellow, c.cyan, c.red], sky: ["#0b0418", "#3a0f5a", "#ff6ab0"], fog: "#2a0f3a", head: "#ffe3f0", tail: c.red },
  },
  {
    id: "toxic",
    name: "Toxic",
    note: "Acid green data glow with a yellow signal.",
    primary: c.green,
    signal: c.yellow,
    heat: c.magenta,
    city: { lights: [c.green, c.yellow, c.cyan, c.magenta, c.orange, c.violet], sky: ["#010a06", "#06301c", "#39d98a"], fog: "#06231a", head: "#eaffd8", tail: c.magenta },
  },
  {
    id: "voltage",
    name: "Voltage",
    note: "Electric blue with a cyan signal.",
    primary: "#4d7cff",
    signal: c.cyan,
    heat: c.magenta,
    city: { lights: ["#4d7cff", c.cyan, c.violet, c.magenta, c.yellow, "#ffffff"], sky: ["#020618", "#0a1a60", "#4d7cff"], fog: "#0a1840", head: "#e8f0ff", tail: c.magenta },
  },
  {
    id: "solar",
    name: "Solar Flare",
    note: "Sodium orange and yellow, hot streets at dusk.",
    primary: c.orange,
    signal: c.yellow,
    heat: c.red,
    city: { lights: [c.orange, c.yellow, c.red, c.magenta, c.cyan, c.violet], sky: ["#0c0502", "#3a1404", "#ff8a1a"], fog: "#3a1a08", head: "#fff0c0", tail: c.red },
  },
  {
    id: "violet-dusk",
    name: "Violet Dusk",
    note: "Violet lead with a pink signal.",
    primary: "#a855ff",
    signal: c.magenta,
    heat: c.orange,
    city: { lights: ["#a855ff", c.magenta, c.cyan, c.orange, c.yellow, c.blue], sky: ["#07031a", "#2a0e6a", "#b36bff"], fog: "#20104a", head: "#f1e6ff", tail: c.red },
  },
]

export const DEFAULT_PALETTE: PaletteId = "night-city"

export function isPaletteId(v: unknown): v is PaletteId {
  return typeof v === "string" && (PALETTE_IDS as readonly string[]).includes(v)
}

export function isPalettePref(v: unknown): v is PalettePref {
  return v === "rotate" || isPaletteId(v)
}

export function paletteById(id: unknown): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/**
 * Chooses the theme for this page load. A fixed theme is itself; "rotate" picks a random one that is not the one
 * shown last time, so a refresh always looks different.
 */
export function pickPalette(pref: unknown, last: unknown = null, random: () => number = Math.random): PaletteId {
  if (isPaletteId(pref)) return pref
  if (pref !== "rotate") return DEFAULT_PALETTE
  const pool = PALETTE_IDS.filter((id) => id !== last)
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}
