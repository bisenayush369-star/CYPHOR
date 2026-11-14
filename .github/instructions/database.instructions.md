---
description: Rules for the database layer
applyTo: 'db/**'
---

# Database

The tables and how conversations are saved are in `docs/ARCHITECTURE.md` section 3.

- `db/schema.ts` (drizzle) and `BOOTSTRAP_SQL` in `db/index.ts` describe the same tables. Change them together. A column added after the first release also goes in `LATER_COLUMNS`, so a database made by an older version gets it when it is opened.
- A unit test (in `tests/unit/server-lib.test.ts`) compares the columns of the tables made by `BOOTSTRAP_SQL` with `db/schema.ts`. Another opens an older database and checks the column is added without losing a row. Keep both passing.
- `PRAGMA foreign_keys = ON` is what makes deleting a conversation delete its messages. Do not remove it.
- `conversations.owner_id` is the anonymous visitor id from `proxy.ts`. Every query that touches a conversation filters by it.
- Image bytes are never stored. Attachments keep name, type, size and extracted text only.
- The default database is `file:./.data/cyphor.db`; `DATABASE_URL` (and `DATABASE_AUTH_TOKEN` for Turso) change it. Never commit `.data/` or `*.db`.
- After a change run `npx tsc --noEmit` and `npm run test:unit`.
