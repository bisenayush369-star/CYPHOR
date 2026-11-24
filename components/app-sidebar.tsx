import { useEffect, useMemo, useRef } from "react"
import {
  FolderKanban,
  FolderMinus,
  FolderPlus,
  Keyboard,
  MessagesSquare,
  Monitor,
  MoreHorizontal,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  StarOff,
  Sun,
  Trash2,
  Boxes,
} from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { startNewChat } from "@/lib/actions"
import { decode } from "@/lib/motion"
import { href, navigate, useRoute } from "@/lib/route"
import { useChatMetas, useStore, type ChatMeta } from "@/lib/store"
import { transitionTheme } from "@/lib/theme"
import { MOD, useUI } from "@/lib/ui"
import { bucketFor } from "@/lib/utils"
import type { ThemePref } from "@/lib/types"
import { LogoMark, Wordmark } from "./brand"
import { Keys } from "./keys"
import Link from "next/link"

const MAX_RECENTS = 40
const ORDER = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"]

function ChatItem({ chat, active }: { chat: ChatMeta; active: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const projects = useStore((s) => s.projects)
  const toggleStar = useStore((s) => s.toggleStar)
  const moveChat = useStore((s) => s.moveChat)
  const deleteChat = useStore((s) => s.deleteChat)
  const restoreChat = useStore((s) => s.restoreChat)
  const markTitleSeen = useStore((s) => s.markTitleSeen)
  const setRenameChat = useUI((s) => s.setRenameChat)
  const titleRef = useRef<HTMLSpanElement>(null)

  // A newly named chat decodes into its title once: the sidebar's one moment of cipher play.
  useEffect(() => {
    if (!chat.titleFresh) return
    if (titleRef.current) decode(titleRef.current, chat.title)
    markTitleSeen(chat.id)
  }, [chat.titleFresh, chat.title, chat.id, markTitleSeen])

  const remove = () => {
    const removed = deleteChat(chat.id)
    if (active) navigate(href.home)
    toast("Chat deleted", { action: removed ? { label: "Undo", onClick: () => restoreChat(removed) } : undefined })
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={chat.title} className="h-9 lg:h-8">
        {/* The label keeps the name steady while the title decodes, so screen readers never hear scrambled letters. */}
        <Link href={href.chat(chat.id)} aria-label={chat.title} aria-current={active ? "page" : undefined} onClick={() => isMobile && setOpenMobile(false)}>
          <span ref={titleRef} className="truncate">
            {chat.title}
          </span>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover aria-label={`Options for ${chat.title}`}>
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="start" className="w-52">
          <DropdownMenuItem onSelect={() => toggleStar(chat.id)}>
            {chat.starred ? <StarOff /> : <Star />} {chat.starred ? "Remove from starred" : "Star"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenameChat(chat.id)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderPlus /> Add to project
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {Object.values(projects).length === 0 && <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>}
              {Object.values(projects).map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => moveChat(chat.id, p.id)}>
                  <FolderKanban /> <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
              {chat.projectId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => moveChat(chat.id, null)}>
                    <FolderMinus /> Remove from project
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={remove}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const route = useRoute()
  const metas = useChatMetas()
  const { isMobile, setOpenMobile } = useSidebar()
  const theme = useStore((s) => s.settings.theme)
  const updateSettings = useStore((s) => s.updateSettings)
  const setCommandOpen = useUI((s) => s.setCommandOpen)
  const openSettings = useUI((s) => s.openSettings)

  const activeId = route.name === "chat" ? route.id : null
  const close = () => isMobile && setOpenMobile(false)

  const { starred, groups, extra } = useMemo(() => {
    const starred = metas.filter((m) => m.starred)
    const rest = metas.filter((m) => !m.starred)
    const shown = rest.slice(0, MAX_RECENTS)
    const map = new Map<string, ChatMeta[]>()
    for (const m of shown) {
      const b = bucketFor(m.updatedAt)
      map.set(b, [...(map.get(b) ?? []), m])
    }
    return {
      starred,
      groups: ORDER.filter((b) => map.has(b)).map((b) => ({ label: b, items: map.get(b)! })),
      extra: rest.length - shown.length,
    }
  }, [metas])

  const newChat = () => {
    startNewChat()
    close()
  }

  const setTheme = (next: ThemePref, e?: React.SyntheticEvent) => {
    const rect = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect()
    transitionTheme(next, rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null, () => updateSettings({ theme: next }))
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center justify-between gap-2 p-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:p-2">
        <Link href={href.home} onClick={close} className="flex min-h-10 items-center gap-2 rounded-md pr-2 outline-offset-4 lg:min-h-0 lg:pr-0" aria-label="Cyphor home">
          <LogoMark className="size-7" />
          <Wordmark className="group-data-[collapsible=icon]:hidden" />
        </Link>
        <SidebarTrigger className="size-8 text-muted-foreground max-lg:hidden" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="New chat"
                onClick={newChat}
                className="h-10 bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary lg:h-9 data-[active=true]:bg-primary/15"
              >
                <Plus />
                <span>New chat</span>
                <Keys keys={[MOD, "⇧", "O"]} className="ml-auto hidden text-primary can-hover:inline-flex group-data-[collapsible=icon]:hidden [&>kbd]:bg-transparent [&>kbd]:text-inherit" />
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Search" onClick={() => { setCommandOpen(true); close() }} className="h-10 lg:h-9">
                <Search />
                <span>Search</span>
                <Keys keys={[MOD, "K"]} className="ml-auto hidden can-hover:inline-flex group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Chats" isActive={route.name === "chats"} className="h-10 lg:h-9">
                <Link href={href.chats} onClick={close}>
                  <MessagesSquare />
                  <span>Chats</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Projects" isActive={route.name === "projects" || route.name === "project"} className="h-10 lg:h-9">
                <Link href={href.projects} onClick={close}>
                  <FolderKanban />
                  <span>Projects</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Artifacts" isActive={route.name === "artifacts"} className="h-10 lg:h-9">
                <Link href={href.artifacts} onClick={close}>
                  <Boxes />
                  <span>Artifacts</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <div className="contents group-data-[collapsible=icon]:hidden">
          {starred.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Starred</SidebarGroupLabel>
              <SidebarMenu>
                {starred.map((c) => (
                  <ChatItem key={c.id} chat={c} active={c.id === activeId} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}

          {groups.map((g) => (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarMenu>
                {g.items.map((c) => (
                  <ChatItem key={c.id} chat={c} active={c.id === activeId} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}

          {extra > 0 && (
            <div className="px-4 pb-2">
              <Link href={href.chats} onClick={close} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                View all {metas.length} chats
              </Link>
            </div>
          )}

          {metas.length === 0 && (
            <p className="px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">Your chats will show up here once you start one.</p>
          )}
        </div>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar aria-hidden className="size-8 rounded-none [clip-path:polygon(0_0,calc(100%_-_6px)_0,100%_6px,100%_100%,6px_100%,0_calc(100%_-_6px))]">
                <AvatarFallback className="rounded-none bg-primary font-display text-sm font-semibold text-primary-foreground">C</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">Cyphor</span>
                <span className="truncate text-xs text-muted-foreground">Local workspace</span>
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-60">
            <DropdownMenuItem onSelect={() => { close(); openSettings("general") }}>
              <Settings /> Settings
              <span className="ml-auto hidden text-xs text-muted-foreground can-hover:inline">{MOD},</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { close(); openSettings("shortcuts") }}>
              <Keyboard /> Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Appearance</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePref)}>
              <DropdownMenuRadioItem value="light" onClick={(e) => setTheme("light", e)}>
                <Sun className="size-4" /> Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" onClick={(e) => setTheme("dark", e)}>
                <Moon className="size-4" /> Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" onClick={(e) => setTheme("system", e)}>
                <Monitor className="size-4" /> System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      {!isMobile && <SidebarRail />}
    </Sidebar>
  )
}
