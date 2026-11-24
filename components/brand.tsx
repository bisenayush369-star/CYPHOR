import { cn } from "@/lib/utils"

/** The C: an angular letter with its corners cut. Drawn in a 48 by 48 box. */
const C_PATH = "M10 4H40L44 8V13H17L13 17V31L17 35H44V40L40 44H10L4 38V10Z"

function Glyph({ live = false }: { live?: boolean }) {
  return (
    <>
      <path d={C_PATH} fill="#fcee09" />
      <rect x="24" y="20" width="8" height="8" fill="#00f0ff" transform="rotate(45 28 24)" className={live ? "pulse-dot" : undefined} />
      <path d="M34 24H44" stroke="#00f0ff" strokeWidth="2" />
    </>
  )
}

/**
 * The Cyphor mark on its own chamfered tile: a C with a signal passing through it.
 * The tile is always ink with yellow and cyan on it, so the mark looks the same on both themes.
 * `live` makes the signal node pulse (used while something loads).
 */
export function LogoMark({ className, live = false }: { className?: string; live?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <path d="M0 0H52L64 12V64H12L0 52Z" fill="#05060b" />
      <path d="M.5.5H51.8L63.5 12.2V63.5H12.2L.5 51.8Z" fill="none" stroke="#2b3248" />
      <g transform="translate(12 12) scale(0.8333)">
        <Glyph live={live} />
      </g>
    </svg>
  )
}

/** The C by itself, for large uses on a dark surface. */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-16 shrink-0", className)} aria-hidden="true">
      <Glyph />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span data-text="CYPHOR" className={cn("glitch font-display text-[1.02rem] font-bold tracking-[0.16em]", className)}>
      CYPHOR
    </span>
  )
}
