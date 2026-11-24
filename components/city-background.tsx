"use client"

import { useEffect, useRef, useState } from "react"
import { useDark } from "@/lib/hooks/use-dark"
import { useCoarsePointer, useMedia } from "@/lib/hooks/use-media"
import { usePaletteId } from "@/lib/palette"
import { paletteById } from "@/lib/scene/palettes"
import { setCityStatus, type CityQuality, type CityReason } from "@/lib/scene/status"
import { useStore } from "@/lib/store"
import type { City, Motion } from "@/lib/scene/city/engine"

/**
 * The live night city behind the chat.
 *
 * The three.js engine is a separate chunk (lib/scene/city/engine.ts): nothing of it loads unless this is switched on,
 * and it starts only once the app has painted, so the first screen never waits for it. It draws into a canvas this
 * component creates itself, because a WebGL surface cannot be reused once it is disposed.
 *
 * If it cannot run (no WebGL, a lost graphics context, or a machine too slow even at the lowest quality) the page goes
 * back to the plain background and Settings says why (lib/scene/status.ts).
 */

const TIER_KEY = "cyphor:city-tier"
const TIER_TTL = 3 * 24 * 3600 * 1000
const GAVE_UP_KEY = "cyphor:city-gave-up"

function isQuality(v: unknown): v is CityQuality {
  return v === "low" || v === "medium" || v === "high"
}

/** The tier the last session settled on, so a slow machine does not start high and visibly drop every time. */
function savedTier(): CityQuality | null {
  try {
    const raw = localStorage.getItem(TIER_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { q?: unknown; at?: unknown }
    if (isQuality(v.q) && typeof v.at === "number" && Date.now() - v.at < TIER_TTL) return v.q
  } catch {
    /* unreadable */
  }
  return null
}

function saveTier(q: CityQuality) {
  try {
    localStorage.setItem(TIER_KEY, JSON.stringify({ q, at: Date.now() }))
  } catch {
    /* storage can be blocked */
  }
}

function gaveUpThisSession(): boolean {
  try {
    return sessionStorage.getItem(GAVE_UP_KEY) === "1"
  } catch {
    return false
  }
}

function startTier(coarse: boolean): CityQuality {
  const saved = savedTier()
  if (saved) return saved
  const base: CityQuality = coarse ? "medium" : "high"
  const cores = navigator.hardwareConcurrency
  if (cores && cores <= 2) return base === "high" ? "medium" : "low"
  return base
}

interface Probe {
  /** Three.js needs WebGL 2. */
  ok: boolean
  /** The "graphics card" is the CPU (SwiftShader, llvmpipe, Windows' basic driver). It cannot draw this scene at a usable rate, so the city is not even tried. */
  software: boolean
}

/** Asked with a throwaway canvas, and the context is released again straight away. */
function probeWebgl(): Probe {
  try {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2")
    if (!gl) return { ok: false, software: false }
    let software = false
    const info = gl.getExtension("WEBGL_debug_renderer_info")
    if (info) software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)))
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return { ok: true, software }
  } catch {
    return { ok: false, software: false }
  }
}

const PIN_KEY = "cyphor:city-pin"

/**
 * `?city=low|medium|high` fixes the quality for this tab and turns the quality governor off. It is for tests and
 * screenshots on a machine with no graphics card, where the governor would (rightly) switch the city off again.
 */
function pinnedTier(): CityQuality | null {
  try {
    const asked = new URLSearchParams(location.search).get("city")
    if (isQuality(asked)) sessionStorage.setItem(PIN_KEY, asked)
    const v = sessionStorage.getItem(PIN_KEY)
    return isQuality(v) ? v : null
  } catch {
    return null
  }
}

function later(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 1500 })
    return () => w.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, 250)
  return () => window.clearTimeout(id)
}

function applyMotion(city: City, m: Motion) {
  city.setMotion(m)
  if (m === "still") {
    city.stop()
    city.advance(0)
    city.renderFrame()
  } else if (!document.hidden) {
    city.start()
  }
}

type Phase = "loading" | "ready" | "failed"

function CityScene({ motion, coarse }: { motion: Motion; coarse: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const cityRef = useRef<City | null>(null)
  const paletteId = usePaletteId()
  const [probe] = useState(() => ({ ...probeWebgl(), pin: pinnedTier() }))
  const supported = probe.ok && (probe.pin !== null || (!probe.software && !gaveUpThisSession()))
  const [phase, setPhase] = useState<Phase>(supported ? "loading" : "failed")

  // The city is started once, with whatever is current at that moment. Later changes arrive through their own effects.
  const latest = useRef({ motion, paletteId, coarse })
  useEffect(() => {
    latest.current = { motion, paletteId, coarse }
  })

  useEffect(() => {
    if (!supported) setCityStatus({ state: "unavailable", reason: !probe.ok ? "no-webgl" : probe.software ? "software" : "slow" })
    else setCityStatus({ state: "loading" })
    return () => setCityStatus({ state: "off" })
  }, [supported, probe])

  // The page's own attribute: the CSS makes the main area see-through only while the city is showing or about to.
  const failed = phase === "failed"
  useEffect(() => {
    if (failed) return
    const root = document.documentElement
    root.dataset.city = "on"
    return () => {
      delete root.dataset.city
    }
  }, [failed])

  useEffect(() => {
    if (!supported) return
    const el = host.current
    if (!el) return
    let dead = false
    let city: City | null = null
    let canvas: HTMLCanvasElement | null = null
    let observer: ResizeObserver | null = null
    let resizeTimer = 0
    let cancelStart = () => {}

    const live = () => latest.current.motion !== "still"
    const fit = () => {
      if (!city) return
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) city.resize(w, h, window.devicePixelRatio || 1)
    }
    const onVisibility = () => {
      if (!city) return
      if (document.hidden) city.stop()
      else if (live()) city.start()
    }
    const onLost = (e: Event) => {
      e.preventDefault()
      fail("lost")
    }
    const teardown = () => {
      cancelStart()
      observer?.disconnect()
      window.clearTimeout(resizeTimer)
      document.removeEventListener("visibilitychange", onVisibility)
      canvas?.removeEventListener("webglcontextlost", onLost)
      city?.dispose()
      city = null
      cityRef.current = null
      canvas?.remove()
      canvas = null
    }
    function fail(reason: CityReason) {
      if (dead) return
      if (reason === "slow") {
        try {
          sessionStorage.setItem(GAVE_UP_KEY, "1")
        } catch {
          /* ignore */
        }
      }
      teardown()
      setCityStatus({ state: "unavailable", reason })
      setPhase("failed")
    }

    const begin = async () => {
      try {
        const { createCity } = await import("@/lib/scene/city/engine")
        if (dead) return
        const c = document.createElement("canvas")
        c.className = "city-canvas"
        c.setAttribute("aria-hidden", "true")
        c.addEventListener("webglcontextlost", onLost)
        el.appendChild(c)
        canvas = c
        const made = await createCity(c, {
          palette: paletteById(latest.current.paletteId),
          quality: probe.pin ?? startTier(latest.current.coarse),
          pinned: probe.pin !== null,
          motion: latest.current.motion,
          onQuality: (q) => {
            saveTier(q)
            if (!dead) setCityStatus({ state: "ready", quality: q, still: !live() })
          },
          onGiveUp: () => fail("slow"),
        })
        if (dead) {
          made.dispose()
          c.remove()
          return
        }
        city = made
        cityRef.current = made
        fit()
        made.renderFrame()
        applyMotion(made, latest.current.motion)
        observer = new ResizeObserver(() => {
          window.clearTimeout(resizeTimer)
          resizeTimer = window.setTimeout(fit, 120)
        })
        observer.observe(el)
        document.addEventListener("visibilitychange", onVisibility)
        requestAnimationFrame(() => {
          if (dead || !city) return
          el.dataset.quality = city.stats.quality
          setCityStatus({ state: "ready", quality: city.stats.quality, still: !live() })
          setPhase("ready")
        })
      } catch {
        fail("error")
      }
    }
    cancelStart = later(() => void begin())

    return () => {
      dead = true
      teardown()
    }
  }, [supported, probe])

  useEffect(() => {
    const c = cityRef.current
    if (!c) return
    applyMotion(c, motion)
    setCityStatus({ state: "ready", quality: c.stats.quality, still: motion === "still" })
  }, [motion])

  useEffect(() => {
    cityRef.current?.setPalette(paletteById(paletteId))
  }, [paletteId])

  if (failed) return null
  return <div ref={host} className="city" data-state={phase} aria-hidden="true" />
}

/**
 * Mounted once, in the app shell. Does nothing unless the city is switched on and the theme is dark: the city is a
 * night scene, and in Daylight the plain background is shown instead.
 */
export function CityBackground() {
  const scene = useStore((s) => s.settings.scene)
  const effects = useStore((s) => s.settings.effects)
  const dark = useDark()
  const reduce = useMedia("(prefers-reduced-motion: reduce)")
  const coarse = useCoarsePointer()
  const wanted = scene === "city" && dark

  useEffect(() => {
    if (scene === "city" && !dark) {
      setCityStatus({ state: "unavailable", reason: "light-theme" })
      return () => setCityStatus({ state: "off" })
    }
  }, [scene, dark])

  if (!wanted) return null
  const motion: Motion = reduce || effects === "off" ? "still" : effects === "subtle" ? "subtle" : "full"
  return <CityScene motion={motion} coarse={coarse} />
}
