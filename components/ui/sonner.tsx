import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Theme is passed in by the app (it owns light/dark/system), so no next-themes dependency. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--input)",
          "--border-radius": "2px",
          "--success-bg": "var(--popover)",
          "--success-text": "var(--signal)",
          "--success-border": "color-mix(in srgb, var(--signal) 50%, var(--input))",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--heat)",
          "--error-border": "color-mix(in srgb, var(--heat) 55%, var(--input))",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
