"use client"

import { useState } from "react"
import { BookOpen, Code2, Heart, ListChecks, PenLine } from "lucide-react"
import { sendMessage } from "@/lib/actions"
import { STARTERS } from "@/lib/defaults"
import { navigate, href } from "@/lib/route"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { cn, greeting } from "@/lib/utils"
import { Composer } from "./composer"
import { RouterStrip } from "./router-strip"
import { SceneChoice } from "./scene-choice"

const ICONS = { write: PenLine, learn: BookOpen, code: Code2, plan: ListChecks, life: Heart } as const

export function Home() {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const createChat = useStore((s) => s.createChat)
  const setDraft = useUI((s) => s.setDraft)
  const openSettings = useUI((s) => s.openSettings)
  const [category, setCategory] = useState<string | null>(null)
  const active = STARTERS.find((c) => c.id === category)
  const hello = greeting(settings.displayName)

  const start = (text: string, files: Parameters<typeof sendMessage>[2]) => {
    const id = createChat({ model: settings.defaultModel })
    navigate(href.chat(id))
    sendMessage(id, text, files)
  }

  const pick = (prompt: string) => {
    setDraft("home", prompt)
    setCategory(null)
    // On a phone, focusing would raise the keyboard over the very prompt that was just picked.
    if (window.matchMedia("(pointer: coarse)").matches) return
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Message to Cyphor']")?.focus())
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col justify-center px-4 py-8 sm:px-6">
        <SceneChoice />
        <div className="rise [@media(max-height:560px)]:hidden">
          <RouterStrip onConnect={() => openSettings("router")} />
        </div>
        <h1 className="rise rise-1 mt-6 text-center font-display text-[1.9rem] leading-[1.12] font-semibold text-balance sm:text-[2.7rem] [@media(max-height:560px)]:mt-0">
          <span className="glitch" data-text={hello}>
            {hello}
          </span>
        </h1>
        <p className="scene-text rise rise-1 mt-2 text-center text-[15px] text-muted-foreground">What are we working on?</p>

        <div className="rise rise-2 mt-7">
          <Composer
            hero
            autoFocus
            draftKey="home"
            placeholder="Ask Cyphor anything"
            model={settings.defaultModel}
            onModelChange={(id) => update({ defaultModel: id })}
            onSend={start}
            menuSide="bottom"
          />
        </div>

        <div className="rise rise-3 mt-4">
          <div
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
            role="group"
            aria-label="Prompt ideas"
          >
            {STARTERS.map((c) => {
              const Icon = ICONS[c.id as keyof typeof ICONS]
              const on = category === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-expanded={on}
                  onClick={() => setCategory(on ? null : c.id)}
                  className={cn(
                    "cut cut-sm inline-flex h-9 shrink-0 items-center gap-2 px-3.5 text-sm text-muted-foreground transition-[color,--edge,--fill] duration-150 [--edge:var(--border)] [--fill:var(--card)] hover:text-foreground hover:[--edge:var(--signal)] active:brightness-90 max-sm:h-10 pointer-coarse:h-10",
                    on && "text-foreground [--edge:var(--marker)]"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {c.label}
                </button>
              )
            })}
          </div>

          {active && (
            <ul className="mt-3 overflow-hidden border bg-card animate-in fade-in slide-in-from-top-1 duration-200">
              {active.prompts.map((p) => (
                <li key={p} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="w-full px-4 py-3 text-left text-[15px] leading-snug transition-colors hover:bg-accent focus-visible:bg-accent"
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          )}

        </div>
      </div>
    </div>
  )
}
