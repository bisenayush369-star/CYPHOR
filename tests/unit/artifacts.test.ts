/**
 * Artifacts: how a reply becomes cards and previews. Covers the <artifact> tag, ordinary fenced code that is promoted
 * to an artifact, the pages that run in the preview frame, and the instruction models are given.
 */
import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { humanize, kindFor, qualifies, titleFor } from "../../lib/artifact/detect.ts"
import { CDN_HOSTS, CSP, MERMAID_SRI, MERMAID_URL, buildPreviewDoc, inlineScript, jsonForScript, reporterScript } from "../../lib/artifact/srcdoc.ts"
import { DEFAULT_SETTINGS } from "../../lib/defaults.ts"
import { artifactExtension, collectArtifacts, mayHaveArtifacts, normalizeType, parseContent, plainText, type ParsedArtifact, type Segment } from "../../lib/parse.ts"
import { ARTIFACT_PROMPT, buildSystemPrompt } from "../../lib/prompt.ts"
import type { Message } from "../../lib/types.ts"

const artifacts = (segs: Segment[]): ParsedArtifact[] => segs.flatMap((s) => (s.kind === "artifact" ? [s.artifact] : []))
const texts = (segs: Segment[]) => segs.flatMap((s) => (s.kind === "text" ? [s.text] : []))

const PAGE = `<!doctype html>
<html>
<head><title>Pomodoro timer</title></head>
<body><h1>Focus</h1><button id="go">Start</button><script>document.getElementById("go").onclick=()=>alert(1)</script></body>
</html>`

const TODO = `import { useState } from "react"
import { Plus } from "lucide-react"

export default function TodoList() {
  const [items, setItems] = useState<string[]>([])
  return <div className="p-4"><button onClick={() => setItems([...items, "x"])}><Plus /></button>{items.length}</div>
}`

const FLOW = `flowchart TD
  A[Start] --> B{Ready?}
  B -- yes --> C[Go]
  B -- no --> A`

describe("the <artifact> tag", () => {
  test("reads the attributes and the body", () => {
    const [a] = artifacts(parseContent(`Here you go.\n<artifact identifier="timer" type="html" title="Timer">\n${PAGE}\n</artifact>\nEnjoy.`))
    assert.equal(a.identifier, "timer")
    assert.equal(a.type, "html")
    assert.equal(a.title, "Timer")
    assert.equal(a.content, PAGE)
    assert.equal(a.complete, true)
    assert.equal(a.promoted, undefined)
  })

  test("keeps the text before and after it", () => {
    const segs = parseContent(`Before.\n<artifact identifier="x" type="svg" title="X"><svg viewBox="0 0 1 1"></svg></artifact>\nAfter.`)
    assert.deepEqual(segs.map((s) => s.kind), ["text", "artifact", "text"])
    assert.match(texts(segs)[1], /After\./)
  })

  test("names every type the way models write them", () => {
    const cases: [string | undefined, string][] = [
      ["html", "html"], ["text/html", "html"], ["application/vnd.ant.html", "html"],
      ["react", "react"], ["application/vnd.ant.react", "react"], ["jsx", "react"], ["tsx", "react"],
      ["svg", "svg"], ["image/svg+xml", "svg"],
      ["mermaid", "mermaid"], ["application/vnd.ant.mermaid", "mermaid"],
      ["markdown", "markdown"], ["md", "markdown"], ["document", "markdown"],
      ["application/vnd.ant.code", "code"], ["python", "code"], [undefined, "code"],
    ]
    for (const [given, want] of cases) assert.equal(normalizeType(given), want, String(given))
  })

  test("reads <antArtifact> and its closing tag", () => {
    const [a] = artifacts(parseContent(`<antArtifact identifier="a" type="application/vnd.ant.react" title="A">${TODO}</antArtifact>`))
    assert.equal(a.type, "react")
    assert.equal(a.complete, true)
    assert.equal(a.content, TODO)
  })

  test("a half-written tag is held back, not shown as text", () => {
    for (const cut of ["<", "<art", "<artifact", "<antArt"]) {
      const segs = parseContent("Working on it.\n" + cut)
      assert.deepEqual(segs.map((s) => s.kind), ["text"], cut)
      assert.equal(texts(segs).join("").includes("<"), false, cut)
    }
  })

  test("an unfinished artifact is incomplete and never shows a half-typed closing tag", () => {
    const [a] = artifacts(parseContent(`<artifact identifier="x" type="html" title="X">\n<p>hello</p>\n</artif`))
    assert.equal(a.complete, false)
    assert.equal(a.content, "<p>hello</p>")
  })

  test("strips a code fence the model wrapped around the content", () => {
    const [a] = artifacts(parseContent('<artifact identifier="x" type="code" language="python" title="X">\n```python\nprint(1)\n```\n</artifact>'))
    assert.equal(a.content, "print(1)")
  })

  test("a web page or component filed as type=code still gets a preview", () => {
    const [page] = artifacts(parseContent(`<artifact identifier="p" type="code" language="html" title="P">\n${PAGE}\n</artifact>`))
    assert.equal(page.type, "html")
    const [comp] = artifacts(parseContent(`<artifact identifier="c" type="code" language="tsx" title="C">\n${TODO}\n</artifact>`))
    assert.equal(comp.type, "react")
    const [py] = artifacts(parseContent('<artifact identifier="s" type="code" language="python" title="S">\nprint(1)\n</artifact>'))
    assert.equal(py.type, "code")
  })

  test("a tag mentioned inside a code fence is only text", () => {
    const segs = parseContent('Use it like this:\n```\n<artifact identifier="x" type="html" title="X">...</artifact>\n```\n')
    assert.equal(artifacts(segs).length, 0)
  })

  test("a markdown artifact may contain fenced code without it being promoted", () => {
    const body = "# Guide\n\n```html\n" + PAGE + "\n```\n"
    const segs = parseContent(`<artifact identifier="g" type="markdown" title="Guide">\n${body}</artifact>`)
    const found = artifacts(segs)
    assert.equal(found.length, 1)
    assert.equal(found[0].type, "markdown")
  })

  test("thinking blocks still come out separately", () => {
    const segs = parseContent("<thinking>plan</thinking>Done.")
    assert.deepEqual(segs.map((s) => s.kind), ["thinking", "text"])
  })
})

describe("ordinary fenced code becomes an artifact", () => {
  test("a full web page in an html fence", () => {
    const segs = parseContent("Here is the page:\n\n```html\n" + PAGE + "\n```\n\nOpen it in a browser.")
    const [a] = artifacts(segs)
    assert.equal(a.type, "html")
    assert.equal(a.identifier, "html-1")
    assert.equal(a.title, "Pomodoro timer")
    assert.equal(a.content, PAGE)
    assert.equal(a.complete, true)
    assert.equal(a.promoted, true)
    assert.match(texts(segs).join(""), /Here is the page/)
    assert.match(texts(segs).join(""), /Open it in a browser/)
    assert.equal(texts(segs).join("").includes("<!doctype"), false)
  })

  test("a short snippet stays a code block", () => {
    const segs = parseContent("Centre it like so:\n\n```html\n<div class=\"c\">hi</div>\n```\n")
    assert.equal(artifacts(segs).length, 0)
    assert.match(texts(segs).join(""), /```html/)
  })

  test("svg, mermaid and a React component", () => {
    const svg = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><title>Logo</title><circle cx="50" cy="50" r="40" fill="#fcee09"/></svg>'
    const segs = parseContent("```svg\n" + svg + "\n```\n\n```mermaid\n" + FLOW + "\n```\n\n```tsx\n" + TODO + "\n```\n")
    const found = artifacts(segs)
    assert.deepEqual(found.map((a) => a.type), ["svg", "mermaid", "react"])
    assert.deepEqual(found.map((a) => a.identifier), ["svg-1", "mermaid-1", "react-1"])
    assert.deepEqual(found.map((a) => a.title), ["Logo", "Flowchart", "Todo list"])
    assert.equal(found[1].content, FLOW)
  })

  test("javascript with a React import is a React artifact, plain javascript is not", () => {
    const react = parseContent("```js\n" + TODO.replace(": string[]", "") + "\n```")
    assert.equal(artifacts(react)[0]?.type, "react")
    const plain = parseContent("```js\n" + "function add(a, b) {\n  return a + b\n}\n".repeat(8) + "```")
    assert.equal(artifacts(plain).length, 0)
  })

  test("ordinary code in other languages is left alone, however long", () => {
    const long = "x = 1\n".repeat(200)
    assert.equal(artifacts(parseContent("```python\n" + long + "```")).length, 0)
    assert.equal(artifacts(parseContent("```ts\nimport { useState } from \"react\"\n" + "const a = 1\n".repeat(30) + "```")).length, 0)
  })

  test("the identifier counts per kind, in order, within one reply", () => {
    const segs = parseContent("```html\n" + PAGE + "\n```\nand\n```html\n" + PAGE.replace("Pomodoro timer", "Other") + "\n```")
    assert.deepEqual(artifacts(segs).map((a) => a.identifier), ["html-1", "html-2"])
    assert.deepEqual(artifacts(segs).map((a) => a.title), ["Pomodoro timer", "Other"])
  })

  test("tildes work as fences", () => {
    const [a] = artifacts(parseContent("~~~html\n" + PAGE + "\n~~~"))
    assert.equal(a.type, "html")
    assert.equal(a.complete, true)
  })

  test("a block still being written is incomplete, and a half-typed closing fence is not shown in it", () => {
    const a = artifacts(parseContent("```html\n" + PAGE.slice(0, PAGE.length - 10) + "\n``"))[0]
    assert.equal(a.complete, false)
    assert.equal(a.content.endsWith("``"), false)
  })

  test("a card never turns back into plain code while the reply streams in", () => {
    const message = "Intro text.\n\n```html\n" + PAGE + "\n```\n\nThen a diagram:\n\n```mermaid\n" + FLOW + "\n```\n\nAnd a component:\n\n```jsx\n" + TODO + "\n```\n\nBye."
    let seen: string[] = []
    for (let n = 0; n <= message.length; n++) {
      const now = artifacts(parseContent(message.slice(0, n))).map((a) => a.identifier)
      for (let i = 0; i < seen.length; i++) assert.equal(now[i], seen[i], `artifact ${i} vanished at ${n} characters`)
      seen = now
    }
    assert.deepEqual(seen, ["html-1", "mermaid-1", "react-1"])
  })

  test("identifiers stay the same while the title is still being worked out", () => {
    const early = artifacts(parseContent("```html\n<!doctype html><html><head><meta charset=utf-8>"))[0]
    const late = artifacts(parseContent("```html\n" + PAGE))[0]
    assert.equal(early.identifier, late.identifier)
    assert.equal(early.title, "Web page")
    assert.equal(late.title, "Pomodoro timer")
  })

  test("a long streamed page parses in a blink", () => {
    const rows = Array.from({ length: 3000 }, (_, i) => `<tr><td>${i}</td><td><b>row</b></td></tr>`).join("\n")
    const big = "```html\n<!doctype html><html><body><table>" + rows + "</table></body></html>"
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) parseContent(big)
    assert.ok(performance.now() - t0 < 1500, "five parses of a 120 KB page took too long")
  })

  test("versions of a promoted artifact group across messages", () => {
    const msg = (id: string, content: string): Message => ({ id, role: "assistant", content, createdAt: 0, parentId: null, children: [] }) as unknown as Message
    const history = collectArtifacts([msg("a", "```html\n" + PAGE + "\n```"), msg("u", "make it dark"), msg("b", "```html\n" + PAGE.replace("Focus", "Dark focus") + "\n```")] as Message[])
    assert.equal(history.length, 1)
    assert.equal(history[0].identifier, "html-1")
    assert.deepEqual(history[0].versions.map((v) => v.messageId), ["a", "b"])
  })

  test("plain text names the artifact instead of pasting the code", () => {
    assert.equal(plainText("Done.\n\n```html\n" + PAGE + "\n```"), "Done.\n\n[Artifact: Pomodoro timer]")
  })
})

describe("what counts as worth previewing", () => {
  test("fence languages", () => {
    assert.equal(kindFor("html", ""), "html")
    assert.equal(kindFor("HTM", ""), "html")
    assert.equal(kindFor("svg", ""), "svg")
    assert.equal(kindFor("mermaid", ""), "mermaid")
    assert.equal(kindFor("tsx", ""), "react")
    assert.equal(kindFor("python", ""), null)
    assert.equal(kindFor("js", "console.log(1)"), null)
    assert.equal(kindFor("js", 'import React from "react"'), "react")
  })

  test("size and shape rules", () => {
    assert.equal(qualifies("html", "<p>hi</p>"), false)
    assert.equal(qualifies("html", "<!DOCTYPE html><html></html>"), true)
    assert.equal(qualifies("html", "<div>".repeat(100)), true)
    assert.equal(qualifies("svg", "<svg></svg>"), false)
    assert.equal(qualifies("svg", `<svg viewBox="0 0 9 9">${"<path d=\"M0 0\"/>".repeat(6)}</svg>`), true)
    assert.equal(qualifies("mermaid", "graph LR\nA-->B"), true)
    assert.equal(qualifies("mermaid", "not a diagram at all, just a sentence about graphs"), false)
    assert.equal(qualifies("react", "export default 1"), false)
  })

  test("titles come from the content", () => {
    assert.equal(titleFor("html", "<html><body><h1>Hello &amp; welcome</h1></body></html>"), "Hello & welcome")
    assert.equal(titleFor("html", "<div>no heading</div>"), "Web page")
    assert.equal(titleFor("mermaid", "sequenceDiagram\nA->>B: hi"), "Sequence diagram")
    assert.equal(titleFor("mermaid", "---\ntitle: Sign-up flow\n---\nflowchart LR\nA-->B"), "Sign-up flow")
    assert.equal(titleFor("react", "export default function App() { return null }"), "React app")
    assert.equal(titleFor("react", "export default function PriceCalculator() { return null }"), "Price calculator")
    assert.equal(titleFor("svg", "<svg><title>Moon</title></svg>"), "Moon")
    assert.equal(humanize("TodoListApp"), "Todo list app")
    assert.equal(humanize("HTMLViewer"), "HTML viewer")
  })

  test("a quick check before parsing", () => {
    assert.equal(mayHaveArtifacts("just words"), false)
    assert.equal(mayHaveArtifacts("a <artifact identifier='x'>"), true)
    assert.equal(mayHaveArtifacts("```html\n"), true)
  })

  test("file extensions", () => {
    assert.equal(artifactExtension("react", "tsx"), "tsx")
    assert.equal(artifactExtension("react", "jsx"), "jsx")
    assert.equal(artifactExtension("react"), "jsx")
    assert.equal(artifactExtension("mermaid"), "mmd")
    assert.equal(artifactExtension("html"), "html")
    assert.equal(artifactExtension("code", "python"), "py")
  })
})

describe("the preview pages", () => {
  const assets = { runtime: "window.__cyphor={run:function(){}};", tailwind: "/* tailwind */" }
  const base = { title: "T", theme: "light", token: "tok123" } as const

  test("a web page gets the policy and the reporter ahead of its own code", () => {
    const doc = buildPreviewDoc({ ...base, type: "html", content: PAGE })
    const head = doc.slice(doc.indexOf("<head>"))
    assert.ok(head.indexOf("Content-Security-Policy") < head.indexOf("<title>Pomodoro"), "policy must come first")
    assert.ok(head.indexOf("Content-Security-Policy") < head.indexOf("__cyphor"), "policy before the reporter")
    assert.ok(doc.includes('"tok123"'))
    assert.ok(doc.includes(PAGE.slice(PAGE.indexOf("<body>"), PAGE.indexOf("</body>"))))
  })

  test("a fragment is wrapped in a page, and a page without a head gets one", () => {
    const frag = buildPreviewDoc({ ...base, type: "html", content: "<p>hi</p>" })
    assert.match(frag, /^<!doctype html><html><head>/)
    assert.ok(frag.includes("<body><p>hi</p></body>"))
    const noHead = buildPreviewDoc({ ...base, type: "html", content: "<html><body>x</body></html>" })
    assert.match(noHead, /<html><head><meta http-equiv="Content-Security-Policy"/)
  })

  test("the policy blocks the network and allows only the listed libraries", () => {
    assert.match(CSP, /default-src 'none'/)
    assert.match(CSP, /connect-src 'none'/)
    assert.match(CSP, /form-action 'none'/)
    for (const host of CDN_HOSTS) assert.ok(CSP.includes(host), host)
    assert.equal(/script-src[^;]*\*/.test(CSP), false)
    assert.equal(/script-src[^;]*https:(?!\/\/)/.test(CSP), false)
  })

  test("a React page carries the runtime, the compiler input and the boot code", () => {
    const doc = buildPreviewDoc({ ...base, type: "react", content: TODO, assets })
    assert.ok(doc.includes(assets.runtime))
    assert.ok(doc.includes(assets.tailwind))
    assert.ok(doc.indexOf(assets.tailwind) < doc.indexOf(assets.runtime))
    assert.match(doc, /<div id="root"><\/div>/)
    const json = doc.match(/<script type="application\/json" id="__src">([\s\S]*?)<\/script>/)?.[1]
    assert.ok(json)
    assert.equal(JSON.parse(json!), TODO)
  })

  test("a React page without its runtime is an error, not a blank frame", () => {
    assert.throws(() => buildPreviewDoc({ ...base, type: "react", content: TODO }), /runtime/)
  })

  test("source that tries to close the script tag cannot break out", () => {
    const evil = 'export default () => <p>{"</script><script>parent.document.title=1</script><!--"}</p>'
    const doc = buildPreviewDoc({ ...base, type: "react", content: evil, assets })
    const json = doc.match(/<script type="application\/json" id="__src">([\s\S]*?)<\/script>/)?.[1]
    assert.equal(JSON.parse(json!), evil)
    assert.equal(json!.includes("</script"), false)
    assert.equal(json!.includes("<"), false)
    assert.equal(doc.split("</script>").length - 1, doc.split("<script").length - 1, "every script tag must close exactly once")
    const nasty = buildPreviewDoc({ ...base, type: "react", content: TODO, assets: { runtime: 'var a="</script><b>";var c="<!--";', tailwind: "x" } })
    assert.equal(nasty.includes('var a="</script>'), false)
    assert.equal(nasty.includes('var c="<!--"'), false)
  })

  test("escaping helpers", () => {
    assert.equal(inlineScript("a</SCRIPT>b<!--c"), "a<\\/SCRIPT>b<\\!--c")
    assert.equal(jsonForScript("</script>\u2028"), '"\\u003c/script>\\u2028"')
  })

  test("a diagram page loads the pinned engine with its integrity hash and follows the theme", () => {
    const dark = buildPreviewDoc({ ...base, type: "mermaid", content: FLOW, theme: "dark" })
    assert.ok(dark.includes(`src="${MERMAID_URL}"`))
    assert.ok(dark.includes(`integrity="${MERMAID_SRI}"`))
    assert.match(MERMAID_SRI, /^sha384-[A-Za-z0-9+/]{64}$/)
    assert.match(MERMAID_URL, /mermaid@\d+\.\d+\.\d+\//)
    assert.ok(dark.includes('theme:"dark"'))
    assert.ok(dark.includes('securityLevel:"strict"'))
    const light = buildPreviewDoc({ ...base, type: "mermaid", content: FLOW, theme: "light" })
    assert.ok(light.includes('theme:"default"'))
  })

  test("the reporter only speaks with the right token", () => {
    const code = reporterScript('a"b')
    assert.ok(code.includes('var T="a\\"b"'))
    assert.ok(code.includes("parent.postMessage"))
    assert.ok(code.includes("unhandledrejection"))
  })
})

describe("the instruction models are given", () => {
  test("it names every type and shows the tag", () => {
    for (const word of ["html:", "react:", "svg:", "mermaid:", "markdown:", "code:", "<artifact identifier=", "</artifact>", "complete file", "copies all the code"]) {
      assert.ok(ARTIFACT_PROMPT.includes(word), word)
    }
  })

  test("it goes into the system prompt when artifacts are on, and not when they are off", () => {
    assert.ok(buildSystemPrompt({ settings: { ...DEFAULT_SETTINGS, artifacts: true } }).includes(ARTIFACT_PROMPT))
    assert.equal(buildSystemPrompt({ settings: { ...DEFAULT_SETTINGS, artifacts: false } }).includes("<artifact"), false)
  })
})
