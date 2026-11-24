/**
 * Everything that moves a conversation between its three shapes:
 *
 *   Chat (the browser's tree)  <->  rows (the database)  <->  wire messages (what a model reads)
 *
 * It also validates what clients send. Pure functions only, no framework and no I/O, so the
 * API routes, the browser and the unit tests all use the same code.
 */
import type { CouncilInfo, CouncilMember, MessageMeta, ProviderId, RouteInfo, RoutePriority, Task, WebMode, WebSource } from "./router/types"
import type { Attachment, Chat, Message } from "./types"
import { DEFAULT_EFFORT, isEffort, type Effort } from "./router/effort"

export const LIMITS = {
  /** Messages in one saved conversation. */
  messagesPerChat: 2000,
  /** Messages on the path sent with one /api/chat request. */
  threadMessages: 400,
  contentChars: 400_000,
  systemChars: 20_000,
  titleChars: 200,
  attachmentsPerMessage: 20,
  attachmentTextChars: 200_000,
  imageDataChars: 8_000_000,
  /** Largest request body accepted by the API routes. */
  bodyBytes: 12 * 1024 * 1024,
} as const

/** Ids are made by the browser. This keeps them short and free of anything that needs escaping. */
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export type AttachmentMeta = Omit<Attachment, "dataUrl">

/** Removes <thinking> blocks. The model never sees its own earlier reasoning. */
export function stripThinking(raw: string) {
  return raw.replace(/<think(?:ing)?>[\s\S]*?(<\/think(?:ing)?>|$)/g, "").trim()
}

/* ---------------------------------------------------------------- */
/* Wire format (OpenAI chat messages)                                */
/* ---------------------------------------------------------------- */

export type WirePart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }

export interface WireMessage {
  role: "system" | "user" | "assistant"
  content: string | WirePart[]
}

type ThreadMessage = Pick<Message, "role" | "content" | "status" | "attachments">

/** Converts the thread to the OpenAI chat format. Thinking is never sent back to the model. */
export function toWire(system: string, thread: ThreadMessage[]): WireMessage[] {
  const out: WireMessage[] = []
  if (system.trim()) out.push({ role: "system", content: system })
  for (const m of thread) {
    if (m.role === "assistant") {
      const text = stripThinking(m.content)
      if (!text || m.status === "error") continue
      out.push({ role: "assistant", content: text })
      continue
    }
    let text = m.content
    const files = (m.attachments ?? []).filter((a) => a.kind === "text" && a.text)
    for (const f of files) text += `\n\n<file name="${f.name}">\n${f.text}\n</file>`
    const images = (m.attachments ?? []).filter((a) => a.kind === "image" && a.dataUrl)
    if (images.length) {
      out.push({
        role: "user",
        content: [
          { type: "text", text: text || "(see attached image)" },
          ...images.map((i): WirePart => ({ type: "image_url", image_url: { url: i.dataUrl! } })),
        ],
      })
    } else {
      out.push({ role: "user", content: text })
    }
  }
  return out
}

/* ---------------------------------------------------------------- */
/* Rows                                                              */
/* ---------------------------------------------------------------- */

export interface ConversationRow {
  id: string
  ownerId: string
  title: string
  starred: boolean
  projectId: string | null
  model: string
  rootActiveId: string | null
  createdAt: number
  updatedAt: number
}

export interface MessageRow {
  conversationId: string
  id: string
  parentId: string | null
  role: "user" | "assistant"
  content: string
  model: string | null
  attachments: AttachmentMeta[] | null
  activeChildId: string | null
  feedback: "up" | "down" | null
  status: "streaming" | "done" | "error" | "stopped" | null
  error: string | null
  thinkingMs: number | null
  /** How the router made the reply (route, council, sources). */
  meta: MessageMeta | null
  createdAt: number
}

/** What the conversation list shows. No messages. */
export interface ConversationSummary {
  id: string
  title: string
  starred: boolean
  projectId: string | null
  model: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

/* ---------------------------------------------------------------- */
/* Router metadata                                                   */
/* ---------------------------------------------------------------- */

const SLUG_RE = /^[a-z0-9_-]{1,32}$/
const MODES = new Set(["auto", "direct", "fallback", "council"])
const TASKS = new Set(["general", "code", "reasoning", "creative", "quick"])
const PHASES = new Set(["drafting", "synthesizing", "done", "fallback"])
const MEMBER_STATUS = new Set(["pending", "done", "failed", "timeout"])
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "")

function checkRoute(raw: unknown): RouteInfo | undefined {
  if (!isObj(raw) || typeof raw.provider !== "string" || !SLUG_RE.test(raw.provider) || typeof raw.mode !== "string" || !MODES.has(raw.mode)) return undefined
  return {
    mode: raw.mode as RouteInfo["mode"],
    provider: raw.provider as ProviderId,
    providerLabel: clip(raw.providerLabel, 60),
    model: clip(raw.model, 160),
    name: clip(raw.name, 120),
    reason: clip(raw.reason, 400),
    task: typeof raw.task === "string" && TASKS.has(raw.task) ? (raw.task as Task) : undefined,
  }
}

function checkCouncil(raw: unknown): CouncilInfo | undefined {
  if (!isObj(raw) || typeof raw.phase !== "string" || !PHASES.has(raw.phase) || !Array.isArray(raw.members)) return undefined
  const members: CouncilMember[] = []
  for (const m of raw.members.slice(0, 8)) {
    if (!isObj(m) || typeof m.provider !== "string" || !SLUG_RE.test(m.provider) || typeof m.status !== "string" || !MEMBER_STATUS.has(m.status)) continue
    members.push({
      key: clip(m.key, 200),
      provider: m.provider as ProviderId,
      providerLabel: clip(m.providerLabel, 60),
      model: clip(m.model, 160),
      name: clip(m.name, 120),
      status: m.status as CouncilMember["status"],
      ms: typeof m.ms === "number" && m.ms >= 0 ? Math.round(m.ms) : undefined,
      chars: typeof m.chars === "number" && m.chars >= 0 ? Math.round(m.chars) : undefined,
      snippet: typeof m.snippet === "string" ? m.snippet.slice(0, 160) : undefined,
      error: typeof m.error === "string" ? m.error.slice(0, 200) : undefined,
    })
  }
  const chair = isObj(raw.chair) && typeof raw.chair.provider === "string" && SLUG_RE.test(raw.chair.provider)
    ? { provider: raw.chair.provider as ProviderId, providerLabel: clip(raw.chair.providerLabel, 60), model: clip(raw.chair.model, 160), name: clip(raw.chair.name, 120) }
    : undefined
  return { phase: raw.phase as CouncilInfo["phase"], members, chair, note: typeof raw.note === "string" ? raw.note.slice(0, 300) : undefined }
}

function checkSources(raw: unknown): WebSource[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: WebSource[] = []
  for (const s of raw.slice(0, 12)) {
    // Only web addresses: a saved "javascript:" link must never be rendered as one.
    if (!isObj(s) || typeof s.url !== "string" || !/^https?:\/\//i.test(s.url) || s.url.length > 2000) continue
    out.push({ title: clip(s.title, 200) || s.url, url: s.url, site: typeof s.site === "string" ? s.site.slice(0, 80) : undefined, snippet: typeof s.snippet === "string" ? s.snippet.slice(0, 400) : undefined })
  }
  return out.length ? out : undefined
}

/** The router fields of a message sent by a client, checked and clipped. Empty when there are none. */
export function checkMeta(raw: Record<string, unknown>): MessageMeta {
  const meta: MessageMeta = {}
  const route = checkRoute(raw.route)
  const council = checkCouncil(raw.council)
  const sources = checkSources(raw.sources)
  if (route) meta.route = route
  if (council) meta.council = council
  if (sources) meta.sources = sources
  if (typeof raw.webNote === "string" && raw.webNote) meta.webNote = raw.webNote.slice(0, 300)
  return meta
}

function metaOf(m: Message): MessageMeta | null {
  const meta = checkMeta(m as unknown as Record<string, unknown>)
  return Object.keys(meta).length ? meta : null
}

/** Image bytes are never stored. Only the small description of an attachment is. */
function attachmentMeta(a: Attachment): AttachmentMeta {
  const { dataUrl: _dataUrl, ...rest } = a
  return rest
}

export function messageToRow(conversationId: string, m: Message): MessageRow {
  return {
    conversationId,
    id: m.id,
    parentId: m.parentId,
    role: m.role,
    content: m.content,
    model: m.model ?? null,
    attachments: m.attachments?.length ? m.attachments.map(attachmentMeta) : null,
    activeChildId: m.activeChildId,
    feedback: m.feedback ?? null,
    // A reply can never still be streaming once it has been saved.
    status: m.status === "streaming" ? "stopped" : (m.status ?? null),
    error: m.error ?? null,
    thinkingMs: m.thinkingMs ?? null,
    meta: metaOf(m),
    createdAt: m.createdAt,
  }
}

export function chatToRows(ownerId: string, chat: Chat): { conversation: ConversationRow; messages: MessageRow[] } {
  return {
    conversation: {
      id: chat.id,
      ownerId,
      title: chat.title,
      starred: chat.starred,
      projectId: chat.projectId,
      model: chat.model,
      rootActiveId: chat.rootActiveId,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    },
    messages: Object.values(chat.nodes).map((m) => messageToRow(chat.id, m)),
  }
}

const byTime = (a: { createdAt: number; id: string }, b: { createdAt: number; id: string }) =>
  a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Rebuilds the browser's tree. Siblings are ordered by creation time, which is the order they were added in. */
export function rowsToChat(conversation: ConversationRow, rows: MessageRow[]): Chat {
  const nodes: Record<string, Message> = {}
  for (const r of rows) {
    nodes[r.id] = {
      id: r.id,
      parentId: r.parentId,
      role: r.role,
      content: r.content,
      createdAt: r.createdAt,
      model: r.model ?? undefined,
      attachments: r.attachments?.length ? r.attachments : undefined,
      childIds: [],
      activeChildId: r.activeChildId,
      feedback: r.feedback ?? undefined,
      status: r.status ?? undefined,
      error: r.error ?? undefined,
      thinkingMs: r.thinkingMs ?? undefined,
      ...(r.meta ?? {}),
    }
  }

  const rootChildIds: string[] = []
  for (const r of [...rows].sort(byTime)) {
    const parent = r.parentId ? nodes[r.parentId] : undefined
    if (parent) parent.childIds.push(r.id)
    else rootChildIds.push(r.id) // a missing parent is treated as a root so nothing is lost
  }
  for (const m of Object.values(nodes)) {
    if (m.activeChildId && !m.childIds.includes(m.activeChildId)) m.activeChildId = null
    if (!m.activeChildId && m.childIds.length) m.activeChildId = m.childIds[m.childIds.length - 1]
  }
  const rootActive =
    conversation.rootActiveId && rootChildIds.includes(conversation.rootActiveId)
      ? conversation.rootActiveId
      : (rootChildIds[rootChildIds.length - 1] ?? null)

  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    starred: conversation.starred,
    projectId: conversation.projectId,
    model: conversation.model,
    nodes,
    rootChildIds,
    rootActiveId: rootActive,
  }
}

export function toSummary(c: ConversationRow, messageCount: number): ConversationSummary {
  return {
    id: c.id,
    title: c.title,
    starred: c.starred,
    projectId: c.projectId,
    model: c.model,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount,
  }
}

/* ---------------------------------------------------------------- */
/* Validation                                                        */
/* ---------------------------------------------------------------- */

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string }

const bad = (error: string): { ok: false; error: string } => ({ ok: false, error })
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v)
const finite = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback)

const STATUSES = new Set(["streaming", "done", "error", "stopped"])

function checkAttachments(raw: unknown, keepImages: boolean): Checked<Attachment[] | undefined> {
  if (raw == null) return { ok: true, value: undefined }
  if (!Array.isArray(raw)) return bad("Attachments must be a list.")
  if (raw.length > LIMITS.attachmentsPerMessage) return bad("Too many attachments on one message.")
  const out: Attachment[] = []
  for (const a of raw) {
    if (!isObj(a)) return bad("Attachment must be an object.")
    const kind = a.kind
    if (kind !== "image" && kind !== "text" && kind !== "file") return bad("Attachment kind is invalid.")
    if (typeof a.id !== "string" || a.id.length > 64) return bad("Attachment id is invalid.")
    const att: Attachment = {
      id: a.id,
      name: typeof a.name === "string" ? a.name.slice(0, 255) : "file",
      kind,
      mime: typeof a.mime === "string" ? a.mime.slice(0, 100) : "",
      size: Math.max(0, finite(a.size, 0)),
    }
    if (typeof a.text === "string") att.text = a.text.slice(0, LIMITS.attachmentTextChars)
    if (a.unsupported === true) att.unsupported = true
    if (keepImages && kind === "image" && typeof a.dataUrl === "string") {
      if (!a.dataUrl.startsWith("data:image/")) return bad("Image data is invalid.")
      if (a.dataUrl.length > LIMITS.imageDataChars) return bad("An attached image is too large.")
      att.dataUrl = a.dataUrl
    }
    out.push(att)
  }
  return { ok: true, value: out.length ? out : undefined }
}

function checkMessage(raw: unknown, keepImages: boolean): Checked<Message> {
  if (!isObj(raw)) return bad("Message must be an object.")
  if (!isId(raw.id)) return bad("Message id is invalid.")
  const parentId = raw.parentId == null ? null : raw.parentId
  if (parentId !== null && !isId(parentId)) return bad("Message parent id is invalid.")
  if (raw.role !== "user" && raw.role !== "assistant") return bad("Message role is invalid.")
  if (typeof raw.content !== "string") return bad("Message content must be text.")
  if (raw.content.length > LIMITS.contentChars) return bad("A message is too long.")
  const attachments = checkAttachments(raw.attachments, keepImages)
  if (!attachments.ok) return attachments

  const status = typeof raw.status === "string" && STATUSES.has(raw.status) ? (raw.status as Message["status"]) : undefined
  return {
    ok: true,
    value: {
      id: raw.id,
      parentId,
      role: raw.role,
      content: raw.content,
      createdAt: finite(raw.createdAt, Date.now()),
      model: typeof raw.model === "string" ? raw.model.slice(0, 160) : undefined,
      attachments: attachments.value,
      childIds: [],
      activeChildId: isId(raw.activeChildId) ? raw.activeChildId : null,
      feedback: raw.feedback === "up" || raw.feedback === "down" ? raw.feedback : undefined,
      status: status === "streaming" ? "stopped" : status,
      error: typeof raw.error === "string" ? raw.error.slice(0, 2000) : undefined,
      thinkingMs: typeof raw.thinkingMs === "number" && raw.thinkingMs >= 0 ? Math.round(raw.thinkingMs) : undefined,
      ...checkMeta(raw),
    },
  }
}

/** Checks a whole conversation sent by the browser (PUT /api/conversations/[id]) and returns a clean copy. */
export function checkChat(input: unknown, fallbackModel = "cyphor-auto"): Checked<Chat> {
  if (!isObj(input)) return bad("Conversation must be an object.")
  if (!isId(input.id)) return bad("Conversation id is invalid.")
  if (!isObj(input.nodes)) return bad("Conversation messages are missing.")
  const projectId = input.projectId == null ? null : input.projectId
  if (projectId !== null && !isId(projectId)) return bad("Project id is invalid.")

  const entries = Object.entries(input.nodes)
  if (entries.length > LIMITS.messagesPerChat) return bad("This conversation has too many messages to save.")

  const nodes: Record<string, Message> = {}
  for (const [key, raw] of entries) {
    const m = checkMessage(raw, false)
    if (!m.ok) return m
    if (m.value.id !== key) return bad("Message ids do not match their keys.")
    nodes[key] = m.value
  }
  for (const m of Object.values(nodes)) {
    if (m.parentId !== null && !nodes[m.parentId]) return bad("A message points at a parent that is not in the conversation.")
  }

  const rootChildIds: string[] = []
  for (const m of Object.values(nodes).sort(byTime)) {
    if (m.parentId) nodes[m.parentId].childIds.push(m.id)
    else rootChildIds.push(m.id)
  }
  // Everything must be reachable from a root. Anything left over is part of a cycle.
  const seen = new Set<string>()
  const stack = [...rootChildIds]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...nodes[id].childIds)
  }
  if (seen.size !== entries.length) return bad("The message tree contains a loop.")

  for (const m of Object.values(nodes)) {
    if (!m.activeChildId || !m.childIds.includes(m.activeChildId)) m.activeChildId = m.childIds.length ? m.childIds[m.childIds.length - 1] : null
  }
  const rootActiveId = isId(input.rootActiveId) && rootChildIds.includes(input.rootActiveId) ? input.rootActiveId : (rootChildIds[rootChildIds.length - 1] ?? null)

  const now = Date.now()
  const title = typeof input.title === "string" ? input.title.trim().slice(0, LIMITS.titleChars) : ""
  return {
    ok: true,
    value: {
      id: input.id,
      title: title || "New chat",
      createdAt: finite(input.createdAt, now),
      updatedAt: finite(input.updatedAt, now),
      starred: input.starred === true,
      projectId,
      model: typeof input.model === "string" && input.model.trim() ? input.model.trim().slice(0, 160) : fallbackModel,
      nodes,
      rootChildIds,
      rootActiveId,
    },
  }
}

/** The body of POST /api/chat, after checking. */
export interface ChatRequest {
  /** Saved under this conversation. null means "answer, but keep nothing" (a one-off question). */
  chatId: string | null
  /** Id the browser already gave the reply it is waiting for. */
  assistantId: string
  model: string
  system: string
  /** Root to the user message being answered. */
  thread: Message[]
  /** Only used to create the conversation the first time it is seen. */
  chat: { title: string; starred: boolean; projectId: string | null; createdAt: number }
  temperature: number
  maxTokens: number
  thinking: boolean
  /** How hard to try: steers the routing preference and, when high, asks for reasoning. */
  effort: Effort
  /** Web search or research is switched on, which the built-in demo model cannot do. */
  noAccess: boolean
  /** Ground the answer in a web search (needs TINYFISH_API_KEY), or read the top pages as well. */
  web: WebMode
  /** How the router chooses when you use a Cyphor model. */
  priority: RoutePriority
  /** Providers the router must not use. */
  disabledProviders: string[]
  /** The most providers God Mode asks at once. */
  godMax: number
  /** Demo model only: 1 is normal speed. Automated tests use more, or less (to 0.1) to watch a reply being written. */
  speed: number
}

export function checkChatRequest(input: unknown): Checked<ChatRequest> {
  if (!isObj(input)) return bad("The request must be a JSON object.")
  if (!Array.isArray(input.thread) || input.thread.length === 0) return bad("thread must be a non-empty list of messages.")
  if (input.thread.length > LIMITS.threadMessages) return bad("The conversation is too long to send in one request.")

  const thread: Message[] = []
  for (const raw of input.thread) {
    const m = checkMessage(raw, true)
    if (!m.ok) return m
    thread.push(m.value)
  }
  // A thread is one path through the tree: each message is the child of the one before it.
  for (let i = 0; i < thread.length; i++) {
    const expected = i === 0 ? null : thread[i - 1].id
    if (thread[i].parentId !== expected) return bad("The messages are not a single conversation path.")
  }
  if (thread[thread.length - 1].role !== "user") return bad("The last message must be from the user.")

  const chatId = input.chatId == null ? null : input.chatId
  if (chatId !== null && !isId(chatId)) return bad("chatId is invalid.")
  if (!isId(input.assistantId)) return bad("assistantId is invalid.")
  if (typeof input.model !== "string" || !input.model.trim()) return bad("model is required.")
  const system = typeof input.system === "string" ? input.system : ""
  if (system.length > LIMITS.systemChars) return bad("The system prompt is too long.")

  const meta = isObj(input.chat) ? input.chat : {}
  const projectId = meta.projectId == null ? null : meta.projectId
  if (projectId !== null && !isId(projectId)) return bad("Project id is invalid.")
  const title = typeof meta.title === "string" ? meta.title.trim().slice(0, LIMITS.titleChars) : ""

  const temperature = finite(input.temperature, 0.7)
  const maxTokens = finite(input.maxTokens, 4096)
  const speed = finite(input.speed, 1)
  return {
    ok: true,
    value: {
      chatId,
      assistantId: input.assistantId,
      model: input.model.trim().slice(0, 160),
      system,
      thread,
      chat: { title: title || "New chat", starred: meta.starred === true, projectId, createdAt: finite(meta.createdAt, Date.now()) },
      temperature: Math.min(2, Math.max(0, temperature)),
      maxTokens: Math.round(Math.min(128_000, Math.max(1, maxTokens))),
      thinking: input.thinking === true,
      effort: isEffort(input.effort) ? input.effort : DEFAULT_EFFORT,
      noAccess: input.noAccess === true,
      web: input.web === "search" || input.web === "research" ? input.web : "off",
      priority: input.priority === "speed" || input.priority === "quality" || input.priority === "free" ? input.priority : "balanced",
      disabledProviders: Array.isArray(input.disabledProviders) ? input.disabledProviders.filter((p): p is string => typeof p === "string" && SLUG_RE.test(p)).slice(0, 16) : [],
      godMax: Math.round(Math.min(6, Math.max(2, finite(input.godMax, 4)))),
      speed: Math.min(50, Math.max(0.1, speed)),
    },
  }
}
