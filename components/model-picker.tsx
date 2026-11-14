import { Brain, ChevronDown, Library, Network, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { describeModel, useCatalog } from "@/lib/catalog"
import { DEFAULT_MODELS } from "@/lib/models/page"
import { useModelList, useStore } from "@/lib/store"
import { useUI } from "@/lib/ui"
import { KIND_ICON, ProviderMark } from "./model-parts"

interface Props {
  model: string
  onChange: (id: string) => void
  side?: "top" | "bottom"
}

export function ModelPicker({ model, onChange, side = "top" }: Props) {
  const own = useModelList()
  const provider = useStore((s) => s.settings.provider)
  const thinking = useStore((s) => s.settings.extendedThinking)
  const update = useStore((s) => s.updateSettings)
  const openSettings = useUI((s) => s.openSettings)
  const openLibrary = useUI((s) => s.openLibrary)
  const data = useCatalog((s) => s.data)

  const router = provider === "server"
  const info = router ? describeModel(model, data) : null
  const name = router ? info!.name : (own.find((m) => m.id === model) ?? own[0])?.name ?? model
  const Icon = info?.kind ? KIND_ICON[info.kind] : null
  // A model picked by name that is not one of the Cyphor models gets its own row, so the menu shows what is selected.
  const picked = router && !DEFAULT_MODELS.some((m) => m.id === model) ? info : null
  const godReady = !data || data.mode === "demo" || data.godReady
  const hasModels = !!data?.models.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Model: ${name}. Change model`}
          className="h-10 max-w-[9.5rem] gap-1 rounded-full px-2.5 text-[13px] text-muted-foreground hover:text-foreground sm:h-9 sm:max-w-[13rem] sm:px-3"
        >
          {thinking && <Brain className="size-3.5 shrink-0 text-primary" aria-hidden />}
          {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
          <span className="truncate">{name}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={side} className="max-h-[min(34rem,var(--radix-dropdown-menu-content-available-height))] w-[min(20rem,calc(100vw-1.5rem))]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Model</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={model} onValueChange={onChange}>
          {picked && (
            <DropdownMenuRadioItem value={picked.id} className="items-start py-2">
              <span className="flex items-start gap-2">
                {picked.profile && <ProviderMark id={picked.profile.provider} label={picked.providerLabel ?? picked.profile.provider} className="mt-0.5 size-5 text-[9px]" />}
                <span>
                  <span className="block text-sm">{picked.name}</span>
                  <span className="block text-xs text-muted-foreground">{picked.providerLabel ? `${picked.providerLabel} · chosen by you` : "Chosen by you"}</span>
                </span>
              </span>
            </DropdownMenuRadioItem>
          )}
          {(router ? DEFAULT_MODELS : own).map((m) => {
            const KindIcon = "kind" in m && m.kind ? KIND_ICON[m.kind] : null
            const target = router ? data?.virtual[m.id] : null
            const blocked = m.id === "cyphor-god" && !godReady
            return (
              <DropdownMenuRadioItem key={m.id} value={m.id} disabled={blocked} className="items-start py-2">
                <span className="flex items-start gap-2">
                  {KindIcon && <KindIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span>
                    <span className="block text-sm">{m.name}</span>
                    {m.description && <span className="block text-xs text-muted-foreground">{m.description}</span>}
                    {blocked ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">Needs two connected providers.</span>
                    ) : (
                      target && (
                        <span className="mt-0.5 block text-xs text-primary">
                          Now: {target.providerLabel} · {target.name}
                        </span>
                      )
                    )}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={thinking}
          onCheckedChange={(v) => update({ extendedThinking: !!v })}
          onSelect={(e) => e.preventDefault()}
          className="items-start py-2"
        >
          <span>
            <span className="block text-sm">Extended thinking</span>
            <span className="block text-xs text-muted-foreground">Reasons step by step before answering</span>
          </span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {router && hasModels && (
          <DropdownMenuItem onSelect={() => openLibrary(onChange)}>
            <Library /> Browse all models
          </DropdownMenuItem>
        )}
        {router && (
          <DropdownMenuItem onSelect={() => openSettings("router")}>
            <Network /> Router settings
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => openSettings("model")}>
          <SlidersHorizontal /> Manage models
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
