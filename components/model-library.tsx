import { useDeferredValue, useMemo, useRef, useState } from "react"
import { Network, RefreshCw, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useCatalog } from "@/lib/catalog"
import { useCoarsePointer } from "@/lib/hooks/use-media"
import { STANDALONE } from "@/lib/provider"
import { quality } from "@/lib/router/profiles"
import type { ModelProfile, ProviderId, Scores } from "@/lib/router/types"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { cn } from "@/lib/utils"
import { IconButton } from "./icon-button"
import { ModelTags, ProviderMark, ScoreBars, TierBadge } from "./model-parts"

type Sort = "overall" | keyof Scores

const SORTS: { id: Sort; label: string }[] = [
  { id: "overall", label: "Best overall" },
  { id: "coding", label: "Coding" },
  { id: "reasoning", label: "Reasoning" },
  { id: "writing", label: "Writing" },
  { id: "speed", label: "Speed" },
]

const sortValue = (m: ModelProfile, sort: Sort) => (sort === "overall" ? quality(m.scores) : m.scores[sort])
const fmtContext = (n: number | null) => (n ? (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : `${Math.round(n / 1000)}K`) + " tokens" : "")

/**
 * Every model the connected providers offer, rated for what it is good at. Choosing one uses it for the
 * chat that opened the library. The ratings are estimates from the model's family and size, so they
 * say where to start, not who wins a benchmark.
 */
export function ModelLibrary() {
  const lib = useUI((s) => s.library)
  const close = useUI((s) => s.closeLibrary)
  const openSettings = useUI((s) => s.openSettings)
  const data = useCatalog((s) => s.data)
  const status = useCatalog((s) => s.status)
  const load = useCatalog((s) => s.load)
  const disabled = useStore((s) => s.settings.disabledProviders)

  const searchRef = useRef<HTMLInputElement>(null)
  const coarse = useCoarsePointer()
  const [q, setQ] = useState("")
  const query = useDeferredValue(q).trim().toLowerCase()
  const [provider, setProvider] = useState<"all" | ProviderId>("all")
  const [sort, setSort] = useState<Sort>("overall")

  const labels = useMemo(() => new Map((data?.providers ?? []).map((p) => [p.id, p.label])), [data])
  const counts = useMemo(() => {
    const c = new Map<ProviderId, number>()
    for (const m of data?.models ?? []) c.set(m.provider, (c.get(m.provider) ?? 0) + 1)
    return c
  }, [data])

  const shown = useMemo(() => {
    const list = (data?.models ?? []).filter((m) => (provider === "all" || m.provider === provider) && (!query || `${m.name} ${m.id} ${m.tags.join(" ")}`.toLowerCase().includes(query)))
    return [...list].sort((a, b) => sortValue(b, sort) - sortValue(a, sort) || (a.key < b.key ? -1 : 1))
  }, [data, provider, query, sort])

  const pick = (key: string) => {
    lib?.onPick(key)
    close()
  }

  return (
    <Dialog open={!!lib} onOpenChange={(o) => !o && close()}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          // The first thing in the dialog is the Close button, and focusing it pops its tooltip up over the header.
          // Start in the search box instead, so typing finds a model at once. A touch screen keeps the default,
          // because a search box in focus would open the keyboard over the list.
          if (coarse) return
          e.preventDefault()
          searchRef.current?.focus()
        }}
        className="flex flex-col gap-0 overflow-hidden p-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 sm:h-[min(46rem,calc(100dvh-3rem))] sm:max-w-[min(54rem,calc(100%-2rem))]"
      >
        <div className="shrink-0 border-b pt-safe">
          <DialogHeader className="flex-row items-start justify-between gap-2 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <DialogTitle className="font-serif text-xl font-medium tracking-tight">Models</DialogTitle>
              <DialogDescription className="mt-0.5 text-[13px] leading-snug">
                Everything your connected providers offer, rated for what each does best. Ratings are estimates from the model's family and size.
                {STANDALONE && " In this preview the list is a sample: nothing is connected."}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <IconButton label="Close models" size="icon" className="-mr-1 shrink-0 sm:-mr-2">
                <X />
              </IconButton>
            </DialogClose>
          </DialogHeader>

          <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:px-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search models" placeholder="Search models" className="pl-9" autoCapitalize="none" spellCheck={false} />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger aria-label="Sort models by" className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {counts.size > 1 && (
            <div role="group" aria-label="Filter by provider" className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-6">
              {[{ id: "all" as const, label: "All", n: data?.models.length ?? 0 }, ...[...counts].map(([id, n]) => ({ id, label: labels.get(id) ?? id, n }))].map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant={provider === p.id ? "secondary" : "outline"}
                  aria-pressed={provider === p.id}
                  onClick={() => setProvider(p.id)}
                  className="h-8 shrink-0 rounded-full px-3 text-[13px]"
                >
                  {p.label} <span className="text-muted-foreground tabular-nums">{p.n}</span>
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
          {data?.mode === "demo" || (data && !data.models.length) ? (
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyTitle>{data?.mode === "demo" ? "No providers are connected" : "No models found"}</EmptyTitle>
                <EmptyDescription>
                  {data?.mode === "demo"
                    ? "Add your keys to LLM.env next to package.json and restart the server. The built-in demo model answers until then."
                    : "The connected providers did not list any chat models. Open Router settings to see why."}
                </EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={() => { close(); openSettings("router") }}>
                <Network /> Open Router settings
              </Button>
            </Empty>
          ) : !data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
              <Spinner /> Loading models…
            </div>
          ) : shown.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No model matches “{q}”.</p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2" aria-label="Models">
              {shown.map((m) => (
                <li key={m.key} className={cn("flex flex-col gap-2.5 rounded-xl border bg-card p-3", disabled.includes(m.provider) && "opacity-60")}>
                  <div className="flex items-start gap-2.5">
                    <ProviderMark id={m.provider} label={labels.get(m.provider) ?? m.provider} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {labels.get(m.provider) ?? m.provider}
                        {m.context ? ` · ${fmtContext(m.context)}` : ""}
                      </p>
                    </div>
                    <TierBadge tier={m.tier} />
                  </div>
                  <ScoreBars scores={m.scores} />
                  <div className="flex items-end justify-between gap-2">
                    <ModelTags profile={m} />
                    <Button size="sm" variant="outline" className="ml-auto h-9 shrink-0" onClick={() => pick(m.key)} aria-label={`Use ${m.name}`}>
                      Use
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:px-6">
          <p className="text-xs text-muted-foreground">{data?.models.length ? `${shown.length} of ${data.models.length} models` : " "}</p>
          <Button variant="ghost" size="sm" onClick={() => void load(true)} disabled={status === "loading"}>
            {status === "loading" ? <Spinner /> : <RefreshCw />} Refresh list
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

