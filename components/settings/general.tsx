import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"
import { Field, Group, Pane, ToggleRow } from "./parts"

export function GeneralTab() {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)

  return (
    <Pane title="General" description="How you and Cyphor work together day to day.">
      <Group>
        <Field
          id="display-name"
          label="What should Cyphor call you?"
          hint="Used in the greeting and shared with your model, so replies can address you by name."
        >
          <Input
            id="display-name"
            value={settings.displayName}
            onChange={(e) => update({ displayName: e.target.value })}
            maxLength={40}
            autoComplete="given-name"
            placeholder="Your first name"
            aria-describedby="display-name-hint"
          />
        </Field>
      </Group>

      <Group title="Writing">
        <ToggleRow
          id="send-enter"
          label="Send with Enter"
          description="Enter sends and Shift+Enter starts a new line. When off, use ⌘ or Ctrl with Enter to send. On touch screens, Enter always adds a new line."
          checked={settings.sendWithEnter}
          onChange={(v) => update({ sendWithEnter: v })}
        />
        <ToggleRow
          id="expand-thinking"
          label="Open thinking blocks by default"
          description="Show the model's reasoning expanded instead of folded away."
          checked={settings.expandThinking}
          onChange={(v) => update({ expandThinking: v })}
        />
      </Group>
    </Pane>
  )
}
