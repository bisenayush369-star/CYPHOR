import { useParams, usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"

/**
 * The screens of the app. Next.js owns the URLs (see app/), this file is the single place that
 * turns a pathname into one of these names and back, so components never build URLs by hand.
 */
export type Route =
  | { name: "home" }
  | { name: "chat"; id: string }
  | { name: "chats" }
  | { name: "projects" }
  | { name: "project"; id: string }
  | { name: "artifacts" }

export function parsePath(pathname: string): Route {
  const [a, b] = pathname.split(/[?#]/)[0].split("/").filter(Boolean)
  const id = b ? safeDecode(b) : ""
  if (a === "chat") return id ? { name: "chat", id } : { name: "chats" }
  if (a === "projects") return id ? { name: "project", id } : { name: "projects" }
  if (a === "artifacts") return { name: "artifacts" }
  return { name: "home" }
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export const href = {
  home: "/",
  chat: (id: string) => `/chat/${encodeURIComponent(id)}`,
  chats: "/chat",
  projects: "/projects",
  project: (id: string) => `/projects/${encodeURIComponent(id)}`,
  artifacts: "/artifacts",
}

type AppRouter = ReturnType<typeof useRouter>
let router: AppRouter | null = null

/** Lets code outside React (store actions, key handlers) navigate. Call once from the app shell. */
export function useBindRouter() {
  const r = useRouter()
  useEffect(() => {
    router = r
    return () => {
      if (router === r) router = null
    }
  }, [r])
}

export function navigate(to: string) {
  if (typeof window === "undefined") return
  if (window.location.pathname + window.location.search === to) return
  if (router) router.push(to)
  else window.location.assign(to)
}

export function useRoute(): Route {
  const pathname = usePathname()
  return useMemo(() => parsePath(pathname), [pathname])
}

/** The `[id]` segment of the current URL, for the screens that have one. */
export function useRouteId(): string {
  const params = useParams<{ id?: string | string[] }>()
  const raw = Array.isArray(params.id) ? params.id[0] : params.id
  return raw ? safeDecode(raw) : ""
}
