import { BUILTIN_STYLES } from "./defaults"
import { parseContent, mayHaveArtifacts } from "./parse"
import { buildSystemPrompt } from "./prompt"
import { ProviderError, streamReply } from "./provider"
import { href, navigate } from "./route"
import { makeTitle, pathTo, useStore, DEFAULT_TITLE, activeThread } from "./store"
import type { Attachment, Message } from "./types"
import { useUI } from "./ui"
import { isAbortError } from "./utils"

/** One controller per chat so a stop button only cancels its own reply. */
const controllers = new Map<string, AbortController>()

/** Opens the empty "new chat" screen. The keyboard only opens on its own where there is a physical one. */
export function startNewChat() {
  navigate(href.home)
  if (window.matchMedia("(pointer: coarse)").matches) return
  requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Message to Cyphor']")?.focus())
}

export function isGenerating(chatId: string) {
  return !!useUI.getState().generating[chatId]
}

/** Appends a user message to the end of the visible thread and asks for a reply. */
export function sendMessage(chatId: string, text: string, attachments: Attachment[] = []) {
  const s = useStore.getState()
  const chat = s.chats[chatId]
  if (!chat || isGenerating(chatId)) return
  const thread = activeThread(chat)
  const last = thread[thread.length - 1]
  const id = s.addUserMessage(chatId, last ? last.id : null, text, attachments)
  // Name the chat as soon as the first message is sent, so it never sits as "New chat" while the reply streams.
  if (!last && chat.title === DEFAULT_TITLE) s.renameChat(chatId, makeTitle(text, attachments), true)
  void run(chatId, id)
}

/** Editing a user message adds a sibling under the same parent, so the original stays reachable. */
export function editMessage(chatId: string, msgId: string, text: string) {
  const s = useStore.getState()
  const chat = s.chats[chatId]
  const m = chat?.nodes[msgId]
  if (!chat || !m || isGenerating(chatId)) return
  const id = s.addUserMessage(chatId, m.parentId, text, m.attachments)
  void run(chatId, id)
}

/** Retry adds a new assistant sibling under the same user message. */
export function retryMessage(chatId: string, assistantId: string) {
  const chat = useStore.getState().chats[chatId]
  const m = chat?.nodes[assistantId]
  if (!chat || !m?.parentId || isGenerating(chatId)) return
  // A reply that failed before producing anything is replaced, not kept as a second version.
  if (m.status === "error" && !m.content) useStore.getState().removeMessage(chatId, assistantId)
  void run(chatId, m.parentId)
}

export function stopGenerating(chatId: string) {
  controllers.get(chatId)?.abort()
}

function wideScreen() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
}

async function run(chatId: string, userMsgId: string) {
  const st = useStore.getState()
  const chat = st.chats[chatId]
  if (!chat) return
  const { settings } = st
  const project = chat.projectId ? st.projects[chat.projectId] : undefined
  const style = [...BUILTIN_STYLES, ...settings.customStyles].find((x) => x.id === settings.styleId)
  const model = chat.model
  const system = buildSystemPrompt({ settings, style, project })

  const asstId = st.addAssistantMessage(chatId, userMsgId, model)
  const thread = pathTo(useStore.getState().chats[chatId], userMsgId)

  const ac = new AbortController()
  controllers.set(chatId, ac)
  const ui = useUI.getState()
  ui.setGenerating(chatId, true)

  const t0 = performance.now()
  let acc = ""
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  let thinkEnd: number | null = null
  let artifactOpened = false

  // On a wide screen the panel opens by itself as soon as an artifact starts, like Claude. Checked again when the
  // reply ends, because a fast reply can be over before the next scheduled update.
  const openArtifactOnce = () => {
    if (artifactOpened || !mayHaveArtifacts(acc)) return
    const seg = parseContent(acc).findLast((x) => x.kind === "artifact")
    if (seg && seg.kind === "artifact") {
      artifactOpened = true
      if (wideScreen()) useUI.getState().openArtifact({ chatId, identifier: seg.artifact.identifier })
    }
  }

  const commit = () => {
    commitTimer = null
    useStore.getState().patchMessage(chatId, asstId, { content: acc })
    const now = performance.now()
    if (thinkEnd === null && /<\/think(?:ing)?>/.test(acc)) thinkEnd = now - t0
    openArtifactOnce()
  }

  let status: "done" | "stopped" | "error" = "done"
  let error: string | undefined
  try {
    // The server keeps the turn in the signed-in account unless saving is switched off.
    const save =
      settings.syncHistory
        ? { chatId, assistantId: asstId, title: chat.title, starred: chat.starred, projectId: chat.projectId, createdAt: chat.createdAt }
        : undefined
    const onMeta = (patch: Partial<Message>) => useStore.getState().patchMessage(chatId, asstId, patch)
    for await (const chunk of streamReply({ settings, model, system, thread, signal: ac.signal, save, onMeta })) {
      acc += chunk
      if (!commitTimer) commitTimer = setTimeout(commit, 60)
    }
  } catch (e) {
    if (isAbortError(e)) status = "stopped"
    else {
      status = "error"
      error = e instanceof ProviderError ? e.message : e instanceof Error ? e.message : "Something went wrong."
    }
  } finally {
    if (commitTimer) clearTimeout(commitTimer)
    controllers.delete(chatId)
  }

  const total = performance.now() - t0
  const hadThinking = /<think(?:ing)?>/.test(acc)
  useStore.getState().patchMessage(chatId, asstId, {
    content: acc,
    status,
    error,
    thinkingMs: hadThinking ? Math.round(thinkEnd ?? total) : undefined,
  })
  openArtifactOnce()
  useUI.getState().setGenerating(chatId, false)
}
