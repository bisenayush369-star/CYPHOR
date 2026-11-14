---
description: "Step 3 of 5, LLM router, God Mode and chat API. Copies the 20 files of this step from the reference folder and checks them."
name: cyphor-3-router
argument-hint: full path of the unzipped cyphor-chat folder
agent: agent
---

# Step 3 of 5: LLM router, God Mode and chat API

The LLM router, God Mode, and the chat and models API. It needs steps 1 and 2.

Reference folder (the unzipped `cyphor-chat` folder), called SOURCE below: `${input:source:full path of the unzipped cyphor-chat folder}`

Read `.github/copilot-instructions.md` first if you have not. Its rules apply here: copy, do not rewrite; prove each step; never touch `LLM.env`.

## Do this

1. List the work. Run these and show me the output:
   - `node docs/tools/verify-files.mjs --only router --list missing`
   - `node docs/tools/verify-files.mjs --only router --list different`

   If all of them print nothing, this step is already in place. Go to point 4.
2. Copy the files with a terminal command. Do not open a file and retype it, do not paste it from memory, do not shorten it. In the command, replace SOURCE with the full path of the reference folder and keep the double quotes (they keep spaces and square brackets safe). Run it from the project root. It copies everything on the `missing` and `different` lists, and prints one line per file:
   - macOS and Linux:
     ```bash
     { node docs/tools/verify-files.mjs --only router --list missing; node docs/tools/verify-files.mjs --only router --list different; } | while IFS= read -r p; do mkdir -p "$(dirname "$p")" && cp "SOURCE/$p" "$p" && echo "copied $p"; done
     ```
   - Windows PowerShell:
     ```powershell
     @(node docs/tools/verify-files.mjs --only router --list missing; node docs/tools/verify-files.mjs --only router --list different) | Where-Object { $_ } | ForEach-Object { $to = Join-Path (Get-Location) $_; [IO.Directory]::CreateDirectory((Split-Path -Parent $to)) | Out-Null; [IO.File]::Copy((Join-Path "SOURCE" $_), $to, $true); "copied $_" }
     ```
   - The PowerShell command uses .NET calls on purpose: the usual PowerShell file commands treat square brackets, as in `app/api/conversations/[id]/route.ts`, as wildcards.
   - If the command fails for one file, say which file and why, then stop. I will run `/cyphor-fix-file` for it.
3. This step has no settings files. A file that already exists here and differs is replaced by the delivered one; list those files in your report.
4. Check. Run each command and quote its output. Do not guess:
   - `node docs/tools/verify-files.mjs --only router` shows no MISSING and no DIFFERENT, except files I told you to keep.
   - `npx tsc --noEmit` prints nothing.
   - `npm run test:unit` prints a summary with `pass 137` and `fail 0` (when only steps up to this one are in; if I had other tests, the total differs).
5. If a check fails, read the first error and fix it by copying the right file from SOURCE. Do not edit code to silence an error, do not delete or weaken a test, do not turn off a tsconfig setting. Run the check again.
6. Report: how many files you copied (with their paths), how many were already identical, which you skipped and why, which existing files you replaced, and the summary lines of the checks. Say "done" only if every check above passed. If something could not be done, say exactly what.

## The files of this step

- `app/api/chat/route.ts`
- `app/api/models/route.ts`
- `lib/mock.ts`
- `lib/openai.ts`
- `lib/router/anthropic.ts`
- `lib/router/catalog.ts`
- `lib/router/env.ts`
- `lib/router/godmode.ts`
- `lib/router/health.ts`
- `lib/router/index.ts`
- `lib/router/planner.ts`
- `lib/router/profiles.ts`
- `lib/router/provider-defs.ts`
- `lib/router/providers.ts`
- `lib/router/router.ts`
- `lib/router/web.ts`
- `lib/sse.ts`
- `tests/unit/helpers/fake-provider.ts`
- `tests/unit/router-pure.test.ts`
- `tests/unit/router.test.ts`

## Do not

- Do not start step 4. I will run it myself.
- Do not touch `LLM.env`, `.env.llm`, `.env.local` or any key.
- Do not install packages by any means other than `npm install` from the delivered `package.json`.
- Do not change a file that is not in this step.
