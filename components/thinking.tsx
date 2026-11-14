import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

function seconds(ms?: number) {
  if (!ms) return ""
  const s = Math.max(1, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

interface Props {
  text: string
  complete: boolean
  ms?: number
  defaultOpen?: boolean
}

export function Thinking({ text, complete, ms, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const label = complete ? (ms ? `Thought for ${seconds(ms)}` : "Thought it through") : "Thinking"

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="font-sans">
      <CollapsibleTrigger
        className="group/think -ml-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/think:rotate-90" aria-hidden />
        <span className={cn(!complete && "shimmer")}>{label}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="mt-1 mb-1 ml-2 max-h-72 overflow-y-auto border-l-2 border-border pl-4 text-[13.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {text || "…"}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
