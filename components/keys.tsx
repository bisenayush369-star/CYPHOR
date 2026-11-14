import { Kbd, KbdGroup } from "@/components/ui/kbd"

/** A shortcut shown as separate keys, e.g. [Ctrl][⇧][O]. */
export function Keys({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <KbdGroup className={className} aria-label={keys.join(" ")}>
      {keys.map((k) => (
        <Kbd key={k} aria-hidden>
          {k}
        </Kbd>
      ))}
    </KbdGroup>
  )
}
