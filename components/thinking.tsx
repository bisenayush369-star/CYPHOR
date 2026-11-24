import { useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Signal } from "@/components/signal"
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
  /** Keep the block open after the reply is done (Settings > Appearance). It is always open while the model is still thinking. */
  defaultOpen?: boolean
}

/**
 * What the model worked out before it answered. It is open while the model is thinking, so the reasoning can be read
 * as it arrives, and folds away when the answer starts (unless Settings says to keep it open).
 */
export function Thinking({ text, complete, ms, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(!complete || defaultOpen)
  const [elapsed, setElapsed] = useState(0)
  const touched = useRef(false)
  const wasLive = useRef(!complete)
  const box = useRef<HTMLDivElement>(null)

  // The moment the thinking ends, fold it away, unless the person has opened or closed it themselves.
  useEffect(() => {
    if (!complete || !wasLive.current) return
    wasLive.current = false
    if (!touched.current && !defaultOpen) setOpen(false)
  }, [complete, defaultOpen])

  // A running clock while it thinks.
  useEffect(() => {
    if (complete) return
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - t0), 250)
    return () => clearInterval(id)
  }, [complete])

  // Keep the newest line in view while it writes.
  useEffect(() => {
    if (!complete && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [text, complete])

  const label = complete ? (ms ? `Thought for ${seconds(ms)}` : "Thought it through") : elapsed >= 1000 ? `Thinking, ${seconds(elapsed)}` : "Thinking"

  return (
    <Collapsible
      open={open}
      onOpenChange={(o) => {
        touched.current = true
        setOpen(o)
      }}
      className="font-sans"
      data-live={!complete || undefined}
    >
      <CollapsibleTrigger className="hud group/think -ml-1.5 flex items-center gap-1.5 px-1.5 py-1 text-[11px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {complete ? (
          <ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/think:rotate-90" aria-hidden />
        ) : (
          <Signal className="size-4 text-signal" />
        )}
        <span className={cn(!complete && "text-foreground")}>{label}</span>
        {!complete && <span aria-hidden className="segbar-run ml-1 w-16" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div
          ref={box}
          className={cn(
            "mt-1 mb-1 ml-2 max-h-72 overflow-y-auto border-l pl-4 text-[13.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground transition-colors",
            complete ? "border-border" : "border-signal/70"
          )}
        >
          {text || "…"}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
