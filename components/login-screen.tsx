"use client"

import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react"
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { LogoMark, Wordmark } from "@/components/brand"
import { SetupCard } from "@/components/setup-card"
import { Skyline } from "@/components/skyline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signInWithEmail, signInWithGoogle, signUpWithEmail, type Outcome } from "@/lib/account"
import { cn } from "@/lib/utils"

type Mode = "in" | "up"

interface Props {
  /** A path on this site to open once signed in. Already checked on the server. */
  next: string
  /** False when DATABASE_URL is not set: there is nothing to sign in to yet. */
  dbReady: boolean
  /** "on" when Google is set up, "off" while developing without it (shows how to turn it on), "hidden" in production without it. */
  google: "on" | "off" | "hidden"
  /** The `error` code Google's round trip came back with, if any. */
  error: string | null
  dev: boolean
}

const GOOGLE_ERRORS: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  account_not_linked: "That email already has an account with a password. Sign in with your password instead.",
  email_not_found: "Google did not share an email address, so the account could not be made.",
}

function googleMessage(code: string | null) {
  if (!code) return null
  return GOOGLE_ERRORS[code] ?? "Google sign-in did not finish. Try again, or use your email."
}

/** The standard four-colour Google "G". It stays in its own colours on both themes, as Google's guidelines ask. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginScreen({ next, dbReady, google, error, dev }: Props) {
  const ids = { tabIn: useId(), tabUp: useId(), panel: useId(), hint: useId(), alert: useId() }
  const [mode, setMode] = useState<Mode>("in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState<"email" | "google" | null>(null)
  const [failure, setFailure] = useState<Outcome | null>(() => {
    const m = googleMessage(error)
    return m ? { ok: false, message: m } : null
  })
  const refs = { name: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), password: useRef<HTMLInputElement>(null) }

  useEffect(() => {
    // Put the cursor in the email box on a computer. On a phone that would pop the keyboard up before anyone asked.
    if (window.matchMedia("(pointer: fine)").matches) refs.email.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const busy = pending !== null

  function fail(o: Outcome) {
    setFailure(o)
    const f = o.field
    if (f) requestAnimationFrame(() => refs[f].current?.focus())
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setFailure(null)
    if (mode === "up" && !name.trim()) return fail({ ok: false, field: "name", message: "Enter your name." })
    if (!EMAIL.test(email.trim())) return fail({ ok: false, field: "email", message: "Enter a valid email address." })
    if (!password) return fail({ ok: false, field: "password", message: "Enter your password." })
    if (mode === "up" && password.length < 8) return fail({ ok: false, field: "password", message: "Use at least 8 characters for the password." })

    setPending("email")
    const res = mode === "in" ? await signInWithEmail(email, password) : await signUpWithEmail(name, email, password)
    if (res.ok) {
      // A full page load, so the app starts clean as this account.
      location.assign(next)
      return
    }
    setPending(null)
    fail(res)
  }

  async function withGoogle() {
    if (busy) return
    setFailure(null)
    setPending("google")
    const res = await signInWithGoogle(next)
    if (!res.ok) {
      setPending(null)
      fail(res)
    }
  }

  function pick(m: Mode) {
    setMode(m)
    setFailure(null)
  }
  function tabKeys(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    const m: Mode = e.key === "ArrowLeft" || e.key === "Home" ? "in" : "up"
    pick(m)
    document.getElementById(m === "in" ? ids.tabIn : ids.tabUp)?.focus()
  }

  const tab = (m: Mode, id: string, label: string) => {
    const on = mode === m
    return (
      <button
        key={m}
        id={id}
        type="button"
        role="tab"
        aria-selected={on}
        aria-controls={ids.panel}
        tabIndex={on ? 0 : -1}
        onClick={() => pick(m)}
        className={cn("hud relative h-11 text-[13px] transition-colors", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        {label}
        {on && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-marker" aria-hidden />}
      </button>
    )
  }

  const invalid = (f: "name" | "email" | "password") => (failure?.field === f ? true : undefined)

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
      {/* The picture. A strip on small screens, the whole left half on large ones. */}
      <aside className="relative overflow-hidden bg-[#05060b] max-lg:h-40 lg:min-h-dvh">
        {/* On a computer the picture keeps its own proportions, sits on the floor of the panel and fades out toward the top. */}
        <div className="absolute inset-x-0 bottom-0 max-lg:top-0 lg:aspect-[1200/640] lg:[mask-image:linear-gradient(to_bottom,transparent,#000_38%)]">
          <Skyline className="rise" />
        </div>
        <div className="relative z-10 flex items-center gap-3 p-4 lg:flex-col lg:items-start lg:gap-0 lg:p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <LogoMark className="size-9 lg:size-11" />
            <Wordmark className="text-base text-[#e8ecf6] lg:text-lg" />
          </div>
          <div className="mt-14 hidden max-w-md lg:block">
            <p className="rise rise-1 font-display text-4xl leading-[1.08] font-semibold text-[#e8ecf6] xl:text-5xl">One console for every model.</p>
            <p className="rise rise-2 mt-5 text-base leading-relaxed text-[#aab3c8]">Cyphor sends each question to the model that suits it, switches provider when one goes down, and can ask several models at once and merge their answers.</p>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-background lg:hidden" aria-hidden />
      </aside>

      <section className="flex items-start justify-center px-4 py-6 sm:px-10 sm:pt-12 lg:items-center lg:py-12">
        <h1 className="sr-only">Sign in to Cyphor</h1>
        <div className="rise rise-2 w-full max-w-md">
          <div className="cut cut-lg brackets lit [--edge:var(--input)] [--fill:var(--card)]">
            {!dbReady ? (
              <div className="grid gap-5 p-6 sm:p-8">
                <div className="grid gap-2">
                  <p className="font-display text-xl font-semibold">Connect your database</p>
                  <p className="text-sm text-muted-foreground" role="alert">
                    Accounts and chats are stored in Postgres, and no database is connected yet.
                  </p>
                </div>
                <SetupCard trial={dev} />
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="grid gap-5 p-6 sm:p-8" aria-busy={busy}>
                <div role="tablist" aria-label="Account" className="-mt-1 grid grid-cols-2 border-b" onKeyDown={tabKeys}>
                  {tab("in", ids.tabIn, "Sign in")}
                  {tab("up", ids.tabUp, "Create account")}
                </div>

                <div id={ids.panel} role="tabpanel" aria-labelledby={mode === "in" ? ids.tabIn : ids.tabUp} className="grid gap-5">
                  {google !== "hidden" && (
                    <div className="grid gap-2">
                      <Button type="button" variant="outline" size="lg" className="w-full" disabled={google === "off" || busy} onClick={withGoogle}>
                        {pending === "google" ? <Loader2 className="animate-spin" /> : <GoogleMark />}
                        Continue with Google
                      </Button>
                      {google === "off" && (
                        <p className="text-xs text-muted-foreground">
                          Google sign-in is off. Add <code className="font-mono">GOOGLE_CLIENT_ID</code> and <code className="font-mono">GOOGLE_CLIENT_SECRET</code> to .env.local to turn it on.
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
                        <span className="h-px flex-1 bg-border" />
                        or use your email
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    </div>
                  )}

                  {mode === "up" && (
                    <div className="grid gap-1.5">
                      <Label htmlFor="login-name">Name</Label>
                      <Input
                        id="login-name"
                        ref={refs.name}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        maxLength={80}
                        className="h-11"
                        aria-invalid={invalid("name")}
                        aria-describedby={failure?.field === "name" ? ids.alert : undefined}
                      />
                    </div>
                  )}

                  <div className="grid gap-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      ref={refs.email}
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="h-11"
                      aria-invalid={invalid("email")}
                      aria-describedby={failure?.field === "email" ? ids.alert : undefined}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        ref={refs.password}
                        type={show ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === "in" ? "current-password" : "new-password"}
                        maxLength={128}
                        className="h-11 pr-11"
                        aria-invalid={invalid("password")}
                        aria-describedby={[failure?.field === "password" ? ids.alert : "", mode === "up" ? ids.hint : ""].filter(Boolean).join(" ") || undefined}
                      />
                      <Button type="button" variant="ghost" size="icon-sm" className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)}>
                        {show ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                    {mode === "up" && (
                      <p id={ids.hint} className="text-xs text-muted-foreground">
                        At least 8 characters. Resetting a forgotten password by email is not set up, so keep it somewhere safe.
                      </p>
                    )}
                  </div>

                  {failure?.message && (
                    <p id={ids.alert} role="alert" className="flex items-start gap-2 border border-heat/50 bg-heat/10 px-3 py-2 text-sm text-heat">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>{failure.message}</span>
                    </p>
                  )}

                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {pending === "email" && <Loader2 className="animate-spin" />}
                    {mode === "in" ? "Sign in" : "Create account"}
                  </Button>
                </div>

                <p className="text-center text-xs text-muted-foreground">Your chats are saved to your account, so they follow you to other devices.</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
