import { useEffect, useState } from "react"
import { Check, Copy, FileJson, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { chatToJson, chatToMarkdown, fileSafe } from "@/lib/export"
import { navigate, href } from "@/lib/route"
import { useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { copyText, downloadBlob } from "@/lib/utils"
import { reportSave } from "./save-report"

export function RenameDialog() {
  const id = useUI((s) => s.renameChatId)
  const close = () => useUI.getState().setRenameChat(null)
  const chat = useStore((s) => (id ? s.chats[id] : undefined))
  const rename = useStore((s) => s.renameChat)
  const [value, setValue] = useState("")

  useEffect(() => {
    if (chat) setValue(chat.title)
  }, [chat?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!id || !value.trim()) return
    rename(id, value)
    close()
  }

  return (
    <Dialog open={!!chat} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
          <DialogDescription>Pick a name you will recognize in your chat list.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="space-y-4"
        >
          <Label htmlFor="rename" className="sr-only">
            Chat name
          </Label>
          <Input id="rename" value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={120} onFocus={(e) => e.currentTarget.select()} className="text-base md:text-sm" />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Save name
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ShareDialog() {
  const id = useUI((s) => s.shareChatId)
  const close = () => useUI.getState().setShareChat(null)
  const chat = useStore((s) => (id ? s.chats[id] : undefined))
  const [copied, setCopied] = useState(false)

  if (!chat) return <Dialog open={false} />
  const base = fileSafe(chat.title)

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export chat</DialogTitle>
          <DialogDescription>
            Chats are private to your account, so there is no share link. Export a copy to send to someone or keep for yourself.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
            onClick={async () => {
              if (await copyText(chatToMarkdown(chat))) {
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              } else toast.error("Couldn't copy. Download the Markdown file instead.")
            }}
          >
            {copied ? <Check className="text-primary" /> : <Copy />}
            <span>
              <span className="block text-sm font-medium">{copied ? "Copied to clipboard" : "Copy as Markdown"}</span>
              <span className="block text-xs font-normal text-muted-foreground">Paste into notes, email or a document</span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
            onClick={async () => {
              reportSave(await downloadBlob(`${base}.md`, chatToMarkdown(chat), "text/markdown"))
              close()
            }}
          >
            <FileText />
            <span>
              <span className="block text-sm font-medium">Download Markdown</span>
              <span className="block text-xs font-normal text-muted-foreground">A readable .md file, with artifacts included</span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
            onClick={async () => {
              reportSave(await downloadBlob(`${base}.json`, chatToJson(chat), "application/json"))
              close()
            }}
          >
            <FileJson />
            <span>
              <span className="block text-sm font-medium">Download JSON</span>
              <span className="block text-xs font-normal text-muted-foreground">The full conversation tree, including edits and retries</span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useStore((s) => s.createProject)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (open) {
      setName("")
      setDescription("")
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>A project keeps related chats together and gives Cyphor standing instructions and files.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            const id = create(name, description)
            onOpenChange(false)
            navigate(href.project(id))
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} placeholder="Thesis research" className="text-base md:text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-desc">What is it for?</Label>
            <Textarea id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={300} placeholder="Optional" className="text-base md:text-sm" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
