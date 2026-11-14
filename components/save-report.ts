import { toast } from "sonner"
import type { SaveOutcome } from "@/lib/utils"

/** Says how a save went. Nothing is said when the person turned it down themselves. */
export function reportSave(outcome: SaveOutcome, done?: string) {
  if (outcome === "saved") {
    if (done) toast.success(done)
  } else if (outcome === "unsupported") {
    toast.error("This view can't save that kind of file. Copy it instead.")
  } else if (outcome === "unavailable") {
    toast.error("Saving files is turned off in this view. Copy it instead.")
  }
}
