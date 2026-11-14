/**
 * A small reader for server-sent events (the `data:` lines most chat APIs stream).
 * It works on any ReadableStream, so the server and the browser share it, and tests can feed it a string.
 */

export interface SseEvent {
  /** The `event:` name, or null when the server did not send one. */
  event: string | null
  data: string
}

export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let event: string | null = null
  let data: string[] = []

  const flush = (): SseEvent | null => {
    if (!data.length) {
      event = null
      return null
    }
    const out = { event, data: data.join("\n") }
    event = null
    data = []
    return out
  }

  const feed = (line: string): SseEvent | null => {
    if (line === "") return flush()
    if (line.startsWith(":")) return null // a comment, often used as a keep-alive
    const colon = line.indexOf(":")
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "")
    if (field === "event") event = value.trim() || null
    else if (field === "data") data.push(value)
    return null
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.search(/\r?\n/)) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(buffer[nl] === "\r" ? nl + 2 : nl + 1)
        const ev = feed(line)
        if (ev) yield ev
      }
    }
    // A stream that ends without a final blank line still delivers its last event.
    if (buffer) {
      const ev = feed(buffer.replace(/\r$/, ""))
      if (ev) yield ev
    }
    const last = flush()
    if (last) yield last
  } finally {
    reader.cancel().catch(() => {})
  }
}
