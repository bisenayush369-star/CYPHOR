---
description: "Copies every missing or different Cyphor file from the reference folder into this project, then proves it with the checker, the type check, the unit tests and the build."
name: cyphor-1-apply
argument-hint: full path of the unzipped cyphor-chat folder
agent: agent
---

# Apply the Cyphor files

Reference folder (the unzipped `cyphor-chat` folder), called SOURCE below: `${input:source:full path of the unzipped cyphor-chat folder}`

Read `.github/copilot-instructions.md` first if you have not. Its rules apply here: copy, do not rewrite; prove each step; never touch `LLM.env`.

## Do this

1. List the work. Run these and show me the output:
   - `node docs/tools/verify-files.mjs --only foundation,server,router,interface,e2e,docs --list missing`
   - `node docs/tools/verify-files.mjs --only foundation,server,router,interface,e2e,docs --list different`
   - `node docs/tools/verify-files.mjs --only foundation,server,router,interface,e2e,docs --list review`

   If the first two print nothing, the files are already in place. Go to point 4.
2. Copy the files with a terminal command. Do not open a file and retype it, do not paste it from memory, do not shorten it. In the command, replace SOURCE with the full path of the reference folder and keep the double quotes (they keep spaces and square brackets safe). Run it from the project root. It copies everything on the `missing` and `different` lists and prints one line per file:
   - macOS and Linux:
     ```bash
     { node docs/tools/verify-files.mjs --only foundation,server,router,interface,e2e,docs --list missing; node docs/tools/verify-files.mjs --only foundation,server,router,interface,e2e,docs --list different; } | while IFS= read -r p; do mkdir -p "$(dirname "$p")" && cp "SOURCE/$p" "$p" && echo "copied $p"; done
     ```
   - Windows PowerShell:
     ```powershell
     @(node docs/tools/verify-files.mjs --only foundation,server,router,interface,e2e,docs --list missing; node docs/tools/verify-files.mjs --only foundation,server,router,interface,e2e,docs --list different) | Where-Object { $_ } | ForEach-Object { $to = Join-Path (Get-Location) $_; [IO.Directory]::CreateDirectory((Split-Path -Parent $to)) | Out-Null; [IO.File]::Copy((Join-Path "SOURCE" $_), $to, $true); "copied $_" }
     ```
   - The PowerShell command uses .NET calls on purpose: the usual PowerShell file commands treat square brackets, as in `app/api/conversations/[id]/route.ts`, as wildcards.
   - If the command fails for one file, say which file and why, then stop. I will run `/cyphor-fix-file` for it.
3. Settings files. `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `components.json`, `.gitignore`, `.env.example`, `app/layout.tsx` and `app/globals.css` may differ from the delivered ones on purpose. The checker shows such a file as REVIEW (the third list above). Do **not** overwrite one of them. Show me the difference and ask which version to keep. A settings file that is missing was already copied in point 2. Every other file that exists and differs is replaced by the delivered one; list those files in your report.
4. Install. If `package.json` or `package-lock.json` was copied or changed, or the checker says the dependencies are not installed, run `npm install` (the first run takes a while) and show me whether it finished without an error. Install nothing else.
5. Check. Run each command and quote its output. Do not guess:
   - `node docs/tools/verify-files.mjs` ends with `Result: every required file is in place` (a REVIEW settings file is fine) and exits with code 0.
   - `npx tsc --noEmit --incremental false` prints nothing.
   - `npm run test:unit` prints a summary with `pass 355` and `fail 0` (if I have tests of my own, the total is higher).
   - `npm run build` ends with the route list. If it prints the route list and then stops with `SecurityFatalError: Your version of Next.js is affected by a known security vulnerability`, run it once more. Do not run `next upgrade` or update Next.js; tell me about the advisory in your report and I will decide.
   - The browser tests (`npm run test:e2e`) are slow and need `npx playwright install chromium` once. Run them only if I ask.
6. If a check fails, read the first error and fix it by copying the right file from SOURCE. Do not edit code to silence an error, do not delete or weaken a test, do not turn off a tsconfig setting. Run the check again.
7. Report: how many files you copied (with their paths), how many were already identical, which you skipped and why, which existing files you replaced, which settings files are left for me to decide, and the summary lines of the checks. Say "done" only if every check above passed. If something could not be done, say exactly what.

## Do not

- Do not touch `LLM.env`, `.env.llm`, `.env.local` or any key.
- Do not install packages by any means other than `npm install` from `package.json`.
- Do not delete any file of mine. Old files from the first version of this pack are listed in `docs/APPLY-GUIDE.md`; tell me if they exist and let me decide.
- Do not change a file that is not on the checker's lists.
