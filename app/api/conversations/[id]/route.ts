import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { rowToUIMessage } from "@/lib/chat-messages";
import { VISITOR_COOKIE } from "@/proxy";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;

  const conversation = visitorId
    ? await db.query.conversations.findFirst({
        where: and(eq(conversations.id, id), eq(conversations.visitorId, visitorId)),
      })
    : undefined;

  if (!conversation) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  return Response.json({
    conversation: { id: conversation.id, title: conversation.title },
    messages: rows.map(rowToUIMessage),
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;

  const conversation = visitorId
    ? await db.query.conversations.findFirst({
        where: and(eq(conversations.id, id), eq(conversations.visitorId, visitorId)),
      })
    : undefined;

  if (!conversation) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  // messages.conversation_id has ON DELETE CASCADE, so this takes the
  // messages with it — no separate delete needed.
  await db.delete(conversations).where(eq(conversations.id, id));

  return Response.json({ ok: true });
}
