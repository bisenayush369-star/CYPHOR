"use client"

import { useState } from "react"
import { BookOpen, Code2, Ghost, Heart, ListChecks, PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LiveDisk } from "@/components/cipher-disk"
import { sendMessage } from "@/lib/actions"
import { useDemoMode } from "@/lib/catalog"
import { STARTERS } from "@/lib/defaults"
import { navigate, href } from "@/lib/route"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { cn, greeting } from "@/lib/utils"
import { Composer } from "./composer"

const ICONS = { write: PenLine, learn: BookOpen, code: Code2, plan: ListChecks, life: Heart } as const

export function Home() {
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const createChat = useStore((s) => s.createChat)
  const incognito = useUI((s) => s.incognito)
  const setIncognito = useUI((s) => s.setIncognito)
  const setDraft = useUI((s) => s.setDraft)
  const openSettings = useUI((s) => s.openSettings)
  const demo = useDemoMode()
  const [category, setCategory] = useState<string | null>(null)
  const active = STARTERS.find((c) => c.id === category)

  const start = (text: string, files: Parameters<typeof sendMessage>[2]) => {
    const id = createChat({ incognito, model: settings.defaultModel })
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
        {incognito && (
          <div className="rise mx-auto mb-5 flex max-w-full items-center gap-2 rounded-full border bg-card py-1 pr-1.5 pl-3 text-sm text-muted-foreground">
            <Ghost className="size-4 shrink-0" aria-hidden />
            <span className="truncate">Incognito chat: this conversation won't be saved</span>
            <Button variant="ghost" size="xs" className="rounded-full max-sm:h-8 pointer-coarse:h-8" onClick={() => setIncognito(false)}>
              Turn off
            </Button>
          </div>
        )}

        <div className="rise mx-auto size-[6.5rem] text-foreground sm:size-36 [@media(max-height:560px)]:hidden">
          <LiveDisk intro />
        </div>
        <h1 className="rise rise-1 mt-5 text-center font-serif text-[1.85rem] leading-[1.15] font-medium tracking-tight text-balance sm:text-[2.4rem] [@media(max-height:560px)]:mt-0">
          {greeting(settings.displayName)}
        </h1>
        <p className="rise rise-1 mt-2 text-center text-[15px] text-muted-foreground">What are we working on?</p>

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
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-[color,border-color,background-color,transform] duration-150 hover:border-primary/40 hover:text-foreground active:scale-95 max-sm:h-10 pointer-coarse:h-10 pointer-coarse:h-10",
                    on && "border-primary/50 bg-primary/8 text-foreground"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {c.label}
                </button>
              )
            })}
          </div>

          {active && (
            <ul className="mt-3 overflow-hidden rounded-2xl border bg-card animate-in fade-in slide-in-from-top-1 duration-200">
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

          {settings.provider === "server" && demo && (
            <p className="mt-5 text-center text-[13px] text-muted-foreground">
              The demo model is active, so replies are scripted examples.{" "}
              <button
                type="button"
                onClick={() => openSettings("router")}
                className="-my-2.5 inline-flex min-h-10 items-center px-1 text-primary underline underline-offset-4 hover:no-underline"
              >
                Connect your models
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
