import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { loadPreviewAssets } from "@/lib/artifact/assets"
import { buildPreviewDoc, type PreviewAssets, type PreviewType } from "@/lib/artifact/srcdoc"
import { useDark } from "@/lib/hooks/use-dark"
import { useStickToBottom } from "@/lib/hooks/use-stick-to-bottom"
import type { ArtifactType } from "@/lib/types"
import { highlight } from "./code-block"
import { Markdown } from "./markdown"
import { Signal } from "./signal"

/** What went wrong inside a preview, as far as the page around it can tell. */
export interface PreviewError {
  message: string
  line?: number
  stack?: string
  /** "resource" means a script or stylesheet the page asked for did not load; anything else is an error in the page itself. */
  kind?: "error" | "resource"
}

/** The types that run in a sandboxed frame. SVG, Markdown and plain code are drawn by the app itself. */
export function isSandboxed(type: ArtifactType): type is PreviewType {
  return type === "html" || type === "react" || type === "mermaid"
}

/** True for every type that has something to show besides its source. */
export function hasPreview(type: ArtifactType): boolean {
  return type !== "code"
}

function highlightLanguage(type: ArtifactType, language?: string) {
  switch (type) {
    case "html":
      return "html"
    case "react":
      return "jsx"
    case "svg":
      return "xml"
    case "markdown":
      return "markdown"
    case "mermaid":
      return undefined
    default:
      return language
  }
}

function formatSize(chars: number) {
  return chars < 1024 ? `${chars} characters` : `${(chars / 1024).toFixed(chars < 10240 ? 1 : 0)} KB`
}

/** The whole source, numbered, following the model while it is still writing. */
function CodeView({ content, language, streaming, resetKey }: { content: string; language?: string; streaming: boolean; resetKey: string }) {
  const shown = useDeferredValue(content)
  // Colouring a big file on every update makes a streaming reply stutter, so a long file is coloured once it is done.
  const html = useMemo(() => (streaming && shown.length > 12_000 ? null : highlight(shown, language)), [shown, language, streaming])
  const lines = useMemo(() => (shown ? shown.split("\n").length : 0), [shown])
  const gutter = useMemo(() => Array.from({ length: lines }, (_, i) => i + 1).join("\n"), [lines])
  // A file that is still being written is followed to its end; a finished one opens at its first line.
  const { ref, onScroll } = useStickToBottom<HTMLDivElement>(resetKey, streaming ? shown : "", streaming ? "bottom" : "top")

  return (
    <div className="flex size-full min-h-0 flex-col bg-code">
      <div ref={ref} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="flex min-h-full w-max min-w-full font-mono text-[12.5px] leading-[1.65] sm:text-[13px]">
          <pre aria-hidden className="sticky left-0 m-0 shrink-0 bg-code py-3.5 pr-3 pl-3.5 text-right text-muted-foreground select-none">
            {gutter}
          </pre>
          <pre className="m-0 grow py-3.5 pr-5 pl-1" tabIndex={0} aria-label="Artifact source">
            {html ? <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} /> : <code className="hljs">{shown}</code>}
          </pre>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t px-3.5 py-1.5 text-xs text-muted-foreground">
        <span>
          {lines} {lines === 1 ? "line" : "lines"} · {formatSize(shown.length)}
        </span>
        {streaming && (
          <span className="flex items-center gap-1.5 text-signal">
            <Signal className="size-4" /> Writing
          </span>
        )}
      </div>
    </div>
  )
}

const SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals allow-pointer-lock allow-downloads"

/**
 * A page, React component or diagram running in a sandboxed frame. The frame cannot reach this app (no
 * allow-same-origin), and it reports errors back through postMessage, tagged with a token that changes with every
 * page so a message from a page that has been replaced is ignored.
 */
function SandboxFrame({
  type,
  content,
  title,
  reloadKey,
  onError,
}: {
  type: PreviewType
  content: string
  title: string
  reloadKey: number
  onError?: (e: PreviewError | null) => void
}) {
  const dark = useDark()
  const frame = useRef<HTMLIFrameElement>(null)
  const [assets, setAssets] = useState<PreviewAssets | null>(null)
  const [assetError, setAssetError] = useState<string | null>(null)
  const needsAssets = type === "react"

  useEffect(() => {
    if (!needsAssets) return
    let live = true
    loadPreviewAssets().then(
      (a) => live && setAssets(a),
      (e) => live && setAssetError(e instanceof Error ? e.message : String(e))
    )
    return () => {
      live = false
    }
  }, [needsAssets, reloadKey])

  // Only a diagram's colours follow the app's theme; a page or component is drawn the way its author meant.
  const theme = type === "mermaid" && dark ? "dark" : "light"
  const page = useMemo(() => {
    if (needsAssets && !assets) return null
    const token = Math.random().toString(36).slice(2, 12)
    try {
      return { token, doc: buildPreviewDoc({ type, content, title, theme, token, assets: assets ?? undefined }) }
    } catch {
      return null
    }
    // reloadKey is a deliberate dependency: it asks for a fresh page with the same content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, content, title, theme, assets, needsAssets, reloadKey])

  const token = page?.token
  useEffect(() => {
    onError?.(null)
    if (!token) return
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const d = e.data as { __cyphor?: string; type?: string; message?: unknown; line?: unknown; stack?: unknown } | null
      if (!d || typeof d !== "object" || d.__cyphor !== token) return
      if (d.type !== "error" && d.type !== "resource") return
      onError?.({
        kind: d.type,
        message: String(d.message ?? "Unknown error").slice(0, 1200),
        line: typeof d.line === "number" && d.line > 0 ? d.line : undefined,
        stack: typeof d.stack === "string" ? d.stack.slice(0, 1500) : undefined,
      })
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [token, onError])

  if (assetError) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">The preview engine didn't load.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          React previews need public/artifact/runtime.js and public/artifact/tailwind.js to be served with the app. The Code tab still works. ({assetError})
        </p>
      </div>
    )
  }
  if (!page) {
    return (
      <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Signal className="size-5 text-signal" /> Starting preview
      </div>
    )
  }
  return (
    <iframe
      ref={frame}
      key={page.token}
      title={`Preview of ${title}`}
      srcDoc={page.doc}
      sandbox={SANDBOX}
      allow="clipboard-write; fullscreen"
      allowFullScreen
      referrerPolicy="no-referrer"
      className="size-full border-0 bg-white"
    />
  )
}

function SvgView({ svg, title }: { svg: string; title: string }) {
  // An <img> never runs scripts, so SVG from a model cannot execute code here.
  const src = useMemo(() => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), [svg])
  return (
    <div className="flex size-full items-center justify-center overflow-auto bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] [background-size:20px_20px] p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} className="max-h-full max-w-full object-contain drop-shadow-sm" />
    </div>
  )
}

export type ArtifactTab = "preview" | "code" | "split"

interface Props {
  type: ArtifactType
  language?: string
  content: string
  title: string
  tab: ArtifactTab
  /** True while the model is still writing this artifact. */
  streaming?: boolean
  /** Changes when the person asks for a fresh preview. */
  reloadKey?: number
  /** Identifies the artifact and version, so the code view jumps to the top when another one opens. */
  resetKey?: string
  onPreviewError?: (e: PreviewError | null) => void
}

function Preview({ type, content, title, reloadKey = 0, onPreviewError }: Pick<Props, "type" | "content" | "title" | "reloadKey" | "onPreviewError">) {
  if (isSandboxed(type)) return <SandboxFrame type={type} content={content} title={title} reloadKey={reloadKey} onError={onPreviewError} />
  if (type === "svg") return <SvgView svg={content} title={title} />
  return (
    <div className="size-full overflow-y-auto">
      <div className="mx-auto max-w-[44rem] px-5 py-6 sm:px-8">
        <Markdown text={content} />
      </div>
    </div>
  )
}

export function ArtifactView({ type, language, content, title, tab, streaming = false, reloadKey = 0, resetKey = "", onPreviewError }: Props) {
  const code = <CodeView content={content} language={highlightLanguage(type, language)} streaming={streaming} resetKey={resetKey} />
  if (tab === "code" || !hasPreview(type)) return code
  const preview = <Preview type={type} content={content} title={title} reloadKey={reloadKey} onPreviewError={onPreviewError} />
  if (tab === "split") {
    return (
      <div className="grid size-full grid-cols-2 divide-x">
        <div className="min-w-0">{code}</div>
        <div className="min-w-0">{preview}</div>
      </div>
    )
  }
  return preview
}
