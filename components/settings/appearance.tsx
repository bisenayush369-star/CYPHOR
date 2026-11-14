import { useRef } from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useMedia } from "@/lib/hooks/use-media"
import { useStore } from "@/lib/store"
import { transitionTheme } from "@/lib/theme"
import type { ChatFont, EffectsLevel, ThemePref } from "@/lib/types"
import { Group, Pane, RadioCard } from "./parts"

const TONES = {
  light: { bg: "#f5f3ee", side: "#efece4", ink: "#1a211f", mute: "#d4cfc1", pri: "#166657", card: "#fbfaf7" },
  dark: { bg: "#171c1e", side: "#12171a", ink: "#e8e5dc", mute: "#364146", pri: "#5fb5a3", card: "#20272a" },
} as const

/** A tiny drawing of the app in one theme. Colours are fixed on purpose: it shows each theme, not the current one. */
function Swatch({ tone }: { tone: keyof typeof TONES }) {
  const c = TONES[tone]
  return (
    <div aria-hidden className="relative size-full" style={{ background: c.bg }}>
      <div className="absolute inset-y-0 left-0 w-[22%]" style={{ background: c.side }} />
      <div className="absolute top-[16%] left-[30%] h-[9%] w-[34%] rounded-full" style={{ background: c.ink, opacity: 0.8 }} />
      <div className="absolute top-[33%] left-[30%] h-[7%] w-[58%] rounded-full" style={{ background: c.mute }} />
      <div className="absolute top-[46%] left-[30%] h-[7%] w-[44%] rounded-full" style={{ background: c.mute }} />
      <div className="absolute right-[6%] bottom-[10%] left-[30%] h-[20%] rounded-md" style={{ background: c.card, boxShadow: `inset 0 0 0 1px ${c.mute}` }} />
      <div className="absolute right-[9%] bottom-[15%] size-[10%] rounded-full" style={{ background: c.pri }} />
    </div>
  )
}

const THEMES: { id: ThemePref; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "Match device" },
]

const FONTS: { id: ChatFont; name: string; note: string; family: string }[] = [
  { id: "serif", name: "Serif", note: "Literata. Calm and bookish for long answers.", family: '"Literata", Georgia, serif' },
  { id: "sans", name: "Sans", note: "Schibsted Grotesk. Clean and modern.", family: '"Schibsted Grotesk", system-ui, sans-serif' },
  { id: "legible", name: "Easy to read", note: "Atkinson Hyperlegible Next. Made for low vision.", family: '"Atkinson Hyperlegible Next", system-ui, sans-serif' },
]

const EFFECTS: { id: EffectsLevel; name: string; note: string }[] = [
  { id: "full", name: "Full", note: "Cipher disk, theme sweep, entrances and message transitions." },
  { id: "subtle", name: "Subtle", note: "Short fades only. Nothing spins or sweeps." },
  { id: "off", name: "Off", note: "No animation at all." },
]

export function AppearanceTab() {
  const theme = useStore((s) => s.settings.theme)
  const font = useStore((s) => s.settings.chatFont)
  const effects = useStore((s) => s.settings.effects)
  const update = useStore((s) => s.updateSettings)
  const reduced = useMedia("(prefers-reduced-motion: reduce)")
  // Where the theme sweep starts: the pointer for clicks, the card for keyboard changes.
  const origin = useRef<{ x: number; y: number } | null>(null)

  const setTheme = (v: string) => {
    const next = v as ThemePref
    transitionTheme(next, origin.current, () => update({ theme: next }))
  }

  return (
    <Pane title="Appearance" description="Make Cyphor comfortable for the way you read and the hours you keep.">
      <Group title="Theme">
        <RadioGroup
          value={theme}
          onValueChange={setTheme}
          aria-label="Theme"
          className="grid-cols-3 gap-2.5 sm:gap-3"
          onPointerDownCapture={(e) => {
            origin.current = { x: e.clientX, y: e.clientY }
          }}
          onKeyDownCapture={() => {
            const el = document.activeElement?.getBoundingClientRect()
            origin.current = el ? { x: el.left + el.width / 2, y: el.top + el.height / 2 } : null
          }}
        >
          {THEMES.map((t) => (
            <Label
              key={t.id}
              className="group/theme flex cursor-pointer flex-col items-stretch gap-2 rounded-xl border bg-card p-2 font-normal transition-colors hover:bg-accent/50 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5 has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-ring/50"
            >
              <RadioGroupItem value={t.id} className="sr-only" />
              <span className="block aspect-[16/10] overflow-hidden rounded-md border">
                {t.id === "system" ? (
                  <span className="relative block size-full">
                    <Swatch tone="light" />
                    <span className="absolute inset-0 block" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>
                      <Swatch tone="dark" />
                    </span>
                  </span>
                ) : (
                  <Swatch tone={t.id} />
                )}
              </span>
              <span className="px-0.5 text-center text-[13px] font-medium">{t.label}</span>
            </Label>
          ))}
        </RadioGroup>
      </Group>

      <Group title="Chat font" hint="Applies to Cyphor's replies. Menus and buttons keep the interface font.">
        <RadioGroup value={font} onValueChange={(v) => update({ chatFont: v as ChatFont })} aria-label="Chat font" className="gap-2">
          {FONTS.map((f) => (
            <RadioCard key={f.id} value={f.id}>
              <span className="flex items-baseline gap-3">
                <span className="text-2xl leading-none" style={{ fontFamily: f.family }} aria-hidden>
                  Aa
                </span>
                <span className="text-sm font-medium">{f.name}</span>
              </span>
              <span className="mt-1.5 block text-[15px] leading-snug" style={{ fontFamily: f.family }}>
                Every cipher hides a plain message.
              </span>
              <span className="mt-1 block text-[13px] text-muted-foreground">{f.note}</span>
            </RadioCard>
          ))}
        </RadioGroup>
      </Group>

      <Group title="Effects" hint={reduced ? "Your device asks for reduced motion, so effects stay off whatever you pick here." : "Motion is part of the design here, so you can dial it down or off."}>
        <RadioGroup value={effects} onValueChange={(v) => update({ effects: v as EffectsLevel })} aria-label="Effects level" className="gap-2">
          {EFFECTS.map((f) => (
            <RadioCard key={f.id} value={f.id}>
              <span className="block text-sm font-medium">{f.name}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{f.note}</span>
            </RadioCard>
          ))}
        </RadioGroup>
      </Group>
    </Pane>
  )
}
