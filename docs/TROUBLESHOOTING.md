# Troubleshooting

Find the symptom, read the cause, do the fix. Where an error message is quoted, it is the text the code or the tool prints.

## Applying the files

| Symptom | Cause | Fix |
| --- | --- | --- |
| Copilot says it applied the changes, but files are unchanged | Ask mode cannot edit; or the edits were not kept or saved; or it never made them | Switch to **Agent** mode. Keep and save the edits. Then run `node docs/tools/verify-files.mjs` and believe that, not the message. |
| Typing `/` in Copilot Chat does not show the `cyphor-` prompts | `.github/prompts/` is not in the project root, or the folder opened in VS Code is not the project root | Check that `.github/prompts/` sits next to `package.json`, and open that folder. Hidden folders are skipped by Finder's select-all: see [APPLY-GUIDE.md](./APPLY-GUIDE.md) section 3. |
| Copilot cannot find the reference files | The unzipped `cyphor-chat` folder is not open in the workspace | `File > Add Folder to Workspace`, choose the unzipped `cyphor-chat` folder. |
| Only some files changed | The request was too long for Copilot to hold | One step at a time. For stray files use `/cyphor-fix-file`, or copy the file yourself. |
| The checker says DIFFERENT for a file you did not touch | The file was rewritten rather than copied | Copy it from the reference again (`/cyphor-fix-file`). Line endings do not matter: the checker reads CRLF as LF. |
| The checker says DIFFERENT for a file you changed on purpose | That is expected | Nothing to fix. A settings file (`package.json`, `tsconfig.json`, ...) shows as REVIEW and does not make the check fail. |
| The checker says MISSING for files in `.claude/skills/` | The design skills are optional | Ignore them, or copy them with Path A. They are not needed to run the app. |
| `robocopy` printed a number and stopped | Exit codes 0 to 7 mean success; 8 or more means a failure | Read the lines above the number. |
| PowerShell cannot find `app/api/conversations/[id]/route.ts` | Square brackets are wildcards in a normal path | Use a call that treats the path literally: `[IO.File]::Copy("SOURCE\app\api\conversations\[id]\route.ts", "PROJECT\app\api\conversations\[id]\route.ts", $true)` (the folder must exist), or `Copy-Item -LiteralPath` for the source. The step prompts already use the .NET call. |

## Type check and tests

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Cannot find module '@/lib/...'` or a missing file | A step is not applied yet | `node docs/tools/verify-files.mjs --list missing`, then apply the step that holds those files. The steps must go in order. |
| An error saying a name is declared but its value is never read (`TS6133`), or that all imports in an import statement are unused (`TS6192`) | `tsconfig.json` has `noUnusedLocals` and `noUnusedParameters` on | Remove the unused import or variable. Do not turn the setting off. |
| An error saying a name is a type and must be imported with `import type` (`TS1484`) | `verbatimModuleSyntax` is on | Write `import type { X } from "..."`, or `import { type X }`. |
| Type errors in files that are not from the Cyphor files | They are your own files | The Cyphor files compile on their own at every step. Fix or exclude your own files. |
| `NextRequest is not a constructor` in the unit tests | `node_modules` is a symlink to another folder | Use a real `node_modules`: run `npm install` inside the project. |
| The unit tests fail to start and mention a `.ts` file Node cannot load | Node is older than 22.18 | `node -v`. Install Node 22.18 or newer. |
| The build stops with `Both middleware file ... and proxy file ... are detected` | A `middleware.ts` next to `proxy.ts` | Move what you need into `proxy.ts` and remove `middleware.ts`. |
| `npm install` complains about versions | A `package.json` that is not the zip's | Use the zip's `package.json` and `package-lock.json`, then `npm ci` for the exact tested versions (it deletes and recreates `node_modules`). |
| Playwright says its browser does not exist | The browser was never downloaded | `npx playwright install chromium`. In a container, add `PW_NO_SANDBOX=1`; to use a browser you have, set `PW_CHROMIUM_PATH`. |
| The browser tests time out while starting | The first build is slow, or a port is taken | Wait for the build, or build first and run `SKIP_BUILD=1 npm run test:e2e`. Change ports with `DEMO_PORT`, `ROUTER_PORT`, `FAKE_LLM_PORT`. |

## Running the app

| Symptom | Cause | Fix |
| --- | --- | --- |
| Replies come from the "built-in demo" | No provider key is connected | Create `LLM.env` next to `package.json` with `NAME=value` lines ([ENV-AND-SECURITY.md](./ENV-AND-SECURITY.md) section 2), then restart or press Refresh in Settings > Router. |
| A provider still shows "not connected" after you added its key | Wrong file location, wrong variable name, or `LLM_ENV_DISABLE=1` is set | The file must be named `LLM.env` (or `.env.llm`) and sit next to `package.json`. Use the exact name from the table. Cloudflare also needs `CLOUDFLARE_ACCOUNT_ID`. Restart the server. |
| A provider is connected but Test fails | The provider's own error is shown (with any key hidden) | A rejected key (401 or 403) makes that provider rest for 5 minutes. Fix the key, then restart the server (the rest is kept in memory) or wait. |
| God Mode says "Needs two connected providers" | God Mode needs models from at least two different providers | Connect a second provider. |
| A hand-picked model never switches to another one | By design | Choose Cyphor Auto if you want fail-over. |
| The browser asks for a name and password | `CYPHOR_BASIC_AUTH` is set | Enter them. After too many wrong passwords from one address, answers become 429 for a minute. |
| Every page says the app is locked (503) | `CYPHOR_BASIC_AUTH` is set to something that is not `name:password` | Write it as `name:password`, both parts non-empty, or remove it. |
| "Missing visitor id. Reload the page and try again." | The browser blocks cookies for this site | Allow cookies for the address. The anonymous visitor cookie is `cyphor_owner`. |
| "You're going a little fast. Try again in N seconds." | A rate limit | Wait, or raise `RATE_LIMIT_CHAT_PER_MIN`, `RATE_LIMIT_API_PER_MIN` or `RATE_LIMIT_GOD_PER_MIN`. |
| Saved chats do not show up in another browser | Chats belong to the visitor id in that browser's cookie | Server copy follows one browser. Use Settings > Privacy > Export everything and Import a backup to move chats. Clearing cookies detaches the old copy. |
| A chat was never saved on the server | It was incognito, or Settings > Privacy > Server copy is off, or the database was unreachable | Check those. A database failure is written to the server log; the reply still streamed. |
| A database error appears when the server starts | The folder `.data/` cannot be written | Make it writable, or set `DATABASE_URL` to another path or a Turso address. To start with an empty database, stop the server and move `.data/` aside (do not delete it until you are sure). |
| Port 3000 is in use | Another program has it | `npm run dev -- -p 3001` |
| Download buttons do nothing in the hosted preview | The preview host blocks downloads | Run the real app, or `npm run build:preview` and open the file from disk. The project is not affected. |

## Still stuck

Run `/cyphor-0-audit` in Copilot Chat, or the checker, and keep the output. Together with the exact error text and the step you were on, it says almost everything needed. Do not paste `LLM.env` or any key.
