import { useCatalog } from "@/lib/catalog"
import { HUE_BG, hueOf } from "@/lib/scene/hue"
import { STANDALONE } from "@/lib/standalone"
import type { ProviderStatus } from "@/lib/router/types"
import { cn } from "@/lib/utils"

/**
 * The look of a provider's node. Red and yellow are kept for trouble: a hollow red square when its last check failed, a
 * yellow one while it rests (so the state does not rest on colour alone, and the text for screen readers says it too).
 * Every other colour is the provider's own (lib/scene/hue.ts), at full strength once a check has worked and dimmer before.
 */
function nodeTone(p: ProviderStatus) {
  if (p.coolingDown) return "bg-marker"
  if (p.ok === false) return "border-2 border-heat bg-transparent"
  return cn(HUE_BG[hueOf(p.id)], p.ok !== true && "opacity-60")
}
function nodeState(p: ProviderStatus) {
  if (p.coolingDown) return "resting"
  if (p.ok === false) return "failing"
  if (p.ok === true) return "working"
  return "connected"
}

const SHOWN = 4

/**
 * One line on the home screen that says what the router can reach right now: each connected provider is a node.
 * It reads the same catalog as the model picker, so it never claims more than the server reported.
 */
export function RouterStrip({ onConnect }: { onConnect: () => void }) {
  const data = useCatalog((s) => s.data)
  const status = useCatalog((s) => s.status)
  const connected = data?.providers.filter((p) => p.configured) ?? []

  let body
  if (!data) {
    body = (
      <span className="text-muted-foreground" role="status">
        {status === "error" ? "Could not read the router" : "Checking the router"}
      </span>
    )
  } else if (data.mode === "demo") {
    body = (
      <>
        <span aria-hidden className="size-2 bg-marker" />
        <span className="hud text-[11px]">Demo model</span>
        <span className="text-muted-foreground max-sm:hidden">No provider is connected.</span>
        {!STANDALONE && (
          <button type="button" onClick={onConnect} className="text-link underline underline-offset-4 outline-none hover:no-underline focus-visible:no-underline">
            Connect models
          </button>
        )}
      </>
    )
  } else {
    const shown = connected.slice(0, SHOWN)
    body = (
      <>
        <span aria-hidden className="size-2 bg-signal" />
        <span className="hud text-[11px]">Router online</span>
        <span aria-hidden className="h-3.5 w-px bg-border" />
        <span className="text-muted-foreground sm:hidden">
          {connected.length} provider{connected.length === 1 ? "" : "s"}
        </span>
        <ul className="flex items-center gap-3 max-sm:hidden" aria-label="Connected providers">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className={cn("size-2", nodeTone(p))} />
              <span>{p.label}</span>
              <span className="sr-only">, {nodeState(p)}</span>
            </li>
          ))}
          {connected.length > SHOWN && <li className="text-muted-foreground">+{connected.length - SHOWN}</li>}
        </ul>
      </>
    )
  }

  return (
    <div className="flex justify-center">
      <div className="cut cut-sm [--edge:var(--border)] [--fill:var(--card)]">
        <div className="flex min-h-8 items-center gap-2.5 px-3.5 py-1 text-xs">{body}</div>
      </div>
    </div>
  )
}
