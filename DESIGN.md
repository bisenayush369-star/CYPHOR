---
version: alpha
name: Cyphor Night City
description: A cyberpunk console for talking to every model. Ink-black surfaces, one hard yellow for the main action, cyan for focus and live state, chamfered corners, and a live night city behind the chat that you can switch off. Eight colour themes. The palette and shapes follow Cyberpunk 2077; no game assets are used.
colors:
  # The eight genre colours. Every theme can draw on all of them (dark-scheme values).
  cp-yellow: "#fcee09"
  cp-cyan: "#00f0ff"
  cp-red: "#ff003c"
  cp-magenta: "#ff2a6d"
  cp-violet: "#9d4dff"
  cp-blue: "#2f6bff"
  cp-orange: "#ff7a00"
  cp-green: "#39ff88"
  # Daylight (light scheme). These are the same in every theme except the accent roles listed under Colors.
  primary: "#10131c"
  on-primary: "#fcee09"
  background: "#eceff5"
  foreground: "#0b0d14"
  card: "#f7f8fb"
  popover: "#fafbfd"
  secondary: "#e0e4ed"
  muted: "#e3e7ef"
  muted-foreground: "#4f576b"
  accent: "#d9deea"
  destructive: "#c4103f"
  border: "#cdd3e0"
  input: "#bcc4d4"
  ring: "#00778a"
  sidebar: "#e4e8f0"
  sidebar-accent: "#d9deea"
  sidebar-border: "#cdd3e0"
  signal: "#00737a"
  heat: "#c8002f"
  link: "#005e63"
  bubble: "#e3e8f2"
  code: "#e6eaf2"
  selection: "#b3d3dc"
  syntax-keyword: "#c22053"
  syntax-string: "#1a733d"
  syntax-number: "#a14d00"
  syntax-type: "#6c6604"
  syntax-function: "#006e75"
  syntax-attribute: "#813fd1"
  syntax-tag: "#285bd9"
  syntax-comment: "#5a627a"
  # Night (dark scheme), Night City theme. This is the default.
  dark-primary: "#fcee09"
  dark-on-primary: "#0a0b10"
  dark-background: "#090b12"
  dark-foreground: "#e8ecf6"
  dark-card: "#0f121b"
  dark-popover: "#0b0e16"
  dark-secondary: "#161a26"
  dark-muted: "#121622"
  dark-muted-foreground: "#8d96ae"
  dark-accent: "#1b2030"
  dark-destructive: "#ff3d7a"
  dark-border: "#232838"
  dark-input: "#2b3248"
  dark-ring: "#00f0ff"
  dark-sidebar: "#05060b"
  dark-sidebar-accent: "#121623"
  dark-sidebar-border: "#1a1f2d"
  dark-signal: "#00f0ff"
  dark-heat: "#ff003c"
  dark-link: "#4df3ff"
  dark-bubble: "#101728"
  dark-code: "#070910"
  dark-selection: "#065059"
  dark-syntax-keyword: "#ff2c6e"
  dark-syntax-string: "#39ff88"
  dark-syntax-number: "#ff7a00"
  dark-syntax-type: "#fcee09"
  dark-syntax-function: "#00f0ff"
  dark-syntax-attribute: "#a861ff"
  dark-syntax-tag: "#4c80ff"
  dark-syntax-comment: "#7d89ab"
  # The other seven themes: the colour that leads in the dark scheme.
  redline-primary: "#ff003c"
  neon-rain-primary: "#00f0ff"
  afterglow-primary: "#ff2a6d"
  toxic-primary: "#39ff88"
  voltage-primary: "#4d7cff"
  solar-primary: "#ff7a00"
  violet-dusk-primary: "#a855ff"
  theme-on-primary: "#0a0b10"
typography:
  display:
    fontFamily: Oxanium
    fontSize: 43.2px
    fontWeight: 600
    lineHeight: 1.12
  display-sm:
    fontFamily: Oxanium
    fontSize: 30.4px
    fontWeight: 600
    lineHeight: 1.12
  headline-lg:
    fontFamily: Oxanium
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0.005em
  headline-md:
    fontFamily: Oxanium
    fontSize: 20.5px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0.005em
  headline-sm:
    fontFamily: Oxanium
    fontSize: 17.6px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0.005em
  body-reply:
    fontFamily: Schibsted Grotesk
    fontSize: 16.5px
    fontWeight: 400
    lineHeight: 1.65
  body-ui:
    fontFamily: Schibsted Grotesk
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  body-table:
    fontFamily: Schibsted Grotesk
    fontSize: 14.4px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: Oxanium
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.43
    letterSpacing: 0.02em
  hud:
    fontFamily: Oxanium
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.1em
  caption:
    fontFamily: Schibsted Grotesk
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: Spline Sans Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.65
rounded:
  sm: 1px
  md: 2px
  lg: 3px
  xl: 4px
  2xl: 6px
  3xl: 8px
  full: 9999px
  # Chamfer sizes (how far the two cut corners are cut). The format has no chamfer field, so they are listed here.
  cut-sm: 6px
  cut: 10px
  cut-lg: 16px
  cut-xl: 24px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  control: 36px
  touch-target: 40px
  column: 46rem
  sidebar: 16rem
  sidebar-drawer: 18rem
  sidebar-rail: 3rem
  settings-nav: 14rem
  settings-dialog-max: 56rem
components:
  page: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.body-ui}" }
  page-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}" }
  greeting: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.display}" }
  greeting-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-foreground}", typography: "{typography.display-sm}" }
  reply: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.body-reply}", width: "{spacing.column}" }
  reply-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-foreground}", typography: "{typography.body-reply}", width: "{spacing.column}" }
  reply-heading: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.headline-lg}" }
  message-user: { backgroundColor: "{colors.bubble}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-sm}", padding: 10px }
  message-user-dark: { backgroundColor: "{colors.dark-bubble}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-sm}", padding: 10px }
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.label}", rounded: "{rounded.cut-sm}", height: "{spacing.control}", padding: 16px }
  button-primary-dark: { backgroundColor: "{colors.dark-primary}", textColor: "{colors.dark-on-primary}", typography: "{typography.label}", rounded: "{rounded.cut-sm}", height: "{spacing.control}", padding: 16px }
  button-secondary: { backgroundColor: "{colors.secondary}", textColor: "{colors.foreground}", typography: "{typography.label}", rounded: "{rounded.cut-sm}", height: "{spacing.control}", padding: 16px }
  button-secondary-dark: { backgroundColor: "{colors.dark-secondary}", textColor: "{colors.dark-foreground}", typography: "{typography.label}", rounded: "{rounded.cut-sm}", height: "{spacing.control}", padding: 16px }
  button-ghost-hover: { backgroundColor: "{colors.accent}", textColor: "{colors.foreground}", typography: "{typography.label}", rounded: "{rounded.cut-sm}", height: "{spacing.control}" }
  button-ghost-hover-dark: { backgroundColor: "{colors.dark-accent}", textColor: "{colors.dark-foreground}", typography: "{typography.label}", rounded: "{rounded.cut-sm}", height: "{spacing.control}" }
  chip: { backgroundColor: "{colors.card}", textColor: "{colors.muted-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-sm}", height: "{spacing.control}", padding: 14px }
  chip-dark: { backgroundColor: "{colors.dark-card}", textColor: "{colors.dark-muted-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-sm}", height: "{spacing.control}", padding: 14px }
  input: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-sm}", height: "{spacing.control}", padding: 12px }
  input-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-sm}", height: "{spacing.control}", padding: 12px }
  composer: { backgroundColor: "{colors.card}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-lg}", width: "{spacing.column}" }
  composer-dark: { backgroundColor: "{colors.dark-card}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-lg}", width: "{spacing.column}" }
  card: { backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.cut}", padding: 16px }
  card-dark: { backgroundColor: "{colors.dark-card}", textColor: "{colors.dark-foreground}", rounded: "{rounded.cut}", padding: 16px }
  popover: { backgroundColor: "{colors.popover}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-sm}", padding: 4px }
  popover-dark: { backgroundColor: "{colors.dark-popover}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.cut-sm}", padding: 4px }
  note-muted: { backgroundColor: "{colors.muted}", textColor: "{colors.muted-foreground}", typography: "{typography.caption}", rounded: "{rounded.cut-sm}", padding: 8px }
  note-muted-dark: { backgroundColor: "{colors.dark-muted}", textColor: "{colors.dark-muted-foreground}", typography: "{typography.caption}", rounded: "{rounded.cut-sm}", padding: 8px }
  sidebar: { backgroundColor: "{colors.sidebar}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", width: "{spacing.sidebar}" }
  sidebar-dark: { backgroundColor: "{colors.dark-sidebar}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", width: "{spacing.sidebar}" }
  sidebar-item-active: { backgroundColor: "{colors.sidebar-accent}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", height: "{spacing.control}" }
  sidebar-item-active-dark: { backgroundColor: "{colors.dark-sidebar-accent}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", height: "{spacing.control}" }
  code-block: { backgroundColor: "{colors.code}", textColor: "{colors.foreground}", typography: "{typography.code}", rounded: "{rounded.cut-sm}", padding: 14px }
  code-block-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-foreground}", typography: "{typography.code}", rounded: "{rounded.cut-sm}", padding: 14px }
  syntax-keyword: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-keyword}", typography: "{typography.code}" }
  syntax-string: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-string}", typography: "{typography.code}" }
  syntax-number: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-number}", typography: "{typography.code}" }
  syntax-type: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-type}", typography: "{typography.code}" }
  syntax-function: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-function}", typography: "{typography.code}" }
  syntax-attribute: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-attribute}", typography: "{typography.code}" }
  syntax-tag: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-tag}", typography: "{typography.code}" }
  syntax-comment: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-comment}", typography: "{typography.code}" }
  syntax-keyword-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-keyword}", typography: "{typography.code}" }
  syntax-string-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-string}", typography: "{typography.code}" }
  syntax-number-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-number}", typography: "{typography.code}" }
  syntax-type-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-type}", typography: "{typography.code}" }
  syntax-function-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-function}", typography: "{typography.code}" }
  syntax-attribute-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-attribute}", typography: "{typography.code}" }
  syntax-tag-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-tag}", typography: "{typography.code}" }
  syntax-comment-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-comment}", typography: "{typography.code}" }
  link: { backgroundColor: "{colors.background}", textColor: "{colors.link}", typography: "{typography.body-reply}" }
  link-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-link}", typography: "{typography.body-reply}" }
  live-state: { backgroundColor: "{colors.background}", textColor: "{colors.signal}", typography: "{typography.hud}" }
  live-state-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-signal}", typography: "{typography.hud}" }
  error-text: { backgroundColor: "{colors.background}", textColor: "{colors.destructive}", typography: "{typography.body-ui}" }
  error-text-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-destructive}", typography: "{typography.body-ui}" }
  danger-mark: { backgroundColor: "{colors.background}", textColor: "{colors.heat}", typography: "{typography.hud}" }
  danger-mark-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-heat}", typography: "{typography.hud}" }
  plate: { backgroundColor: "{colors.cp-yellow}", textColor: "{colors.dark-on-primary}", typography: "{typography.hud}", rounded: "{rounded.cut-sm}", padding: 8px }
  hairline: { backgroundColor: "{colors.border}", height: 1px }
  hairline-dark: { backgroundColor: "{colors.dark-border}", height: 1px }
  field-edge: { backgroundColor: "{colors.input}", height: 1px }
  field-edge-dark: { backgroundColor: "{colors.dark-input}", height: 1px }
  focus-ring: { backgroundColor: "{colors.ring}", height: 2px }
  focus-ring-dark: { backgroundColor: "{colors.dark-ring}", height: 2px }
  sidebar-edge: { backgroundColor: "{colors.sidebar-border}", width: 1px }
  sidebar-edge-dark: { backgroundColor: "{colors.dark-sidebar-border}", width: 1px }
  text-selection: { backgroundColor: "{colors.selection}", textColor: "{colors.foreground}" }
  text-selection-dark: { backgroundColor: "{colors.dark-selection}", textColor: "{colors.dark-foreground}" }
  provider-edge-cyan: { backgroundColor: "{colors.cp-cyan}", height: 1px }
  provider-edge-green: { backgroundColor: "{colors.cp-green}", height: 1px }
  provider-edge-orange: { backgroundColor: "{colors.cp-orange}", height: 1px }
  provider-edge-violet: { backgroundColor: "{colors.cp-violet}", height: 1px }
  provider-edge-blue: { backgroundColor: "{colors.cp-blue}", height: 1px }
  failing-edge: { backgroundColor: "{colors.cp-red}", height: 1px }
  focus-ring-neon-rain: { backgroundColor: "{colors.cp-magenta}", height: 2px }
  theme-redline: { backgroundColor: "{colors.redline-primary}", textColor: "{colors.theme-on-primary}", typography: "{typography.label}" }
  theme-neon-rain: { backgroundColor: "{colors.neon-rain-primary}", textColor: "{colors.theme-on-primary}", typography: "{typography.label}" }
  theme-afterglow: { backgroundColor: "{colors.afterglow-primary}", textColor: "{colors.theme-on-primary}", typography: "{typography.label}" }
  theme-toxic: { backgroundColor: "{colors.toxic-primary}", textColor: "{colors.theme-on-primary}", typography: "{typography.label}" }
  theme-voltage: { backgroundColor: "{colors.voltage-primary}", textColor: "{colors.theme-on-primary}", typography: "{typography.label}" }
  theme-solar: { backgroundColor: "{colors.solar-primary}", textColor: "{colors.theme-on-primary}", typography: "{typography.label}" }
  theme-violet-dusk: { backgroundColor: "{colors.violet-dusk-primary}", textColor: "{colors.theme-on-primary}", typography: "{typography.label}" }
---

# Cyphor Night City

## Overview

Cyphor is one console for every model you have a key for. It sends each question to the model that suits it, switches provider when one is down, and can ask several models at once and merge their answers. The interface is built to look like a night in a cyberpunk city and to stay readable while it does.

The reference is **Cyberpunk 2077**, taken for its colours and its shapes only. No game artwork, logo, typeface or screenshot is used anywhere; the city behind the chat is drawn by code, from the palette in this file.

Five decisions give it its face:

- **One shape: the chamfer.** Two opposite corners of every panel are cut at 45 degrees, the way the game cuts its menu plates. Nothing is a pill, and nothing has a soft radius bigger than 8 px.
- **A hard yellow for the main action.** Acid yellow on ink-black is the button you press. Cyan is the colour of focus and of anything live. Red is for danger and for nothing else.
- **Every colour of the genre is used, each for one job.** Yellow, cyan, red, magenta, violet, blue, orange and green all appear: as code colours, provider colours, the lights of the city, and the eight themes. None is decoration.
- **A city that moves, and a way to not have it.** A three.js night city (a wet street of towers, neon signs, rain, cars and flying cars) runs behind the chat. It is asked about once, it can be switched off in Settings, and when it is off a different theme loads on every refresh. See Motion & Effects.
- **Labels in capitals, words in sentences.** Tabs, buttons and small tags are set in Oxanium capitals with wide tracking, like the game's menus. Everything you read, including every reply, is set in sentence case in Schibsted Grotesk.

Cyphor is the same product on every device. The layout reshapes (see Layout); the colour, shape and behaviour do not.

## Colors

The palette comes from one table, `lib/scene/palettes.ts`. The stylesheet `app/palettes.css` is generated from it with `npm run build:palettes`, and a unit test fails if the two drift apart. Token names here match the CSS custom properties in `app/globals.css`, so `primary` is `--primary` and `muted-foreground` is `--muted-foreground`. Several shadcn roles equal `foreground` and are not repeated: `card-foreground`, `popover-foreground`, `secondary-foreground`, `accent-foreground` and `sidebar-foreground`.

**The eight genre colours** (dark-scheme values; on the light scheme each is darkened until it reads on the page):

| Name | Value | Its job |
| --- | --- | --- |
| Yellow | #fcee09 | The main action, the logo, active bars, the hazard stripe, plates |
| Cyan | #00f0ff | Focus rings, live state, links, network information |
| Red | #ff003c | Danger, failure, warnings |
| Magenta | #ff2a6d | Keywords in code, hot signs in the city |
| Violet | #9d4dff | Attributes in code, billboards and haze |
| Blue | #2f6bff | Tags in code, electric signs, the cold side of the sky |
| Orange | #ff7a00 | Numbers in code, sodium lamps, the warm side of the sky |
| Green | #39ff88 | Strings in code, "go" states, data streams |

**Two schemes.** *Night* (dark) is the home of the design and the only scheme the city runs in. *Daylight* (light) is a cool grey-white, not cream, with ink as the primary colour and yellow as the text on it. In Daylight the city is not drawn and Settings says so.

**Eight themes.** A theme chooses which genre colour leads (`primary`), which is the signal colour (`signal`: focus, live, links) and which is the danger colour (`heat`), and it tints the ink behind them a few percent toward its lead colour. The other colours stay available to every theme.

| Theme | Leads | Signal | Danger |
| --- | --- | --- | --- |
| Night City (default) | yellow | cyan | red |
| Redline | red | yellow | orange |
| Neon Rain | cyan | magenta | red |
| Afterglow | magenta | violet | orange |
| Toxic | green | yellow | magenta |
| Voltage | blue #4d7cff | cyan | magenta |
| Solar Flare | orange | yellow | red |
| Violet Dusk | violet #a855ff | magenta | orange |

A setting stores one theme or "Every refresh", which loads a different theme on each page load and never the one shown last time. A small inline script (`lib/no-flash.ts`) sets `data-palette` on the page before it paints, so a theme never flashes.

**Roles.**

- **Primary:** yellow on Night City dark; ink (#10131c) on Daylight, with yellow text on it. The single most important action in a view. Text on a dark primary is `on-primary`, near-black.
- **Background, card, popover:** ink-black surfaces, each a small step lighter than the one under it (dark) or lighter (light). The composer, cards, menus and dialogs use them.
- **Secondary, muted, accent:** quiet fills for buttons, notes, hover states and the active tab.
- **Muted foreground:** secondary text such as timestamps and hints.
- **Signal:** the cyan that means "this is live or focused". It is also the focus ring.
- **Heat:** red, only for failure and danger. In the router strip a failing provider is a hollow red square, so the state is not carried by colour alone.
- **Marker:** the fill of the logo and active bars. It is a fill, never text on a light surface.
- **Border and input:** one-pixel hairlines. Depth comes from these and from tone.
- **Sidebar family:** the sidebar sits a little apart from the page; in dark it is darker than the page, like a margin.
- **Code and syntax:** one genre colour per kind of token (keyword magenta, string green, number orange, type yellow, function cyan, attribute violet, tag blue, error red), each lightened or darkened until it reads on the code surface.
- **Provider colours:** each provider is told apart by colour as well as by name. Five hues are used (cyan, green, orange, violet, blue), assigned in the order the router lists providers (`lib/scene/hue.ts`). Red and yellow are left out because they mean "failing" and "resting" in the router strip. Magenta is left out because it reads as red next to them. With more than five connected providers two can share a hue; the name is always beside the colour.

**Measured contrast** for the default theme (computed with `lib/scene/color.ts`, the same function the unit tests use):

| Pair | Night | Daylight |
| --- | --- | --- |
| foreground on background | 16.6:1 | 16.9:1 |
| muted-foreground on background | 6.7:1 | 6.3:1 |
| muted-foreground on card | 6.3:1 | 6.8:1 |
| muted-foreground on muted | 6.1:1 | 5.8:1 |
| on-primary on primary (buttons) | 16.3:1 | 15.3:1 |
| link on background | 14.6:1 | 6.6:1 |
| signal (live text) on background | 14.0:1 | 4.9:1 |
| focus ring on background (non-text) | 14.0:1 | 4.6:1 |
| destructive on background | 5.8:1 | 5.2:1 |
| lowest code colour on the code surface | 5.5:1 | 4.8:1 |
| field edge (input) on background | 1.5:1 | 1.5:1 |

Across all eight themes in both schemes the lowest text pair measured by `worstContrast()` in `lib/scene/palette-css.ts` is 4.9:1, and `tests/unit/palettes.test.ts` fails if secondary text, signal text or danger text drops under 4.5:1 on any surface in any theme. The last row is a **known gap**, explained under Accessibility.

## Typography

Four families, each with one job, and two optional ones for readers who want them.

- **Oxanium** (a squared techno face) sets the greeting, the headings inside replies, buttons, tabs and every HUD label.
- **Schibsted Grotesk** sets the interface text, your own messages, tables, and the replies.
- **Spline Sans Mono** sets code, and only code.
- **Literata** (serif) and **Atkinson Hyperlegible Next** are choices in Settings > Appearance ("Serif" and "Easy to read") for the reply text. The default is Schibsted Grotesk.

Replies are the product: **16.5 px at a line height of 1.72** (1.65 in the sans and easy-to-read options), in a column **46 rem** wide. Headings inside a reply run 24, 20.5, 17.6 and 16 px at weight 600. The home greeting is 43 px on a desktop and 30 px on a phone, and its lines are balanced so one word never hangs alone.

Body text is 15 px, captions 13 px, and the smallest text anywhere is 11 px: HUD labels and the plates. Nothing is set below 11 px. On touch screens every text input is at least 16 px so iOS does not zoom the page when it is focused.

**HUD type** is capitals with 0.1em tracking, in Oxanium at weight 600. It is a style applied by CSS (`.hud`), not typed capitals, so a screen reader reads normal words. It is used on tabs, buttons, plates and short group labels, never on a sentence and never as a small label above a heading.

Fallback stacks keep Devanagari working: Noto Sans Devanagari follows the sans stack and Noto Serif Devanagari follows the serif stack.

## Layout

Spacing follows a **4 px unit**. Buttons are **36 px** tall and grow to **40 px** on touch screens (`pointer-coarse`), which is the target size for anything you tap. The two extra-small button variants, for dense inline actions, are 36 px and 32 px on touch. No test measures tap targets, so check a new control by hand.

The reading column is **46 rem** wide and centred. Messages, the composer and the home greeting share it.

The shell reshapes at a few widths:

- **1024 px and up (docked).** The sidebar is **16 rem** wide and stays open. An artifact opens beside the chat in a resizable split: the chat is 54% by default and never narrower than 30%; the artifact is 46%, between 28% and 68%.
- **Below 1024 px (drawer).** The sidebar becomes an **18 rem** drawer. An artifact opens full screen with a Back button, and only when you open its card.
- **Settings.** Below 640 px it is a full-screen sheet. From 640 px it is a centred dialog up to **56 rem** wide and 44 rem tall. Its ten sections are a scrolling strip below 768 px and a **14 rem** side navigation from 768 px.
- **Login.** From 1024 px it is two parts, a statement and the skyline on the left and the form on the right. Below that it is one column with the form first.

Phones are a first-class target. The app height follows the visual viewport so the composer stays above the on-screen keyboard, safe-area insets pad the edges, and nothing scrolls sideways from 320 px up.

**The city sits behind everything.** It is a fixed layer below the page (`z-index: -1`). Over it, the reading column keeps a dark, mostly opaque wash and the sides stay thin so the street shows. The sidebar and the artifact panel keep their solid backgrounds. Nothing blurs the canvas.

## Elevation & Depth

Cyphor is **tonal and hairline**. Layers are told apart by a step in tone and a one-pixel edge: page, then card, then popover. Two shadows exist, `--elev-composer` and `--elev-pop`, both offset downward with a soft blur and a one-pixel dark ring in the dark scheme.

**Nothing glows at rest.** A light appears only while something is in use: the composer gets a cyan halo while it has focus (`.focus-glow`), a running segment travels down the route trace while a reply streams, and a panel's two uncut corners get **brackets** when it has focus or is switched on. The light means "you are here".

A clip-path also clips shadows and outlines, which is why the halo goes on a wrapper around the panel, and why a focus ring is drawn inside the shape.

## Shapes

One shape, and a handful of sizes for it.

- **The chamfer (`.cut`).** Top-right and bottom-left corners cut at 45 degrees. Because a clip-path removes the border along the cut, the edge is drawn another way: the element's own background is the edge colour (`--edge`) and a `::before` one pixel smaller on every side, cut the same way, paints the fill (`--fill`). Content sits above both.
- **Sizes:** 6 px (`cut-sm`: buttons, menus, chips, inputs), 10 px (`cut`: cards), 16 px (`cut-lg`: the composer and the login card), 24 px (`cut-xl`).
- **`.chamfer`** cuts the corners only, for an image that cannot hold a `::before`.
- **Brackets (`.brackets`).** Two L-shaped marks, 12 px with a 2 px stroke, on the two corners that were not cut. They appear on focus.
- **Plate (`.plate`).** A small yellow tag with cut corners for something that has to be seen: God Mode, a new item, an artifact's type.
- **Hazard stripe (`.hazard`).** Yellow and black diagonal stripes. It is used once, on the God Mode composer.
- **Radii** that remain are tiny: 1, 2, 3, 4, 6 and 8 px, and a full circle for avatars, switches and radio buttons.

## Components

Every component below exists in both schemes. The dark tokens carry the `dark-` prefix.

- **Primary button:** yellow fill (ink on Daylight), 36 px tall, a 6 px chamfer, HUD label. One per view.
- **Secondary and ghost buttons:** `secondary` fill, or transparent until hover or focus.
- **Prompt chip:** a chamfered chip on `card` with muted text and a hairline edge. On the home screen the chips scroll sideways on a narrow screen rather than wrapping.
- **Composer:** a 16 px chamfered card at the bottom of the chat. It holds the text area, the attach menu, tool toggles, the model button and the send or stop button. Its edge lights and its brackets appear on focus.
- **Model picker:** the button in the composer reads "Cyphor Auto", then the effort. It opens a popover headed "Choose a model" with one row per Cyphor model (Auto, Swift, Core, Deep, Code, God Mode), each with a one-line description; the selected row also says which real model the name stands for. "Effort" (Low, Medium, High) and "More models" (a searchable list of every connected model) are sub-views, and "Compare ratings" opens the model library.
- **Thinking block:** with Medium (the default) or High effort, the reply starts with a "Thinking" block that is open while the model works, shows the reasoning as it arrives with a running clock, and folds into "Thought for 12s" when the answer starts. Low effort answers immediately and shows none.
- **Router strip:** on the home screen, "Router online" with a static dot, then a square and the name of each connected provider in its colour. A failing provider is a hollow red square.
- **Route chip and route info:** under a reply, a chip names the model that answered. It opens "How this reply was made": who chose the model, which providers were tried, and why a fallback happened.
- **Your message:** a chamfered bubble up to 84% of the column on a desktop and 92% on a phone. Edit and copy sit under it.
- **Assistant reply:** no bubble. Text directly on the page, with copy, rate and try-again actions underneath. Retrying or editing makes a new branch, and a small version switcher moves between them.
- **Artifact card:** a compact card in the chat (a tile, the title, the type and the version) that opens the artifact. While it is being written the tile shows the live signal mark.
- **Artifact panel:** a **Preview**, **Code** and (when the panel is at least 880 px wide) **Split** switch, a version picker, **Copy code**, Download, Reload preview, full screen and Close. Previews run in a sandboxed frame that can run scripts but has no access to the app's storage or cookies.
- **Code block:** a header with the language, a wrap toggle and a copy button; 13 px mono at 1.65.
- **First-run card:** asked once, the first time an account opens the app: "Keep the moving city?" with the buttons "Keep the city" and "No city, change themes". If this browser cannot run the city (no WebGL, or graphics drawn on the CPU), the card says so in a note beside an info icon, and the second button is the one that does something.
- **Settings > Appearance:** a **Background** choice (Moving city, No background), a **Colour theme** choice (the eight themes and "Every refresh"), the colour scheme, the reply font, and Effects. Under the background choice a status line says what the city is doing, or why it is not running.
- **Login:** tabs for **Sign in** and **Create account**, a "Continue with Google" button that appears only when Google is set up on the server, and email and password fields. Errors say what is wrong in words and put the cursor in the field.
- **Sidebar:** brand, New chat, Search, Chats, Projects, Artifacts, then chats grouped by time. A newly named chat resolves out of scrambled letters, once. The account menu at the bottom holds Settings and Sign out.
- **Command palette:** Ctrl or Cmd + K. Searches chat titles and message text and offers commands.
- **Error note:** a heat-coloured edge and a light wash. It always says what happened and what to do next.

## Motion & Effects

Motion answers something you did or shows that something is happening. Everything respects the **Effects** setting (Full, Subtle, Off) and the operating system's reduced-motion preference. With either set to reduce, entrance delays and loops are removed, and the city draws one still frame and then stops.

- **The city.** A three.js scene in its own lazy chunk (`lib/scene/city`). Nothing of it loads unless the city is on, and it starts only after the app has painted. The camera glides down an endless street at night: towers with lit windows and neon edges, signs and billboards (some in Japanese when a Japanese font is installed), lamps and rooftop beacons, a wet mirror-like road, cars and flying cars with head and tail lights, rain, fog and a bloom pass. New blocks are built as old ones pass behind the camera, so the street never repeats. The colours come from the current theme, and changing theme recolours the city live.
- **The quality governor.** A small governor (`lib/scene/city/governor.ts`) watches frame times. If frames are slow it steps the quality down (high, medium, low) within a second or two; if even low is too slow it switches the city off for that tab and Settings says why. It never steps back up in the same session. A browser that draws WebGL on the CPU is refused up front, because it could not draw a frame fast enough to be anything but a freeze.
- **Test pin.** `?city=low|medium|high` fixes the quality for the tab and turns the governor off. It exists for tests and screenshots on machines with no graphics card.
- **The glitch.** A short burst of colour fringing on the wordmark and the home greeting, a few times a minute (once per hover on links).
- **The route trace.** A hairline beside a reply with a bright segment that runs down it while the reply streams.
- **Thinking.** The block opens while the model reasons and folds away when it stops. The "Thinking" and "Writing" labels have a light sweep while a reply is on its way.
- **Decode.** A new chat title resolves out of scrambled letters, once.
- **Rise.** Content on a new screen rises in with a short stagger.
- **Theme change.** Switching between Daylight and Night wipes the new scheme across the screen as a clockwise sweep that starts at the point you clicked (View Transitions API, 780 ms).
- **Press feedback.** Round buttons dip to 93% scale and return with an exponential ease-out in 160 ms. There is no overshoot anywhere.
- **Not used:** blinking cursors, pulsing status dots that are always on, gradient text, parallax, and marquee text.

Streaming text is committed about every 60 ms rather than on every chunk, which keeps long replies smooth on slow phones.

## Accessibility

The interface is checked with axe-core against WCAG 2.0, 2.1 and 2.2 levels A and AA plus axe's best-practice rules, in both schemes, on desktop and phone, across home, chat, tables, code, artifacts, the command palette, the login page (both tabs and an error state), the first-run card and every Settings section.

- Text pairs are at least 4.5:1 in every theme and both schemes: `worstContrast()` measures 4.9:1 at the lowest, and unit tests enforce 4.5:1 for secondary, signal and danger text. The focus ring is at least 3:1 (14.0:1 on Night, 4.6:1 on Daylight for the default theme), and a unit test reads the stylesheet to keep it so.
- Every control has an accessible name that starts with, or equals, its visible text.
- Landmarks are named and unique. There is exactly one `h1` per screen.
- Dialogs trap focus, restore it when they close and close with one Escape.
- Tabs and radio groups move with the arrow keys. The login tabs, the Background choice and the Colour theme choice are all operable without a pointer.
- The city and its canvas are `aria-hidden`. The page is fully usable, and reads the same, with the city off or refused.
- A provider's state is never carried by colour alone: a failing provider is a hollow square and the word "failing" is in its accessible name.
- Tooltips appear only where a pointer can hover. Touch screens get larger tap targets instead.
- Keyboard shortcuts are listed in Settings and are never the only way to do anything.

**Known gap.** The resting edge of a text field, a button or a panel is a hairline about 1.5:1 against its surface. WCAG 2.2 success criterion 1.4.11 (non-text contrast) asks 3:1 for the edge of a control when the edge is the only thing that identifies it. Here every field also has a visible label or placeholder, and its edge turns signal-coloured with corner brackets on focus, but a strict reading would still ask for a stronger resting edge. The fix is a separate `--field-edge` token used by fields only (`components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`), set to at least 3:1; it is deliberately not done by raising `--input`, which also draws the edge of the composer, menus and dialogs and would make every panel heavy.

## Do's and Don'ts

- Do use the chamfer for every panel, button and chip. Use `--edge` and `--fill` on a `.cut`, not `bg-*` and `border-*`, because a `bg-*` paints over the edge.
- Do use yellow for the one most important action in a view and cyan for focus and live state. Use red for failure and danger only.
- Do give a new colour a job. If a colour does not mean something, it does not go in the UI.
- Do separate layers with a tone step and a hairline before reaching for a shadow.
- Do keep every tap target at least 40 px and every text input at least 16 px on touch screens.
- Do give a new control a name that contains the text people can see, and keep that name the same through the whole flow.
- Do check any new colour pair for 4.5:1 in both schemes and in all eight themes before using it for text. `worstContrast()` does it for the generated palette.
- Do add a theme by adding one entry to `lib/scene/palettes.ts` and running `npm run build:palettes`. Never edit `app/palettes.css` by hand.
- Don't glow anything at rest. A light means focus or live.
- Don't put a coloured stripe thicker than 1 px on the side of a card, note or list item. A blockquote in a reply is the one exception.
- Don't use gradient text, glass, decorative blur, bounce or overshoot easing, always-on pulsing dots or blinking cursors.
- Don't set a small capitalised label above a heading. HUD type is for tabs, buttons, plates and short group labels.
- Don't use more than two type families on one surface. Mono is for code only.
- Don't use red or yellow as a provider's colour. They mean "failing" and "resting".
- Don't add motion that loops forever and cannot be turned off. The city and the glitch both follow Effects and reduced motion.
- Don't put a tooltip on the first focusable element of a dialog: its tooltip opens on focus and swallows the first Escape.
- Don't show a key, or any part of one, anywhere in the interface. The screens know the name of the variable that holds a key and nothing more.
- Don't present a model's scores as a measurement. They are estimates, and the copy around them should say where to start, not who wins.
- Don't use a provider's logo, or anything from Cyberpunk 2077 other than its colours and the idea of its shapes. The monogram is the same for every provider, so no one provider looks more official than another.
