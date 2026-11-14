#!/usr/bin/env node
/**
 * Writes file-tree.txt: where every file of the app lives, how the files depend on each other, and which
 * files each route pulls in. Nothing is installed or run; the files are only read.
 *
 *   node scripts/file-tree.mjs                       writes file-tree.txt next to package.json
 *   node scripts/file-tree.mjs --print               prints it instead of writing it
 *   node scripts/file-tree.mjs --check reference.txt says which files of a reference tree are missing here
 *   node scripts/file-tree.mjs --stats               prints how big each route's tree is, and writes nothing
 *   node scripts/file-tree.mjs --edges               prints every import as "from -> to", and writes nothing
 *
 * What counts as an import: `import ... from`, `import "x"`, `export ... from` and `import("x")`, when the
 * path starts with `@/` or `.` and points at a .ts or .tsx file of this project (type imports too).
 * Styles, images and packages from node_modules are not files of the project, so they are left out.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const FOLDERS = ["app", "components", "db", "lib"]
const ROOT_FILES = ["proxy.ts", "middleware.ts", "instrumentation.ts"]
const CODE = /\.(?:ts|tsx)$/
const RESOLVE = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
/** Files Next.js wraps around a page, from the top folder down to the page's own. */
const WRAPPERS = ["layout", "template"]

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const flagValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

/* ------------------------------------------------------------------ */
/* Finding the files                                                   */
/* ------------------------------------------------------------------ */

const posix = (p) => p.split(sep).join("/")
/** Plain character order, so the lists come out the same on every computer. */
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`
    const stat = statSync(join(root, rel))
    if (stat.isDirectory()) walk(rel, out)
    else if (CODE.test(name)) out.push(rel)
  }
  return out
}

const files = [...FOLDERS.filter((f) => existsSync(join(root, f))).flatMap((f) => walk(f)), ...ROOT_FILES.filter((f) => existsSync(join(root, f)))].sort(byText)
const known = new Set(files)

/* ------------------------------------------------------------------ */
/* Reading the imports                                                  */
/* ------------------------------------------------------------------ */

/** Replaces comments with spaces, so an import written inside a comment is not counted. Strings are kept. */
function withoutComments(src) {
  let out = ""
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    const next = src[i + 1]
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++
    } else if (c === "/" && next === "*") {
      i += 2
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++
      i += 2
      out += " "
    } else if (c === '"' || c === "'" || c === "`") {
      // Copy the whole string, so a "//" inside a URL is not taken for a comment.
      const quote = c
      out += c
      i++
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") {
          out += src[i]
          i++
        }
        out += src[i] ?? ""
        i++
      }
      out += quote
      i++
    } else {
      out += c
      i++
    }
  }
  return out
}

const IMPORT_PATTERNS = [
  /\bimport\s+(?:type\s+)?(?:[\w$*{}\s,]+?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
]

function resolveSpecifier(from, spec) {
  let base
  if (spec.startsWith("@/")) base = spec.slice(2)
  else if (spec.startsWith(".")) base = posix(relative(root, resolve(join(root, dirname(from)), spec)))
  else return null
  for (const ext of RESOLVE) if (known.has(base + ext)) return base + ext
  return undefined
}

/** For each file: the project files it imports, each once, in the order they first appear in the file. */
const imports = new Map()
const unresolved = []
for (const file of files) {
  const src = withoutComments(readFileSync(join(root, file), "utf8"))
  const found = []
  for (const re of IMPORT_PATTERNS) for (const m of src.matchAll(re)) found.push({ at: m.index ?? 0, spec: m[1] })
  found.sort((a, b) => a.at - b.at)
  const list = []
  for (const { spec } of found) {
    const target = resolveSpecifier(file, spec)
    if (target === null) continue
    if (target === undefined) {
      // A file that is not code (a stylesheet, an image) is fine. A missing code file is worth knowing about.
      if (!/\.(?:css|svg|png|jpe?g|json|woff2?)$/.test(spec)) unresolved.push(`${file} imports "${spec}", which is not a file of the project`)
      continue
    }
    if (target !== file && !list.includes(target)) list.push(target)
  }
  imports.set(file, list)
}

const usedBy = new Map(files.map((f) => [f, new Set()]))
for (const [file, list] of imports) for (const target of list) usedBy.get(target).add(file)
const label = (f) => `[imports ${imports.get(f).length}, used by ${usedBy.get(f).size}]`

/* ------------------------------------------------------------------ */
/* Routes                                                               */
/* ------------------------------------------------------------------ */

function routeOf(file) {
  const parts = file.split("/").slice(1, -1).filter((p) => !/^\(.*\)$/.test(p) && !p.startsWith("@"))
  return `/${parts.join("/")}`
}

const routes = files
  .filter((f) => f.startsWith("app/") && /^(?:page|route)\.tsx?$/.test(f.split("/").pop()))
  .map((file) => {
    const api = /^route\./.test(file.split("/").pop())
    const folders = file.split("/").slice(0, -1)
    const wrappers = []
    if (!api) {
      for (let i = 1; i <= folders.length; i++) {
        for (const w of WRAPPERS) {
          for (const ext of [".tsx", ".ts"]) {
            const candidate = `${folders.slice(0, i).join("/")}/${w}${ext}`
            if (known.has(candidate)) wrappers.push(candidate)
          }
        }
      }
    }
    return { path: routeOf(file), api, entries: [...wrappers, file] }
  })
  .sort((a, b) => byText(a.path, b.path))

/** How many files a route pulls in, counting each once. */
function reach(entries) {
  const seen = new Set()
  const visit = (f) => {
    if (seen.has(f)) return
    seen.add(f)
    for (const t of imports.get(f)) visit(t)
  }
  entries.forEach(visit)
  return seen
}

/** How many lines the route's tree has when nothing is left out. Counted without building it. */
function treeSize(entries) {
  const memo = new Map()
  const size = (f, chain) => {
    if (chain.has(f)) return 1
    if (memo.has(f)) return memo.get(f)
    chain.add(f)
    let n = 1
    for (const t of imports.get(f)) n += size(t, chain)
    chain.delete(f)
    memo.set(f, n)
    return n
  }
  return entries.reduce((sum, f) => sum + size(f, new Set()), 0)
}

/* ------------------------------------------------------------------ */
/* Drawing                                                              */
/* ------------------------------------------------------------------ */

function folderTree() {
  const tree = {}
  for (const file of files) {
    let node = tree
    const parts = file.split("/")
    for (const part of parts.slice(0, -1)) node = node[part + "/"] ??= {}
    node[parts.at(-1)] = file
  }
  const lines = []
  const walkTree = (node, prefix) => {
    // Folders first, then files, each in order.
    const names = Object.keys(node).sort((a, b) => {
      const da = a.endsWith("/")
      const db = b.endsWith("/")
      return da !== db ? (da ? -1 : 1) : byText(a, b)
    })
    names.forEach((name, i) => {
      const last = i === names.length - 1
      const branch = `${prefix}${last ? "└─ " : "├─ "}`
      if (name.endsWith("/")) {
        lines.push({ text: `${branch}${name}` })
        walkTree(node[name], prefix + (last ? "   " : "│  "))
      } else {
        lines.push({ text: `${branch}${name}`, file: node[name] })
      }
    })
  }
  walkTree(tree, "")
  // One column for every [imports, used by] note, two spaces after the longest line.
  const column = Math.max(...lines.filter((l) => l.file).map((l) => l.text.length)) + 2
  return lines.map((l) => (l.file ? `${l.text.padEnd(column)}${label(l.file)}` : l.text))
}

function routeTree(entries) {
  const lines = []
  const draw = (file, prefix, last, chain) => {
    const circular = chain.has(file)
    lines.push(`${prefix}${last ? "└─ " : "├─ "}${file}  ${label(file)}${circular ? "  (already above)" : ""}`)
    if (circular) return
    chain.add(file)
    const children = imports.get(file)
    children.forEach((child, i) => draw(child, prefix + (last ? "   " : "│  "), i === children.length - 1, chain))
    chain.delete(file)
  }
  entries.forEach((file, i) => draw(file, "", i === entries.length - 1, new Set()))
  return lines
}

const top = (counts) =>
  [...counts]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || byText(a[0], b[0]))
    .slice(0, 10)
    .map(([file, n]) => `${String(n).padStart(4)}  ${file}`)

function build() {
  const out = []
  out.push("HOW TO READ: [imports 3, used by 9] means this file imports 3 other project files, and 9 project files import it.", "")
  out.push("FILE LOCATIONS (folder tree)", "", ...folderTree(), "")
  out.push("ROUTES (each route and every file it pulls in)", "")
  for (const r of routes) {
    const n = reach(r.entries).size
    out.push(`${r.path}  ${r.api ? "(API)  " : ""}uses ${n} file${n === 1 ? "" : "s"}`, ...routeTree(r.entries), "")
  }
  out.push("MOST USED FILES (imported by the most files)", "", ...top(files.map((f) => [f, usedBy.get(f).size])), "")
  out.push("FILES THAT IMPORT THE MOST", "", ...top(files.map((f) => [f, imports.get(f).length])))
  return out.join("\n") + "\n"
}

/* ------------------------------------------------------------------ */
/* What to do                                                           */
/* ------------------------------------------------------------------ */

if (flag("--stats")) {
  for (const r of routes) console.log(`${r.path.padEnd(28)} ${String(reach(r.entries).size).padStart(4)} files   ${String(treeSize(r.entries)).padStart(9)} lines when nothing is left out`)
  process.exit(0)
}

if (flag("--edges")) {
  for (const [file, list] of imports) for (const target of list) console.log(`${file} -> ${target}`)
  process.exit(0)
}

if (flag("--check")) {
  const reference = flagValue("--check")
  if (!reference || !existsSync(reference)) {
    console.error("Say which file to compare with: node scripts/file-tree.mjs --check path/to/file-tree.txt")
    process.exit(2)
  }
  // The folder tree of the reference, read back into paths.
  const wanted = []
  const stack = []
  const section = readFileSync(reference, "utf8").split("\n")
  const start = section.findIndex((l) => l.startsWith("FILE LOCATIONS"))
  const end = section.findIndex((l) => l.startsWith("ROUTES"))
  for (const line of section.slice(start + 1, end)) {
    const m = /^((?:│  |   )*)(?:├─|└─) (\S+?)(\/)?(?:\s+\[imports.*)?$/.exec(line)
    if (!m) continue
    const depth = m[1].length / 3
    stack.length = depth
    if (m[3]) stack[depth] = m[2]
    else wanted.push([...stack, m[2]].join("/"))
  }
  const missing = wanted.filter((f) => !known.has(f))
  console.log(`${wanted.length} files in the reference, ${files.length} here.`)
  if (missing.length) {
    console.log(`Missing here (${missing.length}):\n  ${missing.join("\n  ")}`)
    process.exit(1)
  }
  console.log("Every file of the reference is here too.")
  process.exit(0)
}

const text = build()
if (unresolved.length) console.error(`Imports that point at nothing:\n  ${unresolved.join("\n  ")}`)
if (flag("--print")) process.stdout.write(text)
else {
  writeFileSync(join(root, "file-tree.txt"), text)
  console.log(`Wrote file-tree.txt: ${files.length} files, ${routes.length} routes, ${text.split("\n").length - 1} lines.`)
}
