import type { Attachment, Chat, Message, Project } from "./types"

/**
 * Reads a backup file and returns only data that is safe to put in the store.
 * Anything malformed is repaired or dropped, so a damaged or hand-edited file can't break the app later.
 * Image data and incognito chats never come back from a backup.
 */

type Raw = Record<string, unknown>

const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback)
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback)
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])
/** Keys that would change an object's prototype if used as a property name. */
const unsafeKey = (k: string) => k === "__proto__" || k === "constructor" || k === "prototype"
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

function cleanAttachment(raw: unknown): Attachment | null {
  if (!isObj(raw)) return null
  const id = str(raw.id)
  const name = str(raw.name)
  if (!id || !name) return null
  const kind = raw.kind === "image" || raw.kind === "text" || raw.kind === "file" ? raw.kind : "file"
  const out: Attachment = { id, name, kind, mime: str(raw.mime), size: num(raw.size, 0) }
  if (typeof raw.text === "string") out.text = raw.text
  if (raw.unsupported === true) out.unsupported = true
  return out
}

function cleanMessage(id: string, raw: Raw, now: number): Message | null {
  if (raw.role !== "user" && raw.role !== "assistant") return null
  const msg: Message = {
    id,
    parentId: typeof raw.parentId === "string" ? raw.parentId : null,
    role: raw.role,
    content: str(raw.content),
    createdAt: num(raw.createdAt, now),
    childIds: [],
    activeChildId: null,
  }
  if (typeof raw.model === "string") msg.model = raw.model
  // A reply that was still streaming when the backup was made can't be resumed.
  if (raw.status === "done" || raw.status === "error") msg.status = raw.status
  else if (raw.status === "streaming" || raw.status === "stopped") msg.status = "stopped"
  if (typeof raw.error === "string") msg.error = raw.error
  if (raw.feedback === "up" || raw.feedback === "down") msg.feedback = raw.feedback
  if (typeof raw.thinkingMs === "number" && Number.isFinite(raw.thinkingMs)) msg.thinkingMs = raw.thinkingMs
  if (Array.isArray(raw.attachments)) {
    const files = raw.attachments.map(cleanAttachment).filter((a): a is Attachment => !!a)
    if (files.length) msg.attachments = files
  }
  return msg
}

function cleanChat(raw: unknown, key: string, now: number): Chat | null {
  if (!isObj(raw) || !isObj(raw.nodes)) return null
  const id = str(raw.id) || key
  if (!id || unsafeKey(id)) return null

  const given: Record<string, Raw> = {}
  const nodes: Record<string, Message> = {}
  for (const [nid, m] of Object.entries(raw.nodes)) {
    if (unsafeKey(nid) || !isObj(m)) continue
    const clean = cleanMessage(nid, m, now)
    if (!clean) continue
    nodes[nid] = clean
    given[nid] = m
  }
  const ids = Object.keys(nodes)
  if (!ids.length) return null

  // Parents must exist, and walking up from any message must reach a root (no loops).
  for (const nid of ids) if (nodes[nid].parentId && !has(nodes, nodes[nid].parentId!)) nodes[nid].parentId = null
  for (const nid of ids) {
    let cur: Message | undefined = nodes[nid]
    let steps = 0
    while (cur?.parentId) {
      if (++steps > ids.length) {
        nodes[nid].parentId = null
        break
      }
      cur = nodes[cur.parentId]
    }
  }

  // Child lists: keep the file's order where it is valid, then add anything that was missing.
  const childrenOf = (listed: unknown, parent: string | null) => {
    const wanted = strList(listed).filter((x) => has(nodes, x) && nodes[x].parentId === parent)
    const extra = ids
      .filter((x) => nodes[x].parentId === parent && !wanted.includes(x))
      .sort((a, b) => nodes[a].createdAt - nodes[b].createdAt)
    return [...new Set([...wanted, ...extra])]
  }
  for (const nid of ids) {
    const kids = childrenOf(given[nid].childIds, nid)
    nodes[nid].childIds = kids
    const active = given[nid].activeChildId
    nodes[nid].activeChildId = typeof active === "string" && kids.includes(active) ? active : (kids[kids.length - 1] ?? null)
  }
  const rootChildIds = childrenOf(raw.rootChildIds, null)
  if (!rootChildIds.length) return null
  const rootActiveId = typeof raw.rootActiveId === "string" && rootChildIds.includes(raw.rootActiveId) ? raw.rootActiveId : rootChildIds[rootChildIds.length - 1]

  return {
    id,
    title: str(raw.title).trim() || "New chat",
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
    starred: raw.starred === true,
    projectId: typeof raw.projectId === "string" ? raw.projectId : null,
    model: str(raw.model),
    nodes,
    rootChildIds,
    rootActiveId,
  }
}

function cleanProject(raw: unknown, key: string, now: number): Project | null {
  if (!isObj(raw)) return null
  const id = str(raw.id) || key
  if (!id || unsafeKey(id)) return null
  return {
    id,
    name: str(raw.name).trim() || "Untitled project",
    description: str(raw.description),
    instructions: str(raw.instructions),
    files: Array.isArray(raw.files) ? raw.files.map(cleanAttachment).filter((a): a is Attachment => !!a) : [],
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
  }
}

/** Throws when the text isn't JSON or isn't shaped like a backup. */
export function parseBackup(json: string): { chats: Record<string, Chat>; projects: Record<string, Project> } {
  const parsed: unknown = JSON.parse(json)
  if (!isObj(parsed)) throw new Error("Not a backup")
  const data = isObj(parsed.state) ? parsed.state : parsed
  if (!isObj(data.chats) && !isObj(data.projects)) throw new Error("Not a backup")

  const now = Date.now()
  const projects: Record<string, Project> = {}
  for (const [k, v] of Object.entries(isObj(data.projects) ? data.projects : {})) {
    const p = cleanProject(v, k, now)
    if (p) projects[p.id] = p
  }
  const chats: Record<string, Chat> = {}
  for (const [k, v] of Object.entries(isObj(data.chats) ? data.chats : {})) {
    const c = cleanChat(v, k, now)
    if (c) chats[c.id] = c
  }
  return { chats, projects }
}
