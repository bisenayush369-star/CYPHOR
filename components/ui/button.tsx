import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  // Filled and outlined buttons wear the chamfered corner (see app/cyber.css). The focus ring is drawn inside it.
  "inline-flex shrink-0 items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-[filter,background-color,color,--fill,--edge] disabled:pointer-events-none disabled:opacity-50 aria-invalid:outline-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "hud cut cut-solid cut-sm bg-primary text-primary-foreground hover:brightness-110 active:brightness-95",
        destructive: "hud cut cut-solid cut-sm bg-destructive text-white hover:brightness-110 dark:text-[#0a0b10]",
        outline:
          "cut cut-sm font-display font-semibold tracking-[0.02em] text-foreground [--edge:var(--input)] [--fill:var(--background)] hover:[--edge:var(--signal)] hover:[--fill:var(--accent)]",
        secondary:
          "cut cut-solid cut-sm bg-secondary font-display font-semibold tracking-[0.02em] text-secondary-foreground hover:bg-accent",
        ghost:
          "rounded-sm hover:bg-accent hover:text-accent-foreground",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        // Fine pointers keep the compact sizes; touch screens get 40 px or more so targets are easy to hit.
        default: "h-9 px-4 py-2 has-[>svg]:px-3 pointer-coarse:h-10",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3 pointer-coarse:h-9 pointer-coarse:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5 pointer-coarse:h-10",
        lg: "h-10 px-6 has-[>svg]:px-4 pointer-coarse:h-11",
        icon: "size-9 pointer-coarse:size-10",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3 pointer-coarse:size-8",
        "icon-sm": "size-8 pointer-coarse:size-10",
        "icon-lg": "size-10 pointer-coarse:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
