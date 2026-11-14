/**
 * Lets `node --test` load the app's TypeScript the way Next.js does: `@/lib/x` aliases, imports
 * without a file extension, and `next/server`, which Next.js ships as a plain file that Node wants
 * spelled `next/server.js`. Node strips the types itself (Node 22.18 or newer), so nothing is compiled.
 *
 *   node --import ./tests/unit/register.mjs --test tests/unit/*.test.ts
 */
import { existsSync, statSync } from "node:fs"
import { registerHooks } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"]
const KNOWN = /\.(?:[cm]?[jt]sx?|json|node|wasm)$/

const isFile = (p) => existsSync(p) && statSync(p).isFile()

function find(path) {
  if (isFile(path)) return path
  for (const ext of EXTENSIONS) if (isFile(path + ext)) return path + ext
  for (const ext of EXTENSIONS) if (isFile(resolve(path, `index${ext}`))) return resolve(path, `index${ext}`)
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let found = null
    if (specifier.startsWith("@/")) {
      found = find(resolve(root, specifier.slice(2)))
    } else if (/^next\/[a-z-]+$/.test(specifier)) {
      found = find(resolve(root, "node_modules", specifier)) // only the one-segment entry points the app imports, such as next/server
    } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:") && !KNOWN.test(specifier)) {
      found = find(resolve(dirname(fileURLToPath(context.parentURL)), specifier))
    }
    return found ? { url: pathToFileURL(found).href, shortCircuit: true } : nextResolve(specifier, context)
  },
})
