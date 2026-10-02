import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * Local file by default (`sqlite.db`, created automatically on first run).
 *
 * For serverless production (Vercel, etc.), point this at a hosted libSQL
 * database instead — Turso's free tier is the common choice. The driver and
 * every query stay exactly the same; only the URL (and an auth token)
 * change:
 *
 *   DATABASE_URL=libsql://your-db.turso.io
 *   DATABASE_AUTH_TOKEN=...
 *
 * See https://orm.drizzle.team/docs/get-started/turso-new
 */
const client = createClient({
  url: process.env.DATABASE_URL || "file:./sqlite.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
