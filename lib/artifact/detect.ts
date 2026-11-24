/**
 * Which fenced code blocks in a reply are really pages, diagrams or components that deserve a preview.
 *
 * Most models never learn a custom <artifact> tag, but nearly all of them put a web page in a ```html fence. Treating
 * those fences as artifacts means the person gets a card, a live preview and a one-click copy whichever model answers.
 *
 * One rule shapes everything here: a block that qualifies while it is still streaming must still qualify when it is
 * complete. Every test below only becomes true as more text arrives, never false, so a card never flips back into a
 * plain code block half way through a reply.
 */

export type PreviewKind = "html" | "react" | "svg" | "mermaid"

const LANG_KIND: Record<string, PreviewKind> = {
  html: "html",
  htm: "html",
  xhtml: "html",
  svg: "svg",
  mermaid: "mermaid",
  mmd: "mermaid",
  jsx: "react",
  tsx: "react",
  react: "react",
}
const JS_LANGS = new Set(["js", "javascript", "mjs"])

const REACT_IMPORT = /\bfrom\s+["']react["']/
const DOCUMENT_MARK = /<!doctype\s+html|<html[\s>]|<body[\s>]/i
const MERMAID_START =
  /^\s*(?:---[\s\S]*?---\s*)?(?:%%\{[\s\S]*?\}%%\s*)?(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey(?:-beta)?|xychart(?:-beta)?|block(?:-beta)?|packet(?:-beta)?|architecture(?:-beta)?|kanban|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|radar(?:-beta)?|treemap(?:-beta)?)\b/

/** The preview kind a fence language points at, or null when it is ordinary code. */
export function kindFor(lang: string, body: string): PreviewKind | null {
  const l = lang.toLowerCase()
  const direct = LANG_KIND[l]
  if (direct) return direct
  if (JS_LANGS.has(l) && REACT_IMPORT.test(body)) return "react"
  return null
}

/** True when a block of this kind is big enough, and clearly enough a whole thing, to be an artifact. */
export function qualifies(kind: PreviewKind, body: string): boolean {
  switch (kind) {
    case "html":
      if (DOCUMENT_MARK.test(body)) return true
      if (body.length >= 400) return true
      return body.length >= 200 && /<(?:script|style)[\s>]/i.test(body)
    case "svg":
      return body.length >= 80 && /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(body)
    case "mermaid":
      return MERMAID_START.test(body)
    case "react":
      if (body.length < 100) return false
      if (REACT_IMPORT.test(body)) return true
      return (/\bexport\s+default\b/.test(body) || /\b(?:function|const)\s+App\b/.test(body)) && /<[A-Za-z][\w.]*[\s/>]/.test(body)
  }
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function clip(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s
}

/** "TodoListApp" becomes "Todo list app". */
export function humanize(name: string): string {
  const words = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
  if (!words[0]) return name
  return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase())).join(" ")
}

const MERMAID_TITLES: [RegExp, string][] = [
  [/^(?:graph|flowchart)\b/, "Flowchart"],
  [/^sequenceDiagram\b/, "Sequence diagram"],
  [/^classDiagram\b/, "Class diagram"],
  [/^stateDiagram/, "State diagram"],
  [/^erDiagram\b/, "Entity diagram"],
  [/^journey\b/, "User journey"],
  [/^gantt\b/, "Gantt chart"],
  [/^pie\b/, "Pie chart"],
  [/^quadrantChart\b/, "Quadrant chart"],
  [/^requirementDiagram\b/, "Requirement diagram"],
  [/^gitGraph\b/, "Git graph"],
  [/^mindmap\b/, "Mind map"],
  [/^timeline\b/, "Timeline"],
  [/^sankey/, "Sankey diagram"],
  [/^xychart/, "Chart"],
  [/^block/, "Block diagram"],
  [/^architecture/, "Architecture diagram"],
  [/^kanban\b/, "Kanban board"],
  [/^C4/, "C4 diagram"],
]

/** A name for the card, taken from the content itself. It may improve as more text streams in; the identifier never does. */
export function titleFor(kind: PreviewKind, body: string): string {
  switch (kind) {
    case "html": {
      const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1]
      if (t && decode(t)) return clip(decode(t))
      const h = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(body)?.[1]
      if (h && decode(h)) return clip(decode(h))
      return "Web page"
    }
    case "svg": {
      const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1]
      return t && decode(t) ? clip(decode(t)) : "SVG image"
    }
    case "mermaid": {
      const front = /^\s*---\s*\n[\s\S]*?\btitle:\s*(.+)\n[\s\S]*?---/.exec(body)?.[1]
      if (front && front.trim()) return clip(front.trim().replace(/^["']|["']$/g, ""))
      const first = body
        .replace(/^\s*---[\s\S]*?---\s*/, "")
        .replace(/^\s*%%\{[\s\S]*?\}%%\s*/, "")
        .trimStart()
      for (const [re, name] of MERMAID_TITLES) if (re.test(first)) return name
      return "Diagram"
    }
    case "react": {
      const name =
        /export\s+default\s+(?:async\s+)?function\s+([A-Z]\w*)/.exec(body)?.[1] ??
        /export\s+default\s+class\s+([A-Z]\w*)/.exec(body)?.[1] ??
        /export\s+default\s+([A-Z]\w*)\s*;?\s*$/m.exec(body)?.[1]
      if (name && name !== "App") return clip(humanize(name))
      return "React app"
    }
  }
}
