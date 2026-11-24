import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  ArrowUp,
  Camera,
  Crown,
  FileText,
  Globe,
  Mic,
  Palette,
  Paperclip,
  Plug,
  Plus,
  Square,
  Telescope,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCatalog } from "@/lib/catalog"
import { useCoarsePointer } from "@/lib/hooks/use-media"
import { readAttachment } from "@/lib/files"
import { BUILTIN_STYLES, CONNECTORS } from "@/lib/defaults"
import { useStore } from "@/lib/store"
import type { Attachment } from "@/lib/types"
import { useUI } from "@/lib/ui"
import { cn, formatBytes } from "@/lib/utils"
import { IconButton } from "./icon-button"
import { ModelPicker } from "./model-picker"

const MAX_FILES = 8
const MAX_BYTES = 10 * 1024 * 1024
const NO_FILES: Attachment[] = []

interface Props {
  /** Key for the unsent draft, so text and files survive navigation. */
  draftKey: string
  placeholder?: string
  autoFocus?: boolean
  generating?: boolean
  model: string
  onModelChange: (id: string) => void
  onSend: (text: string, files: Attachment[]) => void
  onStop?: () => void
  /** The large variant used on the home screen. */
  hero?: boolean
  menuSide?: "top" | "bottom"
}

interface SpeechLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
  start: () => void
  stop: () => void
}

function getSpeech(): (new () => SpeechLike) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechLike; webkitSpeechRecognition?: new () => SpeechLike }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function Composer({ draftKey, placeholder = "Reply to Cyphor", autoFocus, generating, model, onModelChange, onSend, onStop, hero, menuSide = "top" }: Props) {
  const draft = useUI((s) => s.drafts[draftKey] ?? "")
  const files = useUI((s) => s.pending[draftKey] ?? NO_FILES)
  const setDraft = useUI((s) => s.setDraft)
  const setPending = useUI((s) => s.setPending)
  const openSettings = useUI((s) => s.openSettings)
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const coarse = useCoarsePointer()

  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const recRef = useRef<SpeechLike | null>(null)
  const baseRef = useRef("")
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [listening, setListening] = useState(false)
  const Speech = getSpeech()

  // God Mode is a switch of its own: it asks every connected provider and merges the answers. Turning it off goes back to the model you had.
  const catalog = useCatalog((s) => s.data)
  const godReady = !catalog || catalog.mode === "demo" || catalog.godReady
  const isGod = model === "cyphor-god"
  const beforeGod = useRef("cyphor-auto")
  useEffect(() => {
    if (model !== "cyphor-god") beforeGod.current = model
  }, [model])
  const toggleGod = () => onModelChange(isGod ? beforeGod.current : "cyphor-god")

  const style = [...BUILTIN_STYLES, ...settings.customStyles].find((x) => x.id === settings.styleId)
  const connected = CONNECTORS.filter((c) => settings.connectors[c.id])

  // Grow with the text up to 40% of the viewport, then scroll.
  useLayoutEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.4)) + "px"
  }, [draft])

  useEffect(() => {
    if (autoFocus && !coarse) taRef.current?.focus()
  }, [autoFocus, coarse, draftKey])

  useEffect(() => () => recRef.current?.stop(), [])

  const addFiles = useCallback(
    async (list: File[]) => {
      if (!list.length) return
      const have = useUI.getState().pending[draftKey]?.length ?? 0
      const room = MAX_FILES - have
      if (room <= 0) return void toast.error(`You can attach up to ${MAX_FILES} files per message.`)
      if (list.length > room) toast.info(`Only the first ${room} file${room === 1 ? "" : "s"} were added.`)
      setReading(true)
      const out: Attachment[] = []
      for (const f of list.slice(0, room)) {
        if (f.size > MAX_BYTES) {
          toast.error(`${f.name} is larger than 10 MB.`)
          continue
        }
        try {
          const a = await readAttachment(f)
          if (a.unsupported) toast.error(`Cyphor can't read ${a.name} yet. Text files and images work.`)
          else out.push(a)
        } catch {
          toast.error(`Couldn't read ${f.name}.`)
        }
      }
      setReading(false)
      if (out.length) setPending(draftKey, [...(useUI.getState().pending[draftKey] ?? []), ...out])
    },
    [draftKey, setPending]
  )

  const canSend = !generating && !reading && (draft.trim().length > 0 || files.length > 0)

  const submit = () => {
    if (!canSend) return
    recRef.current?.stop()
    const text = draft.trim()
    setDraft(draftKey, "")
    setPending(draftKey, [])
    onSend(text, files)
  }

  const toggleVoice = () => {
    if (!Speech) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new Speech()
    rec.lang = navigator.language || "en-US"
    rec.interimResults = true
    rec.continuous = true
    baseRef.current = draft ? draft.replace(/\s+$/, "") + " " : ""
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join("")
      setDraft(draftKey, baseRef.current + text)
    }
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast.error("Microphone access is blocked. Allow it in your browser settings.")
      else if (e.error && e.error !== "no-speech" && e.error !== "aborted") toast.error("Voice input stopped working.")
    }
    rec.onend = () => setListening(false)
    try {
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch {
      toast.error("Voice input isn't available right now.")
    }
  }

  const chips: { key: string; label: string; icon: typeof Globe; off: () => void }[] = []
  if (settings.webSearch) chips.push({ key: "web", label: "Web search", icon: Globe, off: () => update({ webSearch: false }) })
  if (settings.research) chips.push({ key: "research", label: "Research", icon: Telescope, off: () => update({ research: false }) })
  if (style && style.id !== "normal") chips.push({ key: "style", label: style.name, icon: Palette, off: () => update({ styleId: "normal" }) })

  return (
    <div className="focus-glow">
    <div
      data-active={dragging || undefined}
      data-god={isGod || undefined}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        setDragging(false)
        void addFiles(Array.from(e.dataTransfer.files))
      }}
      className={cn(
        "cut cut-lg brackets lit [--edge:var(--input)] [--fill:var(--card)]",
        hero && "cut-xl",
        // God Mode wears the hazard stripe along its top edge and a yellow outline.
        isGod && "[--edge:var(--marker)]"
      )}
    >
      {isGod && <div className="hazard pointer-events-none absolute inset-x-0 top-0 z-[2] h-[3px]" aria-hidden />}
      {dragging && (
        <div className="hud pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-card/90 text-sm text-signal">
          Drop files to attach
        </div>
      )}

      {files.length > 0 && (
        <ul className="no-scrollbar flex gap-2 overflow-x-auto px-3 pt-3" aria-label="Attached files">
          {files.map((f) => (
            <li key={f.id} className="group/file relative shrink-0">
              {f.kind === "image" && f.dataUrl ? (
                <img src={f.dataUrl} alt={f.name} className="size-16 rounded-sm border object-cover" />
              ) : (
                <div className="flex h-16 w-40 items-center gap-2 rounded-sm border bg-muted/60 px-3">
                  <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 text-xs">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                  </span>
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setPending(draftKey, files.filter((x) => x.id !== f.id))}
                className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-sm border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground max-sm:size-7"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        ref={taRef}
        value={draft}
        rows={hero ? 2 : 1}
        placeholder={placeholder}
        aria-label="Message to Cyphor"
        enterKeyHint={settings.sendWithEnter && !coarse ? "send" : "enter"}
        autoComplete="off"
        spellCheck
        onChange={(e) => {
          setDraft(draftKey, e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return
          const mod = e.metaKey || e.ctrlKey
          const enterSends = settings.sendWithEnter && !coarse
          if (mod || (enterSends && !e.shiftKey)) {
            e.preventDefault()
            submit()
          }
        }}
        onPaste={(e) => {
          const pasted = Array.from(e.clipboardData.files)
          if (pasted.length) {
            e.preventDefault()
            void addFiles(pasted)
          }
        }}
        className={cn(
          "block w-full resize-none bg-transparent px-4 pt-3.5 pb-1.5 font-sans text-base leading-6 outline-none placeholder:text-muted-foreground",
          hero ? "min-h-[4.25rem] sm:px-5 sm:pt-4" : "min-h-[2.75rem]"
        )}
      />

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-3 pb-1.5" aria-label="Active options">
          {chips.map(({ key, label, icon: Icon, off }) => (
            <li key={key}>
              <button
                type="button"
                onClick={off}
                aria-label={`${label} is on. Turn off`}
                className="group/chip inline-flex h-7 items-center gap-1.5 rounded-sm border border-signal/40 bg-signal/10 pr-1.5 pl-2.5 font-sans text-xs text-link transition-colors hover:bg-signal/20 max-sm:h-8"
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
                <X className="size-3 opacity-60 group-hover/chip:opacity-100" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1 px-2 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Add files, connectors and tools" size="icon" className="size-9 rounded-sm text-muted-foreground" side={menuSide === "top" ? "top" : "bottom"}>
              <Plus className="size-5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={menuSide} className="w-[min(17rem,calc(100vw-1.5rem))]">
            <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
              <Paperclip /> Add files or photos
            </DropdownMenuItem>
            {coarse && (
              <DropdownMenuItem onSelect={() => camRef.current?.click()}>
                <Camera /> Take a photo
              </DropdownMenuItem>
            )}
            {connected.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Plug /> Add from connectors
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {connected.map((c) => (
                    <DropdownMenuItem key={c.id} onSelect={() => toast.info(`${c.name} needs a backend integration to attach content.`)}>
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem onSelect={() => openSettings("connectors")}>
                <Plug /> Connect apps
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={settings.webSearch} onCheckedChange={(v) => update({ webSearch: !!v })} onSelect={(e) => e.preventDefault()}>
              <Globe className="size-4" /> Web search
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={settings.research} onCheckedChange={(v) => update({ research: !!v })} onSelect={(e) => e.preventDefault()}>
              <Telescope className="size-4" /> Research
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette /> Use style
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Response style</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={settings.styleId} onValueChange={(v) => update({ styleId: v })}>
                  {[...BUILTIN_STYLES, ...settings.customStyles].map((st) => (
                    <DropdownMenuRadioItem key={st.id} value={st.id} className="items-start py-2">
                      <span>
                        <span className="block text-sm">{st.name}</span>
                        <span className="block text-xs text-muted-foreground">{st.description}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          {settings.provider === "server" && (
            <IconButton
              label={isGod ? "God Mode is on. Turn it off" : godReady ? "God Mode: every connected model answers, then one merged answer" : "God Mode needs two connected providers"}
              pressed={isGod}
              size="icon"
              disabled={!godReady && !isGod}
              onClick={toggleGod}
              className={cn("size-9 rounded-sm text-muted-foreground", isGod && "bg-marker text-[#0a0b10] hover:bg-marker hover:text-[#0a0b10]")}
            >
              <Crown className="size-[1.1rem]" />
            </IconButton>
          )}
          <ModelPicker model={model} onChange={onModelChange} side={menuSide} />
          {Speech && (
            <IconButton
              label={listening ? "Stop voice input" : "Dictate"}
              pressed={listening}
              size="icon"
              onClick={toggleVoice}
              className={cn("size-9 rounded-sm text-muted-foreground", listening && "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive")}
            >
              <Mic className={cn("size-[1.15rem]", listening && "animate-pulse")} />
            </IconButton>
          )}
          {generating ? (
            <Button type="button" size="icon" aria-label="Stop reply" onClick={onStop} className="ratchet size-10 sm:size-9">
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              aria-label="Send message"
              disabled={!canSend}
              onClick={submit}
              className="ratchet size-10 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:size-9"
            >
              <ArrowUp className="size-[1.15rem]" />
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />
    </div>
    </div>
  )
}
