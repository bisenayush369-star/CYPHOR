import type { Metadata } from "next"
import { ChatsPage } from "@/components/pages"

export const metadata: Metadata = { title: "Chats" }

/** `/chat` lists every saved conversation. A single conversation lives at `/chat/[id]`. */
export default function Page() {
  return <ChatsPage />
}
