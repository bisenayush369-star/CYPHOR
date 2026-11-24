import { and, eq } from "drizzle-orm"
import { getDb, type Db } from "@/db"
import { conversations, messages, type ConversationRecord } from "@/db/schema"
import { checkChat, chatToRows, rowsToChat, ID_RE } from "@/lib/chat-messages"
import { apiError, guard, readJson, type Guarded } from "@/lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** Rows inserted per statement. Postgres caps one statement at 65,535 bound values, and a message has about 14. */
const CHUNK = 500

type Loaded =
  | { ok: false; response: Response }
  | { ok: true; gate: Extract<Guarded, { ok: true }>; id: string; db: Db; conversation: ConversationRecord | undefined }

async function load(req: Request, ctx: Ctx): Promise<Loaded> {
  const gate = await guard(req, "api", 120, "RATE_LIMIT_API_PER_MIN")
  if (!gate.ok) return { ok: false, response: gate.response }
  const { id } = await ctx.params
  if (!ID_RE.test(id)) return { ok: false, response: apiError(400, "bad_request", "The conversation id is invalid.", gate.headers) }
  const db = await getDb()
  const [conversation] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.ownerId, gate.ownerId))).limit(1)
  return { ok: true, gate, id, db, conversation }
}

/** Thrown inside the save transaction to roll it back when the id belongs to another account. */
class NotYours extends Error {}

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

  const { conversation, messages: rows } = chatToRows(l.gate.ownerId, parsed.value)
  try {
    await l.db.transaction(async (tx) => {
      // The update only applies to a row this user owns. An id that belongs to someone else changes nothing and is
      // reported like a missing one, so ids cannot be probed and nobody's chat can be overwritten.
      const claimed = await tx
        .insert(conversations)
        .values(conversation)
        .onConflictDoUpdate({
          target: conversations.id,
          set: {
            title: conversation.title,
            starred: conversation.starred,
            projectId: conversation.projectId,
            model: conversation.model,
            rootActiveId: conversation.rootActiveId,
            updatedAt: conversation.updatedAt,
          },
          setWhere: eq(conversations.ownerId, l.gate.ownerId),
        })
        .returning({ id: conversations.id })
      if (!claimed.length) throw new NotYours()
      await tx.delete(messages).where(eq(messages.conversationId, l.id))
      for (let i = 0; i < rows.length; i += CHUNK) await tx.insert(messages).values(rows.slice(i, i + CHUNK))
    })
  } catch (e) {
    if (e instanceof NotYours) return notFound(l.gate.headers)
    throw e
  }

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
  await l.db.transaction(async (tx) => {
    await tx.delete(messages).where(eq(messages.conversationId, l.id))
    await tx.delete(conversations).where(eq(conversations.id, l.id))
  })
  return Response.json({ ok: true }, { headers: l.gate.headers })
}
