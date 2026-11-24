import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Backdrop } from "@/components/backdrop"
import { Shell } from "@/components/shell"
import { NO_FLASH_SCRIPT } from "@/lib/no-flash"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: { default: "Cyphor", template: "%s · Cyphor" },
  description: "Cyphor routes your questions across many language models from one console.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceff5" },
    { media: "(prefers-color-scheme: dark)", color: "#090b12" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The inline script and the app itself change <html> attributes (theme, font, effects) before
    // React looks at them, so the server's copy is allowed to differ.
    <html lang="en" className="dark" data-font="sans" data-effects="full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className={cn("antialiased")}>
        <Backdrop />
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
