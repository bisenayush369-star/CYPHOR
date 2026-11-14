---
description: Rules for screens and components
applyTo: 'components/**'
---

# Components

Screens, settings and design rules are in `docs/UI-AND-DESIGN.md`; the tokens are in `DESIGN.md` and `app/globals.css`.

- `components/ui/` is shadcn library code. Do not restyle it. Add a component with `npx shadcn@latest add <name>`; style from the app's own components.
- Use token classes (`bg-background`, `text-muted-foreground`, `border`). Do not write a hex colour in a component.
- An icon-only button uses `IconButton` (`components/icon-button.tsx`) and gives it a `label`. Keep focus visible.
- New motion must be silent when `effectsLevel()` (`lib/motion.ts`) is `off`.
- Read the store with a selector: `useStore((s) => s.settings.theme)`. Do not subscribe to the whole store.
- Touch screens: controls keep a comfortable size (`pointer-coarse:` styles). The sidebar docks from 1024 px (`lg`) and is a drawer below.
- After a layout change run `npx tsc --noEmit` and the browser tests at desktop and phone size: `npx playwright test --project=desktop --project=phone`.
