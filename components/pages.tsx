"use client"

import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from "react"
import { Boxes, ChevronLeft, FileText, FolderKanban, FolderX, MessagesSquare, MoreHorizontal, Plus, ScrollText, Search, Star, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { sendMessage } from "@/lib/actions"
import { readAttachment } from "@/lib/files"
import { collectArtifacts } from "@/lib/parse"
import { href, navigate, useRouteId } from "@/lib/route"
import { activeThread, useChatMetas, useStore, type ChatMeta } from "@/lib/store"
import type { ArtifactType, Attachment } from "@/lib/types"
import { useUI } from "@/lib/ui"
import { cn, formatBytes, formatRelative } from "@/lib/utils"
import { TYPE_LABEL, TypeIcon } from "./artifact-card"
import { Composer } from "./composer"
import { NewProjectDialog } from "./dialogs"
import { IconButton } from "./icon-button"
import Link from "next/link"

/** The scrolling frame shared by every page. The app header above it carries the page title. */
function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className={cn("mx-auto w-full px-4 pt-2 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:px-6", wide ? "max-w-5xl" : "max-w-3xl")}>{children}</div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Chats                                                             */
/* ---------------------------------------------------------------- */

function ChatRow({
  chat,
  projectName,
  selecting,
  picked,
  onPick,
}: {
  chat: ChatMeta
  projectName?: string
  selecting?: boolean
  picked?: boolean
  onPick?: (id: string) => void
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{chat.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span>{formatRelative(chat.updatedAt)}</span>
          {projectName && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{projectName}</span>
            </>
          )}
        </span>
      </span>
      {chat.starred && <Star className="size-4 shrink-0 fill-brass text-brass" aria-label="Starred" />}
    </>
  )

  const base = "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent"
  if (selecting) {
    return (
      <li>
        <label className={cn(base, "cursor-pointer has-[[data-state=checked]]:bg-accent")}>
          <Checkbox checked={!!picked} onCheckedChange={() => onPick?.(chat.id)} />
          {body}
        </label>
      </li>
    )
  }
  return (
    <li>
      <Link href={href.chat(chat.id)} className={base}>
        {body}
      </Link>
    </li>
  )
}

export function ChatsPage() {
  const metas = useChatMetas()
  const projects = useStore((s) => s.projects)
  const [q, setQ] = useState("")
  const needle = useDeferredValue(q.trim().toLowerCase())
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const results = useMemo(() => {
    if (!needle) return metas
    const chats = useStore.getState().chats
    return metas.filter((m) => {
      if (m.title.toLowerCase().includes(needle)) return true
      const c = chats[m.id]
      return !!c && Object.values(c.nodes).some((n) => n.content.toLowerCase().includes(needle))
    })
  }, [metas, needle])

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const stopSelecting = () => {
    setSelecting(false)
    setPicked(new Set())
  }

  const removePicked = () => {
    const st = useStore.getState()
    const removed = [...picked].map((id) => st.deleteChat(id)).filter((c): c is NonNullable<typeof c> => !!c)
    stopSelecting()
    toast(`${removed.length} chat${removed.length === 1 ? "" : "s"} deleted`, {
      duration: 8000,
      action: { label: "Undo", onClick: () => removed.forEach((c) => useStore.getState().restoreChat(c)) },
    })
  }

  if (metas.length === 0) {
    return (
      <Page>
        <Empty className="mt-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquare />
            </EmptyMedia>
            <EmptyTitle>No chats yet</EmptyTitle>
            <EmptyDescription>Conversations you have are saved here on this device, so you can pick them up later.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href={href.home}>Start a chat</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Page>
    )
  }

  return (
    <Page>
      <div className="sticky top-0 z-10 -mx-4 space-y-3 bg-background/95 px-4 pt-1 pb-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Search your chats"
              placeholder="Search your chats"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 rounded-xl pl-9 md:h-10"
            />
          </div>
          {selecting ? (
            <Button variant="outline" className="h-11 rounded-xl md:h-10" onClick={stopSelecting}>
              Cancel
            </Button>
          ) : (
            <Button variant="outline" className="h-11 rounded-xl md:h-10" onClick={() => setSelecting(true)}>
              Select
            </Button>
          )}
        </div>

        <div className="flex min-h-8 items-center justify-between gap-2 text-[13px] text-muted-foreground" aria-live="polite">
          {selecting ? (
            <>
              <span>{picked.size} selected</span>
              <span className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPicked(picked.size === results.length ? new Set() : new Set(results.map((r) => r.id)))}>
                  {picked.size === results.length && results.length > 0 ? "Clear" : "Select all"}
                </Button>
                <Button variant="destructive" size="sm" disabled={picked.size === 0} onClick={removePicked}>
                  <Trash2 /> Delete
                </Button>
              </span>
            </>
          ) : (
            <span>
              {needle ? `${results.length} of ${metas.length}` : metas.length} chat{(needle ? results.length : metas.length) === 1 ? "" : "s"}
              {needle ? " match" : ""}
            </span>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches “{q.trim()}”. Try a different word.</p>
      ) : (
        <ul className="-mx-1 space-y-0.5">
          {results.map((c) => (
            <ChatRow
              key={c.id}
              chat={c}
              projectName={c.projectId ? projects[c.projectId]?.name : undefined}
              selecting={selecting}
              picked={picked.has(c.id)}
              onPick={toggle}
            />
          ))}
        </ul>
      )}
    </Page>
  )
}

/* ---------------------------------------------------------------- */
/* Projects                                                          */
/* ---------------------------------------------------------------- */

export function ProjectsPage() {
  const projects = useStore((s) => s.projects)
  const metas = useChatMetas()
  const [open, setOpen] = useState(false)

  const list = useMemo(() => Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt), [projects])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of metas) if (c.projectId) m.set(c.projectId, (m.get(c.projectId) ?? 0) + 1)
    return m
  }, [metas])

  return (
    <Page wide>
      <div className="flex items-start justify-between gap-4 pb-5">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          A project keeps related chats together and gives Cyphor standing instructions and files to work from.
        </p>
        <Button className="shrink-0 max-sm:h-10 pointer-coarse:h-10" onClick={() => setOpen(true)}>
          <Plus /> New project
        </Button>
      </div>

      {list.length === 0 ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>Create one for a thesis, a client or a side project, and every chat inside it starts with the right context.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setOpen(true)}>
              <Plus /> Create a project
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const n = counts.get(p.id) ?? 0
            return (
              <li key={p.id}>
                <Link
                  href={href.project(p.id)}
                  className="group/project flex h-full min-h-36 flex-col rounded-2xl border bg-card p-4 transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
                >
                  <span className="font-serif text-lg leading-snug font-medium">{p.name}</span>
                  <span className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{p.description || "No description yet"}</span>
                  <span className="mt-auto pt-4 text-xs text-muted-foreground">
                    {n} chat{n === 1 ? "" : "s"} · Updated {formatRelative(p.updatedAt)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </Page>
  )
}

const MAX_PROJECT_CHARS = 200_000
const TEXT_ACCEPT = "text/*,.md,.markdown,.json,.csv,.tsv,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.yml,.yaml,.xml,.log,.sh,.go,.rs,.java,.c,.cpp,.rb,.php,.toml"

function ProjectFiles({ id }: { id: string }) {
  const files = useStore((s) => s.projects[id]?.files ?? [])
  const update = useStore((s) => s.updateProject)
  const inputRef = useRef<HTMLInputElement>(null)
  const used = files.reduce((n, f) => n + (f.text?.length ?? 0), 0)

  const add = async (list: File[]) => {
    const out: Attachment[] = []
    let total = (useStore.getState().projects[id]?.files ?? []).reduce((n, f) => n + (f.text?.length ?? 0), 0)
    for (const f of list) {
      try {
        const a = await readAttachment(f)
        if (a.kind !== "text" || !a.text) {
          toast.error(`${f.name} isn't a text file. Project files can be plain text, Markdown, code or CSV.`)
          continue
        }
        if (total + a.text.length > MAX_PROJECT_CHARS) {
          toast.error(`${f.name} would go over the ${formatBytes(MAX_PROJECT_CHARS)} limit for project files.`)
          continue
        }
        total += a.text.length
        out.push(a)
      } catch {
        toast.error(`Couldn't read ${f.name}.`)
      }
    }
    const current = useStore.getState().projects[id]
    if (out.length && current) update(id, { files: [...current.files, ...out] })
  }

  return (
    <section aria-labelledby="proj-files" className="rounded-2xl border bg-card p-4">
      <h2 id="proj-files" className="flex items-center gap-2 text-sm font-medium">
        <FileText className="size-4 text-muted-foreground" aria-hidden /> Files
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Text Cyphor can read in every chat here. It is sent with each message, so keep it short. {formatBytes(used)} of {formatBytes(MAX_PROJECT_CHARS)} used.
      </p>
      {files.length > 0 && (
        <ul className="mt-3 divide-y rounded-xl border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-1 py-1 pr-1 pl-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{f.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatBytes(f.size)}
                  {f.size > 60_000 && (f.text?.length ?? 0) >= 60_000 ? " · first 60,000 characters" : ""}
                </span>
              </span>
              <IconButton label={`Remove ${f.name}`} onClick={() => update(id, { files: files.filter((x) => x.id !== f.id) })}>
                <X />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" className="mt-3 max-sm:h-10 pointer-coarse:h-10" onClick={() => inputRef.current?.click()}>
        <Plus /> Add files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={TEXT_ACCEPT}
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (list.length) void add(list)
        }}
      />
    </section>
  )
}

export function ProjectPage({ id }: { id: string }) {
  const project = useStore((s) => s.projects[id])
  const update = useStore((s) => s.updateProject)
  const remove = useStore((s) => s.deleteProject)
  const createChat = useStore((s) => s.createChat)
  const defaultModel = useStore((s) => s.settings.defaultModel)
  const updateSettings = useStore((s) => s.updateSettings)
  const metas = useChatMetas()
  const [confirm, setConfirm] = useState(false)
  const chats = useMemo(() => metas.filter((m) => m.projectId === id), [metas, id])
  const setIncognito = useUI((s) => s.setIncognito)

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderX />
            </EmptyMedia>
            <EmptyTitle>This project isn't here</EmptyTitle>
            <EmptyDescription>It may have been deleted. Your chats from it are still in your chat list.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href={href.projects}>Back to projects</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const start = (text: string, files: Attachment[]) => {
    setIncognito(false)
    const chatId = createChat({ projectId: id, model: defaultModel })
    navigate(href.chat(chatId))
    sendMessage(chatId, text, files)
  }

  return (
    <Page wide>
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-6 lg:col-start-1">
          <header className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={href.projects}
                className="-ml-1 inline-flex h-9 items-center gap-1 rounded-lg px-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground max-sm:h-10 pointer-coarse:h-10"
              >
                <ChevronLeft className="size-4" aria-hidden /> All projects
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton label="Project options">
                    <MoreHorizontal />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                    <Trash2 /> Delete project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <h1>
              <input
                aria-label="Project name"
                value={project.name}
                maxLength={80}
                onChange={(e) => update(id, { name: e.target.value })}
                onBlur={() => !project.name.trim() && update(id, { name: "Untitled project" })}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="-mx-2 w-[calc(100%+1rem)] rounded-lg bg-transparent px-2 py-1 font-serif text-3xl leading-tight font-medium tracking-tight transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </h1>
            <Textarea
              aria-label="Project description"
              value={project.description}
              rows={2}
              maxLength={300}
              placeholder="Add a short description"
              onChange={(e) => update(id, { description: e.target.value })}
              className="-mx-2 field-sizing-content min-h-0 w-[calc(100%+1rem)] resize-none border-transparent bg-transparent px-2 py-1 text-[15px] text-muted-foreground shadow-none hover:bg-accent/60 focus-visible:bg-accent/60 dark:bg-transparent"
            />
          </header>

          <Composer
            draftKey={`project:${id}`}
            placeholder={`Start a chat in ${project.name}`}
            model={defaultModel}
            onModelChange={(m) => updateSettings({ defaultModel: m })}
            onSend={start}
            menuSide="bottom"
            hero
          />
        </div>

        <aside className="min-w-0 space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section aria-labelledby="proj-instr" className="rounded-2xl border bg-card p-4">
            <h2 id="proj-instr" className="flex items-center gap-2 text-sm font-medium">
              <ScrollText className="size-4 text-muted-foreground" aria-hidden /> Instructions
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Cyphor follows these in every chat in this project.</p>
            <Textarea
              aria-label="Project instructions"
              value={project.instructions}
              onChange={(e) => update(id, { instructions: e.target.value })}
              rows={6}
              maxLength={6000}
              placeholder="For example: Answer in British English, keep replies under 200 words, and ask before assuming."
              className="mt-3"
            />
          </section>
          <ProjectFiles id={id} />
        </aside>

        <section aria-labelledby="proj-chats" className="min-w-0 lg:col-start-1">
          <h2 id="proj-chats" className="mb-2 text-sm font-medium">
            Chats in this project
          </h2>
          {chats.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing here yet. Start one above, or move an existing chat in from its menu.
            </p>
          ) : (
            <ul className="-mx-1 space-y-0.5">
              {chats.map((c) => (
                <ChatRow key={c.id} chat={c} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The project's instructions and files are removed. Its {chats.length} chat{chats.length === 1 ? "" : "s"} stay in your chat list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                remove(id)
                navigate(href.projects)
                toast("Project deleted")
              }}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}

/* ---------------------------------------------------------------- */
/* Artifacts                                                         */
/* ---------------------------------------------------------------- */

interface Item {
  key: string
  chatId: string
  chatTitle: string
  identifier: string
  title: string
  type: ArtifactType
  versions: number
  at: number
  snippet: string
  svg?: string
}

const FILTERS: { id: "all" | ArtifactType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "html", label: "Web pages" },
  { id: "svg", label: "Images" },
  { id: "markdown", label: "Documents" },
  { id: "code", label: "Code" },
]

export function ArtifactsPage() {
  const chats = useStore((s) => s.chats)
  const openArtifact = useUI((s) => s.openArtifact)
  const [filter, setFilter] = useState<"all" | ArtifactType>("all")

  const items = useMemo(() => {
    const out: Item[] = []
    for (const c of Object.values(chats)) {
      if (c.incognito) continue
      const thread = activeThread(c)
      if (!thread.some((m) => m.role === "assistant" && m.content.includes("<artifact"))) continue
      for (const h of collectArtifacts(thread)) {
        const last = h.versions[h.versions.length - 1]
        out.push({
          key: `${c.id}:${h.identifier}`,
          chatId: c.id,
          chatTitle: c.title,
          identifier: h.identifier,
          title: h.title,
          type: h.type,
          versions: h.versions.length,
          at: c.nodes[last.messageId]?.createdAt ?? c.updatedAt,
          snippet: last.artifact.content.split("\n").slice(0, 7).join("\n").slice(0, 320),
          svg: h.type === "svg" && last.artifact.complete ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(last.artifact.content)}` : undefined,
        })
      }
    }
    return out.sort((a, b) => b.at - a.at)
  }, [chats])

  const shown = filter === "all" ? items : items.filter((i) => i.type === filter)
  const present = FILTERS.filter((f) => f.id === "all" || items.some((i) => i.type === f.id))

  const open = (i: Item) => {
    openArtifact({ chatId: i.chatId, identifier: i.identifier })
    navigate(href.chat(i.chatId))
  }

  if (items.length === 0) {
    return (
      <Page>
        <Empty className="mt-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Boxes />
            </EmptyMedia>
            <EmptyTitle>No artifacts yet</EmptyTitle>
            <EmptyDescription>Ask Cyphor to build a web page, draw an SVG or write a document. It opens beside the chat and is kept here.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href={href.home}>Start a chat</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Page>
    )
  }

  return (
    <Page wide>
      {present.length > 2 && (
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          <ToggleGroup type="single" value={filter} onValueChange={(v) => setFilter((v || "all") as typeof filter)} variant="outline" aria-label="Filter by type" className="w-max">
            {present.map((f) => (
              <ToggleGroupItem key={f.id} value={f.id} className="px-3.5 text-[13px] max-sm:h-10 pointer-coarse:h-10">
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((i) => (
          <li key={i.key}>
            <button
              type="button"
              onClick={() => open(i)}
              className="group/art flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
            >
              <span aria-hidden className="relative block h-32 shrink-0 overflow-hidden border-b bg-muted/60">
                {i.svg ? (
                  <img src={i.svg} alt="" className="size-full object-contain p-3" loading="lazy" />
                ) : i.type === "html" ? (
                  <span className="flex size-full items-center justify-center text-primary/70">
                    <TypeIcon type="html" className="size-9" />
                  </span>
                ) : (
                  <pre className="m-0 size-full overflow-hidden p-3 font-mono text-[11px] leading-[1.45] whitespace-pre-wrap text-muted-foreground">{i.snippet}</pre>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col p-3.5">
                <span className="flex items-center gap-2">
                  <TypeIcon type={i.type} className="size-4 shrink-0 text-primary" />
                  <span className="truncate text-[15px] font-medium">{i.title}</span>
                </span>
                <span className="mt-1 truncate text-[13px] text-muted-foreground">From “{i.chatTitle}”</span>
                <span className="mt-2 text-xs text-muted-foreground">
                  {TYPE_LABEL[i.type]}
                  {i.versions > 1 ? ` · ${i.versions} versions` : ""} · {formatRelative(i.at)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Page>
  )
}

/** Entry point for app/projects/[id]/page.tsx. */
export function ProjectRoute() {
  return <ProjectPage id={useRouteId()} />
}
