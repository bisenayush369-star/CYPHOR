import { useEffect, useState } from "react"
import { Eye, EyeOff, Info, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useCatalog, useDemoMode } from "@/lib/catalog"
import { fetchModelIds, STANDALONE } from "@/lib/provider"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { DEFAULT_MODEL_ID, DEFAULT_MODELS } from "@/lib/models/page"
import type { ModelDef, ProviderKind } from "@/lib/types"
import { IconButton } from "../icon-button"
import { Field, Group, NumberField, Pane, RadioCard } from "./parts"

/** Keeps the default model valid whenever the list changes. */
function useModelEditor() {
  const models = useStore((s) => s.settings.models)
  const defaultModel = useStore((s) => s.settings.defaultModel)
  const update = useStore((s) => s.updateSettings)
  const set = (next: ModelDef[], renamed?: { from: string; to: string }) => {
    let def = defaultModel
    if (renamed && renamed.from === def) def = renamed.to
    if (!next.some((m) => m.id === def)) def = next[0]?.id ?? def
    update({ models: next, defaultModel: def })
  }
  return { models, set }
}

function ModelRows() {
  const { models, set } = useModelEditor()
  const ids = models.map((m) => m.id.trim())

  const edit = (i: number, patch: Partial<ModelDef>) => {
    const before = models[i]
    set(
      models.map((m, j) => (j === i ? { ...m, ...patch } : m)),
      patch.id !== undefined ? { from: before.id, to: patch.id } : undefined
    )
  }

  return (
    <ul className="space-y-2">
      {models.map((m, i) => {
        const id = m.id.trim()
        const problem = !id ? "Add an ID" : ids.indexOf(id) !== i ? "Another model already uses this ID" : ""
        return (
          <li key={i} className="rounded-xl border bg-card p-2.5">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                aria-label={`Model ${i + 1} ID`}
                aria-invalid={!!problem}
                value={m.id}
                onChange={(e) => edit(i, { id: e.target.value })}
                placeholder="model-id"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="font-mono"
              />
              <Input
                aria-label={`Model ${i + 1} display name`}
                value={m.name}
                onChange={(e) => edit(i, { name: e.target.value })}
                placeholder="Display name"
              />
              <IconButton
                label={`Remove ${m.name || m.id || `model ${i + 1}`}`}
                disabled={models.length <= 1}
                onClick={() => set(models.filter((_, j) => j !== i))}
                className="justify-self-end"
              >
                <Trash2 />
              </IconButton>
            </div>
            {problem && (
              <p role="alert" className="mt-1.5 px-1 text-[13px] text-destructive">
                {problem}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Models listed by the server. Ticking one adds it to the picker, unticking removes it. */
function ServerModels({ ids }: { ids: string[] }) {
  const { models, set } = useModelEditor()
  const [q, setQ] = useState("")
  const have = new Set(models.map((m) => m.id))
  const shown = ids.filter((id) => id.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 300)

  const toggle = (id: string) => {
    if (have.has(id)) {
      if (models.length > 1) set(models.filter((m) => m.id !== id))
    } else set([...models, { id, name: id, description: "" }])
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-2">
        <Input
          type="search"
          aria-label="Filter server models"
          placeholder={`Filter ${ids.length} models`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      <ul className="max-h-60 divide-y overflow-y-auto overscroll-contain">
        {shown.map((id) => (
          <li key={id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-accent/60">
              <Checkbox checked={have.has(id)} onCheckedChange={() => toggle(id)} />
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{id}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-muted-foreground">No model matches that filter.</li>}
      </ul>
    </div>
  )
}

export function ModelTab() {
  const s = useStore((x) => x.settings)
  const update = useStore((x) => x.updateSettings)
  const { models, set } = useModelEditor()
  const demo = useDemoMode()
  const connected = useCatalog((x) => (x.data?.mode === "router" ? x.data.providers.filter((p) => p.configured).length : 0))
  const openSettings = useUI((x) => x.openSettings)
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverIds, setServerIds] = useState<string[] | null>(null)
  const [fetchError, setFetchError] = useState("")

  // Blank and duplicate rows are only allowed while editing. Tidy them up when leaving the tab.
  useEffect(
    () => () => {
      const cur = useStore.getState().settings
      const seen = new Set<string>()
      const clean = cur.models
        .map((m) => ({ ...m, id: m.id.trim(), name: m.name.trim() || m.id.trim() }))
        .filter((m) => {
          if (!m.id || seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })
      const changed = clean.length !== cur.models.length || clean.some((m, i) => m.id !== cur.models[i].id || m.name !== cur.models[i].name)
      if (clean.length && changed) {
        const def = clean.some((m) => m.id === cur.defaultModel.trim()) ? cur.defaultModel.trim() : clean[0].id
        useStore.getState().updateSettings({ models: clean, defaultModel: def })
      }
    },
    []
  )

  const fetchList = async () => {
    setLoading(true)
    setFetchError("")
    try {
      const ids = await fetchModelIds(s.baseUrl, s.apiKey)
      setServerIds(ids)
      toast.success(`Connected. The server lists ${ids.length} model${ids.length === 1 ? "" : "s"}.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't load the model list."
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  const usable = models.filter((m) => m.id.trim())

  return (
    <Pane title="Model" description="Choose where replies come from and how the model is steered.">
      <Group title="Source">
        <RadioGroup value={s.provider} onValueChange={(v) => update({ provider: v as ProviderKind })} aria-label="Model source" className="gap-2 sm:grid-cols-2">
          <RadioCard value="server">
            <span className="block text-sm font-medium">Cyphor server</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
              Replies come through this app's server. It keeps your keys, picks a model for each message and tries another provider if one fails. With nothing connected it answers with a built-in demo.
            </span>
          </RadioCard>
          <RadioCard value="openai">
            <span className="block text-sm font-medium">Your own LLM</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
              Any server that speaks the OpenAI chat API: OpenAI, OpenRouter, Ollama, LM Studio, vLLM and more.
            </span>
          </RadioCard>
        </RadioGroup>

        {s.provider === "server" && connected > 0 && (
          <Alert role="note">
            <Info />
            <AlertTitle>
              Routing through {connected} provider{connected === 1 ? "" : "s"}
            </AlertTitle>
            <AlertDescription>
              <p>The keys are set on the server in LLM.env, so nothing secret is stored in this browser.</p>
              <Button variant="outline" size="sm" className="mt-1 h-9" onClick={() => openSettings("router")}>
                Open Router settings
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {s.provider === "server" && demo && (
          <Alert role="note">
            <Info />
            <AlertTitle>The demo model is on</AlertTitle>
            <AlertDescription>
              <p>It shows how Cyphor handles thinking, code, tables and artifacts. It does not understand what you write.</p>
              {!STANDALONE && <p>To use real models, add your keys to LLM.env and restart the server. The Router tab lists the variable names.</p>}
              {!STANDALONE && (
                <Button variant="outline" size="sm" className="mt-1 h-9" onClick={() => openSettings("router")}>
                  Open Router settings
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </Group>

      {s.provider === "openai" && (
        <Group title="Connection" hint="Cyphor sends requests from this browser straight to the address below.">
          <Field id="base-url" label="Base URL" hint="Everything before /chat/completions, for example https://api.openai.com/v1 or http://localhost:11434/v1.">
            <Input
              id="base-url"
              type="url"
              inputMode="url"
              value={s.baseUrl}
              onChange={(e) => update({ baseUrl: e.target.value })}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://api.openai.com/v1"
              aria-describedby="base-url-hint"
            />
          </Field>
          <Field id="api-key" label="API key" hint="Leave blank for local servers that don't need one.">
            <div className="flex gap-2">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={s.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore
                placeholder="sk-…"
                aria-describedby="api-key-hint"
              />
              <IconButton
                label={showKey ? "Hide API key" : "Show API key"}
                pressed={showKey}
                variant="outline"
                size="icon"
                onClick={() => setShowKey((v) => !v)}
                className="shrink-0"
              >
                {showKey ? <EyeOff /> : <Eye />}
              </IconButton>
            </div>
          </Field>
          <Alert role="note">
            <TriangleAlert />
            <AlertTitle>The key stays in this browser</AlertTitle>
            <AlertDescription>
              <p>
                It is saved in local storage as plain text and sent only to the base URL above. Anyone who can open this browser profile can read it. For
                anything shared or public, put your own server in between and keep the key there.
              </p>
              <p>If requests fail with “could not reach the server”, the endpoint probably needs to allow this page's origin (CORS).</p>
            </AlertDescription>
          </Alert>
        </Group>
      )}

      {s.provider === "server" && (
        <Group title="Models" hint="The server decides which models exist. Pick one in the model picker above the message box.">
          <Field id="default-model" label="Default model" hint="Used for new chats.">
            <Select value={DEFAULT_MODELS.some((m) => m.id === s.defaultModel) ? s.defaultModel : DEFAULT_MODEL_ID} onValueChange={(v) => update({ defaultModel: v })}>
              <SelectTrigger id="default-model" className="w-full sm:w-80" aria-describedby="default-model-hint">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Group>
      )}

      {s.provider === "openai" && (
      <Group title="Models" hint="These appear in the model picker. The ID is sent to your server exactly as typed.">
        <ModelRows />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="max-sm:h-10 pointer-coarse:h-10"
            onClick={() => set([...models, { id: "", name: "", description: "" }])}
          >
            <Plus /> Add model
          </Button>
          {s.provider === "openai" && (
            <Button variant="outline" size="sm" className="max-sm:h-10 pointer-coarse:h-10" onClick={fetchList} disabled={loading || !s.baseUrl.trim()}>
              {loading ? <Spinner /> : <RefreshCw />} {serverIds ? "Refresh server list" : "Choose from server"}
            </Button>
          )}
        </div>
        {fetchError && (
          <p role="alert" className="text-[13px] leading-relaxed text-destructive">
            {fetchError}
          </p>
        )}
        {serverIds && <ServerModels ids={serverIds} />}

        <Field id="default-model" label="Default model" hint="Used for new chats.">
          <Select value={s.defaultModel} onValueChange={(v) => update({ defaultModel: v })}>
            <SelectTrigger id="default-model" className="w-full sm:w-80" aria-describedby="default-model-hint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {usable.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name || m.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Group>
      )}

      <Group title="Generation">
        <Field id="temperature" label={`Temperature: ${s.temperature.toFixed(1)}`} hint="Lower is more focused and repeatable. Higher is more varied.">
          <Slider
            aria-label="Temperature"
            min={0}
            max={2}
            step={0.1}
            value={[s.temperature]}
            onValueChange={([v]) => update({ temperature: Math.round(v * 10) / 10 })}
            className="py-3"
          />
        </Field>
        <Field id="max-tokens" label="Maximum reply length (tokens)" hint="Replies stop at this length. A token is roughly four characters.">
          <NumberField id="max-tokens" value={s.maxTokens} min={64} max={200000} step={64} onCommit={(n) => update({ maxTokens: n })} className="w-40" />
        </Field>
        <Field id="system-prompt" label="Standing instructions" hint="Added to every chat, on top of the style and project instructions.">
          <Textarea
            id="system-prompt"
            value={s.systemPrompt}
            onChange={(e) => update({ systemPrompt: e.target.value })}
            rows={5}
            maxLength={4000}
            placeholder="For example: I work in logistics. Prefer metric units and short answers."
            aria-describedby="system-prompt-hint"
          />
        </Field>
      </Group>
    </Pane>
  )
}
