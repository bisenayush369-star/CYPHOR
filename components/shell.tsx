"use client"

import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { LogoMark, Wordmark } from "@/components/brand"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { SIDEBAR_STORAGE_KEY, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { CityBackground } from "@/components/city-background"
import { useIsDesktop } from "@/lib/hooks/use-media"
import { startNewChat } from "@/lib/actions"
import { useCatalog } from "@/lib/catalog"
import { loadMotion } from "@/lib/motion"
import { useBindRouter, useRoute } from "@/lib/route"
import { useStore } from "@/lib/store"
import { startSync } from "@/lib/sync"
import { applyPalettePref } from "@/lib/palette"
import { applyAppearance, applyThemeDom } from "@/lib/theme"
import { useUI } from "@/lib/ui"

/* ---------------------------------------------------------------- */
/* Code splitting                                                    */
/* ---------------------------------------------------------------- */

/**
 * Next.js already splits every route into its own file. What is left here is the chrome that is
 * not needed for first paint: the artifact panel and command palette are fetched in the background
 * right after it, and settings and the small dialogs are fetched the first time they open.
 */
const load = {
  panel: () => import("@/components/artifact-panel"),
  palette: () => import("@/components/command-palette"),
  settings: () => import("@/components/settings/dialog"),
  dialogs: () => import("@/components/dialogs"),
  library: () => import("@/components/model-library"),
}
const ArtifactPanel = lazy(() => load.panel().then((m) => ({ default: m.ArtifactPanel })))
const CommandPalette = lazy(() => load.palette().then((m) => ({ default: m.CommandPalette })))
const SettingsDialog = lazy(() => load.settings().then((m) => ({ default: m.SettingsDialog })))
const RenameDialog = lazy(() => load.dialogs().then((m) => ({ default: m.RenameDialog })))
const ShareDialog = lazy(() => load.dialogs().then((m) => ({ default: m.ShareDialog })))
const ModelLibrary = lazy(() => load.library().then((m) => ({ default: m.ModelLibrary })))

function usePreload() {
  useEffect(() => {
    const run = () => {
      for (const f of [load.panel, load.palette]) void f().catch(() => {})
      void loadMotion().catch(() => {})
    }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 3000 })
    else setTimeout(run, 1200)
  }, [])
}

/** True from the first moment `flag` is true. Lets a dialog's code load on first open and then stay mounted. */
function useEver(flag: boolean) {
  const [ever, setEver] = useState(flag)
  if (flag && !ever) setEver(true)
  return ever
}

/** Shown for the instant a screen's code is on its way. Deliberately plain: it should never flash a spinner. */
function Pending() {
  return (
    <div className="min-h-0 flex-1" aria-busy="true">
      <span className="sr-only" role="status">
        Loading
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* App-wide behaviour                                                */
/* ---------------------------------------------------------------- */

function useAppearance() {
  const theme = useStore((s) => s.settings.theme)
  const font = useStore((s) => s.settings.chatFont)
  const effects = useStore((s) => s.settings.effects)

  useEffect(() => applyThemeDom(theme), [theme])
  useEffect(() => {
    if (theme !== "system") return
    const m = window.matchMedia("(prefers-color-scheme: dark)")
    const on = () => applyThemeDom("system")
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [theme])
  useEffect(() => applyAppearance(font, effects), [font, effects])

  // The colour theme. The first-paint script already picked one for this page load (a different one on every refresh
  // when you chose "change on every refresh"). Here a fixed choice wins over whatever it picked, and choosing "rotate"
  // in Settings shows a new theme straight away, but opening the app does not re-roll it.
  const palette = useStore((s) => s.settings.palette)
  const scene = useStore((s) => s.settings.scene)
  const first = useRef(true)
  useEffect(() => {
    applyPalettePref(palette, !first.current)
    first.current = false
  }, [palette])
  useEffect(() => {
    document.documentElement.dataset.scene = scene
  }, [scene])
}

/**
 * Keeps the app exactly as tall as what is visible. On phones the on-screen keyboard covers part
 * of the page, and 100dvh alone does not always follow it.
 */
function useVisibleHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const sync = () => {
      // While pinch-zoomed the visual viewport shrinks. That is zoom, not a keyboard.
      if (vv.scale > 1.01) return
      root.style.setProperty("--app-h", `${Math.round(vv.height)}px`)
      if (vv.offsetTop > 0) window.scrollTo(0, 0)
    }
    sync()
    vv.addEventListener("resize", sync)
    vv.addEventListener("scroll", sync)
    return () => {
      vv.removeEventListener("resize", sync)
      vv.removeEventListener("scroll", sync)
      root.style.removeProperty("--app-h")
    }
  }, [])
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      const ui = useUI.getState()
      const modalOpen = !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')

      if (mod && !e.shiftKey && !e.altKey && k === "k") {
        e.preventDefault()
        if (ui.commandOpen) ui.setCommandOpen(false)
        else if (!modalOpen) ui.setCommandOpen(true)
      } else if (mod && e.shiftKey && !e.altKey && k === "o") {
        e.preventDefault()
        if (!modalOpen) startNewChat()
      } else if (mod && !e.shiftKey && !e.altKey && k === ",") {
        e.preventDefault()
        if (ui.settingsOpen) ui.closeSettings()
        else if (!modalOpen) ui.openSettings()
      } else if (!mod && !e.altKey && e.key === "/" && !isTyping(e.target) && !modalOpen) {
        const box = document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Message to Cyphor']")
        if (box) {
          e.preventDefault()
          box.focus()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}

function useDocumentTitle() {
  const route = useRoute()
  const name = useStore((s) => (route.name === "chat" ? s.chats[route.id]?.title : route.name === "project" ? s.projects[route.id]?.name : undefined))
  useEffect(() => {
    const label =
      route.name === "chats" ? "Chats" : route.name === "projects" ? "Projects" : route.name === "artifacts" ? "Artifacts" : name
    const want = label ? `${label} · Cyphor` : "Cyphor Chat"
    const apply = () => {
      if (document.title !== want) document.title = want
    }
    apply()
    // Next.js puts a fresh <title> element in when the route changes, and that would undo the line above.
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [route.name, name])
}

/**
 * Marks the page once the shell is live: the router is bound and the keyboard shortcuts listen.
 * Nothing is styled by it. The browser tests wait for it, because a key pressed while the page is
 * still starting goes nowhere. Call it after the other effect hooks in App, so each of them has run by then.
 */
function useReadyMark() {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.ready = "true"
    return () => {
      delete root.dataset.ready
    }
  }, [])
}

/** An artifact belongs to one chat, so it closes when you leave that chat. */
function useArtifactLifecycle() {
  const route = useRoute()
  useEffect(() => {
    const a = useUI.getState().artifact
    if (a && !(route.name === "chat" && route.id === a.chatId)) useUI.getState().closeArtifact()
  }, [route])
}

function useBoot() {
  // Keeps a copy of saved chats in the account's database (does nothing in the offline preview).
  useEffect(() => startSync(), [])
  // Asks the server which providers are connected, so the model picker can say what each model resolves to.
  useEffect(() => {
    void useCatalog.getState().load()
  }, [])
}

/* ---------------------------------------------------------------- */
/* Layout                                                            */
/* ---------------------------------------------------------------- */

/**
 * The screen for the current URL. Keyed by pathname so moving between chats (or any two screens)
 * starts a fresh view with the short fade, exactly like a template.tsx would.
 */
function RouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="flex min-h-0 flex-1 flex-col animate-in duration-200 fade-in">
      <Suspense fallback={<Pending />}>{children}</Suspense>
    </div>
  )
}

function Frame({ children }: { children: ReactNode }) {
  const route = useRoute()
  const artifact = useUI((s) => s.artifact)
  const wide = useIsDesktop()
  const open = !!artifact && route.name === "chat" && route.id === artifact.chatId
  const fullscreen = open && !!artifact?.fullscreen
  const docked = open && wide && !fullscreen

  // `scene-surface` is where the veil over the moving city is drawn (app/cyber.css); `data-view` sets how strong it is.
  const view = route.name === "home" ? "home" : route.name === "chat" ? "chat" : "page"
  const main = (
    <div className="scene-surface flex h-full min-h-0 min-w-0 flex-1 flex-col" data-view={view}>
      <AppHeader artifactOpen={open} />
      <RouteFrame>{children}</RouteFrame>
    </div>
  )

  if (!wide) {
    return (
      <>
        {main}
        {open && (
          <Suspense fallback={null}>
            <ArtifactPanel mode="overlay" />
          </Suspense>
        )}
      </>
    )
  }

  return (
    <>
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel id="chat" minSize="30%" defaultSize={docked ? "54%" : "100%"}>
          {main}
        </ResizablePanel>
        {docked && (
          <>
            <ResizableHandle withHandle aria-label="Resize artifact panel" />
            <ResizablePanel id="artifact" defaultSize="46%" minSize="28%" maxSize="68%">
              <Suspense fallback={<div className="h-full border-l bg-background" aria-busy="true" />}>
                <ArtifactPanel mode="dock" />
              </Suspense>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {fullscreen && (
        <Suspense fallback={null}>
          <ArtifactPanel mode="dock" />
        </Suspense>
      )}
    </>
  )
}

function readSidebarOpen() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false"
  } catch {
    return true
  }
}

/**
 * Everything the app shows comes from this browser (saved chats, settings), so the server only
 * sends this splash and the real screen appears the moment the page is live. No mismatch, no flash.
 */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

function Splash() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background text-foreground" role="status" aria-label="Loading Cyphor">
      <LogoMark className="size-10" />
      <Wordmark className="text-lg" />
    </div>
  )
}

/**
 * The login page stands alone: no sidebar, no saved chats, and it is drawn on the server as well, so there is nothing to wait for.
 * Everything else waits until the server has said who is signed in, and shows their saved copy only then.
 */
export function Shell({ children }: { children: ReactNode }) {
  const mounted = useMounted()
  if (!mounted) return <Splash />
  return <App>{children}</App>
}

function App({ children }: { children: ReactNode }) {
  useBindRouter()
  useAppearance()
  useVisibleHeight()
  useShortcuts()
  useDocumentTitle()
  useArtifactLifecycle()
  useBoot()
  usePreload()
  useReadyMark()
  const theme = useStore((s) => s.settings.theme)
  const settingsReady = useEver(useUI((s) => s.settingsOpen))
  const paletteReady = useEver(useUI((s) => s.commandOpen))
  const renameReady = useEver(useUI((s) => s.renameChatId !== null))
  const shareReady = useEver(useUI((s) => s.shareChatId !== null))
  const libraryReady = useEver(useUI((s) => s.library !== null))

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={250}>
      <CityBackground />
      <SidebarProvider defaultOpen={readSidebarOpen()} className="h-[var(--app-h,100dvh)] min-h-0 overflow-hidden">
        <button
          type="button"
          onClick={() => document.getElementById("main")?.focus()}
          className="absolute top-2 left-2 z-[100] -translate-y-[200%] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0"
        >
          Skip to content
        </button>
        <AppSidebar />
        {/* Named, so it stays distinguishable from the main landmark inside an artifact's own page. */}
        <SidebarInset id="main" aria-label="Cyphor" tabIndex={-1} className="min-h-0 min-w-0 overflow-hidden outline-none">
          <Frame>{children}</Frame>
        </SidebarInset>
        <Suspense fallback={null}>
          {paletteReady && <CommandPalette />}
          {settingsReady && <SettingsDialog />}
          {renameReady && <RenameDialog />}
          {shareReady && <ShareDialog />}
          {libraryReady && <ModelLibrary />}
        </Suspense>
        <Toaster
          position="top-center"
          theme={theme}
          visibleToasts={3}
          offset={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
          mobileOffset={{ top: "calc(env(safe-area-inset-top) + 0.5rem)", left: "0.75rem", right: "0.75rem" }}
        />
      </SidebarProvider>
    </TooltipProvider>
  )
}
