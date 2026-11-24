---
description: Rules for screens and components
applyTo: 'components/**'
---

# Components

Colours, type, shapes, motion and accessibility rules are in `DESIGN.md`. The tokens are in `DESIGN.md`, `app/globals.css` and `app/palettes.css` (generated).

- `components/ui/` is shadcn library code. Do not restyle it. Add a component with `npx shadcn@latest add <name>`; style from the app's own components.
- Use token classes (`bg-background`, `text-muted-foreground`, `border`) and the eight genre colours (yellow, cyan, red, magenta, violet, blue, orange, green) as classes (`text-cp-cyan`, `bg-cp-magenta`) or variables (`var(--c-cyan)`). Do not write a hex colour in a component. The eight themes change those variables, so a hard-coded colour does not follow the theme.
- An icon-only button uses `IconButton` (`components/icon-button.tsx`) and gives it a `label`. Keep focus visible.
- New motion must be silent when `effectsLevel()` (`lib/motion.ts`) is `off` and under `prefers-reduced-motion`.
- Read the store with a selector: `useStore((s) => s.settings.theme)`. Do not subscribe to the whole store.
- Touch screens: controls keep a comfortable size (40 px, `pointer-coarse:` styles). The sidebar docks from 1024 px (`lg`) and is a drawer below.
- The moving city's engine (`lib/scene/city/engine.ts`, which pulls in three.js) is loaded by `components/city-background.tsx` with a dynamic `import()`, so three.js stays out of the first load. Keep it that way: import the engine only with `import type` or `import()`.
- After a layout change run `npx tsc --noEmit --incremental false` and the browser tests at desktop and phone size: `npx playwright test --project=desktop --project=phone`.
