"use client"

import { DatabaseZap, KeyRound, TriangleAlert, WifiOff } from "lucide-react"
import { LogoMark, Wordmark } from "@/components/brand"
import { SetupCard } from "@/components/setup-card"
import { Button } from "@/components/ui/button"
import { loadAccount, useAccount } from "@/lib/account"

const TITLES = {
  db_not_configured: "Connect your database",
  db_unavailable: "Cyphor can't reach its database",
  auth_not_configured: "Add a sign-in key",
  offline: "Cyphor can't be reached",
  unknown: "Sign-in isn't available",
} as const

const ICONS = { db_not_configured: DatabaseZap, db_unavailable: DatabaseZap, auth_not_configured: KeyRound, offline: WifiOff, unknown: TriangleAlert } as const

/** Shown when the server cannot say who is signed in: no database is connected yet, the database is down, no sign-in key is set, or there is no connection. */
export function AccountProblem() {
  const problem = useAccount((s) => s.problem)
  const code = problem?.code ?? "unknown"
  const setup = code === "db_not_configured"
  const Icon = ICONS[code]

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="cut cut-lg brackets [--fill:var(--card)] [--edge:var(--input)]" data-active="true">
          <div className="grid gap-5 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <LogoMark className="size-9" />
              <Wordmark />
            </div>
            <div className="grid gap-2">
              <h1 className="flex items-center gap-2 font-display text-xl font-semibold">
                <Icon className="size-5 text-heat" aria-hidden />
                {TITLES[code]}
              </h1>
              <p className="text-sm text-muted-foreground" role="alert">
                {setup ? "Accounts and chats are stored in Postgres, and no database is connected yet." : problem?.message}
              </p>
            </div>
            {setup && <SetupCard trial={process.env.NODE_ENV !== "production"} />}
            {code === "db_unavailable" && (
              <p className="text-sm text-muted-foreground">Check that DATABASE_URL is the right connection string and that the Neon project is running. A project that has been idle wakes up on the first request, which can take a few seconds.</p>
            )}
            <div>
              <Button
                onClick={() => {
                  useAccount.setState({ status: "loading", problem: null })
                  void loadAccount()
                }}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
