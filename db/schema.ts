import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { MessageMeta } from "@/lib/router/types"

/**
 * One row per conversation. `ownerId` is the anonymous visitor id that proxy.ts puts in a cookie;
 * swap it for a real user id when you add accounts.
 */
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    starred: integer("starred", { mode: "boolean" }).notNull().default(false),
    projectId: text("project_id"),
    model: text("model").notNull(),
    /** Which first message is on screen when the conversation is opened. */
    rootActiveId: text("root_active_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("conversations_owner_updated_idx").on(t.ownerId, t.updatedAt)]
)

/**
 * Messages form a tree: editing a message or retrying a reply adds a sibling under the same parent.
 * `parentId` links the tree, `activeChildId` remembers which branch is showing.
 */
export const messages = sqliteTable(
  "messages",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    parentId: text("parent_id"),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    model: text("model"),
    /** Name, type and size of each attachment. Image bytes are never stored. */
    attachments: text("attachments", { mode: "json" }).$type<
      { id: string; name: string; kind: "image" | "text" | "file"; mime: string; size: number; text?: string; unsupported?: boolean }[]
    >(),
    activeChildId: text("active_child_id"),
    feedback: text("feedback", { enum: ["up", "down"] }),
    status: text("status", { enum: ["streaming", "done", "error", "stopped"] }),
    error: text("error"),
    thinkingMs: integer("thinking_ms"),
    /** How the router made the reply: which model answered, the God Mode council, web sources. */
    meta: text("meta", { mode: "json" }).$type<MessageMeta>(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.id] }), index("messages_conversation_idx").on(t.conversationId)]
)

export type ConversationRecord = typeof conversations.$inferSelect
export type MessageRecord = typeof messages.$inferSelect
