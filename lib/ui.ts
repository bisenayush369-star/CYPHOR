import { create } from "zustand"
import type { Attachment } from "./types"

export type SettingsTab =
  | "general"
  | "appearance"
  | "model"
  | "router"
  | "capabilities"
  | "styles"
  | "connectors"
  | "privacy"
  | "usage"
  | "shortcuts"

export interface ArtifactView {
  chatId: string
  identifier: string
  /** Index into the version list; null follows the latest version. */
  version: number | null
  tab: "preview" | "code"
  fullscreen: boolean
}

interface UIState {
  settingsOpen: boolean
  settingsTab: SettingsTab
  /** The model library dialog. `onPick` is what happens when a model is chosen in it. */
  library: { onPick: (modelId: string) => void } | null
  commandOpen: boolean
  shareChatId: string | null
  renameChatId: string | null
  incognito: boolean
  generating: Record<string, boolean>
  artifact: ArtifactView | null
  /** Unsent text and attachments survive navigation and layout changes (never persisted). */
  drafts: Record<string, string>
  pending: Record<string, Attachment[]>
  /** Bumped on each keystroke and generation step; the cipher disk advances one notch per bump. */
  tick: number

  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  openLibrary: (onPick: (modelId: string) => void) => void
  closeLibrary: () => void
  setSettingsTab: (tab: SettingsTab) => void
  setCommandOpen: (v: boolean) => void
  setShareChat: (id: string | null) => void
  setRenameChat: (id: string | null) => void
  setIncognito: (v: boolean) => void
  setGenerating: (chatId: string, v: boolean) => void
  openArtifact: (v: Pick<ArtifactView, "chatId" | "identifier"> & Partial<ArtifactView>) => void
  patchArtifact: (p: Partial<ArtifactView>) => void
  closeArtifact: () => void
  setDraft: (key: string, text: string) => void
  setPending: (key: string, files: Attachment[]) => void
  bumpTick: () => void
}

export const useUI = create<UIState>()((set) => ({
  settingsOpen: false,
  settingsTab: "general",
  library: null,
  commandOpen: false,
  shareChatId: null,
  renameChatId: null,
  incognito: false,
  generating: {},
  artifact: null,
  drafts: {},
  pending: {},
  tick: 0,

  openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
  closeSettings: () => set({ settingsOpen: false }),
  openLibrary: (onPick) => set({ library: { onPick } }),
  closeLibrary: () => set({ library: null }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  setCommandOpen: (v) => set({ commandOpen: v }),
  setShareChat: (id) => set({ shareChatId: id }),
  setRenameChat: (id) => set({ renameChatId: id }),
  setIncognito: (v) => set({ incognito: v }),
  setGenerating: (chatId, v) =>
    set((s) => {
      const next = { ...s.generating }
      if (v) next[chatId] = true
      else delete next[chatId]
      return { generating: next }
    }),
  openArtifact: (v) =>
    set((s) => ({
      artifact: {
        version: null,
        tab: s.artifact?.tab ?? "preview",
        fullscreen: false,
        ...v,
      },
    })),
  patchArtifact: (p) => set((s) => (s.artifact ? { artifact: { ...s.artifact, ...p } } : s)),
  closeArtifact: () => set({ artifact: null }),
  setDraft: (key, text) =>
    set((s) => {
      const drafts = { ...s.drafts }
      if (text) drafts[key] = text
      else delete drafts[key]
      return { drafts }
    }),
  setPending: (key, files) =>
    set((s) => {
      const pending = { ...s.pending }
      if (files.length) pending[key] = files
      else delete pending[key]
      return { pending }
    }),
  bumpTick: () => set((s) => ({ tick: s.tick + 1 })),
}))

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
export const MOD = isMac ? "⌘" : "Ctrl"
