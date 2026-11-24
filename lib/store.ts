import { useMemo } from "react"
import { create } from "zustand"
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware"
import { parseBackup } from "./import"
import { DEFAULT_MODELS } from "./models/page"
import { DEFAULT_SETTINGS } from "./defaults"
import type { Attachment, Chat, Message, Project, Settings } from "./types"
import { uid } from "./utils"
import { DEFAULT_EFFORT, isEffort } from "./router/effort"
import { isPalettePref } from "./scene/palettes"

/** Base name of the saved data. Each account gets its own copy: `cyphor:v1:<user id>`. */
export const STORAGE_KEY = "cyphor:v1"
/** Appearance (theme, reply font, effects, colour theme, city) is also kept once per device, so the login page and the first paint match what you chose. */
export const APPEARANCE_KEY = "cyphor:appearance"
export const DEFAULT_TITLE = "New chat"

interface Data {
  settings: Settings
  chats: Record<string, Chat>
  projects: Record<string, Project>
}

interface Actions {
  updateSettings: (patch: Partial<Settings>) => void
  resetSettings: () => void

  createChat: (opts?: { projectId?: string | null; model?: string }) => string
  deleteChat: (id: string) => Chat | undefined
  restoreChat: (chat: Chat) => void
  deleteAllChats: () => void
  renameChat: (id: string, title: string, fresh?: boolean) => void
  markTitleSeen: (id: string) => void
  toggleStar: (id: string) => void
  moveChat: (id: string, projectId: string | null) => void
  setChatModel: (id: string, model: string) => void

  addUserMessage: (chatId: string, parentId: string | null, text: string, attachments?: Attachment[]) => string
  addAssistantMessage: (chatId: string, parentId: string, model: string) => string
  patchMessage: (chatId: string, msgId: string, patch: Partial<Message>) => void
  /** Drops a leaf message (used to replace a failed reply instead of branching from it). */
  removeMessage: (chatId: string, msgId: string) => void
  setActiveChild: (chatId: string, parentId: string | null, childId: string) => void
  setFeedback: (chatId: string, msgId: string, feedback: "up" | "down" | null) => void

  createProject: (name: string, description?: string) => string
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => void
  deleteProject: (id: string) => void

  importData: (json: string) => { chats: number; projects: number }
}

export type State = Data & Actions

/* ---------------------------------------------------------------- */
/* Persistence                                                       */
/* ---------------------------------------------------------------- */

/**
 * Streaming updates the store many times per second. Instead of serializing on every update,
 * keep the latest state object and write it at most twice a second (and when the tab hides).
 * Image data never reaches storage. Everything is saved under the signed-in account's own key, and
 * nothing is written until we know whose it is.
 */
let storageUser: string | null = null
const keyFor = (name: string) => (storageUser ? `${name}:${storageUser}` : null)

let latest: { name: string; value: StorageValue<Data> } | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function serialize(value: StorageValue<Data>) {
  const { settings, chats, projects } = value.state
  const outChats: Record<string, Chat> = {}
  for (const [id, chat] of Object.entries(chats)) {
    const nodes: Record<string, Message> = {}
    for (const [mid, m] of Object.entries(chat.nodes)) {
      let next = m
      if (m.status === "streaming") next = { ...next, status: "stopped" }
      if (m.attachments?.some((a) => a.dataUrl)) {
        next = { ...next, attachments: m.attachments.map(({ dataUrl, ...rest }) => rest) }
      }
      nodes[mid] = next
    }
    outChats[id] = { ...chat, nodes }
  }
  return JSON.stringify({ state: { settings, chats: outChats, projects }, version: value.version })
}

/** Writes any pending change now. Called when the tab hides and before the account changes. */
export function flush() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!latest) return
  const { name, value } = latest
  latest = null
  try {
    localStorage.setItem(name, serialize(value))
  } catch {
    // Storage is full or blocked. The app keeps working in memory for this session.
  }
}

const storage: PersistStorage<Data> = {
  getItem: (name) => {
    const key = keyFor(name)
    if (!key) return null
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as StorageValue<Data>) : null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    const key = keyFor(name)
    if (!key) return // nobody is signed in: there is nothing to save, and nobody to save it for
    latest = { name: key, value }
    if (!timer) timer = setTimeout(flush, 500)
  },
  removeItem: (name) => {
    latest = null
    const key = keyFor(name)
    if (!key) return
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush()
  })
}

/* ---------------------------------------------------------------- */
/* Store                                                             */
/* ---------------------------------------------------------------- */

function mutateChat(s: State, id: string, fn: (c: Chat) => Chat): Partial<State> {
  const c = s.chats[id]
  if (!c) return {}
  return { chats: { ...s.chats, [id]: fn(c) } }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      chats: {},
      projects: {},

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

      createChat: (opts = {}) => {
        const s = get()
        const id = uid("c_")
        const now = Date.now()
        const chat: Chat = {
          id,
          title: DEFAULT_TITLE,
          createdAt: now,
          updatedAt: now,
          starred: false,
          projectId: opts.projectId ?? null,
          model: opts.model ?? s.settings.defaultModel,
          nodes: {},
          rootChildIds: [],
          rootActiveId: null,
        }
        set({ chats: { ...s.chats, [id]: chat } })
        return id
      },

      deleteChat: (id) => {
        const chat = get().chats[id]
        if (!chat) return undefined
        set((s) => {
          const next = { ...s.chats }
          delete next[id]
          return { chats: next }
        })
        return chat
      },
      restoreChat: (chat) => set((s) => ({ chats: { ...s.chats, [chat.id]: chat } })),
      deleteAllChats: () => set({ chats: {} }),

      renameChat: (id, title, fresh = false) =>
        set((s) =>
          mutateChat(s, id, (c) => ({ ...c, title: title.trim() || DEFAULT_TITLE, titleFresh: fresh || undefined }))
        ),
      markTitleSeen: (id) => set((s) => mutateChat(s, id, (c) => ({ ...c, titleFresh: undefined }))),
      toggleStar: (id) => set((s) => mutateChat(s, id, (c) => ({ ...c, starred: !c.starred }))),
      moveChat: (id, projectId) => set((s) => mutateChat(s, id, (c) => ({ ...c, projectId }))),
      setChatModel: (id, model) => set((s) => mutateChat(s, id, (c) => ({ ...c, model }))),

      addUserMessage: (chatId, parentId, text, attachments) => {
        const id = uid("m_")
        set((s) =>
          mutateChat(s, chatId, (chat) => {
            const msg: Message = {
              id,
              parentId,
              role: "user",
              content: text,
              createdAt: Date.now(),
              attachments: attachments?.length ? attachments : undefined,
              childIds: [],
              activeChildId: null,
              status: "done",
            }
            const nodes = { ...chat.nodes, [id]: msg }
            let { rootChildIds, rootActiveId } = chat
            if (parentId && nodes[parentId]) {
              const p = nodes[parentId]
              nodes[parentId] = { ...p, childIds: [...p.childIds, id], activeChildId: id }
            } else {
              rootChildIds = [...rootChildIds, id]
              rootActiveId = id
            }
            return { ...chat, nodes, rootChildIds, rootActiveId, updatedAt: Date.now() }
          })
        )
        return id
      },

      addAssistantMessage: (chatId, parentId, model) => {
        const id = uid("m_")
        set((s) =>
          mutateChat(s, chatId, (chat) => {
            const msg: Message = {
              id,
              parentId,
              role: "assistant",
              content: "",
              createdAt: Date.now(),
              model,
              childIds: [],
              activeChildId: null,
              status: "streaming",
            }
            const nodes = { ...chat.nodes, [id]: msg }
            const p = nodes[parentId]
            if (p) nodes[parentId] = { ...p, childIds: [...p.childIds, id], activeChildId: id }
            return { ...chat, nodes, updatedAt: Date.now() }
          })
        )
        return id
      },

      patchMessage: (chatId, msgId, patch) =>
        set((s) =>
          mutateChat(s, chatId, (chat) => {
            const m = chat.nodes[msgId]
            if (!m) return chat
            return { ...chat, nodes: { ...chat.nodes, [msgId]: { ...m, ...patch } } }
          })
        ),

      removeMessage: (chatId, msgId) =>
        set((s) =>
          mutateChat(s, chatId, (chat) => {
            const m = chat.nodes[msgId]
            if (!m || m.childIds.length) return chat
            const nodes = { ...chat.nodes }
            delete nodes[msgId]
            if (m.parentId && nodes[m.parentId]) {
              const p = nodes[m.parentId]
              const childIds = p.childIds.filter((c) => c !== msgId)
              nodes[m.parentId] = { ...p, childIds, activeChildId: p.activeChildId === msgId ? (childIds[childIds.length - 1] ?? null) : p.activeChildId }
            }
            return { ...chat, nodes }
          })
        ),

      setActiveChild: (chatId, parentId, childId) =>
        set((s) =>
          mutateChat(s, chatId, (chat) => {
            if (!parentId) return { ...chat, rootActiveId: childId }
            const p = chat.nodes[parentId]
            if (!p) return chat
            return { ...chat, nodes: { ...chat.nodes, [parentId]: { ...p, activeChildId: childId } } }
          })
        ),

      setFeedback: (chatId, msgId, feedback) =>
        set((s) =>
          mutateChat(s, chatId, (chat) => {
            const m = chat.nodes[msgId]
            if (!m) return chat
            return { ...chat, nodes: { ...chat.nodes, [msgId]: { ...m, feedback } } }
          })
        ),

      createProject: (name, description = "") => {
        const id = uid("p_")
        const now = Date.now()
        const project: Project = { id, name: name.trim() || "Untitled project", description, instructions: "", files: [], createdAt: now, updatedAt: now }
        set((s) => ({ projects: { ...s.projects, [id]: project } }))
        return id
      },
      updateProject: (id, patch) =>
        set((s) => {
          const p = s.projects[id]
          if (!p) return {}
          return { projects: { ...s.projects, [id]: { ...p, ...patch, updatedAt: Date.now() } } }
        }),
      deleteProject: (id) =>
        set((s) => {
          const projects = { ...s.projects }
          delete projects[id]
          const chats = Object.fromEntries(
            Object.entries(s.chats).map(([cid, c]) => [cid, c.projectId === id ? { ...c, projectId: null } : c])
          )
          return { projects, chats }
        }),

      importData: (json) => {
        const { chats, projects } = parseBackup(json)
        set((s) => {
          const allProjects = { ...s.projects, ...projects }
          const merged = { ...s.chats, ...chats }
          // A chat can't belong to a project that doesn't exist here.
          for (const [id, c] of Object.entries(chats)) {
            if (c.projectId && !allProjects[c.projectId]) merged[id] = { ...c, projectId: null }
          }
          return { chats: merged, projects: allProjects }
        })
        return { chats: Object.keys(chats).length, projects: Object.keys(projects).length }
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage,
      // The account is not known when the page loads. activateUser() loads the right copy once it is.
      skipHydration: true,
      partialize: (s): Data => ({ settings: s.settings, chats: s.chats, projects: s.projects }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Data>
        const settings: Settings = { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) }
        if (!Array.isArray(settings.models) || settings.models.length === 0) settings.models = DEFAULT_MODELS
        if (!settings.models.some((m) => m.id === settings.defaultModel)) settings.defaultModel = settings.models[0].id
        // Saved before the server existed: the old built-in demo choice is now "server" (which falls back to the demo model).
        if ((settings.provider as string) === "mock") settings.provider = "server"
        // Incognito chats were removed. Older saved settings may still carry the switch.
        delete (settings as { incognitoByDefault?: boolean }).incognitoByDefault
        // "Extended thinking" became the High effort level.
        const old = settings as { extendedThinking?: boolean; effort?: unknown }
        if (!isEffort(old.effort)) settings.effort = old.extendedThinking === true ? "high" : DEFAULT_EFFORT
        delete old.extendedThinking
        // Themes and the city came later: anything unrecognised falls back to the defaults.
        if (!isPalettePref(settings.palette)) settings.palette = DEFAULT_SETTINGS.palette
        if (settings.scene !== "city" && settings.scene !== "off") settings.scene = DEFAULT_SETTINGS.scene
        settings.sceneChosen = settings.sceneChosen === true
        return { ...current, settings, chats: p.chats ?? {}, projects: p.projects ?? {} }
      },
    }
  )
)

/* ---------------------------------------------------------------- */
/* One saved copy per account                                        */
/* ---------------------------------------------------------------- */

const FRESH: Data = { settings: DEFAULT_SETTINGS, chats: {}, projects: {} }

/** The appearance, as the first-paint script reads it. */
function mirrorAppearance(settings: Settings) {
  try {
    localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify({ theme: settings.theme, chatFont: settings.chatFont, effects: settings.effects, palette: settings.palette, scene: settings.scene })
    )
  } catch {
    /* storage can be blocked */
  }
}

let stopMirror: (() => void) | null = null

/**
 * Loads the saved copy that belongs to this account. The first account to sign in on a browser that used Cyphor
 * before accounts existed also receives that older copy (moved, not copied, so a second person on the same browser does not).
 */
export async function activateUser(userId: string) {
  flush()
  stopMirror?.()
  // Clear the screen's state while nobody owns it, so the clearing itself is never saved under anyone's key.
  storageUser = null
  useStore.setState(FRESH)
  storageUser = userId
  try {
    const mine = `${STORAGE_KEY}:${userId}`
    if (localStorage.getItem(mine) === null) {
      const legacy = localStorage.getItem(STORAGE_KEY)
      if (legacy !== null) {
        localStorage.setItem(mine, legacy)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  } catch {
    /* storage can be blocked: the app then runs from memory */
  }
  await useStore.persist.rehydrate()

  mirrorAppearance(useStore.getState().settings)
  stopMirror = useStore.subscribe((s, prev) => {
    const a = s.settings
    const b = prev.settings
    if (a.theme !== b.theme || a.chatFont !== b.chatFont || a.effects !== b.effects || a.palette !== b.palette || a.scene !== b.scene) mirrorAppearance(a)
  })
}

/** Forgets the signed-in account on this screen. Their saved copy stays on this device under their own key until they erase it. */
export function deactivateUser() {
  flush()
  stopMirror?.()
  stopMirror = null
  storageUser = null
  useStore.setState(FRESH)
}

/** How much room this account's saved copy takes in the browser. localStorage counts two bytes per UTF-16 character. */
export function savedBytes() {
  try {
    const key = storageUser ? `${STORAGE_KEY}:${storageUser}` : STORAGE_KEY
    return (localStorage.getItem(key)?.length ?? 0) * 2
  } catch {
    return 0
  }
}

/** Removes this account's saved copy from this device (used by "Erase everything"). */
export function forgetLocalCopy() {
  latest = null
  if (timer) clearTimeout(timer)
  timer = null
  try {
    if (storageUser) localStorage.removeItem(`${STORAGE_KEY}:${storageUser}`)
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------- */
/* Selectors and helpers                                             */
/* ---------------------------------------------------------------- */

/** The models the picker offers: the server's own list, or the list you edited for your own endpoint. */
export function useModelList() {
  return useStore((s) => (s.settings.provider === "server" ? DEFAULT_MODELS : s.settings.models))
}

/** The messages shown on screen: follow each node's active child from the root. */
export function activeThread(chat: Chat): Message[] {
  const out: Message[] = []
  const seen = new Set<string>()
  let id = chat.rootActiveId
  while (id && !seen.has(id)) {
    seen.add(id)
    const m = chat.nodes[id]
    if (!m) break
    out.push(m)
    id = m.activeChildId
  }
  return out
}

/** Root-to-message path, used to build the request for one specific turn. */
export function pathTo(chat: Chat, id: string): Message[] {
  const out: Message[] = []
  let cur: Message | undefined = chat.nodes[id]
  while (cur) {
    out.unshift(cur)
    cur = cur.parentId ? chat.nodes[cur.parentId] : undefined
  }
  return out
}

export function siblingsOf(chat: Chat, m: Message): string[] {
  return m.parentId ? (chat.nodes[m.parentId]?.childIds ?? []) : chat.rootChildIds
}

export interface ChatMeta {
  id: string
  title: string
  updatedAt: number
  starred: boolean
  projectId: string | null
  titleFresh: boolean
}

const SEP_A = "\u0001"
const SEP_B = "\u0002"

/**
 * Lightweight, sorted list for the sidebar. It is derived through a string signature so the
 * sidebar does not re-render on every streamed token (only title/order/star changes alter it).
 */
export function useChatMetas(): ChatMeta[] {
  const sig = useStore((s) =>
    Object.values(s.chats)
      .map((c) => [c.id, c.title, c.updatedAt, c.starred ? 1 : 0, c.projectId ?? "", c.titleFresh ? 1 : 0].join(SEP_A))
      .join(SEP_B)
  )
  return useMemo(() => {
    if (!sig) return []
    return sig
      .split(SEP_B)
      .map((row): ChatMeta => {
        const [id, title, updatedAt, starred, projectId, fresh] = row.split(SEP_A)
        return {
          id,
          title,
          updatedAt: Number(updatedAt),
          starred: starred === "1",
          projectId: projectId || null,
          titleFresh: fresh === "1",
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [sig])
}

export function firstUserText(chat: Chat) {
  const t = activeThread(chat)
  return t.find((m) => m.role === "user")?.content ?? ""
}

/** A short title from the first message: first sentence or line, trimmed at a word boundary. */
export function makeTitle(text: string, attachments?: Attachment[]) {
  const clean = text.replace(/\s+/g, " ").replace(/^[#>*\-\s]+/, "").trim()
  if (!clean) {
    if (attachments?.some((a) => a.kind === "image")) return "Image chat"
    if (attachments?.length) return attachments[0].name.slice(0, 40)
    return DEFAULT_TITLE
  }
  const sentence = clean.split(/(?<=[.!?])\s/)[0]
  if (sentence.length <= 48) return sentence.replace(/[.!?]+$/, "")
  const cut = sentence.slice(0, 48)
  const sp = cut.lastIndexOf(" ")
  return (sp > 24 ? cut.slice(0, sp) : cut).replace(/[,;:\-\s]+$/, "") + "…"
}
