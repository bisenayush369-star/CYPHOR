import type { ArtifactType, Message } from "./types"

export interface ParsedArtifact {
  identifier: string
  type: ArtifactType
  language?: string
  title: string
  content: string
  complete: boolean
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
const ART_OPEN = "<artifact"
const ART_CLOSE = "</artifact>"

/** True when `before` ends inside an unclosed fenced code block. */
function inFence(before: string) {
  const m = before.match(/^[ \t]*(?:```|~~~)/gm)
  return !!m && m.length % 2 === 1
}

/** A trailing "<", "<thi", "<artif" ... that may still become a tag. */
function isPartialTag(rest: string) {
  return (
    (rest.length < THINK_OPEN.length && THINK_OPEN.startsWith(rest)) ||
    (rest.length < ART_OPEN.length && ART_OPEN.startsWith(rest))
  )
}

function stripPartialClose(s: string, close: string) {
  for (let n = Math.min(close.length - 1, s.length); n > 0; n--) {
    if (s.endsWith(close.slice(0, n))) return s.slice(0, s.length - n)
  }
  return s
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))
  return m ? (m[1] ?? m[2] ?? "") : undefined
}

function normalizeType(t: string | undefined): ArtifactType {
  const s = (t ?? "").toLowerCase()
  if (s.includes("html")) return "html"
  if (s.includes("svg")) return "svg"
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

/** Splits an assistant message into text, thinking blocks and artifacts. Safe on partial streams. */
export function parseContent(raw: string): Segment[] {
  const out: Segment[] = []
  let buf = ""
  let i = 0
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
    const fenced = inFence(raw.slice(0, i))

    const open = !fenced ? THINK_OPEN_RE.exec(rest) : null
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

    if (!fenced && /^<artifact[\s>]/.test(rest)) {
      const gt = rest.indexOf(">")
      if (gt === -1) break // opening tag still streaming: hold it back
      flush()
      const tag = rest.slice(0, gt + 1)
      const bodyStart = gt + 1
      const end = rest.indexOf(ART_CLOSE, bodyStart)
      const title = attr(tag, "title") ?? "Untitled"
      const language = attr(tag, "language")
      const complete = end !== -1
      const body = complete ? rest.slice(bodyStart, end) : stripPartialClose(rest.slice(bodyStart), ART_CLOSE)
      out.push({
        kind: "artifact",
        artifact: {
          identifier: attr(tag, "identifier") || slug(title),
          type: normalizeType(attr(tag, "type")),
          language,
          title,
          content: cleanBody(body),
          complete,
        },
      })
      if (complete) i += end + ART_CLOSE.length
      else i = raw.length
      continue
    }

    if (!fenced && isPartialTag(rest)) break

    buf += "<"
    i += 1
  }
  flush()
  return out
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
    if (m.role !== "assistant" || !m.content.includes("<artifact")) continue
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
  const map: Record<string, string> = {
    typescript: "ts", ts: "ts", tsx: "tsx", javascript: "js", js: "js", jsx: "jsx", python: "py", py: "py",
    json: "json", css: "css", bash: "sh", shell: "sh", sql: "sql", go: "go", rust: "rs", java: "java",
    c: "c", cpp: "cpp", yaml: "yml", yml: "yml",
  }
  return map[(language ?? "").toLowerCase()] ?? "txt"
}
