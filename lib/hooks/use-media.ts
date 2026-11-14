import { useCallback, useSyncExternalStore } from "react"

export function useMedia(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query)
      m.addEventListener("change", cb)
      return () => m.removeEventListener("change", cb)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}

/** Wide enough to dock the artifact panel beside the chat. */
export const useIsDesktop = () => useMedia("(min-width: 1024px)")
/** Touch-first devices: Enter inserts a newline and hover-only controls stay visible. */
export const useCoarsePointer = () => useMedia("(pointer: coarse)")
