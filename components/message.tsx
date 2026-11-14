import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  ImageOff,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { editMessage, retryMessage } from "@/lib/actions"
import { collectArtifacts, parseContent, plainText } from "@/lib/parse"
import { describeModel, useCatalog, useDemoMode } from "@/lib/catalog"
import { activeThread, siblingsOf, useStore } from "@/lib/store"
import type { Attachment, Message } from "@/lib/types"
import { useUI } from "@/lib/ui"
import { cn, copyText, formatBytes } from "@/lib/utils"
import { ArtifactCard } from "./artifact-card"
import { LiveDisk } from "./cipher-disk"
import { IconButton } from "./icon-button"
import { Markdown } from "./markdown"
import { CouncilPanel, RouteChip, SourceList } from "./route-info"
import { Thinking } from "./thinking"

const actionRow =
  "mt-1 flex items-center gap-0.5 text-muted-foreground transition-opacity duration-150 can-hover:opacity-0 can-hover:group-hover/msg:opacity-100 can-hover:group-focus-within/msg:opacity-100"

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function BranchNav({ chatId, msgId }: { chatId: string; msgId: string }) {
  const info = useStore(
    useShallow((s) => {
      const chat = s.chats[chatId]
      const m = chat?.nodes[msgId]
      if (!chat || !m) return null
      const sibs = siblingsOf(chat, m)
      const i = sibs.indexOf(msgId)
      return { count: sibs.length, index: i, prev: sibs[i - 1] ?? null, next: sibs[i + 1] ?? null, parentId: m.parentId }
    })
  )
  const setActiveChild = useStore((s) => s.setActiveChild)
  const busy = useUI((s) => !!s.generating[chatId])
  if (!info || info.count < 2) return null
  return (
    <div className="flex items-center" role="group" aria-label="Versions of this message">
      <IconButton
        label="Previous version"
        className="size-7"
        disabled={!info.prev || busy}
        onClick={() => info.prev && setActiveChild(chatId, info.parentId, info.prev)}
      >
        <ChevronLeft className="size-4" />
      </IconButton>
      <span className="min-w-9 text-center text-xs tabular-nums" aria-live="polite">
        {info.index + 1} / {info.count}
      </span>
      <IconButton
        label="Next version"
        className="size-7"
        disabled={!info.next || busy}
        onClick={() => info.next && setActiveChild(chatId, info.parentId, info.next)}
      >
        <ChevronRight className="size-4" />
      </IconButton>
    </div>
  )
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <IconButton
      label={done ? "Copied" : label}
      className="size-8"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } else toast.error("Couldn't copy. Select the text and copy it manually.")
      }}
    >
      {done ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
    </IconButton>
  )
}

function AttachmentView({ a }: { a: Attachment }) {
  if (a.kind === "image") {
    return a.dataUrl ? (
      <img
        src={a.dataUrl}
        alt={a.name}
        className="max-h-56 max-w-full rounded-xl border object-cover sm:max-h-64"
        loading="lazy"
      />
    ) : (
      <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm text-muted-foreground">
        <ImageOff className="size-4" aria-hidden />
        <span className="max-w-48 truncate">{a.name}</span>
        <span className="text-xs">not kept after reload</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="max-w-48 truncate">{a.name}</span>
      <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* User message                                                        */
/* ------------------------------------------------------------------ */

function EditBox({ chatId, msg, onClose }: { chatId: string; msg: Message; onClose: () => void }) {
  const [text, setText] = useState(msg.content)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 320) + "px"
  }, [text])
  useEffect(() => {
    const el = ref.current
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const save = () => {
    const t = text.trim()
    if (!t && !msg.attachments?.length) return
    onClose()
    if (t !== msg.content.trim()) editMessage(chatId, msg.id, t)
  }

  return (
    <div className="w-full rounded-2xl border bg-card p-2.5 shadow-sm">
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose()
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save()
        }}
        aria-label="Edit your message"
        className="min-h-12 resize-none border-0 bg-transparent px-1.5 py-1 text-base shadow-none focus-visible:ring-0 md:text-[15.5px] dark:bg-transparent"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="px-1.5 text-xs text-muted-foreground">Saving adds a new version; the original stays available.</p>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={!text.trim() && !msg.attachments?.length}>
            Save and resend
          </Button>
        </div>
      </div>
    </div>
  )
}

function UserMessage({ chatId, msg, isLast }: { chatId: string; msg: Message; isLast: boolean }) {
  const [editing, setEditing] = useState(false)
  const busy = useUI((s) => !!s.generating[chatId])
  return (
    <div className="group/msg msg-in flex flex-col items-end gap-1.5 py-2" data-role="user">
      {msg.attachments?.length ? (
        <div className="flex max-w-full flex-wrap justify-end gap-2">
          {msg.attachments.map((a) => (
            <AttachmentView key={a.id} a={a} />
          ))}
        </div>
      ) : null}
      {editing ? (
        <EditBox chatId={chatId} msg={msg} onClose={() => setEditing(false)} />
      ) : msg.content ? (
        <div className="max-w-[92%] rounded-2xl rounded-br-md bg-bubble px-4 py-2.5 text-[15.5px] leading-[1.55] break-words whitespace-pre-wrap sm:max-w-[84%]">
          {msg.content}
        </div>
      ) : null}
      {!editing && (
        <div className={cn(actionRow, "justify-end", isLast && "can-hover:opacity-100")}>
          <BranchNav chatId={chatId} msgId={msg.id} />
          <CopyButton text={msg.content} label="Copy message" />
          <IconButton label="Edit message" className="size-8" disabled={busy} onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </IconButton>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Assistant message                                                   */
/* ------------------------------------------------------------------ */

function AssistantMessage({ chatId, msg, isLast }: { chatId: string; msg: Message; isLast: boolean }) {
  const segments = useMemo(() => parseContent(msg.content), [msg.content])
  const expandThinking = useStore((s) => s.settings.expandThinking)
  const provider = useStore((s) => s.settings.provider)
  const catalog = useCatalog((s) => s.data)
  const demo = useDemoMode()
  const modelName = describeModel(msg.model ?? "", catalog).name
  const setFeedback = useStore((s) => s.setFeedback)
  const openSettings = useUI((s) => s.openSettings)
  const busy = useUI((s) => !!s.generating[chatId])
  const streaming = msg.status === "streaming"

  // Version counts per artifact come from the whole thread, so cards can say "version 2".
  const versionCounts = useStore(
    useShallow((s) => {
      const chat = s.chats[chatId]
      if (!chat || !msg.content.includes("<artifact")) return {} as Record<string, number>
      const out: Record<string, number> = {}
      for (const h of collectArtifacts(activeThread(chat))) {
        const n = h.versions.findIndex((v) => v.messageId === msg.id)
        if (n !== -1) out[h.identifier] = n + 1
      }
      return out
    })
  )

  return (
    <div className="group/msg msg-in py-2" data-role="assistant">
      <div className="space-y-4">
        {msg.council && <CouncilPanel council={msg.council} />}
        {segments.map((seg, i) => {
          if (seg.kind === "text") return <Markdown key={i} text={seg.text} />
          if (seg.kind === "thinking")
            return <Thinking key={i} text={seg.text} complete={seg.complete} ms={msg.thinkingMs} defaultOpen={expandThinking} />
          return (
            <ArtifactCard
              key={i}
              chatId={chatId}
              artifact={seg.artifact}
              versions={versionCounts[seg.artifact.identifier] ?? 1}
            />
          )
        })}
      </div>

      {streaming && (
        <div className="mt-3 flex items-center gap-2 font-sans text-sm text-muted-foreground" aria-hidden>
          <LiveDisk labels={false} className="size-5 text-primary" />
          <span className="shimmer">{msg.content ? "Writing" : "Thinking"}</span>
          {msg.route && !msg.council && (
            <span className="truncate text-xs">
              {msg.route.mode === "fallback" ? `· switched to ${msg.route.name}` : `· ${msg.route.name}`}
            </span>
          )}
        </div>
      )}

      {(msg.sources?.length || msg.webNote) && !streaming ? (
        <div className="mt-3">
          <SourceList sources={msg.sources ?? []} note={msg.webNote} />
        </div>
      ) : null}

      {msg.status === "error" && (
        <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 font-sans text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-destructive">Couldn't get a reply</p>
            <p className="mt-0.5 break-words text-muted-foreground">{msg.error}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="xs" variant="outline" onClick={() => retryMessage(chatId, msg.id)} disabled={busy}>
                <RefreshCw /> Try again
              </Button>
              {!(provider === "server" && demo) && (
                <Button size="xs" variant="ghost" onClick={() => openSettings(provider === "server" ? "router" : "model")}>
                  {provider === "server" ? "Check the router" : "Check model settings"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {msg.status === "stopped" && <p className="mt-2 font-sans text-sm text-muted-foreground">Reply stopped.</p>}

      {!streaming && msg.status !== "error" && (
        <div className={cn(actionRow, "font-sans", isLast && "can-hover:opacity-100")}>
          <BranchNav chatId={chatId} msgId={msg.id} />
          <CopyButton text={plainText(msg.content)} label="Copy reply" />
          <IconButton label="Try again" className="size-8" disabled={busy} onClick={() => retryMessage(chatId, msg.id)}>
            <RefreshCw className="size-4" />
          </IconButton>
          <IconButton
            label="Good reply"
            pressed={msg.feedback === "up"}
            className="size-8"
            onClick={() => {
              setFeedback(chatId, msg.id, msg.feedback === "up" ? null : "up")
              if (msg.feedback !== "up") toast.success("Thanks for the feedback")
            }}
          >
            <ThumbsUp className={cn("size-4", msg.feedback === "up" && "fill-current text-primary")} />
          </IconButton>
          <IconButton
            label="Poor reply"
            pressed={msg.feedback === "down"}
            className="size-8"
            onClick={() => {
              setFeedback(chatId, msg.id, msg.feedback === "down" ? null : "down")
              if (msg.feedback !== "down") toast.success("Thanks for the feedback")
            }}
          >
            <ThumbsDown className={cn("size-4", msg.feedback === "down" && "fill-current text-primary")} />
          </IconButton>
          {msg.route && !msg.council ? <RouteChip route={msg.route} className="ml-auto" /> : <span className="ml-auto truncate pl-2 text-xs">{msg.council ? "God Mode" : modelName}</span>}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export const MessageView = memo(function MessageView({ chatId, id, isLast }: { chatId: string; id: string; isLast: boolean }) {
  const msg = useStore((s) => s.chats[chatId]?.nodes[id])
  if (!msg) return null
  return msg.role === "user" ? (
    <UserMessage chatId={chatId} msg={msg} isLast={isLast} />
  ) : (
    <AssistantMessage chatId={chatId} msg={msg} isLast={isLast} />
  )
})
