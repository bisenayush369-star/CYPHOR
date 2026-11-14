#!/usr/bin/env node
/**
 * verify-files.mjs: shows which files of the Cyphor reference project are in your folder, and which are not.
 *
 *   node docs/tools/verify-files.mjs                 check the current folder (run it in the project root)
 *   node docs/tools/verify-files.mjs ../my-project   check another folder
 *   node docs/tools/verify-files.mjs --only server   check one step (foundation, server, router, interface, e2e)
 *   node docs/tools/verify-files.mjs --list missing  print only the paths that are missing, one per line
 *   node docs/tools/verify-files.mjs --json          the same report as JSON (for scripts and for Copilot)
 *
 * It only reads. It changes nothing, and it never opens LLM.env or any other .env file (a .env.example is only
 * checked for being there, because people sometimes paste real keys into it).
 * Each file is compared by a SHA-256 hash of its content (line endings read as LF, so Windows checkouts match).
 * The reference list is docs/manifest.json. It needs Node 16 or newer and no packages.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const MAX_LISTED = 40

const HELP = `verify-files.mjs: compares a project folder with the Cyphor reference (docs/manifest.json)

Usage
  node docs/tools/verify-files.mjs [folder] [options]

  folder            the project root to check (the folder that holds package.json). Default: the current folder.

Options
  --only <names>    only these steps or paths. Steps: foundation, server, router, interface, e2e, docs, preview, tooling.
                    Paths: a file or a folder prefix such as lib/router/. Separate several with commas.
  --list <status>   print just the paths with this status, one per line: missing, different, review or ok.
  --json            print the whole report as JSON.
  --all             with --json, include files that are fine too.
  --manifest <file> use another manifest file.
  --help            show this text.

Statuses
  OK         the file is there and its content is the same as the reference. For .env.example it only means
             "the file is there": files whose name starts with .env are never opened.
  MISSING    the file is not there.
  DIFFERENT  the file is there but its content is not the same.
  REVIEW     a settings file (package.json, tsconfig.json, ...) that is different. That is normal when you kept
             your own settings, so look at it by hand. It does not make the check fail.

Exit code: 0 when every required file is OK (or REVIEW) and no check failed, 1 when something needs attention,
2 when the command itself was wrong.
`

// ---------------------------------------------------------------------------------------------- arguments

class UsageError extends Error {}

function fail(message) {
  throw new UsageError(message)
}

function parseArgs(argv) {
  const o = { target: null, manifest: join(HERE, "..", "manifest.json"), only: [], json: false, all: false, list: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i]
    let inline = null
    if (a.startsWith("--") && a.includes("=")) {
      inline = a.slice(a.indexOf("=") + 1)
      a = a.slice(0, a.indexOf("="))
    }
    const value = () => {
      const v = inline !== null ? inline : argv[++i]
      if (v === undefined || v === "") fail(`${a} needs a value`)
      return v
    }
    if (a === "--help" || a === "-h") o.help = true
    else if (a === "--json") o.json = true
    else if (a === "--all") o.all = true
    else if (a === "--manifest") o.manifest = resolve(value())
    else if (a === "--only") o.only.push(...value().split(",").map((s) => s.trim()).filter(Boolean))
    else if (a === "--list") {
      o.list = value().toLowerCase()
      if (!["missing", "different", "review", "ok"].includes(o.list)) fail(`--list takes missing, different, review or ok, not "${o.list}"`)
    } else if (a.startsWith("-")) fail(`unknown option ${a}`)
    else if (o.target === null) o.target = a
    else fail(`only one folder can be checked at a time (got "${o.target}" and "${a}")`)
  }
  o.target = resolve(o.target ?? process.cwd())
  return o
}

// ---------------------------------------------------------------------------------------------- helpers

/** SHA-256 of the content with CRLF read as LF, so a checkout with Windows line endings still matches. */
function hashLf(buf) {
  const text = buf.toString("latin1").replace(/\r\n/g, "\n")
  return createHash("sha256").update(Buffer.from(text, "latin1")).digest("hex")
}

function countLines(buf) {
  const text = buf.toString("latin1").replace(/\r\n/g, "\n")
  if (text === "") return 0
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0)
}

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

/** Reads ">=22.18" style requirements. Returns [major, minor] or null for anything else. */
function minNode(range) {
  const m = /^>=\s*(\d+)(?:\.(\d+))?/.exec(String(range || ""))
  return m ? [Number(m[1]), Number(m[2] || 0)] : null
}

function nodeIsAtLeast(min) {
  const [maj, mino] = process.versions.node.split(".").map(Number)
  return maj > min[0] || (maj === min[0] && mino >= min[1])
}

function globToRegExp(glob) {
  let re = ""
  for (const ch of glob) {
    if (ch === "*") re += "[^/]*"
    else if (ch === "?") re += "[^/]"
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`^${re}$`)
}

/** Is a file in the project root ignored by this .gitignore text? Handles the common patterns, not every git rule. */
function gitignored(text, name) {
  let ignored = false
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim()
    if (!line || line.startsWith("#")) continue
    let negate = false
    if (line.startsWith("!")) {
      negate = true
      line = line.slice(1)
    }
    if (line.endsWith("/")) continue // a folder pattern does not match a file
    line = line.replace(/^\/+/, "").replace(/^(\*\*\/)+/, "")
    if (line.includes("/")) continue // a pattern with a folder in it does not match a file in the root
    if (globToRegExp(line).test(name)) ignored = !negate
  }
  return ignored
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

// ---------------------------------------------------------------------------------------------- the file check

function checkFiles(root, files) {
  return files.map((f) => {
    const full = join(root, ...f.path.split("/"))
    if (basename(f.path).startsWith(".env")) {
      // Never open an env file, not even to hash it. Being there is all that is checked.
      let there = false
      try {
        there = statSync(full).isFile()
      } catch {
        there = false
      }
      return { ...f, status: there ? "ok" : "missing" }
    }
    let buf = null
    try {
      if (statSync(full).isFile()) buf = readFileSync(full)
    } catch {
      buf = null
    }
    if (buf === null) return { ...f, status: "missing" }
    if (hashLf(buf) === f.sha256) return { ...f, status: "ok" }
    return { ...f, status: f.merge ? "review" : "different", yourLines: countLines(buf) }
  })
}

function matchesOnly(file, only) {
  if (only.length === 0) return true
  return only.some((o) => o === file.step || o === file.path || (o.endsWith("/") ? file.path.startsWith(o) : file.path.startsWith(`${o}/`)))
}

// ---------------------------------------------------------------------------------------------- the other checks

function otherChecks(root, manifest) {
  const checks = []
  const add = (level, title, detail = "") => checks.push({ level, title, detail })

  // Node version
  const min = minNode(manifest.node)
  if (min) {
    if (nodeIsAtLeast(min)) add("ok", `Node ${process.versions.node}`, `the project needs ${manifest.node}`)
    else add("fail", `Node ${process.versions.node} is too old`, `the project needs ${manifest.node}. Install a newer Node, then run npm install again.`)
  }

  // package.json: dependencies and scripts
  const pkgPath = join(root, "package.json")
  if (!existsSync(pkgPath)) {
    add("fail", "package.json not found", "this does not look like a project root. Run the command in the folder that holds package.json.")
  } else {
    let pkg = null
    try {
      pkg = readJsonFile(pkgPath)
    } catch (e) {
      add("fail", "package.json is not valid JSON", String(e.message || e))
    }
    if (pkg) {
      const have = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      const want = { ...manifest.reference.dependencies, ...manifest.reference.devDependencies }
      const missing = Object.keys(want).filter((n) => !(n in have))
      const other = Object.keys(want).filter((n) => n in have && have[n] !== want[n])
      if (missing.length === 0) add("ok", `package.json lists all ${Object.keys(want).length} reference packages`)
      else add("warn", `package.json is missing ${plural(missing.length, "package")}`, missing.map((n) => `${n}@${want[n]}`).join(", "))
      if (other.length > 0) add("info", `${plural(other.length, "package")} with a different version range than the reference`, other.map((n) => `${n}: yours ${have[n]}, reference ${want[n]}`).join("; "))
      const scripts = Object.keys(manifest.reference.scripts).filter((n) => !(pkg.scripts && n in pkg.scripts))
      if (scripts.length === 0) add("ok", `package.json has all ${Object.keys(manifest.reference.scripts).length} reference scripts`)
      else add("warn", `package.json is missing ${plural(scripts.length, "script")}`, scripts.join(", "))
    }
  }

  // Installed Next.js
  const nextPkg = join(root, "node_modules", "next", "package.json")
  if (existsSync(nextPkg)) {
    let v = "?"
    try {
      v = readJsonFile(nextPkg).version
    } catch {
      /* leave the question mark */
    }
    add("ok", `Next.js ${v} is installed`, `the reference uses ${manifest.reference.dependencies.next}`)
  } else {
    add("warn", "dependencies are not installed", "run npm install in the project root")
  }

  // Keys must stay out of git
  const ignorePath = join(root, ".gitignore")
  const ignoreText = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : ""
  const unprotected = ["LLM.env", ".env.llm", ".env.local"].filter((n) => !gitignored(ignoreText, n))
  if (unprotected.length === 0) add("ok", ".gitignore keeps LLM.env, .env.llm and .env.local out of git")
  else add("fail", `.gitignore does not ignore ${unprotected.join(", ")}`, "add each name on its own line, so your keys can never be committed")
  if (existsSync(join(root, "LLM.env"))) add("info", "LLM.env is present", "its content was not read")
  else add("info", "LLM.env is not present", "without it the app answers with the built-in demo model. docs/ENV-AND-SECURITY.md says how to add your keys.")

  // Things from an older setup that can clash with this project
  const clash = (path, detail) => {
    if (existsSync(join(root, ...path.split("/")))) add("warn", `${path} exists`, detail)
  }
  for (const m of ["middleware.ts", "middleware.js", "middleware.mjs", "src/middleware.ts", "src/middleware.js"]) {
    if (existsSync(join(root, ...m.split("/")))) {
      add("warn", `${m} exists next to proxy.ts`, "this project uses proxy.ts, the Next.js 16 name for middleware. Keep one of them so the same checks do not run twice.")
    }
  }
  clash("src/app", "this project keeps app/ in the project root. Make sure you are not editing the wrong folder.")
  clash("pages/api", "routes here can clash with the same-named routes in app/api.")

  // Did the Copilot files land? (They sit in a hidden folder that file managers often skip.)
  if (manifest.pack && manifest.pack.length > 0) {
    const absent = manifest.pack.filter((p) => !existsSync(join(root, ...p.path.split("/"))))
    if (absent.length === 0) add("ok", `Copilot files are in place (${manifest.pack.length} files)`)
    else {
      const hidden = absent.some((p) => p.path.startsWith(".github/"))
      add(
        "warn",
        `${absent.length} of ${manifest.pack.length} Copilot and docs files are not in the project`,
        absent.slice(0, 6).map((p) => p.path).join(", ") + (absent.length > 6 ? ", ..." : "") +
          (hidden ? ". The .github folder is hidden on macOS and Linux: copy it with the terminal commands in docs/APPLY-GUIDE.md." : "")
      )
    }
  }
  return checks
}

// ---------------------------------------------------------------------------------------------- report

function buildReport(opts) {
  if (!existsSync(opts.manifest)) fail(`manifest not found: ${opts.manifest}`)
  let manifest
  try {
    manifest = readJsonFile(opts.manifest)
  } catch (e) {
    fail(`manifest is not valid JSON: ${e.message}`)
  }
  if (manifest.format !== 1) fail(`manifest format ${manifest.format} is not supported by this script`)
  if (!existsSync(opts.target) || !statSync(opts.target).isDirectory()) fail(`not a folder: ${opts.target}`)

  const known = new Set(manifest.steps.map((s) => s.id))
  for (const o of opts.only) {
    if (!known.has(o) && !manifest.files.some((f) => f.path === o || f.path.startsWith(o.endsWith("/") ? o : `${o}/`))) {
      fail(`--only "${o}" matches no step and no path. Steps: ${[...known].join(", ")}`)
    }
  }

  const results = checkFiles(opts.target, manifest.files.filter((f) => matchesOnly(f, opts.only)))
  const steps = manifest.steps.map((s) => {
    const mine = results.filter((r) => r.step === s.id)
    const req = mine.filter((r) => r.kind === "required")
    const optional = mine.filter((r) => r.kind === "optional")
    const tally = (list) => ({
      total: list.length,
      ok: list.filter((r) => r.status === "ok").length,
      missing: list.filter((r) => r.status === "missing").length,
      different: list.filter((r) => r.status === "different").length,
      review: list.filter((r) => r.status === "review").length,
    })
    return { ...s, required: tally(req), optional: tally(optional) }
  })
  const checks = otherChecks(opts.target, manifest)

  const needs = results.filter((r) => r.kind === "required" && (r.status === "missing" || r.status === "different"))
  const failedChecks = checks.filter((c) => c.level === "fail")
  return { manifest, results, steps, checks, needs, failedChecks, ok: needs.length === 0 && failedChecks.length === 0 }
}

function cell(t, w) {
  return String(t).padEnd(w)
}

function tallyText(t) {
  if (t.total === 0) return "-"
  const bad = t.missing + t.different
  const parts = [`${t.ok}/${t.total} OK`]
  if (t.missing) parts.push(`${t.missing} missing`)
  if (t.different) parts.push(`${t.different} different`)
  if (t.review) parts.push(`${t.review} to review`)
  return bad === 0 && t.review === 0 ? parts[0] : parts.join(", ")
}

function printList(title, items, fmt) {
  if (items.length === 0) return
  process.stdout.write(`\n${title} (${items.length})\n`)
  for (const r of items.slice(0, MAX_LISTED)) process.stdout.write(`  ${fmt(r)}\n`)
  if (items.length > MAX_LISTED) process.stdout.write(`  ... and ${items.length - MAX_LISTED} more. Use --list to see every path.\n`)
}

function printReport(opts, rep) {
  const { manifest, results, steps, checks } = rep
  const out = (s = "") => process.stdout.write(`${s}\n`)
  out("Cyphor file check")
  out(`  Folder     ${opts.target}`)
  out(`  Reference  ${manifest.name}, ${plural(manifest.files.length, "file")} in docs/manifest.json`)
  if (opts.only.length) out(`  Only       ${opts.only.join(", ")}`)
  out()
  const w = Math.max(...steps.map((s) => (s.number ? `${s.number} ${s.id}` : s.id).length)) + 2
  const w2 = Math.max(14, ...steps.map((s) => tallyText(s.required).length)) + 2
  out(`${cell("Step", w)}${cell("Required files", w2)}Optional files`)
  for (const s of steps) {
    if (s.required.total + s.optional.total === 0) continue
    const label = s.number ? `${s.number} ${s.id}` : s.id
    out(`${cell(label, w)}${cell(tallyText(s.required), w2)}${tallyText(s.optional)}`)
  }

  const stepOf = (r) => {
    const s = steps.find((x) => x.id === r.step)
    return s && s.number ? `step ${s.number} ${s.id}` : r.step
  }
  const missingRequired = results.filter((r) => r.kind === "required" && r.status === "missing")
  const differentRequired = results.filter((r) => r.kind === "required" && r.status === "different")
  const review = results.filter((r) => r.status === "review")
  const optionalProblems = results.filter((r) => r.kind === "optional" && (r.status === "missing" || r.status === "different"))
  const pad = Math.min(54, Math.max(10, ...results.filter((r) => r.status !== "ok").map((r) => r.path.length)) + 2)

  printList("MISSING, required", missingRequired, (r) => `${cell(r.path, pad)}${stepOf(r)}`)
  printList("DIFFERENT, required", differentRequired, (r) => `${cell(r.path, pad)}${cell(stepOf(r), 22)}yours ${r.yourLines} lines, reference ${r.lines}`)
  printList("REVIEW, settings files that differ (normal if you kept your own settings)", review, (r) => `${cell(r.path, pad)}yours ${r.yourLines} lines, reference ${r.lines}`)
  if (optionalProblems.length) {
    const byStep = {}
    for (const r of optionalProblems) byStep[r.step] = (byStep[r.step] || 0) + 1
    out(`\nOptional files not in place: ${Object.entries(byStep).map(([k, v]) => `${v} in ${k}`).join(", ")}. The app runs without them. Use --only <step> to see which.`)
  }

  out("\nChecks")
  const tag = { ok: "[ok]  ", info: "[info]", warn: "[WARN]", fail: "[FAIL]" }
  for (const c of checks) out(`  ${tag[c.level]} ${c.title}${c.detail ? `: ${c.detail}` : ""}`)

  out()
  if (rep.ok) {
    out(review.length ? `Result: every required file is in place. ${plural(review.length, "settings file")} differ, so look at ${review.length === 1 ? "it" : "them"} by hand.` : "Result: every required file is in place and matches the reference.")
  } else {
    const first = steps.find((s) => s.number && (s.required.missing > 0 || s.required.different > 0))
    const parts = []
    if (rep.needs.length) parts.push(`${plural(rep.needs.length, "required file")} need attention`)
    if (rep.failedChecks.length) parts.push(`${plural(rep.failedChecks.length, "check")} failed`)
    out(`Result: ${parts.join(" and ")}.`)
    if (first && first.prompt) out(`Start with step ${first.number} (${first.title}): in Copilot Chat run /${first.prompt}, or copy those files from the reference folder.`)
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write(HELP)
    return
  }
  const rep = buildReport(opts)

  if (opts.list) {
    for (const r of rep.results.filter((x) => x.status === opts.list)) process.stdout.write(`${r.path}\n`)
    return
  }
  if (opts.json) {
    const files = rep.results.filter((r) => opts.all || r.status !== "ok").map((r) => ({
      path: r.path, status: r.status, step: r.step, kind: r.kind, referenceLines: r.lines, yourLines: r.yourLines ?? null,
    }))
    const doc = {
      ok: rep.ok,
      folder: opts.target,
      node: process.versions.node,
      steps: rep.steps.map((s) => ({ id: s.id, number: s.number, title: s.title, prompt: s.prompt, required: s.required, optional: s.optional })),
      files,
      checks: rep.checks,
    }
    process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`)
  } else {
    printReport(opts, rep)
  }
  process.exitCode = rep.ok ? 0 : 1
}

try {
  main()
} catch (e) {
  if (!(e instanceof UsageError)) throw e
  process.stderr.write(`verify-files: ${e.message}\nRun with --help for usage.\n`)
  process.exitCode = 2
}
