"use client";

import { useState, Fragment } from "react";
import { Check, Copy, User } from "lucide-react";
import { toast } from "sonner";
import { CyphorMark } from "./CyphorMark";
import { DecodeText } from "./DecodeText";

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-[hsl(224_26%_6%)]">
      <div className="flex items-center justify-between border-b border-border/80 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {lang || "text"}
        </span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            toast("Copied to clipboard");
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="cy-scroll overflow-x-auto px-3.5 py-3 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}

/** Splits on ``` fences and renders code segments with CodeBlock, text otherwise. */
function RichContent({ content }: { content: string }) {
  const parts = content.split(/```/g);
  return (
    <div className="text-[14.5px] leading-relaxed text-foreground/95">
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const firstLineBreak = part.indexOf("\n");
          const lang = firstLineBreak === -1 ? "" : part.slice(0, firstLineBreak).trim();
          const code = firstLineBreak === -1 ? part : part.slice(firstLineBreak + 1);
          return <CodeBlock key={i} code={code.replace(/\n$/, "")} lang={lang} />;
        }
        return (
          <Fragment key={i}>
            {part.split("\n").map((line, j, arr) => (
              <Fragment key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className="flex animate-rise-in justify-end py-2.5">
        <div className="flex max-w-[80%] items-start gap-2.5 sm:max-w-[70%]">
          <div className="rounded-3xl rounded-br-md bg-secondary px-4 py-2.5 text-[14.5px] leading-relaxed text-secondary-foreground">
            <div className="whitespace-pre-wrap">{content}</div>
          </div>
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-rise-in gap-3 py-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(174_72%_42%/0.14)] text-primary">
        <CyphorMark className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <DecodeText
          text="Cyphor"
          duration={340}
          className="mb-1 block font-display text-[13px] font-medium text-muted-foreground"
        />
        <RichContent content={content} />
        {streaming && (
          <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret-blink bg-primary align-middle" />
        )}
      </div>
    </div>
  );
}
