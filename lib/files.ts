import type { Attachment } from "./types"
import { uid } from "./utils"

const MAX_TEXT = 60_000
const MAX_IMAGE_EDGE = 1600

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "json", "csv", "tsv", "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "html", "htm",
  "css", "scss", "sql", "yml", "yaml", "xml", "log", "sh", "bash", "zsh", "go", "rs", "java", "c", "h", "cpp",
  "hpp", "cs", "rb", "php", "swift", "kt", "toml", "ini", "env", "svg",
])

function extOf(name: string) {
  const i = name.lastIndexOf(".")
  return i === -1 ? "" : name.slice(i + 1).toLowerCase()
}

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

async function downscale(file: File): Promise<string> {
  if (file.size < 350_000 || file.type === "image/gif" || file.type === "image/svg+xml") {
    return readAsDataUrl(file)
  }
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return readAsDataUrl(file)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    return canvas.toDataURL("image/jpeg", 0.84)
  } catch {
    return readAsDataUrl(file)
  }
}

export async function readAttachment(file: File): Promise<Attachment> {
  const base = {
    id: uid("f_"),
    name: file.name || "pasted-image.png",
    mime: file.type || "application/octet-stream",
    size: file.size,
  }
  if (file.type.startsWith("image/")) {
    return { ...base, kind: "image", dataUrl: await downscale(file) }
  }
  if (file.type.startsWith("text/") || TEXT_EXT.has(extOf(file.name))) {
    const text = (await file.text()).slice(0, MAX_TEXT)
    return { ...base, kind: "text", text }
  }
  return { ...base, kind: "file", unsupported: true }
}
