---
description: Put one file back exactly as delivered, by copying it from the reference folder.
name: cyphor-fix-file
argument-hint: file path and reference folder
agent: agent
---

# Fix one file

File to restore, relative to the project root: `${input:path:path such as lib/router/planner.ts}`

Reference folder (the unzipped `cyphor-chat` folder): `${input:source:full path of the unzipped cyphor-chat folder}`

Read `.github/copilot-instructions.md` first if you have not. Copy, do not rewrite.

1. Check that the file exists in the reference folder. If it does not, say so and stop.
2. If the file already exists here and is different, show me the difference first (`diff` on macOS and Linux, `Compare-Object (Get-Content ...) (Get-Content ...)` on Windows). If it is a settings file (`package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/globals.css`, `components.json`, `postcss.config.mjs`, `package-lock.json`), or the difference might hold changes of mine, ask me before replacing it.
3. Copy it with a terminal command. Do not open the file and retype it.
   - macOS and Linux: `mkdir -p "$(dirname "PATH")" && cp "SOURCE/PATH" "PATH"`
   - Windows PowerShell: `$to = Join-Path (Get-Location) "PATH"; [IO.Directory]::CreateDirectory((Split-Path -Parent $to)) | Out-Null; [IO.File]::Copy((Join-Path "SOURCE" "PATH"), $to, $true)` (.NET calls on purpose: the usual PowerShell file commands treat the square brackets in paths such as `app/chat/[id]/page.tsx` as wildcards)
4. Prove it. Run `node docs/tools/verify-files.mjs --only "PATH"` and quote the line for the file; it must say OK. Then run `npx tsc --noEmit` and quote what it printed.
5. Report in two lines: what you copied, and what the two commands printed. Do not touch any other file.
