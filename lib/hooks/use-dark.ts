import { useStore } from "@/lib/store"
import { useMedia } from "./use-media"

/** Whether the app is showing its dark theme right now, including when the theme follows the device. */
export function useDark(): boolean {
  const theme = useStore((s) => s.settings.theme)
  const system = useMedia("(prefers-color-scheme: dark)")
  return theme === "system" ? system : theme === "dark"
}
