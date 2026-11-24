import { mayHaveArtifacts, parseContent } from "@/lib/parse"
import { useMemo } from "react"
import { Progress } from "@/components/ui/progress"
import { savedBytes, useStore } from "@/lib/store"
import { Group, Pane } from "./parts"

const QUOTA_BYTES = 5 * 1024 * 1024

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span className="block font-display text-3xl leading-none font-semibold tabular-nums">{value}</span>
        {note && <span className="mt-1.5 block text-xs text-muted-foreground">{note}</span>}
      </dd>
    </div>
  )
}

export function UsageTab() {
  const chats = useStore((s) => s.chats)
  const projects = useStore((s) => s.projects)

  const stats = useMemo(() => {
    let saved = 0
    let messages = 0
    let chars = 0
    let artifacts = 0
    for (const c of Object.values(chats)) {
      saved++
      for (const m of Object.values(c.nodes)) {
        messages++
        chars += m.content.length
        if (m.role === "assistant" && mayHaveArtifacts(m.content)) artifacts += parseContent(m.content).filter((x) => x.kind === "artifact").length
      }
    }
    return { saved, messages, tokens: Math.ceil(chars / 4), artifacts, bytes: savedBytes() }
  }, [chats])

  const pct = Math.min(100, (stats.bytes / QUOTA_BYTES) * 100)
  const kb = stats.bytes / 1024
  const size = kb < 1024 ? `${kb.toFixed(kb < 10 ? 1 : 0)} KB` : `${(kb / 1024).toFixed(1)} MB`

  return (
    <Pane title="Usage" description="A look at what is stored on this device. Nothing here is billed or sent anywhere.">
      <Group>
        <dl className="grid grid-cols-2 gap-3">
          <Stat label="Saved chats" value={stats.saved.toLocaleString()} />
          <Stat label="Projects" value={Object.keys(projects).length.toLocaleString()} />
          <Stat label="Messages" value={stats.messages.toLocaleString()} note="Including edited and retried versions" />
          <Stat label="Artifacts" value={stats.artifacts.toLocaleString()} />
        </dl>
        <p className="text-[13px] text-muted-foreground">
          About {stats.tokens.toLocaleString()} tokens of conversation. This is an estimate at four characters per token, so your model's own count will differ.
        </p>
      </Group>

      <Group title="Storage" hint="Browsers allow about 5 MB per site. Cyphor drops pasted image data, so most of this is text.">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span>{size} used</span>
            <span className="text-muted-foreground tabular-nums">{pct.toFixed(pct < 10 ? 1 : 0)}% of about 5 MB</span>
          </div>
          <Progress value={pct} aria-label="Storage used on this device" />
        </div>
        {pct > 80 && (
          <p role="status" className="text-[13px] text-destructive">
            Storage is nearly full. Export a backup, then delete old chats under Privacy.
          </p>
        )}
      </Group>
    </Pane>
  )
}
