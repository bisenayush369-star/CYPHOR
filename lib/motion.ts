export type Level = "off" | "subtle" | "full"

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** The effective effects level: the setting, forced to "off" when the OS asks for reduced motion. */
export function effectsLevel(): Level {
  if (typeof document === "undefined" || reducedMotion()) return "off"
  const v = document.documentElement.dataset.effects
  return v === "off" || v === "subtle" ? v : "full"
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

type Gsap = typeof import("gsap").gsap
let gsapInstance: Gsap | null = null
let gsapLoading: Promise<Gsap> | null = null

/** Loads GSAP and its text plugin the first time they are wanted, so they stay out of the first download. */
export function loadMotion(): Promise<Gsap> {
  gsapLoading ??= Promise.all([import("gsap"), import("gsap/ScrambleTextPlugin")]).then(([g, s]) => {
    g.gsap.registerPlugin(s.ScrambleTextPlugin)
    gsapInstance = g.gsap
    return g.gsap
  })
  return gsapLoading
}

/**
 * Resolves an element's text from scrambled capitals into `text`. Instant when effects are off,
 * and instant the one time GSAP isn't loaded yet (it is fetched in the background after first paint).
 */
export function decode(el: HTMLElement, text: string, duration = 0.9) {
  if (effectsLevel() === "off" || !gsapInstance) {
    el.textContent = text
    if (!gsapInstance) void loadMotion()
    return
  }
  const gsap = gsapInstance
  gsap.killTweensOf(el)
  gsap.to(el, {
    duration,
    ease: "none",
    scrambleText: { text, chars: GLYPHS, speed: 0.7, revealDelay: 0.08 },
    onComplete: () => {
      el.textContent = text
    },
  })
}

export const NOTCHES = 26
export const NOTCH_DEG = 360 / NOTCHES
