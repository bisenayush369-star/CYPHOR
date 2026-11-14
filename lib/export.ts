import { parseContent } from "./parse"
import { activeThread, type State } from "./store"
import type { Chat } from "./types"

function fenceFor(text: string) {
  return text.includes("```") ? "````" : "```"
}

export function chatToMarkdown(chat: Chat) {
  const out: string[] = [`# ${chat.title}`, "", `Exported from Cyphor on ${new Date().toLocaleString()}`, ""]
  for (const m of activeThread(chat)) {
    out.push(m.role === "user" ? "## You" : "## Cyphor", "")
    if (m.role === "user") {
      if (m.content) out.push(m.content, "")
      for (const a of m.attachments ?? []) out.push(`*Attachment: ${a.name}*`, "")
      continue
    }
    for (const seg of parseContent(m.content)) {
      if (seg.kind === "text") {
        const t = seg.text.trim()
        if (t) out.push(t, "")
      } else if (seg.kind === "artifact") {
        const a = seg.artifact
        const lang = a.type === "code" ? (a.language ?? "") : a.type === "html" ? "html" : a.type === "svg" ? "xml" : "markdown"
        const f = fenceFor(a.content)
        out.push(`### Artifact: ${a.title}`, "", `${f}${lang}`, a.content, f, "")
      }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n"
}

/** Image data is left out: it can be large and is not kept across reloads anyway. */
export function chatToJson(chat: Chat) {
  const nodes = Object.fromEntries(
    Object.entries(chat.nodes).map(([id, m]) => [
      id,
      m.attachments ? { ...m, attachments: m.attachments.map(({ dataUrl, ...rest }) => rest) } : m,
    ])
  )
  return JSON.stringify({ ...chat, nodes }, null, 2)
}

/** Everything the app stores, except the API key. */
export function exportAll(s: Pick<State, "settings" | "chats" | "projects">) {
  const { apiKey, ...settings } = s.settings
  void apiKey
  const chats = Object.fromEntries(
    Object.entries(s.chats)
      .filter(([, c]) => !c.incognito)
      .map(([id, c]) => [id, JSON.parse(chatToJson(c)) as Chat])
  )
  return JSON.stringify({ app: "cyphor-chat", version: 1, exportedAt: new Date().toISOString(), settings, chats, projects: s.projects }, null, 2)
}

export function fileSafe(name: string) {
  return (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "chat").slice(0, 60)
}
