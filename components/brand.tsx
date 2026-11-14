import { cn } from "@/lib/utils"

/** The Cyphor mark: a ring of 26 notches around a centre pin, like a cipher disk seen from above. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6 shrink-0", className)} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--primary)" />
      <circle
        cx="16"
        cy="16"
        r="9.5"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.4"
        strokeDasharray="1.5 2.07"
      />
      <circle cx="16" cy="16" r="2.6" fill="var(--primary-foreground)" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-serif text-[1.08rem] font-semibold tracking-tight", className)}>Cyphor</span>
}
