import { useEffect, useState, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { clamp, cn } from "@/lib/utils"

/** One settings page: a serif title, a line of context, then groups separated by hairlines. */
export function Pane({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6">
        <h3 className="font-serif text-2xl leading-tight font-medium tracking-tight">{title}</h3>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </header>
      <div className="divide-y">{children}</div>
    </div>
  )
}

export function Group({
  title,
  hint,
  children,
  className,
}: {
  title?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-3 py-6 first:pt-0 last:pb-0", className)}>
      {title && (
        <div>
          <h4 className="text-[15px] font-medium">{title}</h4>
          {hint && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

interface ToggleProps {
  id: string
  label: string
  description: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  /** Small note beside the label, e.g. "Needs your backend". */
  tag?: string
  disabled?: boolean
}

export function ToggleRow({ id, label, description, checked, onChange, tag, disabled }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="inline cursor-pointer text-sm leading-snug font-medium">
          {label}
        </Label>
        {tag && (
          <span className="ml-2 inline-block rounded-full border px-2 py-px align-middle text-[11px] leading-4 text-muted-foreground">
            {tag}
          </span>
        )}
        <p id={`${id}-desc`} className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-desc`} disabled={disabled} className="mt-0.5" />
    </div>
  )
}

/**
 * A selectable card for a RadioGroup. The real radio stays in the tree for keyboard and screen
 * reader users; the whole card is the click target.
 */
export function RadioCard({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <Label
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 text-left font-normal transition-colors hover:bg-accent/50 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5 has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-ring/50",
        className
      )}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <span className="min-w-0 flex-1">{children}</span>
    </Label>
  )
}

interface NumberFieldProps {
  id: string
  value: number
  min: number
  max: number
  step?: number
  onCommit: (n: number) => void
  className?: string
}

/** A number input that lets people type freely and applies the value (clamped) when they leave it. */
export function NumberField({ id, value, min, max, step = 1, onCommit, className }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = () => {
    const n = Number(text)
    if (!text.trim() || !Number.isFinite(n)) return setText(String(value))
    const next = clamp(Math.round(n / step) * step, min, max)
    setText(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <Input
      id={id}
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
      aria-describedby={`${id}-hint`}
      className={className}
    />
  )
}
