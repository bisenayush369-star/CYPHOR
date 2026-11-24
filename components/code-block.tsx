import { memo, useMemo, useState } from "react"
import hljs from "highlight.js/lib/core"
import bash from "highlight.js/lib/languages/bash"
import css from "highlight.js/lib/languages/css"
import diff from "highlight.js/lib/languages/diff"
import go from "highlight.js/lib/languages/go"
import java from "highlight.js/lib/languages/java"
import javascript from "highlight.js/lib/languages/javascript"
import json from "highlight.js/lib/languages/json"
import markdown from "highlight.js/lib/languages/markdown"
import python from "highlight.js/lib/languages/python"
import rust from "highlight.js/lib/languages/rust"
import sql from "highlight.js/lib/languages/sql"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import yaml from "highlight.js/lib/languages/yaml"
import { Check, Copy, WrapText } from "lucide-react"
import { toast } from "sonner"
import { copyText, cn } from "@/lib/utils"
import { IconButton } from "./icon-button"

const LANGS = { bash, css, diff, go, java, javascript, json, markdown, python, rust, sql, typescript, xml, yaml }
for (const [name, fn] of Object.entries(LANGS)) hljs.registerLanguage(name, fn)
hljs.registerAliases(["sh", "shell", "zsh"], { languageName: "bash" })
hljs.registerAliases(["html", "svg", "vue"], { languageName: "xml" })
hljs.registerAliases(["js", "jsx", "mjs"], { languageName: "javascript" })
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" })
hljs.registerAliases(["py"], { languageName: "python" })
hljs.registerAliases(["yml"], { languageName: "yaml" })
hljs.registerAliases(["md"], { languageName: "markdown" })

export function highlight(code: string, lang?: string): string | null {
  if (!lang || code.length > 40_000) return null
  const name = lang.toLowerCase()
  if (!hljs.getLanguage(name)) return null
  try {
    return hljs.highlight(code, { language: name, ignoreIllegals: true }).value
  } catch {
    return null
  }
}

interface Props {
  language?: string
  code: string
  /** Hide the header (used inside the artifact panel, which has its own toolbar). */
  bare?: boolean
  className?: string
}

export const CodeBlock = memo(function CodeBlock({ language, code, bare, className }: Props) {
  const html = useMemo(() => highlight(code, language), [code, language])
  const [copied, setCopied] = useState(false)
  const [wrap, setWrap] = useState(false)

  const copy = async () => {
    const ok = await copyText(code)
    if (!ok) return toast.error("Couldn't copy. Select the text and copy it manually.")
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn("md-block cut overflow-hidden [--fill:var(--code)]", className)}>
      {!bare && (
        <div className="flex items-center justify-between gap-2 border-b bg-muted/50 py-1 pr-1.5 pl-3.5">
          <span className="font-mono text-xs text-muted-foreground">{language || "text"}</span>
          <div className="flex items-center">
            <IconButton
              label={wrap ? "Scroll long lines" : "Wrap long lines"}
              pressed={wrap}
              onClick={() => setWrap((w) => !w)}
              className="size-7 text-muted-foreground"
            >
              <WrapText className="size-3.5" />
            </IconButton>
            <IconButton label={copied ? "Copied" : "Copy code"} onClick={copy} className="size-7 text-muted-foreground">
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            </IconButton>
          </div>
        </div>
      )}
      <pre
        className={cn(
          "m-0 p-3.5 font-mono text-[12.5px] leading-[1.65] sm:text-[13px]",
          wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto"
        )}
        tabIndex={0}
      >
        {html ? (
          <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code className="hljs">{code}</code>
        )}
      </pre>
    </div>
  )
})
