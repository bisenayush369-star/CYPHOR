import type { UIMessage } from "ai";

export interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

/** DB row -> the shape @ai-sdk/react's useChat expects for `messages`/`initialMessages`. */
export function rowToUIMessage(row: MessageRow): UIMessage {
  return {
    id: row.id,
    role: row.role,
    parts: [{ type: "text", text: row.content }],
  };
}

/** Flattens a UIMessage's text parts back into a plain string for storage. */
export function uiMessageToText(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** First ~48 chars of a message, used as an auto-generated conversation title. */
export function titleFromText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 48) return trimmed || "New chat";
  return trimmed.slice(0, 48).trimEnd() + "…";
}
