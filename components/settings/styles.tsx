import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { BUILTIN_STYLES } from "@/lib/defaults"
import { useStore } from "@/lib/store"
import type { ResponseStyle } from "@/lib/types"
import { uid } from "@/lib/utils"
import { IconButton } from "../icon-button"
import { Field, Group, Pane, RadioCard } from "./parts"

type StyleData = Pick<ResponseStyle, "name" | "description" | "prompt">

function StyleForm({ initial, onSave, onCancel }: { initial?: ResponseStyle; onSave: (s: StyleData) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [prompt, setPrompt] = useState(initial?.prompt ?? "")
  const valid = name.trim().length > 0 && prompt.trim().length > 0

  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ name: name.trim(), description: description.trim(), prompt: prompt.trim() })
      }}
    >
      <Field id="style-name" label="Name">
        <Input id="style-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus placeholder="Warm and direct" />
      </Field>
      <Field id="style-desc" label="Short description">
        <Input id="style-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={90} placeholder="Friendly, plain words, no jargon" />
      </Field>
      <Field id="style-prompt" label="Instructions" hint="Tell Cyphor how to write: tone, length, structure, and what to avoid.">
        <Textarea
          id="style-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          maxLength={1500}
          aria-describedby="style-prompt-hint"
          placeholder="Write like a thoughtful colleague. Use plain words, keep paragraphs short, and give an example when an idea is abstract."
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Save style
        </Button>
      </div>
    </form>
  )
}

export function StylesTab() {
  const styleId = useStore((s) => s.settings.styleId)
  const custom = useStore((s) => s.settings.customStyles)
  const update = useStore((s) => s.updateSettings)
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const all = [...BUILTIN_STYLES, ...custom]
  const editingStyle = editing && editing !== "new" ? custom.find((c) => c.id === editing) : undefined

  const save = (data: StyleData) => {
    if (editing === "new") {
      const id = uid("s_")
      update({ customStyles: [...custom, { id, ...data }], styleId: id })
    } else {
      update({ customStyles: custom.map((c) => (c.id === editing ? { ...c, ...data } : c)) })
    }
    setEditing(null)
  }

  const remove = (id: string) => {
    update({ customStyles: custom.filter((c) => c.id !== id), styleId: styleId === id ? "normal" : styleId })
    if (editing === id) setEditing(null)
  }

  return (
    <Pane title="Styles" description="A style changes how Cyphor writes without changing what it knows. Pick one here or from the message box.">
      <Group>
        <RadioGroup value={styleId} onValueChange={(v) => update({ styleId: v })} aria-label="Response style" className="gap-2">
          {all.map((st) => (
            <div key={st.id} className="relative">
              <RadioCard value={st.id} className={st.builtin ? "" : "pr-24"}>
                <span className="block text-sm font-medium">
                  {st.name}
                  {!st.builtin && <span className="ml-2 rounded-full border px-2 py-px align-middle text-[11px] font-normal text-muted-foreground">Custom</span>}
                </span>
                {st.description && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{st.description}</span>}
              </RadioCard>
              {!st.builtin && (
                <div className="absolute top-1.5 right-1.5 flex">
                  <IconButton label={`Edit ${st.name}`} onClick={() => setEditing(st.id)}>
                    <Pencil />
                  </IconButton>
                  <IconButton label={`Delete ${st.name}`} onClick={() => remove(st.id)}>
                    <Trash2 />
                  </IconButton>
                </div>
              )}
            </div>
          ))}
        </RadioGroup>
      </Group>

      <Group title="Your own styles">
        {editing ? (
          <StyleForm key={editing} initial={editingStyle} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <Button variant="outline" className="max-sm:h-10 pointer-coarse:h-10" onClick={() => setEditing("new")}>
            <Plus /> Create a style
          </Button>
        )}
      </Group>
    </Pane>
  )
}
