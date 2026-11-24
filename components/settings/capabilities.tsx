import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { EFFORTS, type Effort } from "@/lib/router/effort"
import { useStore } from "@/lib/store"
import { IconButton } from "../icon-button"
import { Group, Pane, RadioCard, ToggleRow } from "./parts"

const MAX_MEMORIES = 30

function Memories() {
  const memories = useStore((s) => s.settings.memories)
  const update = useStore((s) => s.updateSettings)
  const [text, setText] = useState("")

  const add = () => {
    const t = text.trim()
    if (!t || memories.length >= MAX_MEMORIES) return
    update({ memories: [...memories, t.slice(0, 300)] })
    setText("")
  }

  return (
    <div className="space-y-3 pt-1">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2"
      >
        <Input
          aria-label="New memory"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="For example: I prefer metric units"
          maxLength={300}
          disabled={memories.length >= MAX_MEMORIES}
        />
        <Button type="submit" variant="secondary" disabled={!text.trim() || memories.length >= MAX_MEMORIES} className="shrink-0">
          Add
        </Button>
      </form>
      {memories.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing saved yet. Short, lasting facts work best.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {memories.map((m, i) => (
            <li key={`${i}-${m}`} className="flex items-start gap-1 py-1 pr-1 pl-3.5">
              <span className="min-w-0 flex-1 py-2 text-sm leading-snug break-words">{m}</span>
              <IconButton label={`Forget: ${m.slice(0, 40)}`} onClick={() => update({ memories: memories.filter((_, j) => j !== i) })}>
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {memories.length >= MAX_MEMORIES && <p className="text-[13px] text-muted-foreground">That's the limit of {MAX_MEMORIES}. Forget one to add another.</p>}
    </div>
  )
}

export function CapabilitiesTab() {
  const s = useStore((x) => x.settings)
  const update = useStore((x) => x.updateSettings)

  return (
    <Pane title="Capabilities" description="Decide which tools Cyphor can reach for. The same switches live in the + menu of the message box.">
      <Group title="Effort" hint="How hard a reply tries: it steers which models the router prefers and whether a reply reasons first. The model button in the message box changes it too.">
        <RadioGroup value={s.effort} onValueChange={(v) => update({ effort: v as Effort })} aria-label="Effort" className="gap-2 sm:grid-cols-3">
          {EFFORTS.map((e) => (
            <RadioCard key={e.id} value={e.id}>
              <span className="block text-sm font-medium">{e.label}</span>
              <span className="block text-xs text-muted-foreground">{e.description}</span>
            </RadioCard>
          ))}
        </RadioGroup>
      </Group>

      <Group>
        <ToggleRow
          id="cap-artifacts"
          label="Artifacts"
          description="Web pages, SVGs, documents and long code open in a panel beside the chat, with versions and a live preview."
          checked={s.artifacts}
          onChange={(v) => update({ artifacts: v })}
        />
      </Group>

      <Group title="Needs your backend" hint="These switches work in the interface, but the model endpoint has to do the searching. A plain chat endpoint will ignore them.">
        <ToggleRow
          id="cap-search"
          label="Web search"
          tag="Interface only"
          description="Let Cyphor look things up online and cite what it finds."
          checked={s.webSearch}
          onChange={(v) => update({ webSearch: v })}
        />
        <ToggleRow
          id="cap-research"
          label="Research"
          tag="Interface only"
          description="Break a big question into steps and write up what turns up."
          checked={s.research}
          onChange={(v) => update({ research: v })}
        />
      </Group>

      <Group>
        <ToggleRow
          id="cap-memory"
          label="Memory"
          description="Cyphor keeps the notes below in mind in every new chat. They are stored on this device and sent to your model."
          checked={s.memory}
          onChange={(v) => update({ memory: v })}
        />
        {s.memory && <Memories />}
      </Group>
    </Pane>
  )
}
