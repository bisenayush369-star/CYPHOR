import { and, eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { getDb, type Db } from "@/db"
import { conversations, messages } from "@/db/schema"
import { checkChatRequest, messageToRow, toWire, type ChatRequest } from "@/lib/chat-messages"
import { apiError, guard, readJson } from "@/lib/http"
import { mockReply } from "@/lib/mock"
import { resolveModelId } from "@/lib/models/page"
import { ProviderError } from "@/lib/openai"
import { isAbort } from "@/lib/retry"
import { WEB_RULES, estimateTokens, hasImages, planRoute, prepare, runGod, runPlan, searchQuery, webGround, type RouterContext } from "@/lib/router"
import { readInt, scrubSecrets } from "@/lib/router/env"
import type { MessageMeta, StreamEvent, WebSource } from "@/lib/router/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/chat answers one message and streams the reply as newline-delimited JSON:
 *   {"type":"route","route":{...}}      which model is answering, and why (again if it fails over)
 *   {"type":"council","council":{...}}  God Mode: who has drafted so far, who merges
 *   {"type":"web","query":"...","sources":[...]}  the pages a web search found
 *   {"type":"text","text":"..."}        a piece of the reply (thinking arrives wrapped in <thinking> tags)
 *   {"type":"error","message":"..."}
 *   {"type":"done"}
 *
 * Unless the chat is incognito, the conversation and both messages are saved as it goes, so a
 * finished reply is in the database even if the tab is closed a moment later.
 */

/** What the answer is made of, before it becomes a line of JSON. */
type Piece = Exclude<StreamEvent, { type: "error" | "done" }>

export async function POST(req: Request) {
  const gate = guard(req, "chat", 20, "RATE_LIMIT_CHAT_PER_MIN")
  if (!gate.ok) return gate.response

  const body = await readJson(req)
  if (!body.ok) return body.response
  const parsed = checkChatRequest(body.value)
  if (!parsed.ok) return apiError(400, "bad_request", parsed.error, gate.headers)
  const r = parsed.value
  const model = resolveModelId(r.model)

  const ctx = await prepare({ disabled: r.disabledProviders })
  if (ctx.configured && model === "cyphor-god") {
    // God Mode asks several providers for one message, so it gets a smaller allowance of its own.
    const god = guard(req, "god", 6, "RATE_LIMIT_GOD_PER_MIN")
    if (!god.ok) return god.response
  }

  // Save the turn before streaming. If the database is down the reply still works, it just isn't saved.
  let db: Db | null = null
  if (r.chatId) {
    try {
      db = await getDb()
      const saved = await beginTurn(db, gate.ownerId, r, model)
      if (saved === "forbidden") return apiError(404, "not_found", "That conversation does not belong to this browser.", gate.headers)
    } catch (e) {
      console.error("[api/chat] could not save the turn:", e)
      db = null
    }
  }

  const ac = new AbortController()
  req.signal.addEventListener("abort", () => ac.abort(), { once: true })
  const source = replyPieces(r, model, ctx, ac.signal)
  const encoder = new TextEncoder()
  const t0 = Date.now()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
        } catch {
          /* the client has gone away */
        }
      }
      let content = ""
      let tail = ""
      let thinkEnd: number | null = null
      let status: "done" | "stopped" | "error" = "done"
      let error: string | undefined
      const meta: MessageMeta = {}

      try {
        for await (const piece of source) {
          if (piece.type === "text") {
            content += piece.text
            if (thinkEnd === null) {
              tail = (tail + piece.text).slice(-16)
              if (/<\/think(?:ing)?>/.test(tail)) thinkEnd = Date.now() - t0
            }
          } else if (piece.type === "route") meta.route = piece.route
          else if (piece.type === "council") meta.council = piece.council
          else if (piece.type === "web") {
            meta.sources = piece.sources.length ? piece.sources : undefined
            meta.webNote = piece.note
          }
          send(piece)
        }
        send({ type: "done" })
      } catch (e) {
        if (isAbort(e) || ac.signal.aborted) {
          status = "stopped"
        } else {
          status = "error"
          error = scrubSecrets(e instanceof Error ? e.message : "Something went wrong.")
          send({ type: "error", message: error, status: e instanceof ProviderError ? e.status : undefined, retryAfterSec: e instanceof ProviderError ? e.retryAfterSec : undefined })
        }
      }

      if (db && r.chatId) {
        try {
          const hadThinking = /<think(?:ing)?>/.test(content)
          await finishTurn(db, r.chatId, r.assistantId, {
            content,
            status,
            error: error ?? null,
            thinkingMs: hadThinking ? Math.round(thinkEnd ?? Date.now() - t0) : null,
            meta: Object.values(meta).some((v) => v !== undefined) ? meta : null,
          })
        } catch (e) {
          console.error("[api/chat] could not save the reply:", e)
        }
      }
      try {
        controller.close()
      } catch {
        /* already closed */
      }
    },
    cancel() {
      ac.abort()
    },
  })

  return new Response(stream, {
    headers: {
      ...gate.headers,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Cyphor-Model": model,
    },
  })
}

/** The pieces of the reply: from the router when a provider is connected, from the built-in demo model otherwise. */
async function* replyPieces(r: ChatRequest, model: string, ctx: RouterContext, signal: AbortSignal): AsyncGenerator<Piece> {
  const last = r.thread[r.thread.length - 1]

  if (!ctx.configured) {
    for await (const text of mockReply({
      prompt: last.content,
      attachments: last.attachments ?? [],
      thinking: r.thinking || model === "cyphor-deep",
      noAccess: r.noAccess || r.web !== "off",
      signal,
      speed: r.speed,
    })) {
      yield { type: "text", text }
    }
    return
  }

  let system = r.system
  if (r.web !== "off") {
    const previous = r.thread.findLast((m, i) => m.role === "user" && i < r.thread.length - 1)
    const grounded = await webGround({ query: searchQuery(last.content, previous?.content), mode: r.web, signal })
    yield { type: "web", query: grounded.query, sources: grounded.sources as WebSource[], note: grounded.note }
    if (grounded.context) system = `${system}\n\n${WEB_RULES}\n\n${grounded.context}`.trim()
  }

  const wire = toWire(system, r.thread)
  const common = { wire, temperature: r.temperature, maxTokens: r.maxTokens, thinking: r.thinking || model === "cyphor-deep", signal }
  const input = { model, prompt: last.content, hasImages: hasImages(wire), estTokens: estimateTokens(wire), priority: r.priority, targets: ctx.targets, providers: ctx.providers }

  if (model === "cyphor-god") {
    const cap = readInt("GODMODE_MAX_PANEL", 6)
    yield* runGod({
      ...common,
      targets: ctx.targets,
      prompt: last.content,
      max: Math.min(cap, r.godMax),
      // If a council cannot meet, the message is answered the ordinary way.
      fallback: () => runPlan(planRoute({ ...input, model: "cyphor-auto" }), common),
    })
    return
  }
  yield* runPlan(planRoute(input), common)
}

/**
 * Makes sure the conversation exists and holds the messages of this request, plus an empty reply
 * marked "streaming". Messages the browser already synced are left alone.
 */
async function beginTurn(db: Db, ownerId: string, r: ChatRequest, model: string): Promise<"saved" | "forbidden"> {
  const chatId = r.chatId!
  const [existing] = await db.select({ ownerId: conversations.ownerId }).from(conversations).where(eq(conversations.id, chatId)).limit(1)
  if (existing && existing.ownerId !== ownerId) return "forbidden"

  const have = existing
    ? new Set((await db.select({ id: messages.id }).from(messages).where(eq(messages.conversationId, chatId))).map((m) => m.id))
    : new Set<string>()
  const user = r.thread[r.thread.length - 1]
  const now = Date.now()

  const statements: BatchItem<"sqlite">[] = []
  if (!existing) {
    statements.push(
      db.insert(conversations).values({
        id: chatId,
        ownerId,
        title: r.chat.title,
        starred: r.chat.starred,
        projectId: r.chat.projectId,
        model,
        rootActiveId: r.thread[0].id,
        createdAt: r.chat.createdAt,
        updatedAt: now,
      })
    )
  }
  const missing = r.thread.filter((m) => !have.has(m.id)).map((m) => messageToRow(chatId, { ...m, activeChildId: m.id === user.id ? r.assistantId : m.activeChildId }))
  if (missing.length) statements.push(db.insert(messages).values(missing).onConflictDoNothing())
  statements.push(
    db
      .insert(messages)
      .values({
        conversationId: chatId,
        id: r.assistantId,
        parentId: user.id,
        role: "assistant",
        content: "",
        model,
        attachments: null,
        activeChildId: null,
        feedback: null,
        status: "streaming",
        error: null,
        thinkingMs: null,
        meta: null,
        createdAt: now,
      })
      .onConflictDoUpdate({ target: [messages.conversationId, messages.id], set: { content: "", status: "streaming", error: null, thinkingMs: null, meta: null } })
  )
  // Point the branch pointers at this turn.
  statements.push(db.update(messages).set({ activeChildId: r.assistantId }).where(and(eq(messages.conversationId, chatId), eq(messages.id, user.id))))
  if (user.parentId) {
    statements.push(db.update(messages).set({ activeChildId: user.id }).where(and(eq(messages.conversationId, chatId), eq(messages.id, user.parentId))))
  } else {
    statements.push(db.update(conversations).set({ rootActiveId: user.id }).where(eq(conversations.id, chatId)))
  }
  statements.push(db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, chatId)))

  await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]])
  return "saved"
}

async function finishTurn(
  db: Db,
  chatId: string,
  assistantId: string,
  result: { content: string; status: "done" | "stopped" | "error"; error: string | null; thinkingMs: number | null; meta: MessageMeta | null }
) {
  await db.batch([
    db.update(messages).set(result).where(and(eq(messages.conversationId, chatId), eq(messages.id, assistantId))),
    db.update(conversations).set({ updatedAt: Date.now() }).where(eq(conversations.id, chatId)),
  ])
}

