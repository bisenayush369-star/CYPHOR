/**
 * The program that runs inside a React artifact's preview frame. It is bundled into public/artifact/runtime.js by
 * `npm run build:artifact-runtime` and is never imported by the app itself.
 *
 * It compiles the artifact's JSX / TypeScript in the browser (sucrase), gives it the few libraries a generated
 * component usually wants, mounts the default export, and reports anything that goes wrong to the page around it.
 */
import * as React from "react"
import * as ReactDOM from "react-dom"
import * as ReactDOMClient from "react-dom/client"
import * as JsxRuntime from "react/jsx-runtime"
import * as Lucide from "lucide-react"
import * as Recharts from "recharts"
import clsx from "clsx"
import { transform } from "sucrase"

type Report = (message: Record<string, unknown>) => void

/** Every module an artifact may import. Anything else is reported with this list, so the model can correct itself. */
const MODULES: Record<string, unknown> = {
  react: React,
  "react/jsx-runtime": JsxRuntime,
  "react-dom": ReactDOM,
  "react-dom/client": ReactDOMClient,
  "lucide-react": Lucide,
  recharts: Recharts,
  clsx: Object.assign(clsx, { default: clsx, clsx, __esModule: true }),
}
export const AVAILABLE = Object.keys(MODULES)

function compile(source: string): string {
  return transform(source, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "classic",
    production: true,
    disableESTransforms: true,
  }).code
}

/** A component name to fall back on when the file has no default export: `App`, else the last capitalised top-level name. */
function guessComponent(source: string): string | null {
  if (/^\s*(?:function|const|class)\s+App\b/m.test(source)) return "App"
  const names = [...source.matchAll(/^(?:function|const|class)\s+([A-Z][A-Za-z0-9_$]*)/gm)].map((m) => m[1])
  return names.length ? names[names.length - 1] : null
}

class Boundary extends React.Component<{ report: Report; children?: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    this.props.report({ type: "error", phase: "render", message: error.message, stack: String(error.stack ?? "").slice(0, 1500) })
  }
  render() {
    if (!this.state.error) return this.props.children
    return React.createElement(
      "pre",
      { style: { margin: 16, padding: 14, border: "1px solid #ff003c", background: "#1a0008", color: "#ffb3c4", font: "13px/1.5 ui-monospace,monospace", whiteSpace: "pre-wrap" } },
      "This component crashed while rendering:\n\n" + this.state.error.message
    )
  }
}

function fail(root: HTMLElement, report: Report, phase: string, e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  report({ type: "error", phase, message, stack: e instanceof Error ? String(e.stack ?? "").slice(0, 1500) : "" })
  root.innerHTML = ""
  const pre = document.createElement("pre")
  pre.setAttribute("style", "margin:16px;padding:14px;border:1px solid #ff003c;background:#1a0008;color:#ffb3c4;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap")
  pre.textContent = (phase === "compile" ? "This code could not be compiled:\n\n" : "This component could not start:\n\n") + message
  root.appendChild(pre)
}

export function run(source: string, root: HTMLElement, report: Report) {
  let code: string
  try {
    code = compile(source)
  } catch (e) {
    return fail(root, report, "compile", e)
  }
  const fallback = guessComponent(source)
  if (fallback) code += `\n;if(!exports.default&&typeof ${fallback}!=="undefined"){exports.default=${fallback}}`

  const module = { exports: {} as Record<string, unknown> }
  const require = (name: string) => {
    if (name in MODULES) return MODULES[name]
    throw new Error(`Cannot import "${name}". This preview can import: ${AVAILABLE.join(", ")}. Use only those, and write any other helper in the file itself.`)
  }
  try {
    new Function("require", "exports", "module", "React", code)(require, module.exports, module, React)
  } catch (e) {
    return fail(root, report, "run", e)
  }
  // A file that mounts itself (createRoot(...).render(...)) has already filled the page.
  if (root.childNodes.length) return
  const exp = module.exports
  const Component = (exp.default ?? Object.values(exp).find((v) => typeof v === "function")) as React.ComponentType | undefined
  if (!Component) return fail(root, report, "run", new Error("The file has no component to show. Export a React component as the default export."))
  ReactDOMClient.createRoot(root).render(React.createElement(Boundary, { report }, React.createElement(Component)))
}

;(window as unknown as { __cyphor: unknown }).__cyphor = { run, available: AVAILABLE }
