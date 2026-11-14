/**
 * Stand-in for `next/navigation` in the single-file preview build, which has no server.
 * The URL path lives in the hash (#/chat/abc) so the file works from file:// and any static host.
 */
import { useMemo, useSyncExternalStore } from "react"

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb)
  return () => window.removeEventListener("hashchange", cb)
}

const pathSnapshot = () => window.location.hash.replace(/^#/, "") || "/"

export function usePathname(): string {
  return useSyncExternalStore(subscribe, pathSnapshot, () => "/")
}

export function useParams<T extends Record<string, string | string[] | undefined>>(): T {
  const path = usePathname()
  return useMemo(() => {
    const [, second] = path.split("/").filter(Boolean)
    return { id: second } as unknown as T
  }, [path])
}

export function useSearchParams() {
  return new URLSearchParams(window.location.search)
}

const go = (to: string) => {
  if (window.location.hash === `#${to}`) return
  window.location.hash = to
}

const router = {
  push: go,
  replace: (to: string) => window.location.replace(`#${to}`),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => {},
  prefetch: () => {},
}

export function useRouter() {
  return router
}
