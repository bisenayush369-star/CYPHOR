import { cn } from "@/lib/utils"

/**
 * A node on a line: the small mark Cyphor shows while it works (a reply being written, an artifact being built).
 * It borrows the shape of the logo's signal. The node blinks when effects are on and holds still when they are not.
 */
export function Signal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5 shrink-0", className)} aria-hidden="true" focusable="false">
      <path d="M1 12h6M17 12h6" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <rect x="8.5" y="8.5" width="7" height="7" transform="rotate(45 12 12)" fill="currentColor" className="pulse-dot" />
    </svg>
  )
}
