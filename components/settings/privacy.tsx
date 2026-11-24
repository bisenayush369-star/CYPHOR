import { useRef, type ReactNode } from "react"
import { Download, Upload } from "lucide-react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { exportAll } from "@/lib/export"
import { href, navigate } from "@/lib/route"
import { STANDALONE } from "@/lib/provider"
import { forgetLocalCopy, useStore } from "@/lib/store"
import { eraseRemote, useSync, type SyncState } from "@/lib/sync"
import { useUI } from "@/lib/ui"
import { downloadBlob } from "@/lib/utils"
import { reportSave } from "../save-report"
import { Group, Pane, ToggleRow } from "./parts"

function Confirm({
  trigger,
  title,
  description,
  action,
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  description: string
  action: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={onConfirm}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DangerRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm leading-snug font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const SYNC_TEXT: Record<SyncState, string> = {
  off: "Off. Chats stay in this browser only.",
  idle: "Up to date.",
  syncing: "Saving…",
  offline: "Offline. Changes are sent when you are back online.",
  error: "Could not reach the server. Cyphor will try again.",
}

function SyncStatus() {
  const state = useSync((s) => s.state)
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground" role="status">
      {SYNC_TEXT[state]}
    </p>
  )
}

export function PrivacyTab() {
  const syncHistory = useStore((s) => s.settings.syncHistory)
  const update = useStore((s) => s.updateSettings)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = async () => {
    const s = useStore.getState()
    reportSave(await downloadBlob(`cyphor-backup-${new Date().toISOString().slice(0, 10)}.json`, exportAll(s), "application/json"), "Backup downloaded")
  }

  const importFile = async (file: File) => {
    try {
      const r = useStore.getState().importData(await file.text())
      if (!r.chats && !r.projects) toast.error("That file has no chats or projects in it.")
      else toast.success(`Imported ${r.chats} chat${r.chats === 1 ? "" : "s"} and ${r.projects} project${r.projects === 1 ? "" : "s"}.`)
    } catch {
      toast.error("That file isn't a Cyphor backup.")
    }
  }

  return (
    <Pane
      title="Privacy and data"
      description={
        STANDALONE
          ? "Everything Cyphor stores lives in this browser. The only thing that leaves is what you send to your model."
          : "Chats are kept in this browser and, unless you turn it off, in your account's database. What you send to your model leaves either way."
      }
    >
      {!STANDALONE && (
        <Group title="Server copy" hint="A copy of your chats in your account's database, so they follow you to every device you sign in on. Nobody else's account can read it.">
          <ToggleRow
            id="priv-sync"
            label="Save chats on the server"
            description="Keeps a copy of every chat, so a reply finishes saving even if you close the tab."
            checked={syncHistory}
            onChange={(v) => update({ syncHistory: v })}
          />
          <SyncStatus />
        </Group>
      )}

      <Group title="Your data" hint="Move or back up your chats and projects as a JSON file. Your API key is never included.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="max-sm:h-10 pointer-coarse:h-10" onClick={exportData}>
            <Download /> Export everything
          </Button>
          <Button variant="outline" className="max-sm:h-10 pointer-coarse:h-10" onClick={() => fileRef.current?.click()}>
            <Upload /> Import a backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void importFile(f)
            }}
          />
        </div>
      </Group>

      <Group title="Delete data">
        <DangerRow title="Delete all chats" description="Removes every saved conversation. Projects and settings stay.">
          <Confirm
            trigger={<Button variant="outline" className="max-sm:h-10 pointer-coarse:h-10">Delete chats</Button>}
            title="Delete all chats?"
            description={syncHistory && !STANDALONE ? "Every saved conversation will be removed from this browser and from the server. This can't be undone." : "Every saved conversation on this device will be removed. This can't be undone."}
            action="Delete all chats"
            onConfirm={() => {
              useUI.getState().closeArtifact()
              useStore.getState().deleteAllChats()
              navigate(href.home)
              toast("All chats deleted")
            }}
          />
        </DangerRow>
        <DangerRow title="Reset settings" description="Puts every preference back to its default, including model, API key and memories.">
          <Confirm
            trigger={<Button variant="outline" className="max-sm:h-10 pointer-coarse:h-10">Reset settings</Button>}
            title="Reset all settings?"
            description="Your preferences, API key, custom styles and memories will be cleared. Chats and projects are kept."
            action="Reset settings"
            onConfirm={() => {
              useStore.getState().resetSettings()
              toast("Settings reset")
            }}
          />
        </DangerRow>
        <DangerRow title="Erase everything" description="Clears chats, projects and settings from this browser and from your account's database, then reloads the page.">
          <Confirm
            trigger={<Button variant="destructive" className="max-sm:h-10 pointer-coarse:h-10">Erase everything</Button>}
            title="Erase everything on this device?"
            description="Chats, projects, settings and your API key will be removed from this browser and from your account's database. Your sign-in stays. Export a backup first if you want to keep anything."
            action="Erase everything"
            onConfirm={() => {
              void eraseRemote().finally(() => {
                forgetLocalCopy()
                location.assign(href.home)
              })
            }}
          />
        </DangerRow>
      </Group>
    </Pane>
  )
}
