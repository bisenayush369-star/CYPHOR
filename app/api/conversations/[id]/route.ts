import { and, eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { getDb, type Db } from "@/db"
import { conversations, messages, type ConversationRecord } from "@/db/schema"
import { checkChat, chatToRows, rowsToChat, ID_RE } from "@/lib/chat-messages"
import { apiError, guard, readJson, type Guarded } from "@/lib/http"
import { getOwnerId } from "@/proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** Rows inserted per statement. SQLite caps the number of bound values in one statement. */
const CHUNK = 150

type Loaded =
  | { ok: false; response: Response }
  | { ok: true; gate: Extract<Guarded, { ok: true }>; id: string; db: Db; conversation: ConversationRecord | undefined }

async function load(req: Request, ctx: Ctx): Promise<Loaded> {
  const gate = guard(req, "api", 120, "RATE_LIMIT_API_PER_MIN")
  if (!gate.ok) return { ok: false, response: gate.response }
  const { id } = await ctx.params
  if (!ID_RE.test(id)) return { ok: false, response: apiError(400, "bad_request", "The conversation id is invalid.", gate.headers) }
  const db = await getDb()
  const [conversation] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.ownerId, getOwnerId(req)!))).limit(1)
  return { ok: true, gate, id, db, conversation }
}

const notFound = (headers: HeadersInit) => apiError(404, "not_found", "That conversation was not found.", headers)

/** GET returns the whole conversation in the shape the browser stores it: { chat }. */
export async function GET(req: Request, ctx: Ctx) {
  const l = await load(req, ctx)
  if (!l.ok) return l.response
  if (!l.conversation) return notFound(l.gate.headers)
  const rows = await l.db.select().from(messages).where(eq(messages.conversationId, l.id))
  return Response.json({ chat: rowsToChat(l.conversation, rows) }, { headers: l.gate.headers })
}

/** PUT saves the whole conversation, replacing what was there. Safe to repeat. */
export async function PUT(req: Request, ctx: Ctx) {
  const l = await load(req, ctx)
  if (!l.ok) return l.response
  const body = await readJson(req)
  if (!body.ok) return body.response
  const parsed = checkChat((body.value as { chat?: unknown } | null)?.chat)
  if (!parsed.ok) return apiError(400, "bad_request", parsed.error, l.gate.headers)
  if (parsed.value.id !== l.id) return apiError(400, "bad_request", "The conversation id does not match the address.", l.gate.headers)

  // An id that belongs to someone else is reported like a missing one, so ids cannot be probed.
  if (!l.conversation) {
    const [taken] = await l.db.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, l.id)).limit(1)
    if (taken) return notFound(l.gate.headers)
  }

  const { conversation, messages: rows } = chatToRows(l.gate.ownerId, parsed.value)
  const statements: BatchItem<"sqlite">[] = [
    l.db.insert(conversations).values(conversation).onConflictDoUpdate({
      target: conversations.id,
      set: {
        title: conversation.title,
        starred: conversation.starred,
        projectId: conversation.projectId,
        model: conversation.model,
        rootActiveId: conversation.rootActiveId,
        updatedAt: conversation.updatedAt,
      },
    }),
    l.db.delete(messages).where(eq(messages.conversationId, l.id)),
  ]
  for (let i = 0; i < rows.length; i += CHUNK) statements.push(l.db.insert(messages).values(rows.slice(i, i + CHUNK)))
  await l.db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]])

  return Response.json({ ok: true, updatedAt: conversation.updatedAt, messageCount: rows.length }, { headers: l.gate.headers })
}

/** PATCH changes the small things (title, star, project, model) without sending any messages. */
export async function PATCH(req: Request, ctx: Ctx) {
  const l = await load(req, ctx)
  if (!l.ok) return l.response
  if (!l.conversation) return notFound(l.gate.headers)
  const body = await readJson(req, 64 * 1024)
  if (!body.ok) return body.response
  const input = (typeof body.value === "object" && body.value !== null ? body.value : {}) as Record<string, unknown>

  const set: Partial<typeof conversations.$inferInsert> = {}
  if (typeof input.title === "string") set.title = input.title.trim().slice(0, 200) || "New chat"
  if (typeof input.starred === "boolean") set.starred = input.starred
  if (typeof input.model === "string" && input.model.trim()) set.model = input.model.trim().slice(0, 80)
  if ("projectId" in input) {
    if (input.projectId !== null && (typeof input.projectId !== "string" || !ID_RE.test(input.projectId))) return apiError(400, "bad_request", "The project id is invalid.", l.gate.headers)
    set.projectId = input.projectId as string | null
  }
  if (!Object.keys(set).length) return apiError(400, "bad_request", "Nothing to change.", l.gate.headers)
  set.updatedAt = Date.now()
  await l.db.update(conversations).set(set).where(eq(conversations.id, l.id))
  return Response.json({ ok: true, updatedAt: set.updatedAt }, { headers: l.gate.headers })
}

export async function DELETE(req: Request, ctx: Ctx) {
  const l = await load(req, ctx)
  if (!l.ok) return l.response
  if (!l.conversation) return notFound(l.gate.headers)
  await l.db.batch([l.db.delete(messages).where(eq(messages.conversationId, l.id)), l.db.delete(conversations).where(eq(conversations.id, l.id))])
  return Response.json({ ok: true }, { headers: l.gate.headers })
}
