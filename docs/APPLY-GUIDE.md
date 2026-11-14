# Apply guide

How to get the Cyphor files into your project folder exactly as they were delivered, and how to prove they landed. Follow this page from top to bottom.

You have two things:

- `cyphor-chat.zip`: the project, 359 files (356 of them are in the manifest; the other three are unneeded `.pyc` files). This is the **reference**: the files are right there, byte for byte.
- This pack: documents, Copilot instruction and prompt files, a manifest of every file with its fingerprint, and a checker (`docs/tools/verify-files.mjs`) that tells you which files are in your folder and which are not.

There are two ways to apply the files. **Path A copies them yourself and is the reliable one.** Path B asks Copilot to do the copying, one step at a time, and uses the checker to catch what it skipped.

## 1. Check your tools

```bash
node -v      # must print v22.18 or newer (package.json says "node": ">=22.18")
npm -v
```

The unit tests run TypeScript directly, which is why Node 22.18 or newer is needed. Older Node: install a current one first.

## 2. Back up

Do one of these before you copy anything. Nothing in this guide deletes your files, but files with the same name are replaced.

- If the project is a git repository: `git add -A && git commit -m "before Cyphor files"`. Afterwards `git diff` shows what changed and `git restore <file>` undoes one file.
- Otherwise copy the whole project folder somewhere else (leave out `node_modules`).

## 3. Put this pack in your project

Copy what is **inside** `cyphor-docs-pack/` into the project root, the folder that holds `package.json`. After that you should see these next to `package.json`:

```text
AGENTS.md
.github/copilot-instructions.md
.github/instructions/   5 files
.github/prompts/        8 files
docs/                   the documents, manifest.json and tools/verify-files.mjs
```

Folders that start with a dot are hidden. On macOS press `Cmd + Shift + .` in Finder to show them, and do not use "select all" in Finder, which skips them. In a terminal, `cp -R cyphor-docs-pack/. /path/to/project/` copies hidden folders too.

If you already have an `AGENTS.md` or a `docs/` folder, do not overwrite: keep yours and add ours next to it (merge the text of `AGENTS.md` by hand).

## 4. Path A: copy the files yourself

1. Unzip `cyphor-chat.zip` **outside** your project. The zip holds one folder, `cyphor-chat/`.

   ```bash
   unzip cyphor-chat.zip -d ~/cyphor-source          # macOS and Linux
   ```

   ```powershell
   Expand-Archive -Path .\cyphor-chat.zip -DestinationPath $HOME\cyphor-source   # Windows PowerShell
   ```

2. Copy everything over your project. Hidden files such as `.gitignore` are included. The commands leave out `node_modules`, `.next`, `.data` and your `LLM.env`.

   macOS and Linux (`rsync`; it moves each file it replaces into a backup folder you can look through):

   ```bash
   rsync -a --exclude node_modules --exclude .next --exclude .data --exclude LLM.env \
     --backup --backup-dir="$HOME/cyphor-replaced" \
     ~/cyphor-source/cyphor-chat/ /path/to/your-project/
   ```

   Windows (`robocopy`; an exit code from 0 to 7 means success, 8 or more means a failure):

   ```powershell
   robocopy "$HOME\cyphor-source\cyphor-chat" "C:\path\to\your-project" /E /XD node_modules .next .data /XF LLM.env
   ```

   Mind the trailing `/` after `cyphor-chat` in the `rsync` command: it means "the contents of", and without it you get a folder inside a folder.

   If `rsync` is missing, or complains about `--backup-dir` (the `rsync` that comes with some macOS versions is a cut-down one), use a plain copy instead. It makes no backup, so section 2 must be done first: `cp -R ~/cyphor-source/cyphor-chat/. /path/to/your-project/`. The unzipped folder has no `node_modules`, `.next`, `.data` or `LLM.env`, so nothing needs to be left out, as long as you did not run `npm install` inside it.

   The macOS and Linux commands were run against a scratch copy of the project, with `rsync` 3.2.7 on Linux; the `rsync` that comes with macOS was not available here. The Windows commands were written carefully but **not run on Windows**. If one fails, copy the files with File Explorer instead (turn on "Hidden items" in the View menu so `.gitignore` and `.github` show), skip `node_modules`, `.next`, `.data` and `LLM.env`, then let the checker tell you what is still missing.

3. Settings files you changed yourself. These files are in the zip, and your own version may differ on purpose. If you want to keep your changes, restore your copy (from the backup or `git`), then add the Cyphor parts to it by hand. If you never changed them, the copy you just made is correct.

- `.env.example`
- `.gitignore`
- `components.json`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `postcss.config.mjs`
- `tsconfig.json`
- `app/globals.css`
- `app/layout.tsx`

   `package.json` matters most: it lists every package the app needs. Keep the zip's version, add back any packages of your own, and run `npm install` (step 5).

4. Install and check:

   ```bash
   cd /path/to/your-project
   npm install
   npx tsc --noEmit                      # prints nothing when it is fine
   npm run test:unit                     # the summary should say: pass 170 and fail 0
   node docs/tools/verify-files.mjs      # every required file should be OK
   npm run dev                           # open http://localhost:3000
   ```

Then go to section 7.

## 5. Path B: let Copilot do it, one step at a time

Use this when you want Copilot to do the copying, or when you have your own changes in many files and want to decide file by file.

**Set up once**

1. Put this pack in your project (section 3). Open the project folder in VS Code.
2. Unzip `cyphor-chat.zip` outside the project (section 4, step 1) and add that folder to the workspace (`File > Add Folder to Workspace`, choose `cyphor-chat` inside it). Copilot reads the folders that are open in the workspace; it cannot see a folder that is not.
3. Open Copilot Chat and switch it to **Agent** mode. In Ask mode Copilot can only answer; it cannot change files, which is the commonest reason nothing happens.
4. Type `/` in the chat box. You should see the prompts that start with `cyphor-`. If you do not, the `.github/prompts` folder is not in the project root.

**Then, in this order**

| What to run | What it does |
| --- | --- |
| `/cyphor-0-audit` | Changes nothing. Runs the checker and tells you which step to start with. |
| `/cyphor-1-foundation` to `/cyphor-5-tests` | One step each (table below). Each asks for the path of the unzipped `cyphor-chat` folder, copies the files for that step, then runs the checker, the type check and the unit tests. |
| `/cyphor-6-final-check` | Changes nothing. Runs every check and prints a table of results. |
| `/cyphor-fix-file` | Restores one file from the reference when the checker says it is MISSING or DIFFERENT. |

Run **one step at a time** and look at the result before the next. After each step, run the checker yourself too. Do not trust a "done" you have not seen proven:

```bash
node docs/tools/verify-files.mjs --only server          # use the step's name
```

If the checker lists files as MISSING or DIFFERENT, run `/cyphor-fix-file` for each, or run the step's prompt again. The prompts do nothing to a file that is already identical, so running one twice is safe.

Prompt files are a VS Code feature. In another editor, open the prompt file in `.github/prompts/` and paste its text into the chat.

## 6. The steps

Each step compiles on its own once the steps before it are in. That is why the order matters.

| Step | What it holds | Copilot prompt | Files | Done when |
| --- | --- | --- | --- | --- |
| 1 | Tooling and shared basics | `/cyphor-1-foundation` | 15 | `npx tsc --noEmit` has no errors |
| 2 | Database, proxy and conversation API | `/cyphor-2-server` | 14 | `npx tsc --noEmit` has no errors, and `npm run test:unit` passes 50 tests |
| 3 | LLM router, God Mode and chat API | `/cyphor-3-router` | 20 | `npx tsc --noEmit` has no errors, and `npm run test:unit` passes 137 tests |
| 4 | Screens, components and browser logic | `/cyphor-4-interface` | 117 | `npx tsc --noEmit` has no errors, and `npm run test:unit` passes 170 tests, and `npm run build` succeeds |
| 5 | Browser tests | `/cyphor-5-tests` | 7 | `npx tsc --noEmit` has no errors (the browser tests are optional and slow: `npm run test:e2e`) |

- Step 1 has 15 files, step 2 has 14, step 3 has 20, step 4 has 117 (counting the 47 shadcn components), step 5 has 7.
- The test counts are the ones measured when each step was built up from nothing: 50 unit tests after step 2, 137 after step 3 and 170 after step 4. If your project already had other tests, your totals differ.
- Not in any step, and optional: the project docs, the single-file preview build and the design skills for Claude Code. They are listed in [FILE-MAP.md](./FILE-MAP.md). Copy them with Path A if you want them.
- The whole list, file by file with what each one does, is in [FILE-MAP.md](./FILE-MAP.md).

## 7. Prove it worked

Run these in the project folder. All five should pass.

| Check | Command | Passing looks like |
| --- | --- | --- |
| Files | `node docs/tools/verify-files.mjs` | The last line says `Result: every required file is in place and matches the reference.` A settings file marked `REVIEW` is normal when you kept your own settings. Exit code 0. |
| Types | `npx tsc --noEmit` | No output at all. |
| Unit tests | `npm run test:unit` | `pass 170` and `fail 0` (with everything applied). |
| Build | `npm run build` | Ends with the route list and no error. |
| By eye | `npm run dev`, open http://localhost:3000 | A "new chat" screen. Send a message: with no keys set, the built-in demo model answers. |

Optional, takes a few minutes and downloads a browser the first time: `npx playwright install chromium`, then `npm run test:e2e`. See [TESTING.md](./TESTING.md).

To use real providers, put your keys in a file named `LLM.env` next to `package.json`, then open **Settings > Router**. See [ENV-AND-SECURITY.md](./ENV-AND-SECURITY.md). Never attach `LLM.env` to a chat.

## 8. Why Copilot skips changes, and what to do

Nobody can see from here what happened in your editor, so these are the usual causes, with the fix for each.

| What goes wrong | Why | What to do |
| --- | --- | --- |
| Copilot explains what to change but nothing changes | Ask mode cannot edit files | Switch to **Agent** mode |
| It says "done" but files are unchanged | It listed edits you did not keep, the files are not saved, or it never made them | Keep the edits, save, and run the checker. Believe the checker, not the message |
| Files look similar but not the same | It rewrote them from a description, so parts were dropped or "improved" | Have it **copy** the reference file with a terminal command. The prompts say so |
| Only the first few files change | A long list in one request is too much for it to hold | One step at a time, and `/cyphor-fix-file` for strays |
| It cannot find the reference files | The unzipped folder is not open in the workspace | Add it to the workspace (section 5) |
| It ignores the project rules | `AGENTS.md` and `.github/copilot-instructions.md` are not in the project root | Check section 3 |
| It edits a file you wanted to keep | No backup, no review | Section 2, and review each edit before keeping it |

The checker is the referee. It compares each file in your folder with the reference by fingerprint (SHA-256 of the file with line endings read as LF, so Windows and macOS copies of the same file match) and prints OK, MISSING, DIFFERENT or REVIEW.

## 9. Special cases

- **`middleware.ts` next to `proxy.ts`.** Next.js 16 stops with "Both middleware file ... and proxy file ... are detected" when both exist. Cyphor uses `proxy.ts`. Move anything you need from your `middleware.ts` into `proxy.ts`, then remove `middleware.ts`. The checker warns about it.
- **A `src/` folder, `pages/` or `app/` in two places.** Cyphor keeps `app/`, `components/`, `lib/` and `db/` in the project root. A second `src/app` or a `pages/` router next to it will fight with it. The checker warns about both.
- **Your own packages.** Keep them in `package.json`; section 4, step 3.
- **An existing database.** Cyphor creates its own tables in `.data/cyphor.db` the first time it runs and does not touch other files. See [ARCHITECTURE.md](./ARCHITECTURE.md).
- **`.gitignore`.** It must keep `LLM.env`, `.env.llm` and `.env.local` out of git. The checker fails if it does not.
- **Something else went wrong.** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Appendix: the packages in `package.json`

If you merge `package.json` by hand, this is what the delivered one asks for. The versions are ranges; `package-lock.json` pins the exact ones that were tested.

**dependencies** (27)

| Package | Version range |
| --- | --- |
| `@fontsource-variable/atkinson-hyperlegible-next` | `^5.3.0` |
| `@fontsource-variable/literata` | `^5.3.0` |
| `@fontsource-variable/schibsted-grotesk` | `^5.3.0` |
| `@fontsource-variable/spline-sans-mono` | `^5.3.0` |
| `@gsap/react` | `^2.1.2` |
| `@libsql/client` | `^0.18.0` |
| `@tailwindcss/postcss` | `^4.3.3` |
| `class-variance-authority` | `^0.7.1` |
| `clsx` | `^2.1.1` |
| `cmdk` | `^1.1.1` |
| `drizzle-orm` | `^0.45.4` |
| `gsap` | `^3.15.0` |
| `highlight.js` | `^11.12.0` |
| `lucide-react` | `^1.62.0` |
| `next` | `^16.4.3` |
| `radix-ui` | `^1.8.1` |
| `react` | `^19.3.1` |
| `react-dom` | `^19.3.1` |
| `react-hook-form` | `^7.91.0` |
| `react-markdown` | `^10.1.0` |
| `react-resizable-panels` | `^4.15.0` |
| `remark-gfm` | `^4.0.1` |
| `sonner` | `^2.0.8` |
| `tailwind-merge` | `^3.7.0` |
| `tw-animate-css` | `^1.4.0` |
| `vaul` | `^1.1.2` |
| `zustand` | `^5.0.16` |

**devDependencies** (13)

| Package | Version range |
| --- | --- |
| `@axe-core/playwright` | `^4.14.0` |
| `@playwright/test` | `^1.64.1` |
| `@tailwindcss/vite` | `^4.3.3` |
| `@types/node` | `^26.6.5` |
| `@types/react` | `^19.3.0` |
| `@types/react-dom` | `^19.3.0` |
| `@vitejs/plugin-react` | `^6.1.2` |
| `drizzle-kit` | `^0.31.11` |
| `shadcn` | `^4.23.0` |
| `tailwindcss` | `^4.3.3` |
| `typescript` | `^7.0.2` |
| `vite` | `^8.3.5` |
| `vite-plugin-singlefile` | `^2.3.4` |
