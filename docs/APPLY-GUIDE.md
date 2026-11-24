# Apply guide

How to get the Cyphor files into your project exactly as delivered, and how to prove that they landed.

You have two zip files:

- `cyphor-chat.zip`: the project, 412 files. It is the **reference**: every file is in it, byte for byte.
- `cyphor-docs-pack.zip`: this pack. Copilot rules and prompts, a list of every project file with its fingerprint (`docs/manifest.json`), and a checker (`docs/tools/verify-files.mjs`) that says which files in your folder are right and which are not.

There are two routes. **The quick route copies the files yourself and is the reliable one.** The Copilot route asks Copilot to do the copying with a terminal command, and uses the checker to catch whatever it skips.

What the app is, how to set up Neon and Google sign-in, and what was tested are in the project itself: `README.md` and `docs/ACCEPTANCE.md`.

## 1. Check your tools

```bash
node -v      # v22.18 or newer (package.json says "node": ">=22.18")
npm -v
```

The unit tests run TypeScript directly, which is why they need Node 22.18 or newer.

## 2. Back up

Nothing in this guide deletes your files, but files with the same name are replaced. Before you copy anything, do one of these:

- In a git repository: `git add -A && git commit -m "before the new Cyphor files"`. Afterwards `git diff` shows what changed and `git restore <file>` undoes one file.
- Otherwise copy the project folder somewhere else (leave out `node_modules`).

## 3. Put this pack in your project

Copy what is **inside** `cyphor-docs-pack/` into the project root, the folder that holds `package.json`. You should then see, next to `package.json`:

```text
AGENTS.md
.github/copilot-instructions.md
.github/instructions/    5 files (api-routes, components, database, router, tests)
.github/prompts/         4 files (cyphor-0-audit, cyphor-1-apply, cyphor-2-final-check, cyphor-fix-file)
docs/APPLY-GUIDE.md      this page
docs/manifest.json       every project file with its fingerprint
docs/tools/verify-files.mjs   the checker
```

Folders that start with a dot are hidden. On macOS press `Cmd + Shift + .` in Finder to show them, and do not use "select all" in Finder, which skips them. In a terminal, `cp -R cyphor-docs-pack/. /path/to/project/` copies hidden folders too.

If you already have an `AGENTS.md` (Next.js can create one), do not overwrite it: keep yours and add the text of ours to it. The same goes for a `docs/` folder of your own: add ours next to your files.

## 4. Quick route: copy the project over yours

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

   Mind the trailing `/` after `cyphor-chat` in the `rsync` command: it means "the contents of". Without it you get a folder inside a folder.

   If `rsync` is missing, or complains about `--backup-dir` (the one that comes with some macOS versions is cut down), use a plain copy instead. It makes no backup, so section 2 must be done first: `cp -R ~/cyphor-source/cyphor-chat/. /path/to/your-project/`. The unzipped folder has no `node_modules`, `.next`, `.data` or `LLM.env`, so nothing needs to be left out, as long as you did not run `npm install` inside it.

   The `rsync` command was run against a scratch copy of a project on Linux. The Windows command was written carefully but **not run on Windows**. If it fails, copy the files with File Explorer instead (turn on "Hidden items" in the View menu so `.gitignore` and `.github` show), skip `node_modules`, `.next`, `.data` and `LLM.env`, then let the checker tell you what is still missing.

3. Settings files you changed yourself. These files are in the zip, and your own version may differ on purpose. The copy in step 2 replaced them, so if you want your changes back, restore your copy from the backup or from git and add the Cyphor parts by hand.

   | File | What it holds | If yours differs |
   | --- | --- | --- |
   | `package.json`, `package-lock.json` | The packages and the scripts | Take both from the zip, add back any packages of your own, then `npm install`. The checker lists the packages that are missing. |
   | `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `components.json` | Compiler and build settings | Take the zip's, so the type check and the build behave as tested. |
   | `.gitignore` | What git leaves out | Keep yours, but it must ignore `LLM.env`, `.env.llm`, `.env.local` and `.data`. The checker fails when it does not. |
   | `.env.example` | The names of the settings, never real values | Take the zip's. Put real values in `.env.local` or `LLM.env`, not here. |
   | `app/layout.tsx`, `app/globals.css` | The page shell (fonts, the theme script) and the design tokens | Take the zip's: the themes, the city and the colours depend on them. |

4. Install and check:

   ```bash
   cd /path/to/your-project
   npm install
   node docs/tools/verify-files.mjs      # every required file should be OK
   npx tsc --noEmit --incremental false  # prints nothing when it is fine
   npm run test:unit                     # the summary should say: pass 355 and fail 0
   npm run build                         # ends with the route list
   ```

   Then set up the database and sign-in as `README.md` says ("Start here"), and run `npm run dev`.

## 5. Copilot route

Use this when you want Copilot to do the copying, or when you have changes of your own in several files and want to decide file by file.

**Set up once**

1. Put this pack in your project (section 3). Open the project folder in VS Code.
2. Unzip `cyphor-chat.zip` outside the project (section 4, step 1) and add the unzipped folder to the workspace (`File > Add Folder to Workspace`, choose `cyphor-chat` inside it). Copilot reads the folders that are open in the workspace; it cannot see a folder that is not.
3. Open Copilot Chat and switch it to **Agent** mode. In Ask mode Copilot can only answer; it cannot change files, which is the commonest reason nothing happens.
4. Type `/` in the chat box. You should see the prompts that start with `cyphor-`. If you do not, `.github/prompts` is not in the project root.

**Then, in this order**

| What to run | What it does |
| --- | --- |
| `/cyphor-0-audit` | Changes nothing. Runs the checker and says what is left to do. |
| `/cyphor-1-apply` | Asks for the path of the unzipped `cyphor-chat` folder, copies every missing or different file with a terminal command, leaves your settings files alone and asks about them, runs `npm install` when needed, then runs the checker, the type check, the unit tests and the build. |
| `/cyphor-2-final-check` | Changes nothing. Runs every check again and prints a table of results. |
| `/cyphor-fix-file` | Restores one file from the reference when the checker still shows it as MISSING or DIFFERENT. |

After `/cyphor-1-apply`, run the checker yourself too. Do not trust a "done" you have not seen proven:

```bash
node docs/tools/verify-files.mjs
```

The prompts do nothing to a file that is already identical, so running one twice is safe.

Prompt files are a VS Code feature. In another editor, open the file in `.github/prompts/` and paste its text into the chat.

**Why Copilot skips changes, and what to do**

| What goes wrong | Why | What to do |
| --- | --- | --- |
| It explains what to change but nothing changes | Ask mode cannot edit files | Switch to **Agent** mode |
| It says "done" but files are unchanged | The edits were not kept or saved, or never made | Keep the edits, save, and run the checker. Believe the checker, not the message |
| Files look similar but are not the same | It rewrote them from a description, so parts were dropped or "improved" | Have it **copy** the reference file with a terminal command. The prompts say so |
| Only the first few files change | A long list in one request is too much for it to hold | Run `/cyphor-1-apply` again, then `/cyphor-fix-file` for strays |
| It cannot find the reference files | The unzipped folder is not open in the workspace | Add it to the workspace (step 2 above) |
| It ignores the project rules | `AGENTS.md` and `.github/copilot-instructions.md` are not in the project root | Check section 3 |

## 6. What the checker prints

```bash
node docs/tools/verify-files.mjs                          # the whole report
node docs/tools/verify-files.mjs --only router            # one group: foundation, server, router, interface, e2e, docs, preview, tooling
node docs/tools/verify-files.mjs --list missing           # only the paths that are missing
node docs/tools/verify-files.mjs --list different         # only the paths whose content differs
node docs/tools/verify-files.mjs --json                   # the same report as JSON
```

It only reads. It never opens `LLM.env` or any other `.env` file. Each file is compared by a SHA-256 fingerprint with line endings read as LF, so Windows and macOS copies of the same file match.

| Status | Meaning |
| --- | --- |
| OK | The file is there and its content is the same as the reference. |
| MISSING | The file is not there. |
| DIFFERENT | The file is there but its content is not the same. |
| REVIEW | A settings file (section 4, step 3) that differs. That is normal when you kept your own settings, and it does not make the check fail. |

The groups are `foundation` (settings and shared types), `server` (database, sign-in, the gate, the conversation API), `router` (providers, God Mode, thinking, the chat API), `interface` (screens, components, the city, themes, artifacts, and their unit tests), `e2e` (browser tests), and three optional ones: `docs`, `preview` (a single-file preview build) and `tooling` (design skills for Claude Code). The app runs without the optional ones.

## 7. If you used the first version of this pack

The first pack described an older app (no sign-in, a local SQLite file). Its files are stale, and Copilot would be misled by them. This pack does not overwrite them, so delete them once you are sure you did not change them (look at them in git first):

```bash
rm -f .github/prompts/cyphor-1-foundation.prompt.md .github/prompts/cyphor-2-server.prompt.md \
  .github/prompts/cyphor-3-router.prompt.md .github/prompts/cyphor-4-interface.prompt.md \
  .github/prompts/cyphor-5-tests.prompt.md .github/prompts/cyphor-6-final-check.prompt.md
rm -f docs/API.md docs/ARCHITECTURE.md docs/ENV-AND-SECURITY.md docs/FILE-MAP.md docs/README.md \
  docs/ROUTER-AND-GOD-MODE.md docs/TESTING.md docs/TROUBLESHOOTING.md docs/UI-AND-DESIGN.md
```

On Windows, delete the same files in File Explorer or with `Remove-Item`. The prompts `cyphor-0-audit` and `cyphor-fix-file`, the five files in `.github/instructions/`, `.github/copilot-instructions.md`, `AGENTS.md`, `docs/APPLY-GUIDE.md`, `docs/manifest.json` and `docs/tools/verify-files.mjs` keep their names and are replaced by the new ones.

**Your old chats.** The first version kept chats in the browser (and in a local SQLite file, which the new app does not read). The new app gives the browser copy to the first account that signs in on that browser at the same address: it moves the copy, so a second person on the same browser does not get it. From then on a copy of each chat is also kept in your Postgres database (`README.md`, "Good to know"). If you open the new app at another address (another port or domain), the browser copy is not there. In that case export a backup from the old app before you switch and import it in the new one. The backup format did not change (`version: 1`), but a backup from the first version was not tried here.

## 8. If something fails

| What you see | What it means | What to do |
| --- | --- | --- |
| `Node ... is too old` | The project needs >=22.18 | Install a newer Node, then `npm install` again |
| `package.json is missing N packages` | Your `package.json` does not list packages the app needs | Take the zip's `package.json` and `package-lock.json` (section 4, step 3), or add the packages the checker names, then `npm install` |
| `dependencies are not installed` | There is no `node_modules` folder | `npm install` in the project root |
| `.gitignore does not ignore ...` | A key file could be committed by accident | Add each name on its own line: `LLM.env`, `.env.llm`, `.env.local` |
| `middleware.ts exists next to proxy.ts` | Next.js 16 stops with "Both middleware file ... and proxy file ... are detected" when both exist | Move what you need from `middleware.ts` into `proxy.ts`, then remove `middleware.ts` |
| `src/app exists` or `pages/api exists` | A second source tree next to the project's | Cyphor keeps `app/`, `components/`, `lib/` and `db/` in the project root. Merge or remove the other one |
| `N of M Copilot and docs files are not in the project` | The hidden `.github` folder did not come along | Copy it with the terminal command in section 3 |
| `npx tsc` prints errors | Files are missing or different, or `npm install` has not run | Run the checker, copy what it lists, then run `npx tsc --noEmit --incremental false` again |
| `npm run build` prints the route list, then stops with `SecurityFatalError` | Next.js noticed that the installed version has known security advisories. The build itself worked | Run it again. Updating Next.js (`npm update next`) removes the cause; `README.md` ("Good to know") says why it was not done for you |
| The unit tests report fewer than 355 passes | Some test files or files they test are missing | Run the checker and copy what it lists |
| The app starts but sign-in or saving fails | Not a file problem: the database or the secret is not set up | `README.md`, "Start here" and "Make the Neon database"; `.env.example` lists every setting |

If a check still fails, run `/cyphor-fix-file` for the file named in the first error, or paste the first error into Copilot Chat together with `docs/ACCEPTANCE.md`.
