/**
 * Reads the provider keys. Server only.
 *
 * Next.js loads .env and .env.local by itself. The keys for the router can also live in a file of
 * their own, `LLM.env` (or `.env.llm`), next to package.json. It is plain KEY=value lines, git-ignored,
 * and read here, never sent to the browser. A variable that is already set in the real environment wins.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseEnv } from "node:util"

/** An environment: process.env, or any object of strings (tests pass their own). */
export type Env = Record<string, string | undefined>

const FILES = ["LLM.env", ".env.llm"]

/** Values this module copied out of those files, so a later reload can tell them from real environment variables. */
const applied = new Map<string, string>()

/**
 * Copies LLM.env into process.env. Safe to call again: the file is read once unless `force` is set,
 * and `force` picks up edits to the file without a restart (real environment variables still win).
 */
export function loadLlmEnv(options: { cwd?: string; force?: boolean; env?: Env } = {}) {
  const g = globalThis as typeof globalThis & { __cyphorEnvAt?: number }
  if (g.__cyphorEnvAt && !options.force) return
  g.__cyphorEnvAt = Date.now()

  const env = options.env ?? process.env
  // LLM_ENV_DISABLE=1 ignores the files, so automated tests never pick up a developer's own keys.
  if (env.LLM_ENV_DISABLE === "1") return
  const cwd = options.cwd ?? process.cwd()
  for (const name of FILES) {
    const file = resolve(cwd, name)
    // The path is built from the project folder at run time on purpose, so the bundler must not trace it.
    if (!existsSync(/*turbopackIgnore: true*/ file)) continue
    let parsed: Record<string, string>
    try {
      parsed = parseEnv(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as Record<string, string>
    } catch (e) {
      console.warn(`[router] could not read ${name}: ${e instanceof Error ? e.message : "unknown error"}`)
      continue
    }
    for (const [key, value] of Object.entries(parsed)) {
      const current = env[key]
      // Set it when nothing is there yet, or when the value there is the one this file gave us earlier.
      if (current === undefined || current === "" || applied.get(key) === current) {
        env[key] = value
        applied.set(key, value)
      }
    }
  }
}

/** Names that hold a secret: GROQ_API_KEY, TINYFISH_KEY, CF_API_TOKEN, DATABASE_AUTH_TOKEN... */
const SECRET_NAME = /(?:^|_)(?:API_KEY|KEY|TOKEN|SECRET|PASSWORD)$/i
const MASK = "[key hidden]"

/**
 * Hides the value of every secret in the environment from a piece of text. Providers sometimes repeat a key
 * back in an error ("Incorrect API key provided: ..."), and error text is shown on screen, so everything
 * that leaves the server as words goes through this first.
 */
export function scrubSecrets(text: string, env: Env = process.env): string {
  let out = text
  for (const [name, raw] of Object.entries(env)) {
    if (!raw || !SECRET_NAME.test(name)) continue
    const value = raw.trim().replace(/^(['"])(.*)\1$/, "$2").trim()
    // Short values would blank out ordinary words.
    if (value.length >= 8 && out.includes(value)) out = out.split(value).join(MASK)
  }
  return out
}

/** The first variable among `names` that has a value, trimmed and without surrounding quotes. */
export function readEnv(names: readonly string[], env: Env = process.env): string | undefined {
  for (const name of names) {
    const raw = env[name]
    if (typeof raw !== "string") continue
    const value = raw.trim().replace(/^(['"])(.*)\1$/, "$2").trim()
    if (value) return value
  }
  return undefined
}

/** "a, b ,c" to ["a","b","c"]. */
export function readList(names: readonly string[], env: Env = process.env): string[] {
  const raw = readEnv(names, env)
  return raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []
}

export function readInt(name: string, fallback: number, env: Env = process.env) {
  const n = Number.parseInt(env[name] ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
