/**
 * Runs a plan: calls the chosen model, and if it fails before saying anything, moves to the next one.
 *
 * Failing over only before the first word is deliberate. Once text has reached the person, switching model
 * would repeat or contradict what they already read, so a failure after that is shown as an error instead.
 * A model picked by name never falls back to a different one: you asked for that model.
 */
import type { WireMessage, WirePart } from "../chat-messages"
import { ProviderError, openAiChat } from "../openai"
import { isAbort, type RetryOptions } from "../retry"
import { anthropicChat } from "./anthropic"
import { resolveBase } from "./catalog"
import { readInt, type Env } from "./env"
import { recordFailure, recordSuccess } from "./health"
import type { Plan, Target } from "./planner"
import { providerHeaders } from "./providers"
import type { RouteInfo, Task } from "./types"

export interface CallArgs {
  wire: WireMessage[]
  temperature: number
  maxTokens: number
  thinking: boolean
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  env?: Env
  /** Retries inside one provider before giving up on it. Failing over is usually better than waiting, so the default is low. */
  retry?: RetryOptions
}

export type RouterEvent = { type: "route"; route: RouteInfo } | { type: "text"; text: string }

const STRIPPED = "(an image was attached here, but this model cannot read images)"

/** Replaces images with a short note for a model that cannot see them. */
export function stripImages(wire: WireMessage[]): WireMessage[] {
  return wire.map((m) => {
    if (typeof m.content === "string") return m
    const parts: WirePart[] = m.content.map((p) => (p.type === "image_url" ? { type: "text", text: STRIPPED } : p))
    return { ...m, content: parts }
  })
}

/** One model, one streamed reply as plain text pieces. No health tracking, no failover. */
export async function* callModel(target: Target, a: CallArgs): AsyncGenerator<string> {
  const { profile, provider } = target
  const env = a.env ?? process.env
  const base = await resolveBase(provider, { env, fetchImpl: a.fetchImpl, signal: a.signal })
  const headers = providerHeaders(provider.def, provider.apiKey, env)
  const wire = profile.vision ? a.wire : stripImages(a.wire)
  const retry: RetryOptions = { retries: 1, maxMs: 1500, ...a.retry }

  if (provider.def.protocol === "anthropic") {
    yield* anthropicChat({
      baseUrl: base,
      apiKey: provider.apiKey,
      model: profile.id,
      messages: wire,
      temperature: a.temperature,
      maxTokens: a.maxTokens,
      thinking: a.thinking && profile.thinking,
      headers,
      signal: a.signal,
      fetchImpl: a.fetchImpl,
      retry,
    })
    return
  }

  const extraBody: Record<string, unknown> = {}
  // gpt-oss on Groq reasons harder when asked to.
  if (a.thinking && profile.thinking && provider.def.id === "groq" && /gpt-oss/i.test(profile.id)) extraBody.reasoning_effort = "high"

  yield* openAiChat({
    baseUrl: base,
    // providerHeaders already holds the Authorization header (and OpenRouter's extras).
    apiKey: "",
    headers,
    model: profile.id,
    messages: wire,
    temperature: a.temperature,
    maxTokens: a.maxTokens,
    tokenParam: provider.def.tokenParam,
    extraBody,
    signal: a.signal,
    fetchImpl: a.fetchImpl,
    retry,
    unreachable: `Could not reach ${provider.def.label}. Check the network and the base URL.`,
  })
}

/** Like callModel, and records the outcome so a failing provider is skipped for a while. */
export async function* trackedCall(target: Target, a: CallArgs): AsyncGenerator<string> {
  const { provider: id } = target.profile
  const key = target.profile.key
  let gotText = false
  try {
    for await (const piece of callModel(target, a)) {
      if (!gotText) {
        gotText = true
        recordSuccess(id, key)
      }
      yield piece
    }
  } catch (e) {
    if (isAbort(e) || a.signal?.aborted) throw e
    const status = e instanceof ProviderError ? e.status : undefined
    recordFailure(id, key, { status, retryAfterSec: e instanceof ProviderError ? e.retryAfterSec : undefined, unreachable: status === undefined })
    throw e
  }
  if (!gotText) {
    // A 200 with nothing in it: usually a content filter or a model that is warming up.
    recordFailure(id, key, { status: 502 })
    throw new ProviderError("returned an empty reply", { status: 502 })
  }
}

/** Waits for the first piece, but not forever. A model that never starts is as bad as one that errors. */
async function firstPiece(gen: AsyncGenerator<string>, ms: number, abort: () => void): Promise<IteratorResult<string>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abort()
      reject(new ProviderError("did not answer in time", { status: 504 }))
    }, ms)
  })
  try {
    return await Promise.race([gen.next(), late])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function why(e: unknown): string {
  if (e instanceof ProviderError) {
    const s = e.status
    if (s === 401 || s === 403) return "rejected its key"
    if (s === 404) return "does not have that model"
    if (s === 429) return "is rate-limited"
    if (s === 504) return "was too slow"
    if (s !== undefined && s >= 500) return "is having trouble"
    if (e.message === "returned an empty reply") return "returned an empty reply"
  }
  return "could not answer"
}

export interface RunOptions extends CallArgs {
  /** How long to wait for the first word before trying the next model. */
  firstByteMs?: number
  /** What the first route event says it was. Defaults to auto/direct. */
  firstMode?: RouteInfo["mode"]
}

export function routeInfo(target: Target, mode: RouteInfo["mode"], reason: string, task?: Task): RouteInfo {
  const p = target.profile
  return { mode, provider: p.provider, providerLabel: target.provider.def.label, model: p.id, name: p.name, reason, task }
}

/** Streams the answer of the first candidate that works. Emits a `route` event each time the model in charge changes. */
export async function* runPlan(plan: Plan, a: RunOptions): AsyncGenerator<RouterEvent> {
  const env = a.env ?? process.env
  const baseWait = a.firstByteMs ?? readInt("ROUTER_FIRST_BYTE_MS", 25_000, env)
  const failures: { label: string; status?: number; retryAfterSec?: number; why: string }[] = []
  let previous: { label: string; why: string } | null = null

  for (let i = 0; i < plan.candidates.length; i++) {
    const c = plan.candidates[i]
    const { profile } = c.target
    const label = `${c.target.provider.def.label} ${profile.name}`
    const mode: RouteInfo["mode"] = i === 0 ? (a.firstMode ?? (plan.kind === "direct" ? "direct" : "auto")) : "fallback"
    const reason = previous ? `${previous.label} ${previous.why}, so ${profile.name} answered instead.` : c.reason
    yield { type: "route", route: routeInfo(c.target, mode, reason, plan.task) }

    const attempt = new AbortController()
    const onAbort = () => attempt.abort()
    a.signal?.addEventListener("abort", onAbort, { once: true })
    const gen = trackedCall(c.target, { ...a, signal: attempt.signal })
    // Models that think first need longer before the first word.
    const wait = a.thinking && profile.thinking ? Math.round(baseWait * 1.6) : baseWait

    let started = false
    try {
      const first = await firstPiece(gen, wait, () => {
        attempt.abort()
        recordFailure(profile.provider, profile.key, { status: 504, unreachable: true })
      })
      if (!first.done) {
        started = true
        yield { type: "text", text: first.value }
        for await (const piece of gen) yield { type: "text", text: piece }
      } else {
        throw new ProviderError("returned an empty reply", { status: 502 })
      }
      return
    } catch (e) {
      if (isAbort(e) && a.signal?.aborted) throw e
      // After the first word the person has already read part of the answer. Report the failure.
      if (started) throw e
      const status = e instanceof ProviderError ? e.status : undefined
      const text = e instanceof Error ? e.message : "failed"
      failures.push({ label, status, retryAfterSec: e instanceof ProviderError ? e.retryAfterSec : undefined, why: `${why(e)}${status ? ` (${status})` : ""}` })
      previous = { label, why: why(e) }
      // A model picked by name has no stand-in. Say what went wrong and stop.
      if (plan.kind === "direct") throw e instanceof ProviderError ? e : new ProviderError(text)
    } finally {
      a.signal?.removeEventListener("abort", onAbort)
      gen.return(undefined).catch(() => {})
    }
  }

  const list = failures.map((f) => `${f.label} ${f.why}`).join("; ")
  const retry = failures.map((f) => f.retryAfterSec).filter((n): n is number => typeof n === "number")
  throw new ProviderError(`No connected model could answer: ${list}. Try again in a moment.`, {
    status: failures.find((f) => f.status)?.status ?? 502,
    retryAfterSec: retry.length ? Math.min(...retry) : undefined,
  })
}
