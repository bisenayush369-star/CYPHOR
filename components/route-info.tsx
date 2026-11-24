import { useState } from "react"
import { ChevronDown, CircleCheck, CircleX, Clock, Crown, ExternalLink, Globe, Info, Route, TriangleAlert } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import type { CouncilInfo, CouncilMember, RouteInfo, WebSource } from "@/lib/router/types"
import { cn } from "@/lib/utils"
import { formatMs, ProviderMark } from "./model-parts"

const MODE_LABEL: Record<RouteInfo["mode"], string> = {
  auto: "Chosen by Cyphor",
  direct: "Chosen by you",
  fallback: "Switched after a failure",
  council: "God Mode",
}

/** Which model answered, and why. Sits in the row of actions under a reply. */
export function RouteChip({ route, className }: { route: RouteInfo; className?: string }) {
  const fell = route.mode === "fallback"
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Answered by ${route.name}, ${route.providerLabel}. ${MODE_LABEL[route.mode]}. Show details`}
          className={cn(
            "cut cut-sm inline-flex min-h-8 max-w-[14rem] min-w-0 items-center gap-1.5 px-2 text-xs text-muted-foreground [--edge:transparent] [--fill:transparent] transition-colors hover:text-foreground hover:[--edge:var(--border)] hover:[--fill:var(--accent)] focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            className
          )}
        >
          {fell ? <TriangleAlert className="size-3.5 shrink-0 text-cp-orange" aria-hidden /> : <ProviderMark id={route.provider} label={route.providerLabel} className="size-4 [--cut:4px] after:content-none" />}
          <span className="truncate">{route.name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="How this reply was made" className="w-72 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <ProviderMark id={route.provider} label={route.providerLabel} />
          <div className="min-w-0">
            <p className="truncate font-medium">{route.name}</p>
            <p className="truncate text-xs text-muted-foreground">{route.providerLabel}</p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <Route className="size-3.5 text-signal" aria-hidden /> {MODE_LABEL[route.mode]}
        </p>
        <p className="text-[13px] leading-snug text-muted-foreground">{route.reason}</p>
      </PopoverContent>
    </Popover>
  )
}

function MemberStatus({ m }: { m: CouncilMember }) {
  if (m.status === "pending")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Spinner className="size-3.5" /> Drafting
      </span>
    )
  if (m.status === "done")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CircleCheck className="size-3.5 text-cp-green" aria-hidden /> {formatMs(m.ms)}
      </span>
    )
  if (m.status === "timeout")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3.5 text-cp-orange" aria-hidden /> Too slow
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <CircleX className="size-3.5" aria-hidden /> Failed
    </span>
  )
}

function summary(c: CouncilInfo) {
  const done = c.members.filter((m) => m.status === "done").length
  if (c.phase === "drafting") return `Asking ${c.members.length} providers… ${done} answered`
  if (c.phase === "synthesizing") return `${done} drafts in. ${c.chair ? `${c.chair.name} is merging them…` : "Merging…"}`
  if (c.phase === "fallback") return c.note ?? "The council could not meet."
  return `${done} of ${c.members.length} answered${c.chair ? `, merged by ${c.chair.name}` : ""}`
}

/** God Mode: who was asked, who answered, and who merged the answers. Open while it works, folded away after. */
export function CouncilPanel({ council }: { council: CouncilInfo }) {
  const busy = council.phase === "drafting" || council.phase === "synthesizing"
  const [chosen, setChosen] = useState<boolean | null>(null)
  const open = chosen ?? busy
  return (
    <Collapsible open={open} onOpenChange={setChosen} className="font-sans">
      <div className="cut [--fill:color-mix(in_oklab,var(--card)_70%,transparent)]">
        <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-ring">
          <Crown className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="hud block text-[12px]">God Mode</span>
            <span className="line-clamp-2 text-xs text-muted-foreground" aria-live="polite">
              {summary(council)}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y border-t">
            {council.members.map((m) => (
              <li key={m.key} className="flex items-start gap-2.5 px-3 py-2">
                <ProviderMark id={m.provider} label={m.providerLabel} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-medium">
                      {m.providerLabel} <span className="font-normal text-muted-foreground">· {m.name}</span>
                    </p>
                    <MemberStatus m={m} />
                  </div>
                  {m.snippet && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{m.snippet}</p>}
                  {m.error && m.status === "failed" && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{m.error}</p>}
                </div>
              </li>
            ))}
          </ul>
          {council.note && council.phase !== "fallback" && (
            <p className="flex items-start gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {council.note}
            </p>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/** The pages a web search found, so every claim can be checked. */
export function SourceList({ sources, note }: { sources: WebSource[]; note?: string }) {
  const [all, setAll] = useState(false)
  if (!sources.length && !note) return null
  const shown = all ? sources : sources.slice(0, 4)
  return (
    <div className="font-sans">
      {sources.length > 0 && (
        <>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Globe className="size-3.5" aria-hidden /> Sources
          </p>
          <ol className="flex flex-wrap gap-1.5">
            {shown.map((s, i) => (
              <li key={s.url} className="min-w-0 max-w-full">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.snippet ? `${s.title}. ${s.snippet}` : s.title}
                  className="cut cut-sm inline-flex min-h-8 max-w-full items-center gap-1.5 px-2.5 py-1 text-xs transition-colors hover:[--fill:var(--accent)] focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="truncate">{s.site ?? s.title}</span>
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="sr-only">{s.title}, opens in a new tab</span>
                </a>
              </li>
            ))}
            {sources.length > 4 && (
              <li>
                <button type="button" onClick={() => setAll((v) => !v)} className="min-h-8 px-2.5 text-xs text-link underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-ring">
                  {all ? "Show fewer" : `Show all ${sources.length}`}
                </button>
              </li>
            )}
          </ol>
        </>
      )}
      {note && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {note}
        </p>
      )}
    </div>
  )
}
