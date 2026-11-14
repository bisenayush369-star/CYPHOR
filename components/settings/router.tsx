import { ChevronDown, CircleAlert, CircleCheck, CircleDashed, CircleX, Clock, Crown, ExternalLink, Globe, Info, Pause, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { RadioGroup } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useCatalog } from "@/lib/catalog"
import { STANDALONE } from "@/lib/provider"
import type { ProviderStatus, RoutePriority } from "@/lib/router/types"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { formatMs, ProviderMark } from "../model-parts"
import { Field, Group, Pane, RadioCard } from "./parts"

const PRIORITIES: { id: RoutePriority; label: string; text: string }[] = [
  { id: "balanced", label: "Balanced", text: "Weighs quality and speed together. The best place to start." },
  { id: "speed", label: "Fastest", text: "Prefers models that answer quickly, even when a slower one would write better." },
  { id: "quality", label: "Best quality", text: "Prefers the strongest model for the job, even when it takes longer." },
  { id: "free", label: "Free first", text: "Prefers models with a free tier and uses the others only when it has to." },
]

type Tone = "ok" | "warn" | "bad" | "muted"

/** A short state with an icon and words, so colour is never the only signal. */
function Pill({ tone, icon: Icon, children }: { tone: Tone; icon: LucideIcon; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px] leading-4",
        tone === "ok" && "text-foreground",
        tone === "warn" && "text-amber-700 dark:text-amber-400",
        tone === "bad" && "text-destructive",
        tone === "muted" && "text-muted-foreground"
      )}
    >
      <Icon className={cn("size-3", tone === "ok" && "text-primary")} aria-hidden />
      {children}
    </span>
  )
}

function statusOf(p: ProviderStatus, off: boolean): { pill: { tone: Tone; icon: LucideIcon; text: string }; detail: string } {
  const models = `${p.modelCount} model${p.modelCount === 1 ? "" : "s"}`
  if (off) return { pill: { tone: "muted", icon: Pause, text: "Switched off" }, detail: "Skipped by the router until you switch it back on." }
  if (p.sample) return { pill: { tone: "muted", icon: CircleDashed, text: "Sample" }, detail: `${models} listed as an example. Nothing is connected in this preview.` }
  if (p.needs) return { pill: { tone: "warn", icon: TriangleAlert, text: "Setup needed" }, detail: `Missing ${p.needs}.` }
  if (p.coolingDown) return { pill: { tone: "warn", icon: Clock, text: `Resting ${p.coolingSec ?? 0}s` }, detail: "It failed several times in a row, so the router is trying others first." }
  if (p.ok === false) return { pill: { tone: "bad", icon: CircleX, text: "Not working" }, detail: p.error ?? "The provider did not answer." }
  if (p.ok === true) return { pill: { tone: "ok", icon: CircleCheck, text: "Connected" }, detail: `${models}${p.latencyMs ? ` · listed in ${formatMs(p.latencyMs)}` : ""}` }
  return { pill: { tone: "muted", icon: CircleDashed, text: "Key found" }, detail: "Not checked yet." }
}

function ProviderRow({ p }: { p: ProviderStatus }) {
  const off = useStore((s) => s.settings.disabledProviders.includes(p.id))
  const test = useCatalog((s) => s.tests[p.id])
  const run = useCatalog((s) => s.test)
  const load = useCatalog((s) => s.load)
  const { pill, detail } = statusOf(p, off)

  const toggle = (on: boolean) => {
    const cur = useStore.getState().settings.disabledProviders
    useStore.getState().updateSettings({ disabledProviders: on ? cur.filter((x) => x !== p.id) : [...new Set([...cur, p.id])] })
    // "Now: …" in the model picker depends on which providers are on.
    void load()
  }

  return (
    <li className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        <ProviderMark id={p.id} label={p.label} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">{p.label}</p>
            <Pill tone={pill.tone} icon={pill.icon}>
              {pill.text}
            </Pill>
          </div>
          <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug text-muted-foreground">{detail}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{p.keyEnv}</p>
        </div>
        <Switch checked={!off} onCheckedChange={toggle} aria-label={`Use ${p.label}`} className="mt-0.5" />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-9">
        <Button size="sm" variant="outline" className="h-9" onClick={() => void run(p.id)} disabled={test?.state === "running" || !!p.needs || !!p.sample}>
          {test?.state === "running" ? <Spinner /> : <CircleCheck />} Test
        </Button>
        {p.sample && <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">Testing needs a real key and a server.</p>}
        {test && !p.sample && (
          <p role="status" className={cn("min-w-0 flex-1 text-[13px] leading-snug", test.state === "fail" ? "text-destructive" : "text-muted-foreground")}>
            {test.text}
          </p>
        )}
      </div>
    </li>
  )
}

function NotConnected({ list, openByDefault }: { list: ProviderStatus[]; openByDefault: boolean }) {
  if (!list.length) return null
  return (
    <Collapsible defaultOpen={openByDefault}>
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-left text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
        <span>Not connected ({list.length})</span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul aria-label="Providers that are not connected" className="divide-y overflow-hidden rounded-xl border bg-card">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <ProviderMark id={p.id} label={p.label} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{p.label}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{p.id === "custom" ? "LLM_BASE_URL" : p.keyEnv}</p>
              </div>
              <a
                href={p.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Docs <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only">for {p.label}, opens in a new tab</span>
              </a>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Which providers the server found, how each message is routed, how big the God Mode panel is, and whether
 * web search works. The keys are on the server. This page only ever sees the names of the variables.
 */
export function RouterTab() {
  const data = useCatalog((s) => s.data)
  const status = useCatalog((s) => s.status)
  const error = useCatalog((s) => s.error)
  const load = useCatalog((s) => s.load)
  const s = useStore((x) => x.settings)
  const update = useStore((x) => x.updateSettings)

  const connected = data?.providers.filter((p) => p.configured) ?? []
  const missing = data?.providers.filter((p) => !p.configured) ?? []
  const loading = status === "loading"

  return (
    <Pane title="Router" description="Cyphor can use every provider you have a key for. It picks a model for each message and moves on to another one if the first fails.">
      {STANDALONE && (
        <Group>
          <Alert role="note">
            <Info />
            <AlertTitle>This preview has no server</AlertTitle>
            <AlertDescription>
              <p>Providers connect on the server, so none can be connected here. The four marked Sample are examples, so you can see the screens. Nothing is sent anywhere, and replies still come from the built-in demo model. Your choices are kept in this browser.</p>
            </AlertDescription>
          </Alert>
        </Group>
      )}

      <Group
        title="Providers"
        hint={
          <>
            Keys live in <code className="font-mono text-[12px]">LLM.env</code> on the server, never in this browser. This list shows the name of each variable and what the server found.
          </>
        }
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground" role="status">
            {!data ? (loading ? "Asking the server…" : "") : data.mode === "demo" ? "None connected" : `${connected.length} of ${data.providers.length} connected`}
          </p>
          <Button size="sm" variant="outline" className="h-9" onClick={() => void load(true)} disabled={loading || STANDALONE}>
            {loading ? <Spinner /> : <RefreshCw />} Refresh
          </Button>
        </div>

        {status === "error" && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Could not reach the server</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
            </AlertDescription>
          </Alert>
        )}

        {data?.mode === "demo" && !STANDALONE && (
          <Alert role="note">
            <Info />
            <AlertTitle>No provider is connected</AlertTitle>
            <AlertDescription>
              <p>The built-in demo model answers until one is. It shows the interface and does not understand what you write.</p>
            </AlertDescription>
          </Alert>
        )}

        {!data && loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
            <Spinner /> Loading providers…
          </div>
        )}

        {connected.length > 0 && (
          <ul className="space-y-2" aria-label="Connected providers">
            {connected.map((p) => (
              <ProviderRow key={p.id} p={p} />
            ))}
          </ul>
        )}

        <NotConnected list={missing} openByDefault={connected.length === 0} />
      </Group>

      <Group title="Routing priority" hint="What Auto should favour when several models could answer. It never overrides a model you pick yourself.">
        <RadioGroup value={s.routePriority} onValueChange={(v) => update({ routePriority: v as RoutePriority })} aria-label="Routing priority" className="gap-2 sm:grid-cols-2">
          {PRIORITIES.map((p) => (
            <RadioCard key={p.id} value={p.id}>
              <span className="block text-sm font-medium">{p.label}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{p.text}</span>
            </RadioCard>
          ))}
        </RadioGroup>
      </Group>

      <Group
        title="God Mode"
        hint="Asks several providers at the same time, then has one model merge the drafts into a single answer."
      >
        <div className="flex items-center gap-2 text-[13px]" role="status">
          <Crown className="size-4 text-primary" aria-hidden />
          {data?.godReady ? "Ready: two or more providers can answer." : "Needs two connected providers."}
        </div>
        <Field id="god-max" label={`Panel size: ${s.godMax} providers`} hint="Each provider is asked once, then one more request merges the drafts. A God Mode message therefore uses about one more request than the panel size, and usually takes longer than a normal reply.">
          <Slider id="god-max" aria-label="God Mode panel size" min={2} max={6} step={1} value={[s.godMax]} onValueChange={([v]) => update({ godMax: v })} className="py-3" />
        </Field>
      </Group>

      <Group title="Web search" hint="Lets replies read current pages. Results are passed to the model as untrusted text, and the pages used are listed under the reply.">
        <div className="flex items-start gap-2 text-[13px] leading-snug" role="status">
          <Globe className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {data?.web.configured ? (
            <span>Ready. Switch on Web search or Research from the + menu in the message box, or under Capabilities.</span>
          ) : (
            <span>
              Not set up. Add <code className="font-mono text-[12px]">{data?.web.keyEnv ?? "TINYFISH_API_KEY"}</code> to LLM.env to let replies search the web.
            </span>
          )}
        </div>
      </Group>

      <Group title="Set up" hint="Four steps, and nothing is typed into this page.">
        <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted-foreground marker:text-foreground">
          <li>
            Create a file named <code className="font-mono text-[12px] text-foreground">LLM.env</code> next to <code className="font-mono text-[12px] text-foreground">package.json</code>.
          </li>
          <li>Add one line per provider, in the form NAME=value. The names are listed above and in .env.example.</li>
          <li>
            For a server of your own, set <code className="font-mono text-[12px] text-foreground">LLM_BASE_URL</code> and, if it needs one, <code className="font-mono text-[12px] text-foreground">LLM_API_KEY</code>.
          </li>
          <li>Restart the server, or press Refresh. Then press Test on a provider to check its key.</li>
        </ol>
        <p className="text-[13px] leading-relaxed text-muted-foreground">LLM.env is ignored by git. Keep it that way, and never paste a key into a chat.</p>
      </Group>
    </Pane>
  )
}
