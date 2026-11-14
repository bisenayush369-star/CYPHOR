import { useMemo } from "react"
import { Boxes, FolderKanban, Ghost, Keyboard, MessageSquare, MessagesSquare, Moon, PanelLeft, Plus, Settings, Sun } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { useSidebar } from "@/components/ui/sidebar"
import { startNewChat } from "@/lib/actions"
import { href, navigate } from "@/lib/route"
import { activeThread, useStore } from "@/lib/store"
import { resolveTheme, transitionTheme } from "@/lib/theme"
import { MOD, useUI } from "@/lib/ui"

export function CommandPalette() {
  const open = useUI((s) => s.commandOpen)
  const setOpen = useUI((s) => s.setCommandOpen)
  const setIncognito = useUI((s) => s.setIncognito)
  const openSettings = useUI((s) => s.openSettings)
  const chats = useStore((s) => s.chats)
  const projects = useStore((s) => s.projects)
  const theme = useStore((s) => s.settings.theme)
  const updateSettings = useStore((s) => s.updateSettings)
  const { toggleSidebar } = useSidebar()

  // Chat text is only indexed while the palette is open.
  const items = useMemo(() => {
    if (!open) return []
    return Object.values(chats)
      .filter((c) => !c.incognito)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 60)
      .map((c) => ({
        id: c.id,
        title: c.title,
        text: activeThread(c)
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join(" ")
          .slice(0, 500),
      }))
  }, [open, chats])

  const run = (fn: () => void) => () => {
    setOpen(false)
    // Let the dialog close first so focus returns cleanly.
    setTimeout(fn, 0)
  }

  const flipTheme = () => {
    const next = resolveTheme(theme) === "dark" ? "light" : "dark"
    transitionTheme(next, null, () => updateSettings({ theme: next }))
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search and commands" description="Find a chat or run a command">
      <CommandInput placeholder="Search chats or type a command" />
      <CommandList className="max-h-[min(26rem,60dvh)]">
        <CommandEmpty>Nothing matches that search.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem value="new chat" onSelect={run(startNewChat)}>
            <Plus /> New chat <CommandShortcut>{MOD} ⇧ O</CommandShortcut>
          </CommandItem>
          <CommandItem value="new incognito chat ghost private" onSelect={run(() => { setIncognito(true); navigate(href.home) })}>
            <Ghost /> New incognito chat
          </CommandItem>
          <CommandItem value="settings preferences" onSelect={run(() => openSettings("general"))}>
            <Settings /> Settings <CommandShortcut>{MOD},</CommandShortcut>
          </CommandItem>
          <CommandItem value="keyboard shortcuts" onSelect={run(() => openSettings("shortcuts"))}>
            <Keyboard /> Keyboard shortcuts
          </CommandItem>
          <CommandItem value="toggle theme dark light mode" onSelect={run(flipTheme)}>
            {resolveTheme(theme) === "dark" ? <Sun /> : <Moon />} Switch to {resolveTheme(theme) === "dark" ? "light" : "dark"} theme
          </CommandItem>
          <CommandItem value="toggle sidebar" onSelect={run(toggleSidebar)}>
            <PanelLeft /> Toggle sidebar <CommandShortcut>{MOD}B</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          <CommandItem value="all chats" onSelect={run(() => navigate(href.chats))}>
            <MessagesSquare /> All chats
          </CommandItem>
          <CommandItem value="projects" onSelect={run(() => navigate(href.projects))}>
            <FolderKanban /> Projects
          </CommandItem>
          <CommandItem value="artifacts" onSelect={run(() => navigate(href.artifacts))}>
            <Boxes /> Artifacts
          </CommandItem>
          {Object.values(projects).map((p) => (
            <CommandItem key={p.id} value={`project ${p.name}`} onSelect={run(() => navigate(href.project(p.id)))}>
              <FolderKanban /> {p.name}
            </CommandItem>
          ))}
        </CommandGroup>

        {items.length > 0 && (
          <CommandGroup heading="Chats">
            {items.map((c) => (
              <CommandItem key={c.id} value={`chat ${c.title} ${c.id}`} keywords={[c.text]} onSelect={run(() => navigate(href.chat(c.id)))}>
                <MessageSquare /> <span className="truncate">{c.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
