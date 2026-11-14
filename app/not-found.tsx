import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-serif text-2xl font-semibold">That page does not exist</h1>
      <p className="text-sm text-muted-foreground">The link may be old, or the address may have a typo.</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Start a new chat
      </Link>
    </div>
  )
}
