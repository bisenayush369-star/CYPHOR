import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Short unique id with an optional prefix, e.g. uid("c_") -> "c_9f3a1b2c4d5e". */
export function uid(prefix = "") {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix + raw.replace(/-/g, "").slice(0, 12)
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true }
    )
  })
}

export function isAbortError(e: unknown) {
  return e instanceof DOMException && e.name === "AbortError"
}

/** "Today", "Yesterday", "Previous 7 days", "Earlier" buckets for the chat list. */
export function bucketFor(ts: number, now = Date.now()) {
  const day = 86_400_000
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  if (ts >= startOfToday) return "Today"
  if (ts >= startOfToday - day) return "Yesterday"
  if (ts >= startOfToday - 7 * day) return "Previous 7 days"
  if (ts >= startOfToday - 30 * day) return "Previous 30 days"
  return "Older"
}

export function formatRelative(ts: number, now = Date.now()) {
  const diff = Math.max(0, now - ts)
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "Just now"
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function greeting(name: string, d = new Date()) {
  const h = d.getHours()
  const part = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
  return name.trim() ? `${part}, ${name.trim().split(/\s+/)[0]}` : part
}

/** Rough token estimate (about 4 characters per token). */
export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4)
}

/** How a save ended. "declined" is the person saying no, so there is nothing to report. */
export type SaveOutcome = "saved" | "declined" | "unsupported" | "unavailable"

/** The part of the page frame's `claude` object that saving needs. */
type FrameClaude = { use?: (name: string) => Promise<unknown> }
type FrameDownloads = { save: (file: { filename: string; data: Blob }) => Promise<unknown> }

/**
 * The page frame that hosts the single-file preview does not let a page start a download itself: a plain link does
 * nothing there. It offers a `downloads` capability instead, which asks the person before anything is saved. The
 * frame is only ever present in the preview, so the Next.js app and a preview opened from disk keep using a link.
 */
function frameClaude(): FrameClaude | undefined {
  if (typeof window === "undefined" || !(typeof __STANDALONE__ !== "undefined" && __STANDALONE__)) return undefined
  return (window as unknown as { claude?: FrameClaude }).claude
}

async function saveInFrame(frame: FrameClaude, filename: string, blob: Blob): Promise<SaveOutcome> {
  let downloads: FrameDownloads | null | undefined
  try {
    downloads = (await frame.use?.("downloads")) as FrameDownloads | null | undefined
  } catch {
    downloads = null
  }
  if (!downloads) return "unavailable"
  try {
    await downloads.save({ filename, data: blob })
    return "saved"
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code
    if (code === "declined") return "declined"
    return code === "rejected_extension" || code === "extension_not_enabled" ? "unsupported" : "unavailable"
  }
}

export function downloadBlob(filename: string, data: BlobPart, type = "text/plain"): Promise<SaveOutcome> {
  const blob = new Blob([data], { type })
  const frame = frameClaude()
  if (frame) return saveInFrame(frame, filename, blob)

  // Everywhere else this runs inside the click, so the browser treats it as the person's own action.
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return Promise.resolve("saved")
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand("copy")
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
