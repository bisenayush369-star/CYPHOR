import type { RoutePriority } from "./types"

/**
 * Effort: how hard a reply should try. It is the third control in the model picker, after the model itself.
 *
 *  low     answers right away: the router leans on the fastest models, and the reply is asked to be brief.
 *  medium  the default. The reply thinks the question through before it answers.
 *  high    thinks deeply and checks its work: models that can reason are used for it, and the router leans on quality.
 *
 * Pure functions, shared by the browser (which words the request) and the server (which routes it).
 */
export type Effort = "low" | "medium" | "high"

export const DEFAULT_EFFORT: Effort = "medium"

export const EFFORTS: { id: Effort; label: string; description: string }[] = [
  { id: "low", label: "Low", description: "Answers right away, short and direct" },
  { id: "medium", label: "Medium", description: "Thinks it through before it answers" },
  { id: "high", label: "High", description: "Thinks deeply and double-checks, prefers stronger models" },
]

export function isEffort(value: unknown): value is Effort {
  return value === "low" || value === "medium" || value === "high"
}

export function effortLabel(effort: Effort): string {
  return EFFORTS.find((e) => e.id === effort)?.label ?? "Medium"
}

/**
 * The routing preference once effort is counted. A preference chosen in Settings > Router (speed, quality or free)
 * is a decision the person made on purpose, so it wins; effort only moves the default "balanced".
 */
export function priorityFor(effort: Effort, chosen: RoutePriority): RoutePriority {
  if (chosen !== "balanced") return chosen
  return effort === "low" ? "speed" : effort === "high" ? "quality" : "balanced"
}

/** Whether the reply should reason first. Every level but Low does, and Cyphor Deep always does. */
export function thinkingFor(effort: Effort, model: string): boolean {
  return effort !== "low" || model === "cyphor-deep"
}

/** A sentence for the system prompt, or null when effort changes nothing about the wording. */
export function effortInstruction(effort: Effort): string | null {
  if (effort === "low") return "Keep the reply short and direct: answer first, skip the preamble and any recap."
  if (effort === "medium")
    return (
      "Before answering, think the question through inside <thinking>...</thinking>: what is being asked, what you know, the approach, and a quick check of the result. " +
      "Keep it focused, and if the message is trivial (a greeting or a one-line fact) keep it to a single sentence. Give the final answer after the closing tag."
    )
  return (
    "Before answering, reason carefully inside <thinking>...</thinking>: restate the problem, weigh the alternatives, work through it step by step, check the result against the question and correct any mistake. " +
    "Then give a complete, well-organised answer after the closing tag."
  )
}
