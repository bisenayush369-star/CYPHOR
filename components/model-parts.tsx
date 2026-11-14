import { Brain, Code, Crown, Scale, Sparkles, Zap, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { ModelProfile, ProviderId, Scores, Tier } from "@/lib/router/types"
import type { ModelDef } from "@/lib/types"
import { cn } from "@/lib/utils"

/** The icon of each Cyphor model, so the picker reads at a glance. */
export const KIND_ICON: Record<NonNullable<ModelDef["kind"]>, LucideIcon> = {
  auto: Sparkles,
  swift: Zap,
  core: Scale,
  deep: Brain,
  code: Code,
  god: Crown,
}

/** A stable hue for each provider, so a name is recognised by colour as well as by its letters. */
function hueOf(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

/**
 * A monogram, not a logo: the first letters of the provider on a tinted square. Decorative, since the
 * provider's name always sits next to it.
 */
export function ProviderMark({ id, label, className }: { id: ProviderId | string; label: string; className?: string }) {
  const hue = hueOf(id)
  const letters = label.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"
  return (
    // The letters are drawn by CSS from data-letters, so they are not text in the page. A button that is named
    // "Answered by Llama, Groq…" and shows this mark would otherwise count as having a visible "G" its name lacks.
    <span
      aria-hidden
      data-letters={letters}
      className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tracking-tight text-foreground before:content-[attr(data-letters)]", className)}
      style={{ backgroundColor: `color-mix(in oklab, oklch(0.7 0.14 ${hue}) 28%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, oklch(0.6 0.14 ${hue}) 35%, transparent)` }}
    />
  )
}

const TIER_LABEL: Record<Tier, string> = { flagship: "Flagship", strong: "Strong", balanced: "Balanced", fast: "Fast", mini: "Mini" }

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <Badge variant={tier === "flagship" ? "default" : "outline"} className={cn("font-sans", className)}>
      {TIER_LABEL[tier]}
    </Badge>
  )
}

const SCORE_ROWS: { key: keyof Scores; label: string; short: string }[] = [
  { key: "reasoning", label: "Reasoning", short: "Reason" },
  { key: "coding", label: "Coding", short: "Code" },
  { key: "writing", label: "Writing", short: "Write" },
  { key: "speed", label: "Speed", short: "Speed" },
]

/** The four ratings of a model as small bars. Estimates from the model family and size, out of 10. */
export function ScoreBars({ scores, className }: { scores: Scores; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-1.5", className)}>
      {SCORE_ROWS.map(({ key, label, short }) => (
        <div key={key} className="flex items-center gap-2">
          <dt className="w-11 shrink-0 text-[11px] text-muted-foreground">{short}</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-1.5">
            <Progress value={scores[key] * 10} aria-label={`${label} ${scores[key]} out of 10`} className="h-1.5 flex-1" />
            <span className="w-6 text-right text-[11px] tabular-nums text-muted-foreground">{scores[key].toFixed(1)}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ModelTags({ profile, className }: { profile: Pick<ModelProfile, "tags" | "free">; className?: string }) {
  if (!profile.tags.length) return null
  return (
    <ul className={cn("flex flex-wrap gap-1", className)} aria-label="Features">
      {profile.tags.map((t) => (
        <li key={t}>
          <Badge variant="secondary" className="px-1.5 py-0 text-[11px] font-normal">
            {t}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

export function formatMs(ms?: number) {
  if (ms === undefined) return ""
  return ms < 950 ? `${Math.round(ms / 10) * 10} ms` : `${(ms / 1000).toFixed(1)} s`
}
