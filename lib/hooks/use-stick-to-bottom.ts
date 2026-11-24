import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

/**
 * Keeps a scroll container pinned to the bottom while content grows (streaming replies),
 * lets the reader scroll away without being yanked back, and reports when they are away.
 *
 * `start` says where a newly opened container begins: at the end (a chat, or a file still being written) or at the
 * top (a file that is already finished, which should be read from its first line). It is only read when `resetKey`
 * changes, so a file that finishes while it is on screen is not pulled back to the top.
 */
export function useStickToBottom<T extends HTMLElement>(resetKey: string, growthKey: unknown, start: "bottom" | "top" = "bottom") {
  const ref = useRef<T>(null)
  const startRef = useRef(start)
  startRef.current = start
  const stuck = useRef(true)
  const lastTop = useRef(0)
  const [away, setAway] = useState(false)

  const toBottom = useCallback((smooth = false) => {
    const el = ref.current
    if (!el) return
    stuck.current = true
    setAway(false)
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
  }, [])

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    if (el.scrollTop < lastTop.current - 2 && distance > 24) stuck.current = false
    if (distance < 24) stuck.current = true
    lastTop.current = el.scrollTop
    setAway(distance > 160)
  }, [])

  // Jump to the start position when a different chat (or file) opens.
  useLayoutEffect(() => {
    const atEnd = startRef.current === "bottom"
    stuck.current = atEnd
    lastTop.current = 0
    setAway(false)
    const el = ref.current
    if (el) el.scrollTop = atEnd ? el.scrollHeight : 0
  }, [resetKey])

  // Follow growth while pinned.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && stuck.current) el.scrollTop = el.scrollHeight
  }, [growthKey])

  // Images, code blocks and artifacts can change height after render.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const inner = el.firstElementChild
    if (!inner) return
    const ro = new ResizeObserver(() => {
      if (stuck.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [resetKey])

  return { ref, away, toBottom, onScroll }
}
