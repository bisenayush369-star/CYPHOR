import { Shuffle } from "lucide-react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { usePaletteId } from "@/lib/palette"
import { DARK, resolve } from "@/lib/scene/palette-css"
import { DEFAULT_PALETTE, PALETTES, paletteById, type Palette, type PalettePref } from "@/lib/scene/palettes"
import { describeCityStatus, useCityStatus } from "@/lib/scene/status"
import { useStore } from "@/lib/store"
import type { SceneMode } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Group, RadioCard } from "./parts"

/** A skyline in a theme's own lights: the same six colours the city behind the chat draws its windows and signs from. */
const HEIGHTS = [46, 78, 58, 92, 50, 70, 40]

function ThemeSwatch({ p }: { p: Palette }) {
  const s = p.id === DEFAULT_PALETTE ? DARK : resolve(p).dark.surfaces
  return (
    <div aria-hidden className="relative size-full overflow-hidden" style={{ background: s.background }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${p.city.sky[2]}55, transparent 62%)` }} />
      <div className="absolute inset-x-[7%] bottom-0 flex h-[62%] items-end gap-[2.5%]">
        {HEIGHTS.map((h, i) => (
          <span key={i} className="block flex-1" style={{ height: `${h}%`, background: s.card, boxShadow: `inset 0 2px 0 ${p.city.lights[i % 6]}` }}>
            <span className="mt-[18%] ml-[22%] block size-[16%]" style={{ background: p.city.lights[(i + 2) % 6] }} />
          </span>
        ))}
      </div>
      <div className="absolute top-[14%] left-[7%] h-[11%] w-[30%]" style={{ background: p.primary }} />
      <div className="absolute top-[31%] left-[7%] h-[3px] w-[22%]" style={{ background: p.signal }} />
      <div className="absolute top-[14%] right-[7%] size-[9%] rounded-full" style={{ background: p.heat }} />
    </div>
  )
}

/** Every theme's lead colour side by side: what "change on every refresh" cycles through. */
function RotateSwatch() {
  return (
    <div aria-hidden className="relative flex size-full" style={{ background: DARK.background }}>
      {PALETTES.map((p) => (
        <span key={p.id} className="block flex-1" style={{ background: p.primary }} />
      ))}
      <span className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 text-white ring-1 ring-white/25">
        <Shuffle className="size-4" strokeWidth={2.4} />
      </span>
    </div>
  )
}

const SCENES: { id: SceneMode; name: string; note: string }[] = [
  { id: "city", name: "Moving city", note: "A live night city behind your chats: rain, wet streets, neon signs and flying cars. It uses the graphics chip and pauses when the tab is hidden." },
  { id: "off", name: "No background", note: "Plain background. The colour theme then changes on every refresh, until you pick one below." },
]

export function BackgroundGroup() {
  const scene = useStore((s) => s.settings.scene)
  const update = useStore((s) => s.updateSettings)
  const status = describeCityStatus(useCityStatus())
  return (
    <Group title="Background" hint="Cyphor can run a moving city behind the chat, or you can turn it off.">
      <RadioGroup
        value={scene}
        onValueChange={(v) => update(v === "off" ? { scene: "off", sceneChosen: true, palette: "rotate" } : { scene: "city", sceneChosen: true })}
        aria-label="Background"
        className="gap-2"
      >
        {SCENES.map((f) => (
          <RadioCard key={f.id} value={f.id}>
            <span className="block text-sm font-medium">{f.name}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{f.note}</span>
          </RadioCard>
        ))}
      </RadioGroup>
      <p aria-live="polite" data-testid="city-status" className="min-h-5 text-[13px] leading-snug text-muted-foreground">
        {scene === "city" ? status : ""}
      </p>
    </Group>
  )
}

export function ColourThemeGroup() {
  const palette = useStore((s) => s.settings.palette)
  const update = useStore((s) => s.updateSettings)
  const showing = paletteById(usePaletteId())
  const cards: { id: PalettePref; label: string; note: string; swatch: React.ReactNode }[] = [
    { id: "rotate", label: "Every refresh", note: "A new theme each time", swatch: <RotateSwatch /> },
    ...PALETTES.map((p) => ({ id: p.id as PalettePref, label: p.name, note: p.note, swatch: <ThemeSwatch p={p} /> })),
  ]
  return (
    <Group
      title="Colour theme"
      hint={
        <>
          The genre has eight colours and every theme uses all of them; a theme decides which one leads.{" "}
          <span aria-live="polite">
            {palette === "rotate" ? `Showing ${showing.name} now. A different theme loads each time you refresh.` : `${paletteById(palette).name}: ${paletteById(palette).note}`}
          </span>
        </>
      }
    >
      <RadioGroup value={palette} onValueChange={(v) => update({ palette: v as PalettePref })} aria-label="Colour theme" className="grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {cards.map((c) => (
          <Label
            key={c.id}
            className={cn(
              "relative flex cursor-pointer flex-col items-stretch gap-2 rounded-xl border bg-card p-2 font-normal transition-colors hover:bg-accent/50 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5 has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-ring/50",
              c.id === "rotate" && "col-span-2 sm:col-span-3"
            )}
          >
            <RadioGroupItem value={c.id} className="sr-only" />
            <span className={cn("block overflow-hidden rounded-md border", c.id === "rotate" ? "aspect-[16/2.2]" : "aspect-[16/10]")}>{c.swatch}</span>
            <span className="px-0.5">
              <span className="block text-[13px] font-medium">{c.label}</span>
              {c.id === "rotate" && <span className="block text-[12px] text-muted-foreground">{c.note}</span>}
            </span>
          </Label>
        ))}
      </RadioGroup>
    </Group>
  )
}
