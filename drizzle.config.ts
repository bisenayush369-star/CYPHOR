import { defineConfig } from "drizzle-kit"

/**
 * For people who prefer migrations to the tables the app makes by itself (db/index.ts):
 *   npm run db:generate    writes SQL migrations to ./drizzle
 *   npm run db:push        applies the schema straight to the database in DATABASE_URL
 * Both read DATABASE_URL from your environment (drizzle-kit does not read .env.local, so export it or use `node --env-file=.env.local`).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
})
