import { Code2, FileText, Globe, ImageIcon } from "lucide-react"
import { LiveDisk } from "@/components/cipher-disk"
import type { ParsedArtifact } from "@/lib/parse"
import { useUI } from "@/lib/ui"
import { cn } from "@/lib/utils"
import type { ArtifactType } from "@/lib/types"

export const TYPE_LABEL: Record<ArtifactType, string> = {
  html: "Web page",
  svg: "SVG image",
  markdown: "Document",
  code: "Code",
}

export function TypeIcon({ type, className }: { type: ArtifactType; className?: string }) {
  const Icon = type === "html" ? Globe : type === "svg" ? ImageIcon : type === "markdown" ? FileText : Code2
  return <Icon className={className} aria-hidden />
}

interface Props {
  chatId: string
  artifact: ParsedArtifact
  versions: number
}

/** The compact card shown in the chat. Opening it docks the full artifact beside the conversation. */
export function ArtifactCard({ chatId, artifact, versions }: Props) {
  const open = useUI((s) => s.artifact?.chatId === chatId && s.artifact.identifier === artifact.identifier)
  const openArtifact = useUI((s) => s.openArtifact)
  const writing = !artifact.complete

  return (
    <button
      type="button"
      onClick={() => openArtifact({ chatId, identifier: artifact.identifier })}
      aria-current={open ? "true" : undefined}
      className={cn(
        "group/card flex w-full max-w-md items-center gap-3 rounded-2xl border bg-card p-3 text-left font-sans shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.99]",
        open && "border-primary/60 ring-1 ring-primary/30"
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
        {writing ? <LiveDisk labels={false} className="size-7 text-primary" /> : <TypeIcon type={artifact.type} className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        {/* The button's name comes from its own text, so it always matches what is on screen. */}
        <span className="sr-only">Open </span>
        <span className="block truncate text-[15px] font-medium">{artifact.title}</span>{" "}
        <span className="block truncate text-[13px] text-muted-foreground">
          {writing ? "Writing…" : TYPE_LABEL[artifact.type]}
          {!writing && versions > 1 ? `, version ${versions}` : ""}
        </span>
      </span>
      <span
        aria-hidden
        className="shrink-0 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors group-hover/card:border-primary/40 group-hover/card:text-foreground"
      >
        {open ? "Open" : "View"}
      </span>
    </button>
  )
}
