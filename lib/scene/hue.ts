import { PROVIDERS } from "../router/provider-defs"
import type { CpColor } from "./palettes"

/**
 * Providers are told apart by colour as well as by name, so a list of them reads at a glance.
 *
 * Red and yellow are left out on purpose. In the router strip they already mean "failing" and "resting", and a colour
 * that stands for two things ends up standing for neither. Magenta is left out with them, because in this palette it sits
 * right next to red and a provider tile would look like an error. The other five carry identity, in the order the router
 * lists its providers, so a new provider takes the next colour without anything being added here.
 */
export const PROVIDER_HUES = ["cyan", "green", "orange", "violet", "blue"] as const satisfies readonly CpColor[]
export type ProviderHue = (typeof PROVIDER_HUES)[number]

/** The same provider is always the same colour: in the strip, the picker, the library and the route trace. */
export function hueOf(id: string): ProviderHue {
  const at = PROVIDERS.findIndex((p) => p.id === id)
  if (at >= 0) return PROVIDER_HUES[at % PROVIDER_HUES.length]
  // A provider the router has never heard of (an imported chat): a stable colour from its name.
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PROVIDER_HUES[h % PROVIDER_HUES.length]
}

/** The colour as a CSS value. It follows the theme: each palette and each colour scheme sets its own --c-* values. */
export function hueVar(hue: ProviderHue): string {
  return `var(--c-${hue})`
}

/** Whole class names, because Tailwind finds classes by reading the source, not by running it. */
export const HUE_BG: Record<ProviderHue, string> = {
  cyan: "bg-cp-cyan",
  green: "bg-cp-green",
  orange: "bg-cp-orange",
  violet: "bg-cp-violet",
  blue: "bg-cp-blue",
}
