/**
 * The single-file preview: the same screens as the app, built into one HTML file that opens from disk.
 * There is no server, so Next.js is not involved. The address lives in the hash (#/chat/abc), and the
 * screen for each address is chosen here the way the folders in app/ do it for Next.js.
 */
import "./preview.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ChatRoute } from "@/components/chat-view"
import { Home } from "@/components/home"
import { ArtifactsPage, ChatsPage, ProjectRoute, ProjectsPage } from "@/components/pages"
import { Shell } from "@/components/shell"
import { NO_FLASH_SCRIPT } from "@/lib/no-flash"
import { useRoute } from "@/lib/route"

// A page frame that hosts this preview may supply its own <html>, so make sure the language is set.
document.documentElement.lang ||= "en"

// The Next.js layout runs this in <head> before the first paint, so a dark-theme visitor never sees a light flash.
// Here the page is built in the browser, so it runs first thing instead.
const script = document.createElement("script")
script.textContent = NO_FLASH_SCRIPT
document.head.append(script)
script.remove()

function Page() {
  const route = useRoute()
  switch (route.name) {
    case "chat":
      return <ChatRoute />
    case "chats":
      return <ChatsPage />
    case "projects":
      return <ProjectsPage />
    case "project":
      return <ProjectRoute />
    case "artifacts":
      return <ArtifactsPage />
    default:
      return <Home />
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell>
      <Page />
    </Shell>
  </StrictMode>
)
