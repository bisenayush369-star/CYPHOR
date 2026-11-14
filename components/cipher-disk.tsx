import { memo, useMemo } from "react"
import { NOTCH_DEG } from "@/lib/motion"
import { useUI } from "@/lib/ui"
import { cn } from "@/lib/utils"

const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

interface DiskProps {
  /** Rotation of the inner ring in degrees. */
  rotation: number
  /** Show the two alphabets. Turn off for tiny sizes, where ticks read better than letters. */
  labels?: boolean
  /** Play the one-time spin-in on mount. */
  intro?: boolean
  className?: string
}

/**
 * An Alberti-style cipher disk. The outer alphabet stays still; the inner ring advances one
 * notch each time `rotation` grows by NOTCH_DEG, with a small overshoot like a detent clicking in.
 */
export const CipherDisk = memo(function CipherDisk({ rotation, labels = true, intro = false, className }: DiskProps) {
  const ring = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = i * NOTCH_DEG
        return { ch: A[i], a, edge: a + NOTCH_DEG / 2 }
      }),
    []
  )

  return (
    <svg viewBox="-4 -10 208 208" className={cn("cipher-disk size-full", className)} aria-hidden="true" focusable="false">
      <circle cx="100" cy="100" r="97" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" />
      {labels ? (
        <g fontFamily="var(--font-mono)" fontSize="10" fill="currentColor" textAnchor="middle">
          {ring.map((n) => (
            <text key={n.ch} x="100" y="21" transform={`rotate(${n.a} 100 100)`}>
              {n.ch}
            </text>
          ))}
        </g>
      ) : (
        <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.7">
          {ring.map((n) => (
            <line key={n.ch} x1="100" y1="10" x2="100" y2="19" transform={`rotate(${n.a} 100 100)`} />
          ))}
        </g>
      )}
      <g className={cn("disk-inner", intro && "disk-intro")} style={{ transform: `rotate(${rotation}deg)` }}>
        <circle cx="100" cy="100" r="72" fill="var(--muted)" stroke="var(--border)" />
        {labels ? (
          <g fontFamily="var(--font-mono)" fontSize="9.5" fontWeight="600" fill="var(--primary)" textAnchor="middle">
            {ring.map((n) => (
              <text key={n.ch} x="100" y="40" transform={`rotate(${n.a} 100 100)`}>
                {n.ch}
              </text>
            ))}
          </g>
        ) : (
          <g stroke="var(--primary)" strokeWidth="3" strokeLinecap="round">
            {ring.map((n) => (
              <line key={n.ch} x1="100" y1="32" x2="100" y2="44" transform={`rotate(${n.a} 100 100)`} />
            ))}
          </g>
        )}
        <circle cx="100" cy="100" r="44" fill="var(--card)" stroke="var(--border)" />
      </g>
      <path d="M100 4 L94 -6 L106 -6 Z" fill="var(--brass)" />
      <circle cx="100" cy="100" r="6" fill="var(--primary)" />
    </svg>
  )
})

/** A disk that advances a notch on every keystroke or generation step. */
export function LiveDisk(props: Omit<DiskProps, "rotation">) {
  const tick = useUI((s) => s.tick)
  return <CipherDisk rotation={tick * NOTCH_DEG} {...props} />
}
