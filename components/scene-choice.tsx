import { Building2, Info, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { describeCityStatus, useCityStatus } from "@/lib/scene/status"
import { useStore } from "@/lib/store"

/**
 * Asked once, on the first visit to the home screen: keep the moving city behind the chat, or switch it off and get a
 * different colour theme on every refresh. The city is already running behind this card, so the choice is made with
 * the thing in view. Either answer is final until Settings > Appearance changes it.
 */
export function SceneChoice() {
  const chosen = useStore((s) => s.settings.sceneChosen)
  const update = useStore((s) => s.updateSettings)
  const status = useCityStatus()
  if (chosen) return null
  return (
    <section aria-labelledby="scene-choice-title" className="cut cut-lg brackets lit mb-5 p-4 [--edge:var(--signal)] [--fill:var(--card)] sm:p-5">
      <h2 id="scene-choice-title" className="font-display text-lg leading-tight font-semibold">
        Keep the moving city?
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        That is a live night city behind your chats: rain, neon, flying cars. If you would rather not have it, Cyphor shows a different colour theme every time you refresh the page.
      </p>
      {status.state === "unavailable" && (
        <p role="status" className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-cp-yellow" />
          <span>
            {describeCityStatus(status)} For a different colour theme on every refresh, choose &ldquo;No city, change themes&rdquo;.
          </span>
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={() => update({ scene: "city", sceneChosen: true })} className="sm:flex-1">
          <Building2 aria-hidden />
          Keep the city
        </Button>
        <Button type="button" variant="outline" onClick={() => update({ scene: "off", sceneChosen: true, palette: "rotate" })} className="sm:flex-1">
          <Shuffle aria-hidden />
          No city, change themes
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">You can change this any time in Settings, under Appearance.</p>
    </section>
  )
}
