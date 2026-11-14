import { create } from "zustand"
import { STANDALONE } from "./provider"
import { useStore } from "./store"
import type { Chat, Message } from "./types"

/**
 * Keeps a copy of saved chats in the server's database (/api/conversations).
 *
 * The browser stays the main copy: everything works offline and nothing waits on the network.
 * Changes are sent a moment after they settle, and on start any chat the server has but this
 * browser lacks (or has an older version of) is brought down. Incognito chats never leave the browser.
 */

export type SyncState = "off" | "idle" | "syncing" | "offline" | "error"

interface SyncStatus {
  state: SyncState
  lastSyncedAt: number | null
}

export const useSync = create<SyncStatus>()(() => ({ state: "off", lastSyncedAt: null }))
const setStatus = (patch: Partial<SyncStatus>) => useSync.setState(patch)

const DEBOUNCE_MS = 1500
const RETRY_MS = 15_000

const timers = new Map<string, ReturnType<typeof setTimeout>>()
/** Chats just copied down from the server. Storing them is not a change worth sending back. */
const justPulled = new Map<string, Chat>()
let inflight = 0

function enabled() {
  return !STANDALONE && useStore.getState().settings.syncHistory
}

const streaming = (chat: Chat) => Object.values(chat.nodes).some((m) => m.status === "streaming")
const syncable = (chat: Chat) => !chat.incognito && !streaming(chat)

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init.headers } })
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} failed (${res.status})`)
  return (await res.json()) as T
}

const url = (id: string) => `/api/conversations/${encodeURIComponent(id)}`

/** What goes over the wire: no image bytes (they are never saved) and no screen-only flags. */
function forServer(chat: Chat) {
  const nodes: Record<string, Message> = {}
  for (const [id, m] of Object.entries(chat.nodes)) {
    nodes[id] = m.attachments?.some((a) => a.dataUrl) ? { ...m, attachments: m.attachments.map(({ dataUrl: _d, ...rest }) => rest) } : m
  }
  return { ...chat, nodes, titleFresh: undefined, incognito: undefined }
}

function begin() {
  inflight++
  setStatus({ state: "syncing" })
}
function end(ok: boolean) {
  inflight = Math.max(0, inflight - 1)
  if (!ok) setStatus({ state: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error" })
  else if (inflight === 0) setStatus({ state: "idle", lastSyncedAt: Date.now() })
}

function schedule(id: string, delay = DEBOUNCE_MS) {
  const old = timers.get(id)
  if (old) clearTimeout(old)
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id)
      void push(id)
    }, delay)
  )
}

async function push(id: string) {
  if (!enabled()) return
  const chat = useStore.getState().chats[id]
  if (!chat || !syncable(chat)) return // a chat that is still streaming is sent when it finishes
  begin()
  try {
    await api(url(id), { method: "PUT", body: JSON.stringify({ chat: forServer(chat) }) })
    end(true)
  } catch {
    end(false)
    schedule(id, RETRY_MS)
  }
}

async function remove(id: string) {
  const t = timers.get(id)
  if (t) clearTimeout(t)
  timers.delete(id)
  try {
    await fetch(url(id), { method: "DELETE" })
  } catch {
    /* offline: the server keeps a copy until the next delete-all */
  }
}

interface RemoteSummary {
  id: string
  updatedAt: number
}

/** Compares this browser with the server and copies whatever is newer, in either direction. */
async function reconcile() {
  if (!enabled()) return
  begin()
  try {
    const { conversations } = await api<{ conversations: RemoteSummary[] }>("/api/conversations")
    const remoteIds = new Set(conversations.map((c) => c.id))

    for (const r of conversations) {
      const local = useStore.getState().chats[r.id]
      if (local && !syncable(local)) continue
      if (!local || r.updatedAt > local.updatedAt) {
        const { chat } = await api<{ chat: Chat }>(url(r.id))
        justPulled.set(chat.id, chat)
        useStore.getState().restoreChat(chat)
      } else if (local.updatedAt > r.updatedAt) {
        schedule(r.id, 0)
      }
    }
    // Chats the server has never seen (made before saving was on, or while offline).
    for (const chat of Object.values(useStore.getState().chats)) {
      if (!remoteIds.has(chat.id) && syncable(chat) && Object.keys(chat.nodes).length) schedule(chat.id, 0)
    }
    end(true)
  } catch {
    end(false)
  }
}

/** Removes the server's copy of everything. Used by "Erase everything" before the page reloads. */
export async function eraseRemote() {
  if (STANDALONE) return
  try {
    await Promise.race([fetch("/api/conversations", { method: "DELETE" }), new Promise((r) => setTimeout(r, 3000))])
  } catch {
    /* nothing more to do */
  }
}

/** Starts watching the store. Call once from the app shell; returns a function that stops it. */
export function startSync(): () => void {
  if (STANDALONE) return () => {}
  setStatus({ state: useStore.getState().settings.syncHistory ? "idle" : "off" })
  void reconcile()

  const unsubscribe = useStore.subscribe((s, prev) => {
    if (s.settings.syncHistory !== prev.settings.syncHistory) {
      if (s.settings.syncHistory) void reconcile()
      else setStatus({ state: "off" })
      return
    }
    if (!s.settings.syncHistory) return

    for (const [id, chat] of Object.entries(s.chats)) {
      if (chat === prev.chats[id]) continue
      if (justPulled.get(id) === chat) {
        justPulled.delete(id)
        continue
      }
      if (!chat.incognito) schedule(id)
    }
    for (const id of Object.keys(prev.chats)) {
      if (!s.chats[id] && !prev.chats[id].incognito) void remove(id)
    }
  })

  const onOnline = () => void reconcile()
  window.addEventListener("online", onOnline)
  return () => {
    unsubscribe()
    window.removeEventListener("online", onOnline)
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
  }
}
