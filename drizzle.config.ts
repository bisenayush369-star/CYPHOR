import { defineConfig } from "drizzle-kit"

/**
 * For `npm run db:generate`, `db:push` and `db:studio`. The app does not need any of them: it creates its own
 * tables the first time it opens the database (see BOOTSTRAP_SQL in db/index.ts). Use these when you want
 * migration files or to look at the data.
 *
 * It reads DATABASE_URL (and DATABASE_AUTH_TOKEN for Turso) from your shell, so set them before you run a
 * command. With nothing set it uses the same local file as the app.
 */
const url = process.env.DATABASE_URL || "file:./.data/cyphor.db"
const remote = /^(libsql|https?|wss?):/i.test(url)

export default remote
  ? defineConfig({ dialect: "turso", schema: "./db/schema.ts", out: "./db/migrations", dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN } })
  : defineConfig({ dialect: "sqlite", schema: "./db/schema.ts", out: "./db/migrations", dbCredentials: { url } })
