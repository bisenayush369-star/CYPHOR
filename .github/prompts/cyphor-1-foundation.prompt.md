---
description: "Step 1 of 5, Tooling and shared basics. Copies the 15 files of this step from the reference folder and checks them."
name: cyphor-1-foundation
argument-hint: full path of the unzipped cyphor-chat folder
agent: agent
---

# Step 1 of 5: Tooling and shared basics

The settings files and the shared types. Nothing in this step depends on a later step.

Reference folder (the unzipped `cyphor-chat` folder), called SOURCE below: `${input:source:full path of the unzipped cyphor-chat folder}`

Read `.github/copilot-instructions.md` first if you have not. Its rules apply here: copy, do not rewrite; prove each step; never touch `LLM.env`.

## Do this

1. List the work. Run these and show me the output:
   - `node docs/tools/verify-files.mjs --only foundation --list missing`
   - `node docs/tools/verify-files.mjs --only foundation --list different`
   - `node docs/tools/verify-files.mjs --only foundation --list review`

   If all of them print nothing, this step is already in place. Go to point 4.
2. Copy the files with a terminal command. Do not open a file and retype it, do not paste it from memory, do not shorten it. In the command, replace SOURCE with the full path of the reference folder and keep the double quotes (they keep spaces and square brackets safe). Run it from the project root. It copies everything on the `missing` and `different` lists, and prints one line per file:
   - macOS and Linux:
     ```bash
     { node docs/tools/verify-files.mjs --only foundation --list missing; node docs/tools/verify-files.mjs --only foundation --list different; } | while IFS= read -r p; do mkdir -p "$(dirname "$p")" && cp "SOURCE/$p" "$p" && echo "copied $p"; done
     ```
   - Windows PowerShell:
     ```powershell
     @(node docs/tools/verify-files.mjs --only foundation --list missing; node docs/tools/verify-files.mjs --only foundation --list different) | Where-Object { $_ } | ForEach-Object { $to = Join-Path (Get-Location) $_; [IO.Directory]::CreateDirectory((Split-Path -Parent $to)) | Out-Null; [IO.File]::Copy((Join-Path "SOURCE" $_), $to, $true); "copied $_" }
     ```
   - The PowerShell command uses .NET calls on purpose: the usual PowerShell file commands treat square brackets, as in `app/api/conversations/[id]/route.ts`, as wildcards.
   - If the command fails for one file, say which file and why, then stop. I will run `/cyphor-fix-file` for it.
3. Settings files. `.env.example`, `.gitignore`, `components.json`, `next.config.ts`, `package-lock.json`, `package.json`, `postcss.config.mjs`, `tsconfig.json` may differ from the delivered ones on purpose. If one of them already exists here and is different (the checker shows it as REVIEW), do **not** overwrite it: show me the difference and ask which version to keep. If it is missing, copy it. Every other file that exists and differs is replaced by the delivered one; list those files in your report.
4. Check. Run each command and quote its output. Do not guess:
   - `node docs/tools/verify-files.mjs --only foundation` shows no MISSING and no DIFFERENT, except files I told you to keep.
   - `npm install` (the first run takes a while) finishes without an error. Run it after `package.json` is in place and before the type check.
   - `npx tsc --noEmit` prints nothing.
   - There are no unit tests yet at this step. Do not run `npm run test:unit`.
5. If a check fails, read the first error and fix it by copying the right file from SOURCE. Do not edit code to silence an error, do not delete or weaken a test, do not turn off a tsconfig setting. Run the check again.
6. Report: how many files you copied (with their paths), how many were already identical, which you skipped and why, which existing files you replaced, and the summary lines of the checks. Say "done" only if every check above passed. If something could not be done, say exactly what.

## The files of this step

- `.env.example`
- `.gitignore`
- `.mcp.json` *(optional)*
- `components.json`
- `drizzle.config.ts`
- `lib/env.d.ts`
- `lib/router/types.ts`
- `lib/types.ts`
- `lib/utils.ts`
- `next-env.d.ts` *(optional)*
- `next.config.ts`
- `package-lock.json` *(optional)*
- `package.json`
- `postcss.config.mjs`
- `tsconfig.json`

## Do not

- Do not start step 2. I will run it myself.
- Do not touch `LLM.env`, `.env.llm`, `.env.local` or any key.
- Do not install packages by any means other than `npm install` from the delivered `package.json`.
- Do not change a file that is not in this step.
