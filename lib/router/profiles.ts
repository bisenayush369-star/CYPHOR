/**
 * Works out what a model is good at from its id, so new models are understood the day a provider adds them.
 *
 * Nobody publishes one comparable score for every model, so these are estimates: a table of model
 * families with scores from 0 to 10, plus rules for size and for words like "mini", "coder" or "thinking".
 * They only have to be good enough to put the right model first. Anything the provider tells us
 * (context length, vision, price) beats the guess. Pure functions, no I/O.
 */
import type { ModelProfile, ProviderId, Scores, Tier } from "./types"

/** What a provider's model list says about one model. Every field but `id` is optional. */
export interface ListedModel {
  id: string
  name?: string
  context?: number | null
  vision?: boolean
  thinking?: boolean
  free?: boolean
}

interface Family {
  re: RegExp
  /** reasoning, coding, writing, speed */
  s: [number, number, number, number]
  ctx?: number
  vision?: boolean
  think?: boolean
}

/**
 * First match wins, so the specific rows come before the general ones.
 * The text matched is the id in lower case, without the folder part ("meta/", "@cf/openai/") or ":free".
 */
const FAMILIES: Family[] = [
  // Anthropic
  { re: /claude.*(fable|mythos)/, s: [10, 10, 9.6, 3], ctx: 1_000_000, vision: true, think: true },
  { re: /claude.*opus/, s: [9.6, 9.6, 9.6, 3.5], ctx: 200_000, vision: true, think: true },
  { re: /claude.*sonnet/, s: [9.2, 9.4, 9.3, 6.5], ctx: 200_000, vision: true, think: true },
  { re: /claude.*haiku/, s: [7.8, 7.9, 7.9, 9], ctx: 200_000, vision: true },
  { re: /claude/, s: [8.6, 8.6, 8.8, 6], ctx: 200_000, vision: true },

  // Google
  { re: /gemini.*flash.*lite|gemini.*lite/, s: [6.9, 6.9, 7.2, 9.6], ctx: 1_000_000, vision: true },
  { re: /gemini.*flash/, s: [8.2, 8.2, 8.3, 8.8], ctx: 1_000_000, vision: true, think: true },
  { re: /gemini.*pro/, s: [9.3, 9.1, 9, 4.5], ctx: 1_000_000, vision: true, think: true },
  { re: /gemini/, s: [8, 8, 8.2, 7], ctx: 1_000_000, vision: true },
  { re: /gemma.*(27b|31b|32b)/, s: [7.4, 7.2, 7.6, 7.8], ctx: 128_000, vision: true },
  { re: /gemma.*(12b|9b)/, s: [6.8, 6.6, 7.1, 8.6], ctx: 128_000 },

  // OpenAI (the open-weight gpt-oss models are on Groq, Cloudflare, NVIDIA and OpenRouter)
  { re: /gpt-?oss.*120b/, s: [8.7, 8.5, 7.8, 7.5], ctx: 128_000, think: true },
  { re: /gpt-?oss.*20b/, s: [7.7, 7.6, 7.2, 9], ctx: 128_000, think: true },
  { re: /gpt-?5.*nano/, s: [7.2, 7.2, 7.4, 9.2], ctx: 400_000, vision: true },
  { re: /gpt-?5.*mini/, s: [8.4, 8.4, 8.2, 7.6], ctx: 400_000, vision: true, think: true },
  { re: /gpt-?5/, s: [9.4, 9.4, 9.2, 4.5], ctx: 400_000, vision: true, think: true },
  { re: /gpt-?4\.1.*(mini|nano)/, s: [7.6, 7.8, 7.8, 9], ctx: 1_000_000, vision: true },
  { re: /gpt-?4\.1/, s: [8.4, 8.6, 8.5, 6.5], ctx: 1_000_000, vision: true },
  { re: /gpt-?4o.*mini/, s: [7.2, 7.2, 7.6, 9], ctx: 128_000, vision: true },
  { re: /gpt-?4o/, s: [8, 8, 8.4, 7], ctx: 128_000, vision: true },
  { re: /(^|[^a-z])o[134](-|$)/, s: [9.3, 9, 8.2, 3], ctx: 200_000, vision: true, think: true },

  // Distilled reasoning models carry the name of their base model, so they are matched first.
  { re: /r1.*distill|distill.*r1/, s: [8.4, 8, 7.3, 5.5], ctx: 128_000, think: true },
  { re: /distill/, s: [7.4, 7.2, 6.8, 7], ctx: 128_000, think: true },

  // Meta
  { re: /llama-?4.*maverick/, s: [8.2, 8.1, 8.4, 7.5], ctx: 1_000_000, vision: true },
  { re: /llama-?4.*scout/, s: [7.7, 7.5, 7.9, 8.6], ctx: 128_000, vision: true },
  { re: /llama.*405b/, s: [8.1, 7.9, 8.2, 4], ctx: 128_000 },
  { re: /llama.*(?<![\d.])(70|90)b(?![a-z\d])/, s: [7.8, 7.6, 8, 7.5], ctx: 128_000 },
  { re: /llama.*(?<![\d.])(1|3|8|11)b(?![a-z\d])/, s: [5.9, 5.8, 6.6, 9.6], ctx: 128_000 },

  // Mistral
  { re: /magistral.*small/, s: [8.3, 8, 7.8, 6.5], ctx: 128_000, think: true },
  { re: /magistral/, s: [9, 8.6, 8.2, 4.8], ctx: 128_000, think: true },
  { re: /devstral/, s: [7.8, 9.1, 6.8, 7.5], ctx: 128_000 },
  { re: /codestral/, s: [7.4, 9, 6.8, 8.6], ctx: 256_000 },
  { re: /pixtral.*large/, s: [8.2, 7.8, 8.2, 6], ctx: 128_000, vision: true },
  { re: /pixtral/, s: [6.8, 6.4, 7.2, 8.5], ctx: 128_000, vision: true },
  { re: /mistral.*large/, s: [8.8, 8.6, 8.8, 6], ctx: 128_000, vision: true },
  { re: /mistral.*medium/, s: [8.4, 8.3, 8.5, 6.8], ctx: 128_000, vision: true },
  { re: /mistral.*small/, s: [7.5, 7.3, 7.7, 8.6], ctx: 128_000, vision: true },
  { re: /ministral|mistral.*(nemo|7b|tiny)|open-mistral/, s: [6.2, 6, 6.8, 9.4], ctx: 128_000 },
  { re: /mixtral/, s: [7, 7, 7.4, 8], ctx: 64_000 },

  // Cohere
  { re: /command-a.*(plus|reasoning)/, s: [8.8, 8.4, 8.8, 6], ctx: 256_000, think: true },
  { re: /command-a.*vision/, s: [7.8, 7.4, 8.2, 6.8], ctx: 128_000, vision: true },
  { re: /command-a/, s: [7.8, 7.6, 8.3, 7.2], ctx: 256_000 },
  { re: /command-r7b/, s: [6, 5.8, 6.8, 9.4], ctx: 128_000 },
  { re: /command-r.*plus/, s: [7.2, 7, 8, 6.5], ctx: 128_000 },
  { re: /command-r/, s: [6.9, 6.6, 7.7, 8], ctx: 128_000 },

  // Z.AI
  { re: /glm-?5/, s: [9.1, 9.3, 8.7, 5.6], ctx: 200_000, think: true },
  { re: /glm-?4\.[5-9].*air/, s: [8, 8.2, 7.9, 8.2], ctx: 128_000, think: true },
  { re: /glm-?\d+(\.\d+)?v/, s: [7.9, 7.4, 7.8, 7], ctx: 64_000, vision: true },
  { re: /glm.*flash/, s: [6.9, 6.9, 7.2, 9.4], ctx: 128_000 },
  { re: /glm-?4\.[5-9]/, s: [8.8, 9, 8.5, 6.4], ctx: 200_000, think: true },
  { re: /glm/, s: [7.4, 7.2, 7.8, 7], ctx: 128_000 },

  // DeepSeek, Qwen, Moonshot and other open models
  { re: /deepseek.*(r1|reason)/, s: [9, 8.6, 7.9, 3.8], ctx: 128_000, think: true },
  { re: /deepseek.*coder/, s: [7.4, 8.8, 6.8, 7], ctx: 128_000 },
  { re: /deepseek/, s: [8.5, 8.6, 8.1, 6.4], ctx: 128_000 },
  { re: /kimi/, s: [9, 9.1, 8.7, 5.2], ctx: 256_000, think: true },
  { re: /qwen.*coder/, s: [7.8, 9.1, 6.8, 6], ctx: 128_000 },
  { re: /qwq/, s: [8.5, 8, 7.4, 4.5], ctx: 128_000, think: true },
  { re: /qwen.*(235b|max)/, s: [8.8, 8.7, 8.3, 5.8], ctx: 256_000, think: true },
  { re: /qwen.*(30b|32b|next)/, s: [8.1, 8.2, 7.8, 7.8], ctx: 128_000 },
  { re: /nemotron.*(ultra|253b|340b)/, s: [8.7, 8.2, 8, 4.5], ctx: 128_000, think: true },
  { re: /nemotron.*(super|49b)/, s: [8.2, 7.9, 7.8, 6.5], ctx: 128_000, think: true },
  { re: /nemotron.*(nano|8b|9b)/, s: [6.8, 6.6, 7, 9], ctx: 128_000 },
  { re: /phi-?4/, s: [7.2, 7.3, 6.8, 8], ctx: 16_000 },

  // AionLabs
  { re: /aion-?1.*mini/, s: [8, 7.8, 7.6, 7], ctx: 128_000, think: true },
  { re: /aion-?rp/, s: [6.8, 6.2, 8.8, 7], ctx: 32_000 },
  { re: /aion/, s: [8.6, 8.3, 8.4, 5], ctx: 128_000, think: true },
]

/** Things that are not for chatting: embeddings, speech, images, safety filters... */
const NOT_CHAT_PARTS = [
  "embed",
  "rerank",
  "moderation",
  "whisper",
  "transcribe",
  "imagen",
  "diffusion",
  "guard",
  "safeguard",
  "reward",
  "learnlm",
  "computer-use",
  "robotics",
  "dall-e",
  "text-to-",
  "speech",
]
const NOT_CHAT_TOKENS = new Set(["tts", "asr", "vad", "ocr", "veo", "image", "images", "clip", "live", "audio", "aqa", "flux", "sdxl", "bge", "e5", "parse", "translate", "lyria", "sora"])

/** "meta/llama-3.3-70b-instruct:free" and "@cf/meta/llama-3.3-70b-instruct" both become "llama-3.3-70b-instruct". */
export function bareId(id: string) {
  return id.toLowerCase().replace(/^models\//, "").replace(/^.*\//, "").replace(/:[a-z0-9_-]+$/, "")
}

const tokensOf = (bare: string) => bare.split(/[^a-z0-9.]+/).filter(Boolean)

export function isChatModel(id: string) {
  const bare = bareId(id)
  if (NOT_CHAT_PARTS.some((p) => bare.includes(p))) return false
  return !tokensOf(bare).some((t) => NOT_CHAT_TOKENS.has(t))
}

const clamp = (n: number, lo = 0, hi = 10) => Math.min(hi, Math.max(lo, n))
const round1 = (n: number) => Math.round(n * 10) / 10

/** Largest "70b" or "235b" in the id: the total size of the model. */
function sizeInBillions(bare: string): number | null {
  let best: number | null = null
  for (const m of bare.matchAll(/(?:^|[^a-z0-9.])(?:a)?(\d+(?:\.\d+)?)b(?![a-z0-9])/g)) {
    // "a22b" is the active size of a mixture-of-experts model, not the total.
    if (m[0].includes("a" + m[1])) continue
    const n = Number(m[1])
    if (n > 0 && (best === null || n > best)) best = n
  }
  return best
}

const fmtContext = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M context` : `${Math.round(n / 1000)}K context`)

/** Quality blends what people judge a model by. Tiers are cut from it. */
export function quality(s: Scores) {
  return 0.4 * s.reasoning + 0.3 * s.coding + 0.3 * s.writing
}

export function tierOf(q: number): Tier {
  return q >= 9 ? "flagship" : q >= 8.3 ? "strong" : q >= 7.3 ? "balanced" : q >= 6.4 ? "fast" : "mini"
}

/** "claude-sonnet-5-5" to "Claude Sonnet 5.5", "gpt-oss-120b" to "GPT-OSS 120B". */
export function prettyName(id: string, listed?: string) {
  if (listed && listed.trim() && listed.trim().toLowerCase() !== id.toLowerCase() && listed.length <= 60) return listed.trim()
  const bare = id.replace(/^models\//, "").replace(/^.*\//, "").replace(/:free$/, "")
  const words = bare.split(/[-_ ]+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (/^\d$/.test(w) && /^\d$/.test(words[i + 1] ?? "")) {
      out.push(`${w}.${words[i + 1]}`)
      i++
      continue
    }
    const lower = w.toLowerCase()
    if (["gpt", "glm", "oss", "vl", "ai", "it", "fp8", "llm", "rp"].includes(lower)) out.push(lower.toUpperCase())
    else if (/^\d+(\.\d+)?b$/i.test(w)) out.push(w.toUpperCase())
    else if (/^r\d$/i.test(w) || lower === "qwq") out.push(lower === "qwq" ? "QwQ" : w.toUpperCase())
    else if (/^[a-z]/.test(w)) out.push(w[0].toUpperCase() + w.slice(1))
    else out.push(w)
  }
  const name = out.join(" ").replace(/\bGPT OSS\b/, "GPT-OSS")
  return name || id
}

/** Provider-specific nudge to speed: Groq's chips answer fastest, a busy free tier is slower. */
function speedAdjust(provider: ProviderId, free: boolean) {
  if (provider === "groq") return 1.6
  if (provider === "cloudflare") return 0.4
  if (provider === "nvidia") return -0.4
  if (provider === "openrouter" && free) return -0.8
  return 0
}

/**
 * Turns one entry of a provider's model list into a profile, or null when it is not a chat model.
 * `force` skips that check, for models you pinned yourself in the environment.
 */
export function classify(provider: ProviderId, listed: ListedModel, force = false): ModelProfile | null {
  const id = listed.id.replace(/^models\//, "")
  if (!force && !isChatModel(id)) return null
  const bare = bareId(id)
  const tokens = tokensOf(bare)
  const has = (...words: string[]) => words.some((w) => tokens.includes(w))

  const fam = FAMILIES.find((f) => f.re.test(bare))
  let r: number, c: number, w: number, s: number
  let ctx = listed.context ?? fam?.ctx ?? null
  let vision = listed.vision ?? fam?.vision ?? false
  let thinking = listed.thinking ?? fam?.think ?? false

  if (fam) {
    ;[r, c, w, s] = fam.s
  } else {
    const size = sizeInBillions(bare)
    if (size !== null) {
      const l = Math.log2(Math.max(1, size))
      r = clamp(4.8 + 0.62 * l, 5, 8.6)
      c = r - 0.2
      w = r - 0.1
      s = clamp(11.2 - l, 3, 9.6)
    } else {
      ;[r, c, w, s] = [6.8, 6.6, 7, 7.5]
    }
    // Words in the name say more than nothing when the family is unknown.
    if (has("mini", "small", "lite", "nano", "tiny", "instant", "haiku", "air", "fast", "turbo", "flash")) {
      r -= 0.8
      c -= 0.8
      w -= 0.6
      s += 1.2
    }
    if (has("large", "max", "ultra", "pro", "opus")) {
      r += 0.6
      c += 0.6
      w += 0.5
      s -= 1
    }
  }
  if (has("thinking", "reasoning", "reasoner", "think", "r1")) {
    thinking = true
    if (!fam) r += 0.5
    s -= 1.2
  }
  if (has("coder", "code", "codestral", "devstral") && !fam) c += 1.2
  if (has("vl", "vision", "multimodal", "omni", "pixtral", "llava")) vision = true
  if (!ctx) {
    const m = bare.match(/(\d+)k(?![a-z])/) // names like "...-128k"
    if (m) ctx = Number(m[1]) * 1000
  }

  const free = listed.free ?? false
  s += speedAdjust(provider, free)
  const scores: Scores = { reasoning: round1(clamp(r)), coding: round1(clamp(c)), writing: round1(clamp(w)), speed: round1(clamp(s)) }

  const tags: string[] = []
  if (thinking) tags.push("Thinking")
  if (scores.coding >= 8.8 && scores.coding >= scores.reasoning) tags.push("Coding")
  if (vision) tags.push("Vision")
  if (scores.speed >= 8.5) tags.push("Fast")
  if (ctx && ctx >= 500_000) tags.push(fmtContext(ctx))
  if (free) tags.push("Free")
  if (has("preview", "exp", "experimental", "beta")) tags.push("Preview")

  return {
    key: `${provider}:${id}`,
    provider,
    id,
    name: prettyName(id, listed.name),
    tier: tierOf(quality(scores)),
    scores,
    context: ctx,
    vision,
    thinking,
    free,
    tags: tags.slice(0, 4),
  }
}

/** Sorts best first: quality, then speed, then name so the order never flips between runs. */
export function byStrength(a: ModelProfile, b: ModelProfile) {
  return quality(b.scores) - quality(a.scores) || b.scores.speed - a.scores.speed || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
}
