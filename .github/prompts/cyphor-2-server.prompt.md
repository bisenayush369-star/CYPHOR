---
description: "Step 2 of 5, Database, proxy and conversation API. Copies the 14 files of this step from the reference folder and checks them."
name: cyphor-2-server
argument-hint: full path of the unzipped cyphor-chat folder
agent: agent
---

# Step 2 of 5: Database, proxy and conversation API

The database, the visitor and password gate, rate limits and the saved-conversation API. It needs step 1.

Reference folder (the unzipped `cyphor-chat` folder), called SOURCE below: `${input:source:full path of the unzipped cyphor-chat folder}`

Read `.github/copilot-instructions.md` first if you have not. Its rules apply here: copy, do not rewrite; prove each step; never touch `LLM.env`.

## Do this

1. List the work. Run these and show me the output:
   - `node docs/tools/verify-files.mjs --only server --list missing`
   - `node docs/tools/verify-files.mjs --only server --list different`

   If all of them print nothing, this step is already in place. Go to point 4.
2. Copy the files with a terminal command. Do not open a file and retype it, do not paste it from memory, do not shorten it. In the command, replace SOURCE with the full path of the reference folder and keep the double quotes (they keep spaces and square brackets safe). Run it from the project root. It copies everything on the `missing` and `different` lists, and prints one line per file:
   - macOS and Linux:
     ```bash
     { node docs/tools/verify-files.mjs --only server --list missing; node docs/tools/verify-files.mjs --only server --list different; } | while IFS= read -r p; do mkdir -p "$(dirname "$p")" && cp "SOURCE/$p" "$p" && echo "copied $p"; done
     ```
   - Windows PowerShell:
     ```powershell
     @(node docs/tools/verify-files.mjs --only server --list missing; node docs/tools/verify-files.mjs --only server --list different) | Where-Object { $_ } | ForEach-Object { $to = Join-Path (Get-Location) $_; [IO.Directory]::CreateDirectory((Split-Path -Parent $to)) | Out-Null; [IO.File]::Copy((Join-Path "SOURCE" $_), $to, $true); "copied $_" }
     ```
   - The PowerShell command uses .NET calls on purpose: the usual PowerShell file commands treat square brackets, as in `app/api/conversations/[id]/route.ts`, as wildcards.
   - If the command fails for one file, say which file and why, then stop. I will run `/cyphor-fix-file` for it.
3. This step has no settings files. A file that already exists here and differs is replaced by the delivered one; list those files in your report.
4. Check. Run each command and quote its output. Do not guess:
   - `node docs/tools/verify-files.mjs --only server` shows no MISSING and no DIFFERENT, except files I told you to keep.
   - `npx tsc --noEmit` prints nothing.
   - `npm run test:unit` prints a summary with `pass 50` and `fail 0` (when only steps up to this one are in; if I had other tests, the total differs).
5. If a check fails, read the first error and fix it by copying the right file from SOURCE. Do not edit code to silence an error, do not delete or weaken a test, do not turn off a tsconfig setting. Run the check again.
6. Report: how many files you copied (with their paths), how many were already identical, which you skipped and why, which existing files you replaced, and the summary lines of the checks. Say "done" only if every check above passed. If something could not be done, say exactly what.

## The files of this step

- `app/api/conversations/[id]/route.ts`
- `app/api/conversations/route.ts`
- `db/index.ts`
- `db/schema.ts`
- `lib/basic-auth.ts`
- `lib/chat-messages.ts`
- `lib/http.ts`
- `lib/models/page.ts`
- `lib/rate-limit.ts`
- `lib/retry.ts`
- `proxy.ts`
- `tests/unit/basic-auth.test.ts`
- `tests/unit/register.mjs`
- `tests/unit/server-lib.test.ts`

## Do not

- Do not start step 3. I will run it myself.
- Do not touch `LLM.env`, `.env.llm`, `.env.local` or any key.
- Do not install packages by any means other than `npm install` from the delivered `package.json`.
- Do not change a file that is not in this step.
