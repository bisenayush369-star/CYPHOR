import { ChevronDown, FolderMinus, FolderPlus, Layers, Moon, Pencil, Share2, Star, StarOff, Sun, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { collectArtifacts, mayHaveArtifacts } from "@/lib/parse"
import { href, navigate, useRoute } from "@/lib/route"
import { activeThread, useStore } from "@/lib/store"
import { resolveTheme, transitionTheme } from "@/lib/theme"
import { useUI } from "@/lib/ui"
import { IconButton } from "./icon-button"

const PAGE_TITLES: Record<string, string> = {
  home: "",
  chats: "Chats",
  projects: "Projects",
  artifacts: "Artifacts",
}

function ChatTitle({ id }: { id: string }) {
  const chat = useStore((s) => s.chats[id])
  const projects = useStore((s) => s.projects)
  const toggleStar = useStore((s) => s.toggleStar)
  const moveChat = useStore((s) => s.moveChat)
  const deleteChat = useStore((s) => s.deleteChat)
  const restoreChat = useStore((s) => s.restoreChat)
  const setRenameChat = useUI((s) => s.setRenameChat)
  const setShareChat = useUI((s) => s.setShareChat)
  if (!chat) return null

  const remove = () => {
    const removed = deleteChat(id)
    navigate(href.home)
    toast("Chat deleted", { action: removed ? { label: "Undo", onClick: () => restoreChat(removed) } : undefined })
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <h1 className="sr-only">{chat.title}</h1>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[15px] font-medium transition-colors hover:bg-accent focus-visible:outline-2 data-[state=open]:bg-accent max-sm:min-h-10 pointer-coarse:min-h-10"
          aria-label={`Chat options for ${chat.title}`}
        >
          <span className="truncate">{chat.title}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={() => toggleStar(id)}>
            {chat.starred ? <StarOff /> : <Star />} {chat.starred ? "Remove from starred" : "Star"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenameChat(id)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderPlus /> Add to project
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {Object.values(projects).length === 0 && <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>}
              {Object.values(projects).map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => moveChat(id, p.id)}>
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
              {chat.projectId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => moveChat(id, null)}>
                    <FolderMinus /> Remove from project
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => setShareChat(id)}>
            <Share2 /> Export
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={remove}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function AppHeader({ artifactOpen }: { artifactOpen: boolean }) {
  const route = useRoute()
  const theme = useStore((s) => s.settings.theme)
  const updateSettings = useStore((s) => s.updateSettings)
  const setShareChat = useUI((s) => s.setShareChat)
  const openArtifact = useUI((s) => s.openArtifact)
  const chatId = route.name === "chat" ? route.id : null
  const hasArtifacts = useStore((s) => {
    const c = chatId ? s.chats[chatId] : undefined
    return !!c && activeThread(c).some((m) => m.role === "assistant" && mayHaveArtifacts(m.content))
  })

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = resolveTheme(theme) === "dark" ? "light" : "dark"
    const r = e.currentTarget.getBoundingClientRect()
    transitionTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, () => updateSettings({ theme: next }))
  }

  const showLatestArtifact = () => {
    const c = chatId ? useStore.getState().chats[chatId] : undefined
    if (!c || !chatId) return
    const all = collectArtifacts(activeThread(c))
    const last = all[all.length - 1]
    if (last) openArtifact({ chatId, identifier: last.identifier })
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 px-2 pt-safe sm:px-3">
      <SidebarTrigger className="size-9 lg:hidden max-sm:size-10 pointer-coarse:size-10" aria-label="Open sidebar" />
      <div className="min-w-0 flex-1 px-1">
        {chatId ? (
          <ChatTitle id={chatId} />
        ) : PAGE_TITLES[route.name] ? (
          <h1 className="truncate px-2 text-[15px] font-medium">{PAGE_TITLES[route.name]}</h1>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        {chatId && hasArtifacts && !artifactOpen && (
          <IconButton label="Show artifact" onClick={showLatestArtifact}>
            <Layers />
          </IconButton>
        )}
        {chatId && (
          <IconButton label="Export chat" onClick={() => setShareChat(chatId)}>
            <Share2 />
          </IconButton>
        )}
        <IconButton label="Switch light or dark theme" onClick={toggleTheme} className="max-[400px]:hidden">
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </IconButton>
      </div>
    </header>
  )
}
