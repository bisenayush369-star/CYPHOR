import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useStore } from "@/lib/store"
import { MOD } from "@/lib/ui"
import { Group, Pane } from "./parts"

type Keys = string[]

function Row({ label, keys, note }: { label: string; keys: Keys; note?: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <span className="min-w-0 text-sm leading-snug">
        {label}
        {note && <span className="block text-[13px] text-muted-foreground">{note}</span>}
      </span>
      <KbdGroup className="shrink-0">
        {keys.map((k) => (
          <Kbd key={k} className="h-6 min-w-6 px-1.5 text-[13px]">
            {k}
          </Kbd>
        ))}
      </KbdGroup>
    </li>
  )
}

export function ShortcutsTab() {
  const enterSends = useStore((s) => s.settings.sendWithEnter)

  return (
    <Pane title="Keyboard shortcuts" description="Everything you can do without lifting your hands from the keys.">
      <Group title="Anywhere">
        <ul className="divide-y">
          <Row label="Search chats and run commands" keys={[MOD, "K"]} />
          <Row label="Start a new chat" keys={[MOD, "⇧", "O"]} />
          <Row label="Open settings" keys={[MOD, ","]} />
          <Row label="Show or hide the sidebar" keys={[MOD, "B"]} />
          <Row label="Jump to the message box" keys={["/"]} note="When you aren't typing in a field" />
          <Row label="Close a dialog, menu or full-screen artifact" keys={["Esc"]} />
        </ul>
      </Group>
      <Group title="Message box">
        <ul className="divide-y">
          <Row label="Send" keys={enterSends ? ["Enter"] : [MOD, "Enter"]} note={enterSends ? `${MOD} + Enter also sends` : "Enter adds a new line"} />
          <Row label="New line" keys={enterSends ? ["⇧", "Enter"] : ["Enter"]} />
        </ul>
      </Group>
    </Pane>
  )
}
