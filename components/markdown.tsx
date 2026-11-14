import { Children, isValidElement, memo, type ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { CodeBlock } from "./code-block"

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

const components: Components = {
  // Fenced blocks arrive as <pre><code class="language-x">; render them with our own block.
  pre: ({ children }) => {
    const el = Children.toArray(children)[0]
    if (isValidElement<{ className?: string; children?: ReactNode }>(el)) {
      const lang = /language-([\w+-]+)/.exec(el.props.className ?? "")?.[1]
      return <CodeBlock language={lang} code={textOf(el.props.children).replace(/\n$/, "")} />
    }
    return <pre>{children}</pre>
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  // The wrapper scrolls sideways on narrow screens, so it must be reachable by keyboard.
  table: ({ children }) => (
    <div className="md-table md-block" role="region" aria-label="Table" tabIndex={0}>
      <table>{children}</table>
    </div>
  ),
  // A model may leave a header cell empty (a corner cell, say). Give assistive tech something to read.
  th: ({ children, style }) => (
    <th style={style}>{textOf(children).trim() ? children : <span className="sr-only">Item</span>}</th>
  ),
  img: ({ src, alt }) => <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" />,
}

const remarkPlugins = [remarkGfm]

/** Renders model output. Raw HTML in the text is not interpreted, so replies cannot inject markup. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
})
