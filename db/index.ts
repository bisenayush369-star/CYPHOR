import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { createClient, type Client } from "@libsql/client"
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql"
import * as schema from "./schema"

export type Db = LibSQLDatabase<typeof schema>

/**
 * Creates the tables on first use, so a fresh checkout needs no migration step.
 * Keep this in step with schema.ts (tests/unit/db.test.ts fails if they drift).
 * To manage the schema with drizzle-kit instead, run `npm run db:generate` and `npm run db:push`.
 */
export const BOOTSTRAP_SQL = [
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    starred INTEGER NOT NULL DEFAULT 0,
    project_id TEXT,
    model TEXT NOT NULL,
    root_active_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conversations_owner_updated_idx ON conversations (owner_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS messages (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    parent_id TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    attachments TEXT,
    active_child_id TEXT,
    feedback TEXT,
    status TEXT,
    error TEXT,
    thinking_ms INTEGER,
    meta TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (conversation_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id)`,
]

/** Columns added after the first release. A database made by an older version gets them here. */
const LATER_COLUMNS: { table: string; column: string; ddl: string }[] = [{ table: "messages", column: "meta", ddl: "ALTER TABLE messages ADD COLUMN meta TEXT" }]

async function addMissingColumns(client: Client) {
  for (const { table, column, ddl } of LATER_COLUMNS) {
    const info = await client.execute(`PRAGMA table_info(${table})`)
    if (!info.rows.some((r) => r.name === column)) await client.execute(ddl)
  }
}

export function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || "file:./.data/cyphor.db"
}

/** Opens a database and makes sure the tables exist. Exported so tests can use an in-memory one. */
export async function openDatabase(url = databaseUrl(), authToken = process.env.DATABASE_AUTH_TOKEN): Promise<{ db: Db; client: Client }> {
  if (url.startsWith("file:") && !url.includes(":memory:")) {
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true })
  }
  const client = createClient({ url, authToken: authToken || undefined })
  // SQLite ignores foreign keys unless asked; this makes deleting a conversation delete its messages.
  await client.execute("PRAGMA foreign_keys = ON")
  await client.batch(BOOTSTRAP_SQL, "write")
  await addMissingColumns(client)
  return { db: drizzle(client, { schema }), client }
}

// One connection per server process. The global keeps it across hot reloads in development.
const holder = globalThis as typeof globalThis & { __cyphorDb?: Promise<{ db: Db; client: Client }> }

/** The shared database. Opened on first use, never at import time, so `next build` touches no files. */
export async function getDb(): Promise<Db> {
  holder.__cyphorDb ??= openDatabase().catch((e) => {
    holder.__cyphorDb = undefined // let the next request try again
    throw e
  })
  return (await holder.__cyphorDb).db
}

export { schema }
