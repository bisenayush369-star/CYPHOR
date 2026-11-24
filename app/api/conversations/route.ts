import { count, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { conversations, messages } from "@/db/schema"
import { toSummary } from "@/lib/chat-messages"
import { apiError, guard, readJson } from "@/lib/http"
import { DEFAULT_MODEL_ID } from "@/lib/models/page"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

/** GET /api/conversations lists the signed-in user's saved conversations, newest first. */
export async function GET(req: Request) {
  const gate = await guard(req, "api", 120, "RATE_LIMIT_API_PER_MIN")
  if (!gate.ok) return gate.response
  const db = await getDb()

  const rows = await db.select().from(conversations).where(eq(conversations.ownerId, gate.ownerId)).orderBy(desc(conversations.updatedAt)).limit(500)
  const counts = rows.length
    ? await db
        .select({ id: messages.conversationId, n: count() })
        .from(messages)
        .where(
          inArray(
            messages.conversationId,
            rows.map((r) => r.id)
          )
        )
        .groupBy(messages.conversationId)
    : []
  const byId = new Map(counts.map((c) => [c.id, c.n]))
  return Response.json({ conversations: rows.map((r) => toSummary(r, byId.get(r.id) ?? 0)) }, { headers: gate.headers })
}

/** POST /api/conversations creates an empty conversation. Sending an id that already exists returns it unchanged. */
export async function POST(req: Request) {
  const gate = await guard(req, "api", 120, "RATE_LIMIT_API_PER_MIN")
  if (!gate.ok) return gate.response
  const body = await readJson(req, 64 * 1024)
  if (!body.ok) return body.response
  const input = (typeof body.value === "object" && body.value !== null ? body.value : {}) as Record<string, unknown>

  const id = typeof input.id === "string" ? input.id : "c_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  if (!ID_RE.test(id)) return apiError(400, "bad_request", "The conversation id is invalid.", gate.headers)
  const projectId = input.projectId == null ? null : input.projectId
  if (projectId !== null && (typeof projectId !== "string" || !ID_RE.test(projectId))) return apiError(400, "bad_request", "The project id is invalid.", gate.headers)

  const db = await getDb()
  const [existing] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (existing) {
    if (existing.ownerId !== gate.ownerId) return apiError(409, "conflict", "That conversation id is taken.", gate.headers)
    return Response.json({ conversation: toSummary(existing, 0) }, { headers: gate.headers })
  }

  const now = Date.now()
  const row = {
    id,
    ownerId: gate.ownerId,
    title: (typeof input.title === "string" ? input.title.trim().slice(0, 200) : "") || "New chat",
    starred: input.starred === true,
    projectId,
    model: (typeof input.model === "string" ? input.model.trim().slice(0, 80) : "") || DEFAULT_MODEL_ID,
    rootActiveId: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(conversations).values(row)
  return Response.json({ conversation: toSummary(row, 0) }, { status: 201, headers: gate.headers })
}

/** DELETE /api/conversations removes every conversation the signed-in user has saved. */
export async function DELETE(req: Request) {
  const gate = await guard(req, "api", 120, "RATE_LIMIT_API_PER_MIN")
  if (!gate.ok) return gate.response
  const owner = gate.ownerId
  const db = await getDb()
  const mine = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.ownerId, owner))
  if (mine.length) {
    const ids = mine.map((c) => c.id)
    await db.transaction(async (tx) => {
      await tx.delete(messages).where(inArray(messages.conversationId, ids))
      await tx.delete(conversations).where(eq(conversations.ownerId, owner))
    })
  }
  return Response.json({ deleted: mine.length }, { headers: gate.headers })
}
