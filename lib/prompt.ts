import { effortInstruction } from "./router/effort"
import type { Project, ResponseStyle, Settings } from "./types"

/**
 * How a model is told to make artifacts. Written for small and open models as much as for large ones: it shows the
 * exact tag once, lists the types, and says what a preview cannot do. A model that ignores it and writes a fenced
 * block instead is still handled (lib/artifact/detect.ts), but this gives the cleanest result.
 */
export const ARTIFACT_PROMPT = [
  "Artifacts. When the user asks for something they will run, view, reuse or keep (a web page, app, game, tool, component, chart, diagram, picture, document, or a code file of about 15 lines or more), put it in an artifact. " +
    "It opens in a panel beside the chat with a live preview, the source, and a button that copies all the code. Short snippets, explanations and ordinary answers stay in the chat.",
  "Write an artifact like this, with the opening tag on its own line:",
  '<artifact identifier="pomodoro-timer" type="html" title="Pomodoro timer">\n<!doctype html>\n...the complete file...\n</artifact>',
  "type is one of:\n" +
    "- html: one complete HTML file with its CSS and JavaScript inline. Libraries may load from cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com or cdn.tailwindcss.com. The page cannot call any other website and cannot use localStorage or sessionStorage.\n" +
    '- react: one React component file with the component as its default export. Import only from "react", "lucide-react", "recharts" and "clsx". Style with Tailwind CSS classes. Keep state in React: no localStorage, no fetch.\n' +
    "- svg: one <svg> element with a viewBox.\n" +
    "- mermaid: Mermaid diagram source only.\n" +
    "- markdown: a long document written in Markdown.\n" +
    '- code: any other language or file; add language="python" (or ts, go, sql and so on).',
  "Always write the complete file, never \"...\" or \"rest of the code\". Do not put the content in a code fence inside the tag. Use one artifact per reply unless asked for more. " +
    "To change an artifact, reuse its identifier and send the whole updated file. Say in a sentence what you are making before the artifact and how to use it after, without repeating the code.",
].join("\n\n")

interface Args {
  settings: Settings
  style?: ResponseStyle
  project?: Project
}

/** Builds the system prompt sent with every request. */
export function buildSystemPrompt({ settings, style, project }: Args) {
  const parts: string[] = []

  parts.push(
    "You are Cyphor, a helpful and honest assistant. Reply in the language the user writes in. " +
      "Use Markdown when it helps: short headings, lists, tables, and fenced code blocks with a language tag."
  )

  if (settings.displayName.trim()) {
    parts.push(`The user's name is ${settings.displayName.trim()}.`)
  }

  if (settings.artifacts) parts.push(ARTIFACT_PROMPT)

  const effort = effortInstruction(settings.effort)
  if (effort) parts.push(effort)

  if (style?.prompt) parts.push(style.prompt)

  if (settings.systemPrompt.trim()) parts.push(settings.systemPrompt.trim())

  if (settings.memory && settings.memories.length) {
    parts.push("Things the user asked you to remember:\n" + settings.memories.map((m) => `- ${m}`).join("\n"))
  }

  if (project) {
    if (project.instructions.trim()) {
      parts.push(`Project "${project.name}" instructions:\n${project.instructions.trim()}`)
    }
    const files = project.files.filter((f) => f.text)
    if (files.length) {
      parts.push(
        "Project files:\n" + files.map((f) => `--- ${f.name} ---\n${f.text}`).join("\n\n")
      )
    }
  }

  return parts.join("\n\n")
}
