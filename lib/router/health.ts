/**
 * Remembers which providers and models are failing, so the router stops sending messages into a dead end.
 * Kept in memory for this server process. A restart forgets everything, which is fine: it only costs one retry.
 *
 * What counts as what:
 *  - 401 or 403: the key is wrong. The whole provider rests for five minutes.
 *  - Cannot connect, or no answer in time: the provider may be down. Two in a row and it rests, longer each time.
 *  - 429: that model is out of quota. It rests for the time the provider asked, or 30 seconds.
 *  - 5xx: that model is struggling. It rests, longer each time.
 *  - 404 for the model: it does not exist there. It rests for ten minutes.
 */
import type { ProviderId } from "./types"

export interface Failure {
  status?: number
  retryAfterSec?: number
  /** No answer came at all (cannot connect, or too slow). */
  unreachable?: boolean
}

interface Entry {
  fails: number
  until: number
  status?: number
}

const g = globalThis as typeof globalThis & { __cyphorHealth?: Map<string, Entry> }
const table = () => (g.__cyphorHealth ??= new Map<string, Entry>())

export const REST = { badKeyMs: 5 * 60_000, rateLimitMs: 30_000, maxRateLimitMs: 120_000, baseMs: 15_000, maxMs: 5 * 60_000, missingModelMs: 10 * 60_000 }

const pKey = (provider: ProviderId) => `p:${provider}`
const mKey = (modelKey: string) => `m:${modelKey}`

function rest(key: string, fails: number, ms: number, now: number, status?: number) {
  table().set(key, { fails, until: now + ms, status })
}

const backoff = (fails: number) => Math.min(REST.maxMs, REST.baseMs * 2 ** Math.max(0, fails - 1))

export function recordFailure(provider: ProviderId, modelKey: string, f: Failure, now = Date.now()): void {
  const t = table()
  const s = f.status
  if (s === 401 || s === 403) {
    rest(pKey(provider), 1, REST.badKeyMs, now, s)
  } else if (f.unreachable || s === undefined || s === 408 || s === 504) {
    const fails = (t.get(pKey(provider))?.fails ?? 0) + 1
    // One miss is noise. Two in a row means rest.
    t.set(pKey(provider), { fails, until: fails >= 2 ? now + backoff(fails - 1) : 0, status: s })
  } else if (s === 429) {
    rest(mKey(modelKey), 1, Math.min(REST.maxRateLimitMs, f.retryAfterSec ? f.retryAfterSec * 1000 : REST.rateLimitMs), now, s)
  } else if (s === 404) {
    rest(mKey(modelKey), 1, REST.missingModelMs, now, s)
  } else if (s >= 500) {
    const fails = (t.get(mKey(modelKey))?.fails ?? 0) + 1
    rest(mKey(modelKey), fails, backoff(fails), now, s)
  }
  // Any other 4xx: the request was the problem, not the model. Nothing to remember.
}

export function recordSuccess(provider: ProviderId, modelKey: string) {
  table().delete(pKey(provider))
  table().delete(mKey(modelKey))
}

/** Milliseconds until the provider is tried again. 0 when it is fine. */
export function providerRest(provider: ProviderId, now = Date.now()) {
  const e = table().get(pKey(provider))
  return e && e.until > now ? e.until - now : 0
}

export function modelRest(modelKey: string, now = Date.now()) {
  const e = table().get(mKey(modelKey))
  return e && e.until > now ? e.until - now : 0
}

export function isResting(provider: ProviderId, modelKey: string, now = Date.now()) {
  return providerRest(provider, now) > 0 || modelRest(modelKey, now) > 0
}

export function resetHealth() {
  table().clear()
}
