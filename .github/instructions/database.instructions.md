---
description: Rules for the database layer
applyTo: 'db/**'
---

# Database

The app stores accounts, sessions and chats in Postgres: Neon in use, PGlite (Postgres inside the process) for tests and trial runs.

- `db/schema.ts` (drizzle) and `BOOTSTRAP_SQL` in `db/index.ts` describe the same tables. Change them together. The app creates the tables on the first connection unless `DB_AUTO_MIGRATE=0`.
- A unit test (in `tests/unit/server-lib.test.ts`, "the database") compares the columns of the tables made by `BOOTSTRAP_SQL` with `db/schema.ts`. Another makes the tables twice and checks that nothing changes and nothing is lost. Keep both passing.
- `conversations.owner_id` is the id of the signed-in user. Every query that touches a conversation filters by it.
- Image bytes are never stored. Attachments keep name, type, size and extracted text only.
- `DATABASE_URL` picks the database. On a Neon address `withNeonSsl` makes the connection check the server's certificate (`sslmode=verify-full`); keep that. `pglite://memory` and `pglite://./.data/pg` are for trying and testing, not for a server other people use. Never commit `.data/`.
- The pool holds 5 connections per server process (`DATABASE_POOL_MAX` changes it). Neon limits connections, so do not raise it without a reason.
- After a change run `npx tsc --noEmit --incremental false` and `npm run test:unit`.
