import { useEffect, useRef, type ComponentType } from "react"
import { ChartColumn, Cpu, Feather, Keyboard, Network, Palette, Plug, ShieldCheck, SlidersHorizontal, Sparkles, X, type LucideIcon } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMedia } from "@/lib/hooks/use-media"
import { useUI, type SettingsTab } from "@/lib/ui"
import { IconButton } from "../icon-button"
import { AppearanceTab } from "./appearance"
import { CapabilitiesTab } from "./capabilities"
import { ConnectorsTab } from "./connectors"
import { GeneralTab } from "./general"
import { ModelTab } from "./model"
import { PrivacyTab } from "./privacy"
import { RouterTab } from "./router"
import { ShortcutsTab } from "./shortcuts"
import { StylesTab } from "./styles"
import { UsageTab } from "./usage"

const TABS: { id: SettingsTab; label: string; icon: LucideIcon; Panel: ComponentType }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal, Panel: GeneralTab },
  { id: "appearance", label: "Appearance", icon: Palette, Panel: AppearanceTab },
  { id: "model", label: "Model", icon: Cpu, Panel: ModelTab },
  { id: "router", label: "Router", icon: Network, Panel: RouterTab },
  { id: "capabilities", label: "Capabilities", icon: Sparkles, Panel: CapabilitiesTab },
  { id: "styles", label: "Styles", icon: Feather, Panel: StylesTab },
  { id: "connectors", label: "Connectors", icon: Plug, Panel: ConnectorsTab },
  { id: "privacy", label: "Privacy", icon: ShieldCheck, Panel: PrivacyTab },
  { id: "usage", label: "Usage", icon: ChartColumn, Panel: UsageTab },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard, Panel: ShortcutsTab },
]

export function SettingsDialog() {
  const open = useUI((s) => s.settingsOpen)
  const tab = useUI((s) => s.settingsTab)
  const close = useUI((s) => s.closeSettings)
  const setTab = useUI((s) => s.setSettingsTab)
  const sideNav = useMedia("(min-width: 768px)")
  const listRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // On a phone the tab strip scrolls sideways. Keep the active tab in view, and start each page at the top.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.scrollIntoView({ block: "nearest", inline: "center" })
    bodyRef.current?.scrollTo({ top: 0 })
  }, [open, tab])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        showCloseButton={false}
        // Open on the current section. Left alone, focus lands on the close button, its tooltip opens, and the first Escape only dismisses the tooltip.
        onOpenAutoFocus={(e) => {
          const current = listRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
          if (!current) return
          e.preventDefault()
          current.focus({ preventScroll: true })
        }}
        className="flex flex-col gap-0 overflow-hidden p-0 max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=closed]:slide-out-to-bottom-8 max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom-8 sm:h-[min(44rem,calc(100dvh-3rem))] sm:max-w-[min(56rem,calc(100%-2rem))]"
      >
        <div className="shrink-0 border-b pt-safe">
          <DialogHeader className="flex-row items-center justify-between gap-2 px-4 py-2.5 sm:px-6 sm:py-3">
            <DialogTitle className="font-display text-xl font-semibold tracking-tight">Settings</DialogTitle>
            <DialogDescription className="sr-only">Change how Cyphor looks, which model it talks to, and what it keeps on this device.</DialogDescription>
            <DialogClose asChild>
              <IconButton label="Close settings" size="icon" className="-mr-1 sm:-mr-2">
                <X />
              </IconButton>
            </DialogClose>
          </DialogHeader>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as SettingsTab)}
          orientation={sideNav ? "vertical" : "horizontal"}
          className="min-h-0 flex-1 gap-0 md:flex-row"
        >
          <TabsList
            ref={listRef}
            aria-label="Settings sections"
            className="no-scrollbar h-auto w-full shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-1.5 group-data-[orientation=horizontal]/tabs:h-auto md:w-56 md:flex-col md:items-stretch md:justify-start md:gap-0.5 md:overflow-x-visible md:overflow-y-auto md:border-r md:border-b-0 md:p-3"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="h-10 flex-none justify-start gap-2.5 rounded-lg px-3 text-sm text-muted-foreground after:hidden data-[state=active]:border-transparent data-[state=active]:text-foreground data-[state=active]:bg-accent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-accent"
              >
                <Icon aria-hidden />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div
            ref={bodyRef}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-8 sm:pb-8"
          >
            {TABS.map(({ id, Panel }) => (
              <TabsContent key={id} value={id} className="outline-none">
                <Panel />
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
