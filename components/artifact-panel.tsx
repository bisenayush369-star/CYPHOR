import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Check, Copy, Download, Maximize2, Minimize2, RefreshCw, TriangleAlert, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sendMessage } from "@/lib/actions"
import { artifactExtension, collectArtifacts } from "@/lib/parse"
import { activeThread, useStore } from "@/lib/store"
import type { ArtifactType } from "@/lib/types"
import { useUI } from "@/lib/ui"
import { cn, copyText, downloadBlob } from "@/lib/utils"
import { reportSave } from "./save-report"
import { ArtifactView, hasPreview, isSandboxed, type ArtifactTab, type PreviewError } from "./artifact-view"
import { TYPE_LABEL, TypeIcon } from "./artifact-card"
import { IconButton } from "./icon-button"

const MIME: Record<ArtifactType, string> = {
  html: "text/html",
  react: "text/javascript",
  svg: "image/svg+xml",
  mermaid: "text/plain",
  markdown: "text/markdown",
  code: "text/plain",
}

/** Narrowest panel that still has room for the code and the preview side by side. */
const SPLIT_MIN_WIDTH = 880

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
  const [reload, setReload] = useState(0)
  const [error, setError] = useState<PreviewError | null>(null)
  const [section, setSection] = useState<HTMLElement | null>(null)
  const [wide, setWide] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  const history = useMemo(() => {
    if (!chat || !view) return undefined
    return collectArtifacts(activeThread(chat)).find((a) => a.identifier === view.identifier)
  }, [chat, view])

  const fullscreen = !!view?.fullscreen
  const floating = mode === "overlay" || fullscreen

  // The first error of a page is the useful one; later ones are usually what it caused.
  const onPreviewError = useCallback((e: PreviewError | null) => setError((prev) => (e === null ? null : (prev ?? e))), [])

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

  // Side by side only makes sense once the panel is wide enough to read both halves.
  useEffect(() => {
    if (!section || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= SPLIT_MIN_WIDTH))
    ro.observe(section)
    return () => ro.disconnect()
  }, [section])

  if (!view) return null

  const versions = history?.versions ?? []
  const index = view.version === null ? versions.length - 1 : Math.min(view.version, versions.length - 1)
  const current = versions[index]?.artifact
  const streaming = !!current && !current.complete && generating
  const previewable = !!current && hasPreview(current.type)
  const canSplit = previewable && wide
  const tab: ArtifactTab = !previewable || streaming ? "code" : view.tab === "split" && !canSplit ? "preview" : view.tab
  const showError = !!error && tab !== "code" && !streaming
  // A diagram's engine comes from a CDN this app picked, so failing to load it is the connection's problem, not the model's.
  const engineDown = error?.kind === "resource" && current?.type === "mermaid"

  const copy = async () => {
    if (!current) return
    if (await copyText(current.content)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else toast.error("Couldn't copy. Open the Code tab, select all and copy from there.")
  }

  const download = async () => {
    if (!current) return
    const base = current.identifier.replace(/[^a-z0-9-]+/gi, "-") || "artifact"
    reportSave(await downloadBlob(`${base}.${artifactExtension(current.type, current.language)}`, current.content, MIME[current.type]))
  }

  const fix = () => {
    if (!current || !error) return
    const where = error.line ? ` (line ${error.line})` : ""
    sendMessage(view.chatId, `The preview of "${current.title}" shows this error${where}:\n\n${error.message}\n\nFix it and send the complete updated artifact.`)
    setError(null)
  }

  const panel = (
    <section
      ref={setSection}
      aria-label={current ? `Artifact: ${current.title}` : "Artifact"}
      role={floating ? "dialog" : undefined}
      aria-modal={floating ? true : undefined}
      className={cn(
        "flex min-h-0 min-w-0 flex-col bg-background",
        mode === "dock" && !fullscreen && "h-full border-l",
        floating && "fixed inset-0 z-50 h-dvh animate-in fade-in slide-in-from-right-8 duration-200 pt-safe px-safe"
      )}
    >
      <header className="shrink-0 border-b">
        <div className="flex items-center gap-1.5 px-2 py-2 sm:px-3">
          {mode === "overlay" ? (
            <IconButton ref={closeRef} label="Back to chat" onClick={close}>
              <ArrowLeft />
            </IconButton>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5">
            {current && <TypeIcon type={current.type} tinted className="size-4 shrink-0" />}
            <div className="min-w-0">
              <h2 className="truncate text-sm leading-tight font-medium">{current?.title ?? "Artifact"}</h2>
              {current && (
                <p className="truncate text-xs text-muted-foreground">
                  {TYPE_LABEL[current.type]}
                  {streaming ? ", writing" : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button type="button" size="sm" onClick={copy} disabled={!current} aria-label={copied ? "Copied" : "Copy code"} className="gap-1.5 max-sm:min-h-10 max-sm:px-3 pointer-coarse:min-h-10">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              <span className="max-[400px]:hidden">{copied ? "Copied" : "Copy code"}</span>
              <span aria-hidden className="hidden max-[400px]:inline">
                {copied ? "Copied" : "Copy"}
              </span>
            </Button>
            <IconButton label="Download" onClick={download} disabled={!current}>
              <Download />
            </IconButton>
            {mode === "dock" && (
              <IconButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={() => patch({ fullscreen: !fullscreen })}>
                {fullscreen ? <Minimize2 /> : <Maximize2 />}
              </IconButton>
            )}
            {mode === "dock" && (
              <IconButton ref={floating ? closeRef : undefined} label="Close" onClick={close}>
                <X />
              </IconButton>
            )}
          </div>
        </div>

        {(previewable || versions.length > 1) && (
          <div className="flex items-center gap-2 px-3 pb-2">
            {previewable && (
              <ToggleGroup
                type="single"
                value={tab}
                onValueChange={(v) => v && patch({ tab: v as ArtifactTab })}
                variant="outline"
                size="sm"
                aria-label="View"
                className="shrink-0"
              >
                <ToggleGroupItem value="preview" disabled={streaming} className="px-3 text-xs">
                  Preview
                </ToggleGroupItem>
                <ToggleGroupItem value="code" className="px-3 text-xs">
                  Code
                </ToggleGroupItem>
                {canSplit && (
                  <ToggleGroupItem value="split" disabled={streaming} className="px-3 text-xs">
                    Split
                  </ToggleGroupItem>
                )}
              </ToggleGroup>
            )}
            {versions.length > 1 && (
              <Select value={String(index)} onValueChange={(v) => patch({ version: Number(v) === versions.length - 1 ? null : Number(v) })}>
                <SelectTrigger size="sm" aria-label="Version" className="w-[8.25rem] shrink-0">
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
            <span className="flex-1" />
            {current && isSandboxed(current.type) && tab !== "code" && (
              <IconButton label="Reload preview" onClick={() => setReload((n) => n + 1)} disabled={streaming}>
                <RefreshCw />
              </IconButton>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1">
        {current ? (
          <ArtifactView
            type={current.type}
            language={current.language}
            content={current.content}
            title={current.title}
            tab={tab}
            streaming={streaming}
            reloadKey={reload}
            resetKey={`${view.chatId}:${view.identifier}:${index}`}
            onPreviewError={onPreviewError}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">This artifact isn't part of the version of the conversation you're viewing.</p>
          </div>
        )}
      </div>

      {showError && error && (
        <div role="alert" className="flex shrink-0 items-start gap-2.5 border-t border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug break-words">
            <span className="font-medium">{engineDown ? "The diagram engine didn't load." : "The preview hit an error."}</span>{" "}
            <span className="text-muted-foreground">{engineDown ? "Check your connection and reload the preview, or read the diagram source in the Code tab." : error.message}</span>
          </p>
          {!engineDown && (
            <Button type="button" size="sm" onClick={fix} disabled={generating} className="shrink-0">
              Fix with Cyphor
            </Button>
          )}
          <IconButton label="Dismiss error" onClick={() => setError(null)} className="shrink-0">
            <X />
          </IconButton>
        </div>
      )}
      <span role="status" className="sr-only">
        {copied ? "Code copied to the clipboard" : ""}
      </span>
    </section>
  )

  return floating ? createPortal(panel, document.body) : panel
}
