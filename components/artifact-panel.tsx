import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Check, Copy, Download, Maximize2, Minimize2, X } from "lucide-react"
import { toast } from "sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { artifactExtension, collectArtifacts } from "@/lib/parse"
import { activeThread, useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { cn, copyText, downloadBlob } from "@/lib/utils"
import { reportSave } from "./save-report"
import { ArtifactView } from "./artifact-view"
import { TYPE_LABEL, TypeIcon } from "./artifact-card"
import { IconButton } from "./icon-button"
import { LiveDisk } from "./cipher-disk"

const MIME = { html: "text/html", svg: "image/svg+xml", markdown: "text/markdown", code: "text/plain" } as const

interface Props {
  /** "dock" sits beside the chat on wide screens; "overlay" covers the screen on small ones. */
  mode: "dock" | "overlay"
}

export function ArtifactPanel({ mode }: Props) {
  const view = useUI((s) => s.artifact)
  const patch = useUI((s) => s.patchArtifact)
  const close = useUI((s) => s.closeArtifact)
  const chat = useStore((s) => (view ? s.chats[view.chatId] : undefined))
  const generating = useUI((s) => (view ? !!s.generating[view.chatId] : false))
  const [copied, setCopied] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  const history = useMemo(() => {
    if (!chat || !view) return undefined
    return collectArtifacts(activeThread(chat)).find((a) => a.identifier === view.identifier)
  }, [chat, view])

  const fullscreen = !!view?.fullscreen
  const floating = mode === "overlay" || fullscreen

  // Escape leaves fullscreen first, then closes the panel when it covers the screen.
  useEffect(() => {
    if (!view || !floating) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (document.querySelector('[role="dialog"][data-state="open"], [role="listbox"], [role="menu"]')) return
      if (fullscreen) patch({ fullscreen: false })
      else if (mode === "overlay") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [view, floating, fullscreen, mode, patch, close])

  // Move focus into a full-screen panel when it opens.
  useEffect(() => {
    if (floating) closeRef.current?.focus()
  }, [floating, view?.identifier])

  // Lock page scroll behind a full-screen panel.
  useEffect(() => {
    if (!floating) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [floating])

  if (!view) return null

  const versions = history?.versions ?? []
  const index = view.version === null ? versions.length - 1 : Math.min(view.version, versions.length - 1)
  const current = versions[index]?.artifact
  const streaming = !!current && !current.complete && generating
  const tab: "preview" | "code" = current?.type === "code" || streaming ? "code" : view.tab

  const copy = async () => {
    if (!current) return
    if (await copyText(current.content)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else toast.error("Couldn't copy. Open the Code tab and copy from there.")
  }

  const download = async () => {
    if (!current) return
    const base = current.identifier.replace(/[^a-z0-9-]+/gi, "-") || "artifact"
    reportSave(await downloadBlob(`${base}.${artifactExtension(current.type, current.language)}`, current.content, MIME[current.type]))
  }

  const panel = (
    <section
      aria-label={current ? `Artifact: ${current.title}` : "Artifact"}
      role={floating ? "dialog" : undefined}
      aria-modal={floating ? true : undefined}
      className={cn(
        "flex min-h-0 min-w-0 flex-col bg-background",
        mode === "dock" && !fullscreen && "h-full border-l",
        floating && "fixed inset-0 z-50 h-dvh animate-in fade-in slide-in-from-right-8 duration-200 pt-safe px-safe"
      )}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 border-b px-2 py-2 sm:flex-nowrap sm:px-3">
        {mode === "overlay" ? (
          <IconButton ref={closeRef} label="Back to chat" onClick={close}>
            <ArrowLeft />
          </IconButton>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1.5">
          {current && <TypeIcon type={current.type} className="size-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <h2 className="truncate text-sm leading-tight font-medium">{current?.title ?? "Artifact"}</h2>
            {current && <p className="truncate text-xs text-muted-foreground">{TYPE_LABEL[current.type]}</p>}
          </div>
          {streaming && <LiveDisk labels={false} className="ml-1 size-5 shrink-0 text-primary" />}
        </div>

        {/* On a phone the view switch and version picker drop to a second row so the title keeps room. */}
        {(versions.length > 1 || (current && current.type !== "code")) && (
          <div className="flex items-center gap-2 px-1 max-sm:order-last max-sm:basis-full sm:contents">
            {versions.length > 1 && (
              <Select
                value={String(index)}
                onValueChange={(v) => patch({ version: Number(v) === versions.length - 1 ? null : Number(v) })}
              >
                <SelectTrigger size="sm" aria-label="Version" className="w-[6.5rem] shrink-0 max-sm:order-2 max-sm:ml-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      Version {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {current && current.type !== "code" && (
              <ToggleGroup
                type="single"
                value={tab}
                onValueChange={(v) => v && patch({ tab: v as "preview" | "code" })}
                variant="outline"
                size="sm"
                aria-label="View"
                className="shrink-0 max-sm:order-1"
              >
                <ToggleGroupItem value="preview" disabled={streaming} className="px-2.5 text-xs">
                  Preview
                </ToggleGroupItem>
                <ToggleGroupItem value="code" className="px-2.5 text-xs">
                  Code
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center">
          <IconButton label={copied ? "Copied" : "Copy code"} onClick={copy} disabled={!current}>
            {copied ? <Check className="text-primary" /> : <Copy />}
          </IconButton>
          <IconButton label="Download" onClick={download} disabled={!current}>
            <Download />
          </IconButton>
          {mode === "dock" && (
            <IconButton
              label={fullscreen ? "Exit full screen" : "Full screen"}
              onClick={() => patch({ fullscreen: !fullscreen })}
            >
              {fullscreen ? <Minimize2 /> : <Maximize2 />}
            </IconButton>
          )}
          {mode === "dock" && (
            <IconButton ref={floating ? closeRef : undefined} label="Close" onClick={close}>
              <X />
            </IconButton>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {current ? (
          <ArtifactView type={current.type} language={current.language} content={current.content} title={current.title} tab={tab} />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              This artifact isn't part of the version of the conversation you're viewing.
            </p>
          </div>
        )}
      </div>
    </section>
  )

  return floating ? createPortal(panel, document.body) : panel
}
