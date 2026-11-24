import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"
import type { MessageMeta } from "@/lib/router/types"

/*
 * PostgreSQL, for Neon (or any Postgres). Two groups of tables:
 *
 *   user, session, account, verification   owned by Better Auth (lib/auth.ts). The table and column names
 *                                          are the ones its core schema asks for; do not rename them.
 *   conversations, messages                the chats, saved per signed-in user.
 *
 * db/index.ts creates all of them on first use, so a fresh Neon database needs no migration step.
 */

const stamp = (name: string) => timestamp(name, { withTimezone: true })

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: stamp("created_at").notNull().defaultNow(),
  updatedAt: stamp("updated_at").notNull().defaultNow(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: stamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: stamp("created_at").notNull().defaultNow(),
    updatedAt: stamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: stamp("access_token_expires_at"),
    refreshTokenExpiresAt: stamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: stamp("created_at").notNull().defaultNow(),
    updatedAt: stamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)]
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: stamp("expires_at").notNull(),
    createdAt: stamp("created_at").notNull().defaultNow(),
    updatedAt: stamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
)

/** One row per conversation. `ownerId` is the id of the signed-in user who owns it. */
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    starred: boolean("starred").notNull().default(false),
    projectId: text("project_id"),
    model: text("model").notNull(),
    /** Which first message is on screen when the conversation is opened. */
    rootActiveId: text("root_active_id"),
    /** Milliseconds since 1970, the same numbers the browser keeps. */
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("conversations_owner_updated_idx").on(t.ownerId, t.updatedAt)]
)

/**
 * Messages form a tree: editing a message or retrying a reply adds a sibling under the same parent.
 * `parentId` links the tree, `activeChildId` remembers which branch is showing.
 */
export const messages = pgTable(
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
    attachments: jsonb("attachments").$type<
      { id: string; name: string; kind: "image" | "text" | "file"; mime: string; size: number; text?: string; unsupported?: boolean }[]
    >(),
    activeChildId: text("active_child_id"),
    feedback: text("feedback", { enum: ["up", "down"] }),
    status: text("status", { enum: ["streaming", "done", "error", "stopped"] }),
    error: text("error"),
    thinkingMs: integer("thinking_ms"),
    /** How the router made the reply: which model answered, the God Mode council, web sources. */
    meta: jsonb("meta").$type<MessageMeta>(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.id] }), index("messages_conversation_idx").on(t.conversationId)]
)

export type ConversationRecord = typeof conversations.$inferSelect
export type MessageRecord = typeof messages.$inferSelect
