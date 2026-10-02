import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { VISITOR_COOKIE } from "@/proxy";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;

  if (!visitorId) {
    return Response.json({ conversations: [] });
  }

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.visitorId, visitorId))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);

  return Response.json({ conversations: rows });
}
