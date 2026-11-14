import type { Project, ResponseStyle, Settings } from "./types"

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

  if (settings.artifacts) {
    parts.push(
      "When the user asks for a self-contained deliverable (a web page, component, SVG, document, or a code file longer than about 20 lines), " +
        'put it in an artifact using this exact tag: <artifact identifier="kebab-case-id" type="html|svg|markdown|code" language="ts" title="Short title">full content</artifact>. ' +
        "Reuse the same identifier when you revise an artifact and always send the complete updated content. " +
        "Do not wrap artifact content in code fences. Keep ordinary answers outside artifacts."
    )
  }

  if (settings.extendedThinking) {
    parts.push(
      "Before answering, reason through the problem inside <thinking>...</thinking>, then give the final answer after the closing tag."
    )
  }

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
