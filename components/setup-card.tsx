"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { copyText } from "@/lib/utils"

/**
 * What to do when no database is connected yet: the three steps, and the one line to paste.
 * It shows a placeholder, never a real address: your own connection string goes in .env.local, and nowhere else.
 */
const LINE = "DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"

export function SetupCard({ trial = false }: { trial?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="grid gap-4 text-sm">
      <ol className="grid list-decimal gap-2 pl-5 marker:font-mono marker:text-muted-foreground">
        <li>
          Create a free Postgres database on{" "}
          <a className="text-link underline underline-offset-4" href="https://console.neon.tech" target="_blank" rel="noreferrer">
            Neon
          </a>
          .
        </li>
        <li>
          Copy the <b className="font-semibold">pooled</b> connection string from the project's Connect panel.
        </li>
        <li>
          Add it to <code className="font-mono text-[0.85em]">.env.local</code> as shown below, then restart the server (or set it in your host's environment settings).
        </li>
      </ol>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto border bg-code px-3 py-2 font-mono text-xs whitespace-nowrap select-all">{LINE}</code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={copied ? "Copied" : "Copy the line"}
          onClick={async () => {
            if (await copyText(LINE)) {
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      {trial && (
        <p className="text-muted-foreground">
          Only trying it out? <code className="font-mono text-[0.85em]">DATABASE_URL=pglite://./.data/pg</code> runs a database inside the app, saved to a local folder. It is for one machine, not for hosting.
        </p>
      )}
    </div>
  )
}
