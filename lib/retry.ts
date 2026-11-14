/**
 * Retry with exponential backoff and full jitter.
 *
 * Pure on purpose (no framework, no browser APIs), so the server route and the browser share it
 * and it can be unit-tested with a fake clock.
 */

export class HttpError extends Error {
  status: number
  /** How long the server asked us to wait (Retry-After), in milliseconds. */
  retryAfterMs: number | undefined

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/** Statuses that usually clear up on their own: timeouts, rate limits and server hiccups. */
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504, 529])

export function isRetryableStatus(status: number) {
  return RETRYABLE.has(status)
}

/** Retry-After is either a number of seconds or an HTTP date. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined
  const secs = Number(value)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const when = Date.parse(value)
  return Number.isNaN(when) ? undefined : Math.max(0, when - now)
}

/** Full jitter: a random wait between 0 and min(cap, base * 2^attempt). Spreads out clients that failed together. */
export function backoffDelay(attempt: number, baseMs: number, maxMs: number, random: () => number = Math.random) {
  return Math.floor(random() * Math.min(maxMs, baseMs * 2 ** attempt))
}

export interface RetryOptions {
  /** Extra attempts after the first one. Default 2. */
  retries?: number
  /** First backoff step. Default 300 ms. */
  baseMs?: number
  /** Longest single wait. A Retry-After above this is not waited out: the error is thrown instead. Default 4000 ms. */
  maxMs?: number
  signal?: AbortSignal
  /** Decide whether an error is worth another try. Default: network failures and HttpError with a retryable status. */
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
  random?: () => number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

export function isAbort(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ((error as { name: string }).name === "AbortError" || (error as { name: string }).name === "TimeoutError")
  )
}

function defaultShouldRetry(error: unknown) {
  if (error instanceof HttpError) return isRetryableStatus(error.status)
  // fetch() rejects with a TypeError when the network is down or the host cannot be reached.
  return error instanceof TypeError
}

function defaultSleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function abortError() {
  const e = new Error("Aborted")
  e.name = "AbortError"
  return e
}

export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 2, baseMs = 300, maxMs = 4000, signal, onRetry, random } = opts
  const sleep = opts.sleep ?? defaultSleep
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry

  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw abortError()
    try {
      return await fn(attempt)
    } catch (error) {
      if (isAbort(error) || attempt >= retries || !shouldRetry(error, attempt)) throw error
      let delayMs = backoffDelay(attempt, baseMs, maxMs, random)
      if (error instanceof HttpError && error.retryAfterMs !== undefined) {
        // The server said when to come back. Honour it, unless that is longer than we are willing to wait.
        if (error.retryAfterMs > maxMs) throw error
        delayMs = Math.max(delayMs, error.retryAfterMs)
      }
      onRetry?.({ attempt: attempt + 1, delayMs, error })
      await sleep(delayMs, signal)
    }
  }
}
