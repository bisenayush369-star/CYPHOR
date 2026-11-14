import type { Metadata } from "next"
import { ArtifactsPage } from "@/components/pages"

export const metadata: Metadata = { title: "Artifacts" }

export default function Page() {
  return <ArtifactsPage />
}
