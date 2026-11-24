/**
 * The pages that run inside an artifact's preview frame.
 *
 * Generated code is untrusted. The frame is sandboxed without allow-same-origin, so it has no access to this app's
 * cookies, storage or DOM, and the policy below stops it from making network requests. Libraries a page may load
 * from are limited to a short list of well-known CDNs.
 *
 * Every page here is built as one string and handed to the frame through `srcdoc`. Nothing is fetched from this
 * app's own server by the frame, because a sandboxed frame has no cookies and would be turned away by the sign-in
 * check, and a shared-password gate would refuse it too.
 */

export type PreviewType = "html" | "react" | "mermaid"
export type PreviewTheme = "dark" | "light"

/** The two files a React artifact needs. They are public/artifact/runtime.js and public/artifact/tailwind.js. */
export interface PreviewAssets {
  runtime: string
  tailwind: string
}

/** Pinned, with a subresource-integrity hash of the file published on npm, so a changed CDN file simply fails to load. */
export const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.min.js"
export const MERMAID_SRI = "sha384-HHW54r639fK42Ip0coGF3mz8oSiGn0eEoWNTLs75X7H63pLSDBa0Tqs0RwGmLlXE"

export const CDN_HOSTS = [
  "https://cdnjs.cloudflare.com",
  "https://cdn.jsdelivr.net",
  "https://unpkg.com",
  "https://cdn.tailwindcss.com",
  "https://esm.sh",
  "https://code.jquery.com",
  "https://ajax.googleapis.com",
  "https://stackpath.bootstrapcdn.com",
] as const

const HOSTS = CDN_HOSTS.join(" ")

export const CSP = [
  "default-src 'none'",
  // 'unsafe-eval' is needed by Tailwind's in-browser compiler and by several chart and 3D libraries. The frame is isolated, so it is contained there.
  `script-src 'unsafe-inline' 'unsafe-eval' ${HOSTS}`,
  `style-src 'unsafe-inline' ${HOSTS} https://fonts.googleapis.com`,
  `font-src data: ${HOSTS} https://fonts.gstatic.com`,
  "img-src data: blob: https:",
  "media-src data: blob: https:",
  "worker-src blob:",
  "connect-src 'none'",
  "form-action 'none'",
].join("; ")

/** A script body that is safe to place between <script> tags: it can neither close the tag nor open an HTML comment. */
export function inlineScript(code: string): string {
  return code.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--")
}

/** JSON that is safe inside a <script type="application/json"> element. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * Tells the panel around the frame when something breaks: a thrown error, a rejected promise, or a script that could
 * not be loaded. Messages carry `token`, so a page that has since been replaced cannot report into the new one.
 */
export function reporterScript(token: string): string {
  return `(function(){var T=${JSON.stringify(token)};function send(m){try{m.__cyphor=T;parent.postMessage(m,"*")}catch(e){}}
window.__cyphorReport=send;
window.addEventListener("error",function(e){var t=e.target;
if(t&&t!==window&&t.tagName){if(t.tagName==="SCRIPT"||t.tagName==="LINK"){var u=t.src||t.href;if(u)send({type:"resource",message:"Could not load "+u})}return}
send({type:"error",message:String(e.message||(e.error&&e.error.message)||"Script error"),line:e.lineno,col:e.colno,stack:e.error&&e.error.stack?String(e.error.stack).slice(0,1500):""})},true);
window.addEventListener("unhandledrejection",function(e){var r=e.reason;send({type:"error",message:"Unhandled promise rejection: "+(r&&r.message?r.message:String(r)),stack:r&&r.stack?String(r.stack).slice(0,1500):""})});
send({type:"ready"})})();`
}

const POLICY = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank">`

/** A model's own page, with the policy and the reporter put in front of everything it contains. */
function htmlDoc(html: string, token: string): string {
  const head = `${POLICY}<script>${inlineScript(reporterScript(token))}</script>`
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${head}`)
  if (/<html[\s>]/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`)
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body>${html}</body></html>`
}

function reactDoc(source: string, token: string, title: string, assets: PreviewAssets): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${POLICY}
<title>${escapeHtml(title)}</title>
<style>html,body{margin:0;min-height:100%;background:#fff;color:#111}body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}#root{min-height:100vh}</style>
<script>${inlineScript(reporterScript(token))}</script>
<script>${inlineScript(assets.tailwind)}</script>
</head><body><div id="root"></div>
<script>${inlineScript(assets.runtime)}</script>
<script type="application/json" id="__src">${jsonForScript(source)}</script>
<script>(function(){try{var s=JSON.parse(document.getElementById("__src").textContent);window.__cyphor.run(s,document.getElementById("root"),window.__cyphorReport)}catch(e){window.__cyphorReport({type:"error",phase:"boot",message:String(e&&e.message||e)})}})();</script>
</body></html>`
}

function mermaidDoc(source: string, token: string, theme: PreviewTheme): string {
  const dark = theme === "dark"
  const failed = "The diagram engine could not be loaded. Check your connection, or use the Code tab."
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${POLICY}
<style>html,body{margin:0;min-height:100%;background:${dark ? "#0b0d14" : "#ffffff"};color:${dark ? "#e8ecf5" : "#111111"};font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
body{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
#out{max-width:100%}#out svg{max-width:100%;height:auto}
.msg{font-size:14px;line-height:1.5;opacity:.75}
.err{white-space:pre-wrap;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#ffb3c4;border:1px solid #ff003c;background:#1a0008;padding:14px;max-width:44rem}</style>
<script>${inlineScript(reporterScript(token))}</script></head>
<body><div id="out" class="msg">Drawing the diagram…</div>
<script type="application/json" id="__src">${jsonForScript(source)}</script>
<script src="${MERMAID_URL}" integrity="${MERMAID_SRI}" crossorigin="anonymous" onerror="document.getElementById('out').textContent=${escapeHtml(JSON.stringify(failed))}"></script>
<script>(function(){var out=document.getElementById("out");if(!window.mermaid)return;
var src=JSON.parse(document.getElementById("__src").textContent);
try{window.mermaid.initialize({startOnLoad:false,securityLevel:"strict",suppressErrorRendering:true,theme:${dark ? '"dark"' : '"default"'},fontFamily:"ui-sans-serif,system-ui,sans-serif"})}catch(e){}
window.mermaid.render("d"+Date.now(),src).then(function(r){out.className="";out.innerHTML=r.svg}).catch(function(e){var m=String(e&&e.message||e);out.className="err";out.textContent="This diagram has a syntax error:\\n\\n"+m;window.__cyphorReport({type:"error",phase:"render",message:m})})})();</script>
</body></html>`
}

export interface PreviewRequest {
  type: PreviewType
  content: string
  title: string
  theme: PreviewTheme
  /** Changes with every page, so messages from a replaced page are ignored. */
  token: string
  /** Needed for type "react". */
  assets?: PreviewAssets
}

/** The full document for a frame. Throws if a React artifact is asked for without its runtime. */
export function buildPreviewDoc(r: PreviewRequest): string {
  switch (r.type) {
    case "html":
      return htmlDoc(r.content, r.token)
    case "mermaid":
      return mermaidDoc(r.content, r.token, r.theme)
    case "react":
      if (!r.assets) throw new Error("The React preview needs its runtime files.")
      return reactDoc(r.content, r.token, r.title, r.assets)
  }
}
