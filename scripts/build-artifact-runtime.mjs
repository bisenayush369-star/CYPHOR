/**
 * Builds public/artifact/runtime.js: React, ReactDOM, a JSX/TypeScript compiler (sucrase), lucide-react, recharts and
 * clsx in one file, for the preview frame of a React artifact. The built file is committed, so the app runs without
 * this step; run it again only after changing scripts/artifact-runtime/entry.ts or upgrading one of those packages.
 *
 *   npm run build:artifact-runtime
 */
import { build } from "esbuild"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const out = resolve(root, "public/artifact/runtime.js")
mkdirSync(dirname(out), { recursive: true })

await build({
  absWorkingDir: root,
  entryPoints: ["scripts/artifact-runtime/entry.ts"],
  outfile: out,
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  logLevel: "warning",
})

const bytes = readFileSync(out)
console.log(`public/artifact/runtime.js  ${(statSync(out).size / 1024).toFixed(0)} KB  sha256 ${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}…`)
