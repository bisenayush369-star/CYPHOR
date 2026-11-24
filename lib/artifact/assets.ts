import type { PreviewAssets } from "./srcdoc"

/**
 * The preview runtime for React artifacts: public/artifact/runtime.js (React, a JSX compiler, icons and charts) and
 * public/artifact/tailwind.js. They are fetched once, from this app, by the page itself (which has its cookies),
 * kept in memory, and written into each preview page. Nothing else loads them, and they are only fetched the first
 * time a React artifact is previewed.
 */
let cached: Promise<PreviewAssets> | null = null

async function text(url: string): Promise<string> {
  const res = await fetch(url, { cache: "force-cache" })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  const body = await res.text()
  // A sign-in page or an error page served in its place would be run as a script, so check what arrived.
  if (/^\s*</.test(body)) throw new Error(`${url} did not return a script`)
  return body
}

export function loadPreviewAssets(): Promise<PreviewAssets> {
  cached ??= Promise.all([text("/artifact/runtime.js"), text("/artifact/tailwind.js")])
    .then(([runtime, tailwind]) => ({ runtime, tailwind }))
    .catch((e) => {
      cached = null
      throw e
    })
  return cached
}
