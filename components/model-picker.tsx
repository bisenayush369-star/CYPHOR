import { useDeferredValue, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { ArrowLeft, Check, ChevronDown, ChevronRight, Library, Network, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { describeModel, useCatalog } from "@/lib/catalog"
import { DEFAULT_MODELS } from "@/lib/models/page"
import { EFFORTS, effortLabel, type Effort } from "@/lib/router/effort"
import { quality } from "@/lib/router/profiles"
import type { ModelProfile, ProviderId } from "@/lib/router/types"
import { useModelList, useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { cn } from "@/lib/utils"
import { KIND_ICON, TIER_LABEL } from "./model-parts"

/**
 * The model picker. One button in the composer shows the model and the effort; it opens a small panel:
 *
 *   the model in use, with what it is for and a check      (Cyphor Auto, Swift, Core, Deep, Code, God Mode)
 *   Effort  Medium  >                                       (how hard a reply tries: Low, Medium, High)
 *   More models  >                                          (every model your connected providers offer, with search)
 *
 * The panel has three views that replace each other inside it, so it never opens a second layer on a phone.
 */

type View = "main" | "effort" | "more"

interface Props {
  model: string
  onChange: (id: string) => void
  side?: "top" | "bottom"
}

const PER_PROVIDER = 5
const MAX_RESULTS = 80

const fmtContext = (n: number | null) => (n ? (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : `${Math.round(n / 1000)}K`) + " context" : "")
const detail = (m: ModelProfile) => [TIER_LABEL[m.tier], ...m.tags.slice(0, 2), fmtContext(m.context)].filter(Boolean).join(" · ")

/** One selectable line. A thin yellow bar marks the one the keyboard or pointer is on. */
function Row({
  selected,
  onSelect,
  disabled,
  icon,
  title,
  note,
  extra,
  role = "option",
}: {
  selected?: boolean
  onSelect: () => void
  disabled?: boolean
  icon?: ReactNode
  title: ReactNode
  note?: ReactNode
  extra?: ReactNode
  role?: "option" | "button"
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === "option" ? !!selected : undefined}
      aria-disabled={disabled || undefined}
      data-row
      data-selected={selected || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "relative flex w-full items-start gap-2.5 px-3 py-2 text-left outline-none transition-colors",
        "before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-marker before:opacity-0 hover:bg-accent hover:before:opacity-100 focus-visible:bg-accent focus-visible:before:opacity-100",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent disabled:hover:before:opacity-0",
        "pointer-coarse:py-2.5"
      )}
    >
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-5 font-medium">{title}</span>
        {note && <span className="block text-xs leading-[1.15rem] text-muted-foreground">{note}</span>}
        {extra}
      </span>
      {selected && <Check className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />}
    </button>
  )
}

/** A line that opens another view: it shows where it goes and, when there is one, the current value. */
function GoRow({ label, value, onGo, icon }: { label: string; value?: string; onGo: () => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      data-row
      onClick={onGo}
      className="relative flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-marker before:opacity-0 hover:bg-accent hover:before:opacity-100 focus-visible:bg-accent focus-visible:before:opacity-100"
    >
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      <span>{label}</span>
      {value && <span className="ml-auto text-muted-foreground">{value}</span>}
      <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground", !value && "ml-auto")} aria-hidden />
    </button>
  )
}

function Back({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1 border-b px-1.5 py-1">
      <button
        type="button"
        data-row
        aria-label="Back to the model list"
        onClick={onBack}
        className="flex size-8 items-center justify-center text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent pointer-coarse:size-10"
      >
        <ArrowLeft className="size-4" aria-hidden />
      </button>
      <span className="hud text-xs">{title}</span>
    </div>
  )
}

export function ModelPicker({ model, onChange, side = "top" }: Props) {
  const own = useModelList()
  const provider = useStore((s) => s.settings.provider)
  const effort = useStore((s) => s.settings.effort)
  const update = useStore((s) => s.updateSettings)
  const openSettings = useUI((s) => s.openSettings)
  const openLibrary = useUI((s) => s.openLibrary)
  const data = useCatalog((s) => s.data)

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>("main")
  const [q, setQ] = useState("")
  const query = useDeferredValue(q).trim().toLowerCase()
  const [expanded, setExpanded] = useState<Set<ProviderId>>(() => new Set())
  const panel = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const titleId = useId()

  const router = provider === "server"
  const info = router ? describeModel(model, data) : null
  const name = router ? info!.name : ((own.find((m) => m.id === model) ?? own[0])?.name ?? model)
  const Icon = info?.kind ? KIND_ICON[info.kind] : null
  // A model picked by name that is not one of the Cyphor models gets its own row, so the panel shows what is in use.
  const picked = router && !DEFAULT_MODELS.some((m) => m.id === model) ? info : null
  const godReady = !data || data.mode === "demo" || data.godReady
  const models = data?.models ?? []
  const hasModels = router && models.length > 0
  const connected = data?.providers.filter((p) => p.configured).length ?? 0

  const groups = useMemo(() => {
    const labels = new Map((data?.providers ?? []).map((p) => [p.id, p.label]))
    const by = new Map<ProviderId, ModelProfile[]>()
    for (const m of models) {
      if (query && !`${m.name} ${m.id} ${m.tags.join(" ")} ${labels.get(m.provider) ?? m.provider}`.toLowerCase().includes(query)) continue
      by.set(m.provider, [...(by.get(m.provider) ?? []), m])
    }
    let left = MAX_RESULTS
    return [...by]
      .map(([id, list]) => ({ id, label: labels.get(id) ?? id, list: [...list].sort((a, b) => quality(b.scores) - quality(a.scores) || (a.key < b.key ? -1 : 1)) }))
      .map((g) => {
        const cap = query ? left : expanded.has(g.id) ? g.list.length : PER_PROVIDER
        const shown = g.list.slice(0, Math.max(0, cap))
        if (query) left -= shown.length
        return { ...g, shown, total: g.list.length }
      })
      .filter((g) => g.shown.length > 0)
  }, [data, models, query, expanded])

  const choose = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const go = (next: View) => {
    setView(next)
    // The new view's first control takes focus once it is on screen.
    requestAnimationFrame(() => {
      const el = next === "more" ? searchRef.current : panel.current?.querySelector<HTMLElement>('[data-selected="true"], [data-row]')
      el?.focus()
    })
  }

  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) {
      setView("main")
      setQ("")
    }
  }

  // Arrow keys walk the rows of whichever view is showing. Left arrow goes back out of a sub-view.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const typing = e.target instanceof HTMLInputElement
    if (e.key === "ArrowLeft" && view !== "main" && !typing) {
      e.preventDefault()
      go("main")
      return
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return
    if (typing && (e.key === "Home" || e.key === "End")) return
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-row]:not([disabled])"))
    const field = searchRef.current
    const at = rows.indexOf(document.activeElement as HTMLElement)
    let next: HTMLElement | undefined
    if (e.key === "Home") next = rows[0]
    else if (e.key === "End") next = rows[rows.length - 1]
    else if (e.key === "ArrowDown") next = typing ? rows.find((r) => r.getAttribute("role") === "option") : rows[Math.min(at + 1, rows.length - 1)]
    else if (field && view === "more" && rows.indexOf(document.activeElement as HTMLElement) <= rows.findIndex((r) => r.getAttribute("role") === "option")) next = field
    else next = rows[Math.max(at - 1, 0)]
    if (!next) return
    e.preventDefault()
    next.focus()
    next.scrollIntoView({ block: "nearest" })
  }

  const list = router ? DEFAULT_MODELS : own

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Model: ${name} ${effortLabel(effort)}. Change model`}
          className="hud inline-flex h-10 max-w-[11.5rem] items-center gap-1.5 rounded-sm px-2.5 text-[11px] text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-accent data-[state=open]:text-foreground sm:h-9 sm:max-w-[17rem]"
        >
          {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
          <span className="truncate text-foreground">{name}</span>
          {/* The space keeps the visible text ("Cyphor Auto Medium") identical to the start of the spoken name. */}{" "}
          <span className="hidden shrink-0 sm:inline">{effortLabel(effort)}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side={side}
        sideOffset={8}
        collisionPadding={8}
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        onEscapeKeyDown={(e) => {
          // Escape steps back out of a sub-view first and closes the panel on the second press.
          if (view !== "main") {
            e.preventDefault()
            go("main")
          }
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          panel.current?.querySelector<HTMLElement>('[data-selected="true"], [data-row]')?.focus()
        }}
        className="flex max-h-[min(34rem,var(--radix-popover-content-available-height))] w-[min(22.5rem,calc(100vw-1.5rem))] flex-col p-0"
      >
        <h2 id={titleId} className="sr-only">
          Choose a model
        </h2>
        <div ref={panel} className="flex min-h-0 flex-1 flex-col">
          {view === "main" && (
            <>
              <div role="listbox" aria-label="Model" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
                {picked && (
                  <Row
                    selected
                    onSelect={() => choose(picked.id)}
                    title={picked.name}
                    note={picked.providerLabel ? `${picked.providerLabel}, chosen by you` : "Chosen by you"}
                  />
                )}
                {list.map((m) => {
                  const KindIcon = "kind" in m && m.kind ? KIND_ICON[m.kind] : null
                  const target = router ? data?.virtual[m.id] : null
                  const blocked = m.id === "cyphor-god" && !godReady
                  return (
                    <Row
                      key={m.id}
                      selected={m.id === model}
                      disabled={blocked}
                      onSelect={() => choose(m.id)}
                      icon={KindIcon && <KindIcon className="size-4" aria-hidden />}
                      title={m.name}
                      note={m.description}
                      extra={
                        blocked ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">Needs two connected providers.</span>
                        ) : (
                          target &&
                          m.id === model && (
                            <span className="mt-0.5 block truncate text-xs text-link">
                              Now: {target.providerLabel}, {target.name}
                            </span>
                          )
                        )
                      }
                    />
                  )
                })}
              </div>
              <div className="shrink-0 border-t py-1">
                <GoRow label="Effort" value={effortLabel(effort)} onGo={() => go("effort")} />
                {hasModels && <GoRow label="More models" onGo={() => go("more")} />}
              </div>
              <p className="shrink-0 border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {router ? (
                  connected > 0 ? (
                    <>
                      Routing across {connected} connected provider{connected === 1 ? "" : "s"}.{" "}
                    </>
                  ) : (
                    <>No provider is connected, so the built-in demo model answers. </>
                  )
                ) : (
                  <>Using your own endpoint. </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    openSettings(router ? "router" : "model")
                  }}
                  className="inline-flex items-center gap-1 text-link underline-offset-4 outline-none hover:underline focus-visible:underline"
                >
                  <Network className="size-3" aria-hidden />
                  {router ? "Router settings" : "Manage models"}
                </button>
              </p>
            </>
          )}

          {view === "effort" && (
            <>
              <Back title="Effort" onBack={() => go("main")} />
              <div role="listbox" aria-label="Effort" className="min-h-0 flex-1 overflow-y-auto py-1">
                {EFFORTS.map((e) => (
                  <Row
                    key={e.id}
                    selected={e.id === effort}
                    title={e.label}
                    note={e.description}
                    onSelect={() => {
                      update({ effort: e.id as Effort })
                      go("main")
                    }}
                  />
                ))}
              </div>
              <p className="shrink-0 border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                Effort changes which models the router prefers and whether a reply reasons first. A priority set in Router settings still wins.
              </p>
            </>
          )}

          {view === "more" && (
            <>
              <Back title="More models" onBack={() => go("main")} />
              <div className="relative shrink-0 border-b p-2">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  ref={searchRef}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search models"
                  placeholder="Search models and providers"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <div role="listbox" aria-label="All models" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
                {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{query ? `No model matches "${q.trim()}".` : "No models are listed yet."}</p>}
                {groups.map((g) => (
                  <div key={g.id} role="group" aria-label={g.label}>
                    <p className="hud sticky top-0 z-10 bg-popover px-3 pt-2.5 pb-1 text-[11px] text-muted-foreground">
                      {g.label} <span className="tabular-nums">{g.total}</span>
                    </p>
                    {g.shown.map((m) => (
                      <Row key={m.key} selected={m.key === model} onSelect={() => choose(m.key)} title={m.name} note={detail(m)} />
                    ))}
                    {!query && g.total > g.shown.length && (
                      <button
                        type="button"
                        data-row
                        onClick={() => setExpanded((s) => new Set(s).add(g.id))}
                        className="w-full px-3 py-1.5 text-left text-xs text-link outline-none hover:bg-accent hover:underline focus-visible:bg-accent focus-visible:underline"
                      >
                        Show all {g.total} from {g.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="shrink-0 border-t py-1">
                <GoRow
                  label="Compare ratings"
                  icon={<Library className="size-4" aria-hidden />}
                  onGo={() => {
                    setOpen(false)
                    openLibrary(onChange)
                  }}
                />
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
