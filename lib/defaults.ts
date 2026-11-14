import type { ResponseStyle, Settings } from "./types"
import { DEFAULT_MODELS, DEFAULT_MODEL_ID } from "./models/page"

export const BUILTIN_STYLES: ResponseStyle[] = [
  {
    id: "normal",
    name: "Normal",
    description: "Default responses from Cyphor",
    prompt: "",
    builtin: true,
  },
  {
    id: "concise",
    name: "Concise",
    description: "Shorter responses with fewer words",
    prompt:
      "Respond concisely. Lead with the answer, skip preamble and recaps, and keep paragraphs short.",
    builtin: true,
  },
  {
    id: "explanatory",
    name: "Explanatory",
    description: "Educational responses that show the reasoning",
    prompt:
      "Explain your reasoning step by step. Define terms the first time you use them and give one concrete example.",
    builtin: true,
  },
  {
    id: "formal",
    name: "Formal",
    description: "Polished, well-structured writing",
    prompt:
      "Write in a formal, precise register with complete sentences and clear sections. Avoid slang and filler.",
    builtin: true,
  },
  {
    id: "learning",
    name: "Learning",
    description: "Guides you to the answer instead of handing it over",
    prompt:
      "Act as a patient tutor. Ask one guiding question at a time, check understanding, and give the full solution only when asked.",
    builtin: true,
  },
]

export const CONNECTORS = [
  { id: "drive", name: "Cloud drive", description: "Attach documents from your storage" },
  { id: "repo", name: "Code repository", description: "Read files and issues from a repository" },
  { id: "calendar", name: "Calendar", description: "Check availability and upcoming events" },
  { id: "mail", name: "Email", description: "Search and summarize messages" },
  { id: "notes", name: "Notes", description: "Pull pages from your notes app" },
]

export const STARTERS = [
  {
    id: "write",
    label: "Write",
    prompts: [
      "Draft a friendly email asking a supplier for a delivery update",
      "Write a short product announcement for a new feature",
      "Help me tighten a paragraph without losing my voice",
      "Turn these rough notes into a clear project update",
    ],
  },
  {
    id: "learn",
    label: "Learn",
    prompts: [
      "Explain how public-key encryption works with a real-world analogy",
      "What is the difference between a Caesar cipher and a Vigenère cipher?",
      "Teach me SQL joins with small examples",
      "Make a one-week plan for learning TypeScript",
    ],
  },
  {
    id: "code",
    label: "Code",
    prompts: [
      "Write a TypeScript debounce function and explain how it works",
      "Build a small Caesar cipher tool I can try in the browser",
      "Design a landing page for a coffee roaster",
      "Draw an SVG badge with a cipher wheel",
    ],
  },
  {
    id: "plan",
    label: "Plan",
    prompts: [
      "Create a four-week launch plan for a small side project",
      "Outline a talk on why accessibility matters",
      "Break a big goal into weekly milestones",
    ],
  },
  {
    id: "life",
    label: "Life stuff",
    prompts: [
      "Help me decide between two job offers",
      "Plan a three-day trip with a modest budget",
      "Suggest a weekly meal plan that is quick to cook",
    ],
  },
]

export const DEFAULT_SETTINGS: Settings = {
  displayName: "",
  theme: "system",
  chatFont: "serif",
  effects: "full",
  sendWithEnter: true,
  expandThinking: false,

  provider: "server",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  models: DEFAULT_MODELS,
  defaultModel: DEFAULT_MODEL_ID,
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: "",

  styleId: "normal",
  customStyles: [],

  webSearch: false,
  extendedThinking: false,
  research: false,
  artifacts: true,
  memory: false,
  memories: [],
  connectors: {},
  incognitoByDefault: false,
  syncHistory: true,

  routePriority: "balanced",
  disabledProviders: [],
  godMax: 4,
}
