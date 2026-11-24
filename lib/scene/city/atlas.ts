import { rng } from "./rng"

/**
 * The pictures for the neon signs, drawn once into a canvas when the city starts. One atlas holds every sign:
 *
 *   rows 0 to 5   48 wide signs, 256 x 128 each
 *   bottom strip  16 tall signs, 128 x 256 each (letters stacked, the way they hang over a street)
 *
 * Each pixel keeps three things in its channels, and the sign shader gives them their colour:
 *   red    the bright tube
 *   green  the glow around it
 *   blue   the dark plate behind it
 *
 * The words are invented shop names and plain signage, never real brands. If the device has a Japanese font, some
 * signs use it; if not, they stay in Latin letters instead of showing empty boxes.
 */

export const ATLAS_W = 2048
export const ATLAS_H = 1024
const WIDE = { w: 256, h: 128, cols: 8, rows: 6 }
const TALL = { w: 128, h: 256, y: 768 }

const LATIN = [
  "NOODLE", "RAMEN", "HOTEL", "24H", "OPEN", "ARCADE", "CLINIC", "NET CAFE", "TAXI", "PHARMA", "DATA", "SYNC",
  "VOLT", "NEXA", "KIOSK", "BAR", "MOTEL", "SUSHI", "TATTOO", "REPAIR", "CYPHOR", "ROUTER", "CHROME", "SOUND",
  "LIVE", "PIZZA", "CAFE", "CREDIT", "PAWN", "NEON", "NIGHT", "BOOTH", "MODS", "PLAY", "ZONE 9", "DECK",
  "GLITCH", "OXYGEN", "KARAOKE", "TICKETS", "NOODLE BAR", "CAPSULE", "ALL NIGHT", "VAPOR", "SYNTH", "FIX IT", "BYTE", "SAKE",
]
const JAPANESE = ["電脳", "夜市", "ラーメン", "酒場", "二十四時間", "未来", "居酒屋", "電気街", "薬局", "旅館", "喫茶", "カラオケ"]
const TALL_LATIN = ["HOTEL", "BAR", "CLUB", "SUSHI", "SHOP", "24H", "NOODLE", "CAFE", "DATA", "LIVE", "ARCADE", "TAXI", "MOTEL", "OPEN", "NEON", "RAMEN"]
const TALL_JAPANESE = ["居酒屋", "電脳街", "夜市", "未来", "酒場", "旅館"]

const FAMILY = '"Oxanium", "Schibsted Grotesk", system-ui, sans-serif'
const JP_FAMILY = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Noto Sans CJK JP", "Meiryo", sans-serif'

type Ctx = CanvasRenderingContext2D

/** Two Japanese characters that should look different. If they come out identical, the font is missing and both are empty boxes. */
export function hasJapaneseFont(): boolean {
  try {
    const draw = (ch: string) => {
      const c = document.createElement("canvas")
      c.width = c.height = 48
      const x = c.getContext("2d")
      if (!x) return ""
      x.font = `36px ${JP_FAMILY}`
      x.fillText(ch, 4, 38)
      return c.toDataURL()
    }
    const a = draw("電")
    const b = draw("脳")
    const blank = draw(" ")
    return a !== "" && a !== b && a !== blank
  } catch {
    return false
  }
}

function glowText(ctx: Ctx, text: string, cx: number, cy: number, maxW: number, size: number, family: string) {
  ctx.font = `700 ${size}px ${family}`
  const w = ctx.measureText(text).width
  const s = w > maxW ? (size * maxW) / w : size
  ctx.font = `700 ${s}px ${family}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.globalCompositeOperation = "lighter"
  ctx.shadowColor = "rgb(0,255,0)"
  ctx.shadowBlur = s * 0.3
  ctx.fillStyle = "rgb(0,170,0)"
  ctx.fillText(text, cx, cy)
  ctx.fillText(text, cx, cy)
  ctx.shadowColor = "rgb(255,0,0)"
  ctx.shadowBlur = s * 0.08
  ctx.fillStyle = "rgb(255,0,0)"
  ctx.fillText(text, cx, cy)
  ctx.shadowBlur = 0
  ctx.globalCompositeOperation = "source-over"
}

function tube(ctx: Ctx, draw: () => void) {
  ctx.globalCompositeOperation = "lighter"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.shadowColor = "rgb(0,255,0)"
  ctx.shadowBlur = 14
  ctx.strokeStyle = "rgb(0,160,0)"
  ctx.lineWidth = 9
  draw()
  ctx.shadowColor = "rgb(255,0,0)"
  ctx.shadowBlur = 3
  ctx.strokeStyle = "rgb(255,0,0)"
  ctx.lineWidth = 4
  draw()
  ctx.shadowBlur = 0
  ctx.globalCompositeOperation = "source-over"
}

function plate(ctx: Ctx, x: number, y: number, w: number, h: number, frame: boolean) {
  ctx.fillStyle = "rgb(0,0,150)"
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6)
  if (frame) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    tube(ctx, () => {
      ctx.beginPath()
      ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 10)
      ctx.stroke()
    })
    ctx.restore()
  }
}

/** A few simple shapes to mix in with the words. */
const SYMBOLS: ((ctx: Ctx, cx: number, cy: number, r: number) => void)[] = [
  (ctx, cx, cy, r) => tube(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, 7); ctx.stroke() }),
  (ctx, cx, cy, r) => tube(ctx, () => { ctx.beginPath(); ctx.moveTo(cx - r, cy + r * 0.2); ctx.lineTo(cx + r * 0.4, cy + r * 0.2); ctx.lineTo(cx + r * 0.4, cy - r * 0.45); ctx.lineTo(cx + r, cy + r * 0.2 - 0.001); ctx.lineTo(cx + r * 0.4, cy + r * 0.85); ctx.lineTo(cx + r * 0.4, cy + r * 0.2); ctx.stroke() }),
  (ctx, cx, cy, r) => tube(ctx, () => { ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.95, cy + r * 0.7); ctx.lineTo(cx - r * 0.95, cy + r * 0.7); ctx.closePath(); ctx.stroke() }),
  (ctx, cx, cy, r) => tube(ctx, () => { ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r); ctx.lineTo(cx + r * 0.5, cy - r * 0.1); ctx.lineTo(cx - r * 0.1, cy - r * 0.05); ctx.lineTo(cx + r * 0.3, cy + r); ctx.lineTo(cx - r * 0.5, cy + r * 0.1); ctx.lineTo(cx + r * 0.1, cy + r * 0.05); ctx.closePath(); ctx.stroke() }),
  (ctx, cx, cy, r) => tube(ctx, () => { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.4, cy - r * 0.8); ctx.lineTo(cx + i * r * 0.4, cy + r * 0.8); ctx.stroke() } }),
  (ctx, cx, cy, r) => tube(ctx, () => { ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke() }),
]

export function drawAtlas(canvas: HTMLCanvasElement, japanese: boolean): void {
  canvas.width = ATLAS_W
  canvas.height = ATLAS_H
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H)
  const r = rng(20771)

  const words = [...LATIN]
  if (japanese) for (let i = 0; i < JAPANESE.length; i++) words[i * 4 + 1] = JAPANESE[i]

  for (let i = 0; i < WIDE.cols * WIDE.rows; i++) {
    const x = (i % WIDE.cols) * WIDE.w
    const y = Math.floor(i / WIDE.cols) * WIDE.h
    plate(ctx, x, y, WIDE.w, WIDE.h, r.chance(0.55))
    const word = words[i % words.length]
    const jp = /[　-鿿]/.test(word)
    if (r.chance(0.22)) {
      // A symbol beside a short word.
      const sx = x + 62
      SYMBOLS[r.int(0, SYMBOLS.length - 1)](ctx, sx, y + WIDE.h / 2, 30)
      glowText(ctx, word, x + 158, y + WIDE.h / 2, 150, 54, jp ? JP_FAMILY : FAMILY)
    } else {
      glowText(ctx, word, x + WIDE.w / 2, y + WIDE.h / 2 + 2, WIDE.w - 44, 70, jp ? JP_FAMILY : FAMILY)
    }
  }

  const tall = [...TALL_LATIN]
  if (japanese) for (let i = 0; i < TALL_JAPANESE.length; i++) tall[i * 2] = TALL_JAPANESE[i]
  for (let i = 0; i < 16; i++) {
    const x = i * TALL.w
    plate(ctx, x, TALL.y, TALL.w, TALL.h, r.chance(0.6))
    const letters = Array.from(tall[i])
    const step = Math.min(58, (TALL.h - 40) / letters.length)
    const jp = /[　-鿿]/.test(tall[i])
    letters.forEach((ch, k) => glowText(ctx, ch, x + TALL.w / 2, TALL.y + TALL.h / 2 + (k - (letters.length - 1) / 2) * step, TALL.w - 40, Math.min(58, step * 1.05), jp ? JP_FAMILY : FAMILY))
  }
}
