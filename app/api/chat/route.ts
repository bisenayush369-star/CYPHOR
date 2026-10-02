import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { db } from "@/db";
import { conversations, messages as messagesTable } from "@/db/schema";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { rowToUIMessage, titleFromText, uiMessageToText } from "@/lib/chat-messages";
import { retry } from "@/lib/retry";
import { VISITOR_COOKIE } from "@/proxy";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are Cyphor, a helpful, sharp, friendly AI assistant built into a chat product. " +
  "Keep answers clear and concise unless the user asks for depth. Use fenced code blocks (```) for any code.";

const MAX_MESSAGE_LENGTH = 24_000; // ~6k tokens; generous for pasted logs/code, not unlimited

interface ChatRequestBody {
  message: UIMessage;
  id: string;
}

/** True specifically for "this row's id already exists" — not other DB errors. */
function isUniqueConstraintError(err: unknown): boolean {
  const cause = err as { cause?: { code?: string } } | undefined;
  return cause?.cause?.code === "SQLITE_CONSTRAINT";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "Server is missing ANTHROPIC_API_KEY. Add it to .env.local (see README) and restart the dev server.",
      },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  if (!visitorId) {
    // Shouldn't happen — proxy.ts sets this on every request — but don't
    // silently attribute messages to nobody if it's ever missing.
    return Response.json({ error: "Missing visitor session. Reload the page and try again." }, { status: 400 });
  }

  const { message, id: conversationId }: ChatRequestBody = await req.json();

  const userText = uiMessageToText(message);
  if (userText.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `That message is too long (${userText.length} chars, ${MAX_MESSAGE_LENGTH} max).` },
      { status: 413 }
    );
  }

  const now = new Date();

  // Atomic upsert instead of "check if it exists, then insert or update":
  // that two-step version has the exact race the message-insert fix below
  // guards against, just one function up — two concurrent requests for a
  // brand-new conversation could both see "doesn't exist" and both try to
  // insert, and the loser would throw instead of gracefully continuing.
  // ON CONFLICT makes this one atomic statement with no window between
  // checking and writing. `title` is intentionally left out of the update
  // set, so a race never clobbers the title a concurrent request already
  // wrote.
  await db
    .insert(conversations)
    .values({
      id: conversationId,
      visitorId,
      title: titleFromText(userText),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: conversations.id,
      set: { updatedAt: now },
    });

  const priorRows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt));

  try {
    await db.insert(messagesTable).values({
      id: message.id,
      conversationId,
      role: "user",
      content: userText,
      createdAt: now,
    });
  } catch (err) {
    // A retried request (double-click, flaky network) reuses the same
    // client-generated message id. That's not a real failure — the message
    // is already saved from the first attempt — so treat it as a no-op
    // instead of a 500. Anything else still throws.
    if (!isUniqueConstraintError(err)) throw err;
  }

  const fullHistory: UIMessage[] = [...priorRows.map(rowToUIMessage), message];

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(fullHistory),
    onError: ({ error }) => {
      console.error("streamText error:", error);
    },
    onFinish: async ({ text }) => {
      // The reply has already been streamed to the client at this point —
      // there's no request left to fail. Retry a few times before giving
      // up, and log loudly (rather than losing the reply with zero trace)
      // if it still doesn't stick.
      try {
        await retry(async () => {
          await db.insert(messagesTable).values({
            id: crypto.randomUUID(),
            conversationId,
            role: "assistant",
            content: text,
            createdAt: new Date(),
          });
          await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
        });
      } catch (err) {
        console.error(
          `[chat] FAILED to persist assistant reply for conversation ${conversationId} after retries — reply was shown to the user but is NOT saved:`,
          err
        );
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
