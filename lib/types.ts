import type { CouncilInfo, RouteInfo, RoutePriority, WebSource } from "./router/types"

export type Role = "user" | "assistant"
export type ArtifactType = "html" | "svg" | "markdown" | "code"
export type ThemePref = "light" | "dark" | "system"
export type ChatFont = "serif" | "sans" | "legible"
export type EffectsLevel = "off" | "subtle" | "full"
/** "server" answers through this app's /api/chat. "openai" calls a chat API straight from the browser. */
export type ProviderKind = "server" | "openai"

export interface Attachment {
  id: string
  name: string
  kind: "image" | "text" | "file"
  mime: string
  size: number
  /** Images only. Kept in memory for the session, never saved to storage. */
  dataUrl?: string
  /** Text-like files only (truncated). */
  text?: string
  /** True when Cyphor cannot read this file type. */
  unsupported?: boolean
}

export interface Message {
  id: string
  parentId: string | null
  role: Role
  /** Raw text. Assistant messages may contain <thinking> and <artifact> tags. */
  content: string
  createdAt: number
  model?: string
  attachments?: Attachment[]
  /** Branching: every edit or retry adds a sibling under the same parent. */
  childIds: string[]
  activeChildId: string | null
  feedback?: "up" | "down" | null
  status?: "streaming" | "done" | "error" | "stopped"
  error?: string
  thinkingMs?: number
  /** How the router made this reply: which model answered, the God Mode council, web sources. */
  route?: RouteInfo
  council?: CouncilInfo
  sources?: WebSource[]
  /** A note from the server about the web step, such as "web search needs a key". */
  webNote?: string
}

export interface Chat {
  id: string
  title: string
  /** True right after auto-titling so the sidebar can play the decode effect once. */
  titleFresh?: boolean
  createdAt: number
  updatedAt: number
  starred: boolean
  projectId: string | null
  incognito?: boolean
  model: string
  nodes: Record<string, Message>
  rootChildIds: string[]
  rootActiveId: string | null
}

export interface Project {
  id: string
  name: string
  description: string
  instructions: string
  files: Attachment[]
  createdAt: number
  updatedAt: number
}

export interface ModelDef {
  id: string
  name: string
  description: string
  /** Which Cyphor model this is, for the icon and the router. Models you add yourself have none. */
  kind?: "auto" | "swift" | "core" | "deep" | "code" | "god"
}

export interface ResponseStyle {
  id: string
  name: string
  description: string
  prompt: string
  builtin?: boolean
}

export interface Settings {
  displayName: string
  theme: ThemePref
  chatFont: ChatFont
  effects: EffectsLevel
  sendWithEnter: boolean
  expandThinking: boolean

  provider: ProviderKind
  baseUrl: string
  apiKey: string
  models: ModelDef[]
  defaultModel: string
  temperature: number
  maxTokens: number
  systemPrompt: string

  styleId: string
  customStyles: ResponseStyle[]

  webSearch: boolean
  extendedThinking: boolean
  research: boolean
  artifacts: boolean
  memory: boolean
  memories: string[]
  connectors: Record<string, boolean>
  incognitoByDefault: boolean
  /** Keep a copy of saved chats in the server's database (never for incognito chats). */
  syncHistory: boolean

  /** How the router chooses when you use a Cyphor model: balance everything, or lean on one thing. */
  routePriority: RoutePriority
  /** Providers the router must not use, even though their key is set. */
  disabledProviders: string[]
  /** The most providers God Mode asks at once (2 to 6). */
  godMax: number
}
