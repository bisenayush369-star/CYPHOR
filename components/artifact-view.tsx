import { useMemo } from "react"
import type { ArtifactType } from "@/lib/types"
import { Markdown } from "./markdown"
import { CodeBlock } from "./code-block"

/**
 * Generated pages run in a sandboxed frame: scripts may run, but the frame has no access to this
 * app's storage, cookies or DOM, and the CSP below blocks network requests from the page.
 */
const CSP =
  "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; " +
  "style-src 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
  "font-src data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
  "img-src data: blob: https:; media-src data: blob:; connect-src 'none'; form-action 'none'"

export function buildSrcDoc(html: string) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank">`
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${meta}`)
  if (/<html[\s>]/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head>${meta}</head>`)
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${meta}</head><body>${html}</body></html>`
}

function HtmlFrame({ html, title }: { html: string; title: string }) {
  const srcDoc = useMemo(() => buildSrcDoc(html), [html])
  return (
    <iframe
      title={`Preview of ${title}`}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
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
      <img src={src} alt={title} className="max-h-full max-w-full object-contain drop-shadow-sm" />
    </div>
  )
}

interface Props {
  type: ArtifactType
  language?: string
  content: string
  title: string
  tab: "preview" | "code"
}

export function ArtifactView({ type, language, content, title, tab }: Props) {
  if (tab === "code" || type === "code") {
    return (
      <div className="size-full overflow-auto bg-code">
        <CodeBlock
          bare
          code={content}
          language={type === "code" ? language : type === "html" ? "html" : type === "svg" ? "xml" : "markdown"}
          className="min-h-full rounded-none border-0"
        />
      </div>
    )
  }
  if (type === "html") return <HtmlFrame html={content} title={title} />
  if (type === "svg") return <SvgView svg={content} title={title} />
  return (
    <div className="size-full overflow-y-auto">
      <div className="mx-auto max-w-[44rem] px-5 py-6 sm:px-8">
        <Markdown text={content} />
      </div>
    </div>
  )
}
