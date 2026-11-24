import { mkdirSync } from "node:fs"
import { sql } from "drizzle-orm"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import * as schema from "./schema"

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Creates the tables on first use, so a fresh Neon database needs no migration step.
 * Keep this in step with schema.ts (tests/unit/server-lib.test.ts fails if they drift).
 * To manage the schema with drizzle-kit instead, run `npm run db:generate` and `npm run db:push`,
 * and set DB_AUTO_MIGRATE=0 so the app stops creating tables itself.
 */
export const BOOTSTRAP_SQL = [
  `CREATE TABLE IF NOT EXISTS "user" (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    email_verified boolean NOT NULL DEFAULT false,
    image text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "session" (
    id text PRIMARY KEY NOT NULL,
    expires_at timestamptz NOT NULL,
    token text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    ip_address text,
    user_agent text,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS session_user_idx ON "session" (user_id)`,
  `CREATE TABLE IF NOT EXISTS "account" (
    id text PRIMARY KEY NOT NULL,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz,
    scope text,
    password text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS account_user_idx ON "account" (user_id)`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    id text PRIMARY KEY NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification" (identifier)`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id text PRIMARY KEY NOT NULL,
    owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    title text NOT NULL,
    starred boolean NOT NULL DEFAULT false,
    project_id text,
    model text NOT NULL,
    root_active_id text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conversations_owner_updated_idx ON conversations (owner_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS messages (
    conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    id text NOT NULL,
    parent_id text,
    role text NOT NULL,
    content text NOT NULL,
    model text,
    attachments jsonb,
    active_child_id text,
    feedback text,
    status text,
    error text,
    thinking_ms integer,
    meta jsonb,
    created_at bigint NOT NULL,
    PRIMARY KEY (conversation_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id)`,
]

/** Thrown when DATABASE_URL is missing. The API turns it into a 503 that says how to fix it. */
export class DatabaseNotConfiguredError extends Error {
  readonly code = "db_not_configured"
  constructor() {
    super("No database is set. Put your Neon connection string in .env.local as DATABASE_URL (see .env.example).")
  }
}

export type DatabaseKind = "postgres" | "pglite"

/** The address in DATABASE_URL, or null when none is set. */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || null
}

/**
 * `postgres://...` and `postgresql://...` are a real server, which is what Neon gives you.
 * `pglite://memory` and `pglite://./some/folder` are a Postgres that runs inside this process. It is for tests and
 * for trying the app with no account anywhere; it is not meant for a server other people use.
 */
export function databaseKind(url: string): DatabaseKind {
  return /^pglite:/i.test(url) ? "pglite" : "postgres"
}

/**
 * Neon refuses connections that are not encrypted, so a Neon address is always connected with full certificate checking.
 * The driver treats `require`, `prefer` and `verify-ca` as `verify-full` today, and its next major version weakens them to
 * the libpq meaning (encrypted, but the server is not verified). Naming `verify-full` keeps the strong behaviour whichever
 * version is installed, and stops the driver printing a warning every time the server starts. Any other `sslmode`, and any
 * address that asks for the libpq meaning with `uselibpqcompat`, is left exactly as written.
 */
export function withNeonSsl(url: string): string {
  try {
    const u = new URL(url)
    if (!/\.neon\.tech$/i.test(u.hostname) || u.searchParams.has("uselibpqcompat")) return url
    const mode = (u.searchParams.get("sslmode") ?? "").toLowerCase()
    if (mode && !["require", "prefer", "verify-ca"].includes(mode)) return url
    u.searchParams.set("sslmode", "verify-full")
    return u.toString()
  } catch {
    return url
  }
}

export interface OpenedDatabase {
  db: Db
  kind: DatabaseKind
  close: () => Promise<void>
}

/** Takes one lock so several servers starting together do not create the tables at the same moment. */
const BOOTSTRAP_LOCK = 724163

export async function createTables(db: Db) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK})`)
    for (const statement of BOOTSTRAP_SQL) await tx.execute(sql.raw(statement))
    await tx.execute(sql.raw("INSERT INTO \"user\" (id, name, email) VALUES ('local', 'Local', 'local@cyphor') ON CONFLICT (id) DO NOTHING"))
  })
}

/** Opens a database and makes sure the tables exist. Exported so tests can use an in-memory one. */
export async function openDatabase(url: string | null = databaseUrl()): Promise<OpenedDatabase> {
  if (!url) throw new DatabaseNotConfiguredError()
  const kind = databaseKind(url)
  let db: Db
  let close: () => Promise<void>

  if (kind === "pglite") {
    const place = url.replace(/^pglite:(\/\/)?/i, "")
    const memory = place === "" || place === "memory" || place === "memory:"
    if (!memory) mkdirSync(place, { recursive: true })
    const { PGlite } = await import("@electric-sql/pglite")
    const { drizzle } = await import("drizzle-orm/pglite")
    const client = memory ? new PGlite() : new PGlite(place)
    await client.waitReady
    db = drizzle(client, { schema }) as unknown as Db
    close = () => client.close()
  } else {
    const { Pool } = await import("pg")
    const { drizzle } = await import("drizzle-orm/node-postgres")
    const pool = new Pool({
      connectionString: withNeonSsl(url),
      // A serverless host starts many copies of the app, and Neon limits connections, so keep each pool small.
      max: Math.max(1, Number(process.env.DATABASE_POOL_MAX) || 5),
      idleTimeoutMillis: 20_000,
      // Neon pauses an idle database. The first connection after a pause can take a few seconds to wake it.
      connectionTimeoutMillis: 20_000,
    })
    // An idle connection that Neon closes raises an event. Without a listener that would crash the server.
    pool.on("error", (e) => console.error(`[db] an idle connection was closed: ${e.message}`))
    db = drizzle(pool, { schema }) as unknown as Db
    close = () => pool.end()
  }

  if (process.env.DB_AUTO_MIGRATE !== "0") await createTables(db)
  return { db, kind, close }
}

// One connection pool per server process. The global keeps it across hot reloads in development.
const holder = globalThis as typeof globalThis & { __cyphorDb?: Promise<OpenedDatabase> }

/** The shared database. Opened on first use, never at import time, so `next build` touches no database. */
export async function getDatabase(): Promise<OpenedDatabase> {
  holder.__cyphorDb ??= openDatabase().catch((e) => {
    holder.__cyphorDb = undefined // let the next request try again
    throw e
  })
  return holder.__cyphorDb
}

export async function getDb(): Promise<Db> {
  return (await getDatabase()).db
}

export const LOCAL_OWNER_ID = "local"

export { schema }
