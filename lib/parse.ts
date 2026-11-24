import { kindFor, qualifies, titleFor, type PreviewKind } from "./artifact/detect"
import type { ArtifactType, Message } from "./types"

export interface ParsedArtifact {
  identifier: string
  type: ArtifactType
  language?: string
  title: string
  content: string
  complete: boolean
  /** True when the model wrote an ordinary fenced block and Cyphor turned it into an artifact. */
  promoted?: boolean
}

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string; complete: boolean }
  | { kind: "artifact"; artifact: ParsedArtifact }

// Some open models emit <think>; both spellings are treated the same.
const THINK_OPEN_RE = /^<think(?:ing)?>/
const THINK_CLOSE_RE = /<\/think(?:ing)?>/
const THINK_OPEN = "<thinking>"
const THINK_CLOSE = "</thinking>"
// The tag is <artifact>; <antArtifact> (what some models were trained on) is read the same way.
const ART_OPEN_RE = /^<(?:ant)?artifact[\s>]/i
const ART_OPEN_NAMES = ["<artifact", "<antartifact"]
const ART_CLOSE_RE = /<\/(?:ant)?artifact>/i

/** Cheap check before parsing: could this reply hold an artifact at all? */
export function mayHaveArtifacts(content: string): boolean {
  return content.includes("<artifact") || content.includes("<antArtifact") || content.includes("```") || content.includes("~~~")
}

/** A trailing "<", "<thi", "<artif" ... that may still become a tag. */
function isPartialTag(rest: string) {
  const r = rest.toLowerCase()
  return (r.length < THINK_OPEN.length && THINK_OPEN.startsWith(r)) || ART_OPEN_NAMES.some((n) => r.length <= n.length && n.startsWith(r))
}

function stripPartialClose(s: string, close: string) {
  for (let n = Math.min(close.length - 1, s.length); n > 0; n--) {
    if (s.toLowerCase().endsWith(close.slice(0, n).toLowerCase())) return s.slice(0, s.length - n)
  }
  return s
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))
  return m ? (m[1] ?? m[2] ?? "") : undefined
}

export function normalizeType(t: string | undefined): ArtifactType {
  const s = (t ?? "").toLowerCase()
  if (s.includes("html")) return "html"
  if (s.includes("svg")) return "svg"
  if (s.includes("mermaid")) return "mermaid"
  if (s.includes("react") || s.includes("jsx") || s.includes("tsx")) return "react"
  if (s.includes("markdown") || s === "md" || s.includes("document")) return "markdown"
  return "code"
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artifact"
  )
}

function cleanBody(body: string) {
  let b = body.replace(/^\r?\n/, "").replace(/\s+$/, "")
  const fenced = b.match(/^```[\w-]*\r?\n([\s\S]*?)\r?\n?```$/)
  if (fenced) b = fenced[1]
  return b
}

/**
 * Walks a text from front to back and says whether a position is inside an open fenced code block. The tag scanner
 * asks about positions in increasing order, so one pass over the fence lines serves every question; asking again
 * from the start of the text for each "<" made a long streamed web page quadratic.
 */
function fenceTracker(raw: string) {
  const marks: number[] = []
  const re = /^[ \t]*(?:```|~~~)/gm
  for (let m = re.exec(raw); m; m = re.exec(raw)) marks.push(m.index)
  let n = 0
  return (pos: number) => {
    while (n < marks.length && marks[n] < pos) n++
    return n % 2 === 1
  }
}

interface Fence {
  start: number
  end: number
  bodyStart: number
  bodyEnd: number
  lang: string
  complete: boolean
}

/** The fenced code blocks in a text, including a last one that is still open. */
function findFences(text: string): Fence[] {
  const out: Fence[] = []
  let open: { start: number; bodyStart: number; ch: string; len: number; lang: string } | null = null
  let pos = 0
  for (;;) {
    const nl = text.indexOf("\n", pos)
    const lineEnd = nl === -1 ? text.length : nl
    const line = text.slice(pos, lineEnd)
    if (!open) {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/.exec(line)
      // A backtick fence's info string may not contain a backtick (that would be inline code).
      if (m && !(m[1][0] === "`" && line.slice(m[0].length).includes("`"))) {
        open = { start: pos, bodyStart: nl === -1 ? text.length : nl + 1, ch: m[1][0], len: m[1].length, lang: m[2].toLowerCase() }
      }
    } else {
      const m = /^ {0,3}(`{3,}|~{3,})[ \t]*\r?$/.exec(line)
      if (m && m[1][0] === open.ch && m[1].length >= open.len) {
        out.push({ start: open.start, end: nl === -1 ? text.length : nl + 1, bodyStart: open.bodyStart, bodyEnd: pos, lang: open.lang, complete: true })
        open = null
      }
    }
    if (nl === -1) break
    pos = nl + 1
  }
  if (open) out.push({ start: open.start, end: text.length, bodyStart: Math.min(open.bodyStart, text.length), bodyEnd: text.length, lang: open.lang, complete: false })
  return out
}

/** The body of a fence without the line break before its closing fence, and without a half-typed closing fence. */
function fenceBody(text: string, f: Fence) {
  let body = text.slice(f.bodyStart, f.bodyEnd)
  if (f.complete) body = body.replace(/\r?\n$/, "")
  else body = body.replace(/(?:^|\n)[`~]{1,2}$/, "")
  return body
}

const PROMOTED_LANGUAGE: Record<PreviewKind, string | undefined> = { html: "html", react: "jsx", svg: "svg", mermaid: "mermaid" }

/**
 * Turns the qualifying fenced blocks in one stretch of text into artifacts. A promoted artifact's identifier comes
 * from its kind and its position in the reply (html-1, react-2 ...), never from its content, so it stays the same
 * while the title is still being worked out from text that has not arrived yet.
 */
function promoteFences(text: string, counts: Record<string, number>): Segment[] {
  if (!text.includes("```") && !text.includes("~~~")) return [{ kind: "text", text }]
  const out: Segment[] = []
  let cursor = 0
  for (const f of findFences(text)) {
    const body = fenceBody(text, f)
    const kind = kindFor(f.lang, body)
    if (!kind || !qualifies(kind, body)) continue
    if (f.start > cursor) out.push({ kind: "text", text: text.slice(cursor, f.start) })
    const n = (counts[kind] = (counts[kind] ?? 0) + 1)
    out.push({
      kind: "artifact",
      artifact: {
        identifier: `${kind}-${n}`,
        type: kind,
        language: PROMOTED_LANGUAGE[kind],
        title: titleFor(kind, body),
        content: body,
        complete: f.complete,
        promoted: true,
      },
    })
    cursor = f.end
  }
  if (cursor === 0) return [{ kind: "text", text }]
  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor) })
  return out
}

/** Splits an assistant message into text, thinking blocks and artifacts. Safe on partial streams. */
export function parseContent(raw: string): Segment[] {
  const out: Segment[] = []
  let buf = ""
  let i = 0
  const fenced = fenceTracker(raw)
  const flush = () => {
    if (buf) {
      out.push({ kind: "text", text: buf })
      buf = ""
    }
  }

  while (i < raw.length) {
    const lt = raw.indexOf("<", i)
    if (lt === -1) {
      buf += raw.slice(i)
      break
    }
    buf += raw.slice(i, lt)
    i = lt
    const rest = raw.slice(i)
    const inCode = fenced(i)

    const open = !inCode ? THINK_OPEN_RE.exec(rest) : null
    if (open) {
      flush()
      const after = rest.slice(open[0].length)
      const close = THINK_CLOSE_RE.exec(after)
      if (!close) {
        out.push({ kind: "thinking", text: stripPartialClose(after, THINK_CLOSE).trim(), complete: false })
        i = raw.length
      } else {
        out.push({ kind: "thinking", text: after.slice(0, close.index).trim(), complete: true })
        i += open[0].length + close.index + close[0].length
      }
      continue
    }

    if (!inCode && ART_OPEN_RE.test(rest)) {
      const gt = rest.indexOf(">")
      if (gt === -1) break // opening tag still streaming: hold it back
      flush()
      const tag = rest.slice(0, gt + 1)
      const bodyStart = gt + 1
      const closeAt = rest.slice(bodyStart).search(ART_CLOSE_RE)
      const end = closeAt === -1 ? -1 : bodyStart + closeAt
      const title = attr(tag, "title") ?? "Untitled"
      const language = attr(tag, "language")
      const complete = end !== -1
      const body = cleanBody(complete ? rest.slice(bodyStart, end) : stripPartialClose(rest.slice(bodyStart), "</artifact>"))
      let type = normalizeType(attr(tag, "type"))
      // A model that files a web page or component under type="code" still gets a preview.
      if (type === "code") {
        const kind = kindFor(language ?? "", body)
        if (kind && qualifies(kind, body)) type = kind
      }
      out.push({
        kind: "artifact",
        artifact: { identifier: attr(tag, "identifier") || slug(title), type, language, title, content: body, complete },
      })
      if (complete) i += end + (ART_CLOSE_RE.exec(rest.slice(end))?.[0].length ?? "</artifact>".length)
      else i = raw.length
      continue
    }

    if (!inCode && isPartialTag(rest)) break

    buf += "<"
    i += 1
  }
  flush()

  // Ordinary fenced pages, diagrams and components become artifacts too.
  if (!raw.includes("```") && !raw.includes("~~~")) return out
  const counts: Record<string, number> = {}
  const promoted: Segment[] = []
  for (const seg of out) {
    if (seg.kind === "text") promoted.push(...promoteFences(seg.text, counts))
    else promoted.push(seg)
  }
  return promoted
}

/** Text a person would copy: the visible prose, with artifacts named and thinking removed. */
export function plainText(raw: string) {
  return parseContent(raw)
    .map((s) => {
      if (s.kind === "text") return s.text
      if (s.kind === "artifact") return `[Artifact: ${s.artifact.title}]`
      return ""
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function stripThinking(raw: string) {
  return raw.replace(/<think(?:ing)?>[\s\S]*?(<\/think(?:ing)?>|$)/g, "").trim()
}

export interface ArtifactHistory {
  identifier: string
  title: string
  type: ArtifactType
  language?: string
  versions: { messageId: string; artifact: ParsedArtifact }[]
}

/** Groups artifacts across a thread by identifier; later messages become later versions. */
export function collectArtifacts(thread: Message[]): ArtifactHistory[] {
  const map = new Map<string, ArtifactHistory>()
  for (const m of thread) {
    if (m.role !== "assistant" || !mayHaveArtifacts(m.content)) continue
    for (const seg of parseContent(m.content)) {
      if (seg.kind !== "artifact") continue
      const a = seg.artifact
      const entry = map.get(a.identifier)
      if (entry) {
        entry.versions.push({ messageId: m.id, artifact: a })
        entry.title = a.title
        entry.type = a.type
        entry.language = a.language
      } else {
        map.set(a.identifier, {
          identifier: a.identifier,
          title: a.title,
          type: a.type,
          language: a.language,
          versions: [{ messageId: m.id, artifact: a }],
        })
      }
    }
  }
  return [...map.values()]
}

export function artifactExtension(type: ArtifactType, language?: string) {
  if (type === "html") return "html"
  if (type === "svg") return "svg"
  if (type === "markdown") return "md"
  if (type === "mermaid") return "mmd"
  if (type === "react") return /^tsx?$/i.test(language ?? "") ? "tsx" : "jsx"
  const map: Record<string, string> = {
    typescript: "ts", ts: "ts", tsx: "tsx", javascript: "js", js: "js", jsx: "jsx", python: "py", py: "py",
    json: "json", css: "css", bash: "sh", shell: "sh", sql: "sql", go: "go", rust: "rs", java: "java",
    c: "c", cpp: "cpp", yaml: "yml", yml: "yml",
  }
  return map[(language ?? "").toLowerCase()] ?? "txt"
}
