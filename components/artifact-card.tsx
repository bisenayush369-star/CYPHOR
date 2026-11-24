import { useState } from "react"
import { Atom, Check, Code2, Copy, FileText, Globe, Shapes, Workflow, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Signal } from "@/components/signal"
import type { ParsedArtifact } from "@/lib/parse"
import type { ArtifactType } from "@/lib/types"
import { useUI } from "@/lib/ui"
import { cn, copyText } from "@/lib/utils"
import { IconButton } from "./icon-button"

export const TYPE_LABEL: Record<ArtifactType, string> = {
  html: "Web page",
  react: "React app",
  svg: "SVG image",
  mermaid: "Diagram",
  markdown: "Document",
  code: "Code",
}

/** One colour of the genre per kind of artifact, so a long thread of them reads at a glance. */
export const TYPE_COLOR: Record<ArtifactType, string> = {
  html: "var(--c-cyan)",
  react: "var(--c-magenta)",
  svg: "var(--c-violet)",
  mermaid: "var(--c-green)",
  markdown: "var(--c-yellow)",
  code: "var(--c-orange)",
}

const ICONS: Record<ArtifactType, LucideIcon> = {
  html: Globe,
  react: Atom,
  svg: Shapes,
  mermaid: Workflow,
  markdown: FileText,
  code: Code2,
}

export function TypeIcon({ type, className, tinted }: { type: ArtifactType; className?: string; tinted?: boolean }) {
  const Icon = ICONS[type]
  return <Icon className={className} style={tinted ? { color: TYPE_COLOR[type] } : undefined} aria-hidden />
}

interface Props {
  chatId: string
  artifact: ParsedArtifact
  versions: number
  /** True while the reply this card belongs to is still being written. */
  streaming?: boolean
}

/** The compact card shown in the chat. Opening it docks the full artifact beside the conversation. */
export function ArtifactCard({ chatId, artifact, versions, streaming = false }: Props) {
  const open = useUI((s) => s.artifact?.chatId === chatId && s.artifact.identifier === artifact.identifier)
  const openArtifact = useUI((s) => s.openArtifact)
  const [copied, setCopied] = useState(false)
  const writing = !artifact.complete && streaming
  const cutOff = !artifact.complete && !streaming

  const copy = async () => {
    if (await copyText(artifact.content)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else toast.error("Couldn't copy. Open the artifact and copy from the Code tab.")
  }

  return (
    <div
      className={cn("cut cut-sm group/card flex w-full max-w-md items-stretch font-sans transition-[--edge] duration-200 [--edge:var(--border)] [--fill:var(--card)] hover:[--edge:var(--type)]", open && "[--edge:var(--type)]")}
      style={{ "--type": TYPE_COLOR[artifact.type] } as React.CSSProperties}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: TYPE_COLOR[artifact.type] }} />
      <button
        type="button"
        onClick={() => openArtifact({ chatId, identifier: artifact.identifier })}
        aria-current={open ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 pl-4 text-left active:brightness-90"
      >
        <span className="flex size-11 shrink-0 items-center justify-center bg-muted">
          {writing ? <Signal className="size-7 text-signal" /> : <TypeIcon type={artifact.type} tinted className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          {/* The button's name comes from its own text, so it always matches what is on screen. */}
          <span className="sr-only">Open </span>
          <span className="block truncate text-[15px] font-medium">{artifact.title}</span>{" "}
          <span className="block truncate text-[13px] text-muted-foreground">
            {writing ? "Writing…" : cutOff ? `${TYPE_LABEL[artifact.type]}, cut off` : TYPE_LABEL[artifact.type]}
            {!writing && versions > 1 ? `, version ${versions}` : ""}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1 pr-2.5">
        <IconButton label={copied ? "Copied" : "Copy code"} onClick={copy} disabled={writing || !artifact.content}>
          {copied ? <Check className="text-primary" /> : <Copy />}
        </IconButton>
        <span aria-hidden className="border px-2.5 py-1 text-xs text-muted-foreground transition-colors group-hover/card:text-foreground">
          {open ? "Open" : "View"}
        </span>
      </div>
    </div>
  )
}
