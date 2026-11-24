"use client"

import { useEffect, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { ArrowDown, MessageSquareOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useStickToBottom } from "@/lib/hooks/use-stick-to-bottom"
import { sendMessage, stopGenerating } from "@/lib/actions"
import { href, useRouteId } from "@/lib/route"
import { activeThread, useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { Composer } from "./composer"
import { MessageView } from "./message"
import Link from "next/link"

const NONE: string[] = []

export function ChatView({ id }: { id: string }) {
  const exists = useStore((s) => !!s.chats[id])
  const ids = useStore(
    useShallow((s) => {
      const c = s.chats[id]
      return c ? activeThread(c).map((m) => m.id) : NONE
    })
  )
  const lastLen = useStore((s) => {
    const c = s.chats[id]
    if (!c) return 0
    const t = activeThread(c)
    const last = t[t.length - 1]
    return last ? last.content.length : 0
  })
  const model = useStore((s) => s.chats[id]?.model ?? s.settings.defaultModel)
  const setChatModel = useStore((s) => s.setChatModel)
  const updateSettings = useStore((s) => s.updateSettings)
  const generating = useUI((s) => !!s.generating[id])

  const { ref, away, toBottom, onScroll } = useStickToBottom<HTMLDivElement>(id, lastLen + ids.length * 100000)

  // Tell screen readers when a reply starts and ends, without reading every streamed word.
  const [status, setStatus] = useState("")
  const was = useRef(false)
  useEffect(() => {
    if (generating && !was.current) setStatus("Cyphor is replying")
    if (!generating && was.current) setStatus("Reply complete")
    was.current = generating
  }, [generating])

  if (!exists) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareOff />
            </EmptyMedia>
            <EmptyTitle>This chat isn't here</EmptyTitle>
            <EmptyDescription>It may have been deleted, or it was saved under a different account.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href={href.home}>Start a new chat</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const send = (text: string, files: Parameters<typeof sendMessage>[2]) => {
    sendMessage(id, text, files)
    requestAnimationFrame(() => toBottom())
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="thread">
        <div className="mx-auto w-full max-w-[46rem] px-4 pt-4 pb-8 sm:px-6">
          {ids.map((mid, i) => (
            <MessageView key={mid} chatId={id} id={mid} isLast={i === ids.length - 1} />
          ))}
        </div>
      </div>

      <div className="relative shrink-0 px-3 pt-1 pb-safe sm:px-6">
        <div className="scene-fade pointer-events-none absolute inset-x-0 bottom-full h-8 bg-gradient-to-t from-background to-transparent" />
        <div className="mx-auto w-full max-w-[46rem]">
          {away && (
            <div className="pointer-events-none absolute -top-12 left-0 flex w-full justify-center">
              <Button
                size="icon"
                variant="outline"
                aria-label="Scroll to latest message"
                onClick={() => toBottom(true)}
                className="pointer-events-auto size-9 rounded-sm bg-card shadow-md animate-in fade-in zoom-in-90 duration-150 max-sm:size-10 pointer-coarse:size-10"
              >
                <ArrowDown />
              </Button>
            </div>
          )}
          <Composer
            draftKey={id}
            generating={generating}
            model={model}
            onModelChange={(m) => {
              setChatModel(id, m)
              updateSettings({ defaultModel: m })
            }}
            onSend={send}
            onStop={() => stopGenerating(id)}
            autoFocus
          />
          <p className="hidden pt-2 pb-1 text-center text-xs text-muted-foreground sm:block">
            Cyphor can make mistakes. Check important information.
          </p>
        </div>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>
    </div>
  )
}

/** Entry point for app/chat/[id]/page.tsx. */
export function ChatRoute() {
  return <ChatView id={useRouteId()} />
}
