import { Calendar, Cloud, GitBranch, Mail, NotebookText, type LucideIcon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CONNECTORS } from "@/lib/defaults"
import { useStore } from "@/lib/store"
import { Group, Pane } from "./parts"

const ICONS: Record<string, LucideIcon> = {
  drive: Cloud,
  repo: GitBranch,
  calendar: Calendar,
  mail: Mail,
  notes: NotebookText,
}

export function ConnectorsTab() {
  const connectors = useStore((s) => s.settings.connectors)
  const update = useStore((s) => s.updateSettings)

  return (
    <Pane title="Connectors" description="Link the apps you already use so Cyphor can pull things in from them.">
      <Group hint="Switching one on adds it to the + menu of the message box. Reading from the service needs an integration on your server, so for now these show the flow without fetching anything.">
        <ul className="divide-y rounded-xl border bg-card">
          {CONNECTORS.map((c) => {
            const Icon = ICONS[c.id] ?? Cloud
            const id = `conn-${c.id}`
            return (
              <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <Label htmlFor={id} className="block cursor-pointer text-sm leading-snug font-medium">
                    {c.name}
                  </Label>
                  <p id={`${id}-desc`} className="text-[13px] leading-snug text-muted-foreground">
                    {c.description}
                  </p>
                </div>
                <Switch
                  id={id}
                  checked={!!connectors[c.id]}
                  onCheckedChange={(v) => update({ connectors: { ...connectors, [c.id]: v } })}
                  aria-describedby={`${id}-desc`}
                />
              </li>
            )
          })}
        </ul>
      </Group>
    </Pane>
  )
}
