import type { ComponentProps, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMedia } from "@/lib/hooks/use-media"
import { cn } from "@/lib/utils"

interface Props extends Omit<ComponentProps<typeof Button>, "children" | "size" | "variant"> {
  label: string
  children: ReactNode
  /** Toggle state, announced to screen readers. */
  pressed?: boolean
  size?: ComponentProps<typeof Button>["size"]
  variant?: ComponentProps<typeof Button>["variant"]
  side?: "top" | "bottom" | "left" | "right"
}

/** An icon-only button with an accessible name and a tooltip. 40 px hit area on small screens. */
export function IconButton({ label, children, pressed, className, size = "icon-sm", variant = "ghost", side, ...props }: Props) {
  // Tooltips are for hovering. On a touch screen they only pop up when focus moves in code, and then they cover content.
  const canHover = useMedia("(hover: hover)")
  const button = (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={label}
      aria-pressed={pressed}
      className={cn("max-sm:min-h-10 pointer-coarse:min-h-10 max-sm:min-w-10 pointer-coarse:min-w-10", className)}
      {...props}
    >
      {children}
    </Button>
  )
  if (!canHover) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
