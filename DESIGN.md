---
version: alpha
name: Cyphor Paper & Slate
description: A calm, reading-first chat interface. Warm paper by day, cool slate by night, serif replies, and a cipher dial as its one signature object.
colors:
  # Light theme, "Paper"
  primary: "#166657"
  on-primary: "#ffffff"
  background: "#f5f3ee"
  foreground: "#1a211f"
  card: "#fbfaf7"
  popover: "#fcfbf8"
  secondary: "#ece9e1"
  muted: "#ebe8df"
  muted-foreground: "#5b635d"
  accent: "#e8e4da"
  destructive: "#b3412f"
  border: "#e0dcd0"
  input: "#d6d1c3"
  sidebar: "#efece4"
  sidebar-accent: "#e5e1d6"
  sidebar-border: "#dcd7ca"
  brass: "#b58a3c"
  bubble: "#ece8de"
  code: "#efece3"
  selection: "#c6d8d1"
  syntax-keyword: "#17655a"
  syntax-string: "#85591a"
  syntax-number: "#a33b2a"
  syntax-builtin: "#2c5d8f"
  syntax-comment: "#646c66"
  # Dark theme, "Slate"
  dark-primary: "#5fb5a3"
  dark-on-primary: "#0f1b18"
  dark-background: "#171c1e"
  dark-foreground: "#e8e5dc"
  dark-card: "#1e2427"
  dark-popover: "#1e2427"
  dark-secondary: "#262d30"
  dark-muted: "#242b2d"
  dark-muted-foreground: "#9aa39e"
  dark-accent: "#2a3235"
  dark-destructive: "#e0705d"
  dark-border: "#2c3438"
  dark-input: "#364044"
  dark-sidebar: "#12171a"
  dark-sidebar-accent: "#20272a"
  dark-sidebar-border: "#232a2e"
  dark-brass: "#d2a85a"
  dark-bubble: "#242b2e"
  dark-code: "#12171a"
  dark-selection: "#2b4743"
  dark-syntax-keyword: "#7fd0be"
  dark-syntax-string: "#dcb36a"
  dark-syntax-number: "#ec9582"
  dark-syntax-builtin: "#8db6e6"
  dark-syntax-comment: "#8b948e"
typography:
  display:
    fontFamily: Literata
    fontSize: 38.4px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.025em
  display-sm:
    fontFamily: Literata
    fontSize: 29.6px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Literata
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1.28
    letterSpacing: -0.012em
  headline-md:
    fontFamily: Literata
    fontSize: 20.5px
    fontWeight: 650
    lineHeight: 1.28
    letterSpacing: -0.012em
  headline-sm:
    fontFamily: Literata
    fontSize: 17.6px
    fontWeight: 650
    lineHeight: 1.28
    letterSpacing: -0.012em
  body-reply:
    fontFamily: Literata
    fontSize: 16.5px
    fontWeight: 400
    lineHeight: 1.72
  body-user:
    fontFamily: Schibsted Grotesk
    fontSize: 15.5px
    fontWeight: 400
    lineHeight: 1.55
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
    fontFamily: Schibsted Grotesk
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: Schibsted Grotesk
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  micro:
    fontFamily: Schibsted Grotesk
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
  code:
    fontFamily: Spline Sans Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.65
rounded:
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
  2xl: 20px
  3xl: 24px
  composer: 1.6rem
  full: 9999px
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
  column: 40rem
  sidebar: 16rem
  sidebar-drawer: 18rem
  sidebar-rail: 3rem
  settings-nav: 14rem
  dialog-max: 56rem
components:
  page: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.body-ui}" }
  page-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}" }
  reply: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.body-reply}", width: "{spacing.column}" }
  reply-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-foreground}", typography: "{typography.body-reply}", width: "{spacing.column}" }
  message-user: { backgroundColor: "{colors.bubble}", textColor: "{colors.foreground}", typography: "{typography.body-user}", rounded: "{rounded.2xl}", padding: 10px }
  message-user-dark: { backgroundColor: "{colors.dark-bubble}", textColor: "{colors.dark-foreground}", typography: "{typography.body-user}", rounded: "{rounded.2xl}", padding: 10px }
  greeting: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.display}" }
  greeting-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-foreground}", typography: "{typography.display-sm}" }
  heading-reply: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.headline-lg}" }
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.label}", rounded: "{rounded.md}", height: "{spacing.control}", padding: 16px }
  button-primary-dark: { backgroundColor: "{colors.dark-primary}", textColor: "{colors.dark-on-primary}", typography: "{typography.label}", rounded: "{rounded.md}", height: "{spacing.control}", padding: 16px }
  button-secondary: { backgroundColor: "{colors.secondary}", textColor: "{colors.foreground}", typography: "{typography.label}", rounded: "{rounded.md}", height: "{spacing.control}", padding: 16px }
  button-secondary-dark: { backgroundColor: "{colors.dark-secondary}", textColor: "{colors.dark-foreground}", typography: "{typography.label}", rounded: "{rounded.md}", height: "{spacing.control}", padding: 16px }
  button-ghost-hover: { backgroundColor: "{colors.accent}", textColor: "{colors.foreground}", typography: "{typography.label}", rounded: "{rounded.md}", height: "{spacing.control}" }
  button-ghost-hover-dark: { backgroundColor: "{colors.dark-accent}", textColor: "{colors.dark-foreground}", typography: "{typography.label}", rounded: "{rounded.md}", height: "{spacing.control}" }
  button-send: { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", rounded: "{rounded.full}", size: "{spacing.control}" }
  chip: { backgroundColor: "{colors.card}", textColor: "{colors.muted-foreground}", typography: "{typography.label}", rounded: "{rounded.full}", height: "{spacing.control}", padding: 14px }
  chip-dark: { backgroundColor: "{colors.dark-card}", textColor: "{colors.dark-muted-foreground}", typography: "{typography.label}", rounded: "{rounded.full}", height: "{spacing.control}", padding: 14px }
  input: { backgroundColor: "{colors.background}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", rounded: "{rounded.md}", height: "{spacing.control}", padding: 12px }
  input-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.md}", height: "{spacing.control}", padding: 12px }
  composer: { backgroundColor: "{colors.card}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", rounded: "{rounded.composer}", width: "{spacing.column}" }
  composer-dark: { backgroundColor: "{colors.dark-card}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.composer}", width: "{spacing.column}" }
  card: { backgroundColor: "{colors.card}", textColor: "{colors.foreground}", rounded: "{rounded.xl}", padding: 16px }
  card-dark: { backgroundColor: "{colors.dark-card}", textColor: "{colors.dark-foreground}", rounded: "{rounded.xl}", padding: 16px }
  artifact-card: { backgroundColor: "{colors.card}", textColor: "{colors.foreground}", typography: "{typography.label}", rounded: "{rounded.2xl}", padding: 12px }
  artifact-tile: { backgroundColor: "{colors.muted}", textColor: "{colors.primary}", rounded: "{rounded.xl}", size: 44px }
  artifact-tile-dark: { backgroundColor: "{colors.dark-muted}", textColor: "{colors.dark-primary}", rounded: "{rounded.xl}", size: 44px }
  note-muted: { backgroundColor: "{colors.muted}", textColor: "{colors.muted-foreground}", typography: "{typography.caption}", rounded: "{rounded.md}", padding: 8px }
  note-muted-dark: { backgroundColor: "{colors.dark-muted}", textColor: "{colors.dark-muted-foreground}", typography: "{typography.caption}", rounded: "{rounded.md}", padding: 8px }
  popover: { backgroundColor: "{colors.popover}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", rounded: "{rounded.md}", padding: 4px }
  popover-dark: { backgroundColor: "{colors.dark-popover}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.md}", padding: 4px }
  sidebar: { backgroundColor: "{colors.sidebar}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", width: "{spacing.sidebar}" }
  sidebar-dark: { backgroundColor: "{colors.dark-sidebar}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", width: "{spacing.sidebar}" }
  sidebar-item-active: { backgroundColor: "{colors.sidebar-accent}", textColor: "{colors.foreground}", typography: "{typography.body-ui}", rounded: "{rounded.md}", height: "{spacing.control}" }
  sidebar-item-active-dark: { backgroundColor: "{colors.dark-sidebar-accent}", textColor: "{colors.dark-foreground}", typography: "{typography.body-ui}", rounded: "{rounded.md}", height: "{spacing.control}" }
  code-block: { backgroundColor: "{colors.code}", textColor: "{colors.foreground}", typography: "{typography.code}", rounded: "{rounded.xl}", padding: 14px }
  code-block-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-foreground}", typography: "{typography.code}", rounded: "{rounded.xl}", padding: 14px }
  syntax-keyword: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-keyword}", typography: "{typography.code}" }
  syntax-string: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-string}", typography: "{typography.code}" }
  syntax-number: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-number}", typography: "{typography.code}" }
  syntax-builtin: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-builtin}", typography: "{typography.code}" }
  syntax-comment: { backgroundColor: "{colors.code}", textColor: "{colors.syntax-comment}", typography: "{typography.code}" }
  syntax-keyword-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-keyword}", typography: "{typography.code}" }
  syntax-string-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-string}", typography: "{typography.code}" }
  syntax-number-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-number}", typography: "{typography.code}" }
  syntax-builtin-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-builtin}", typography: "{typography.code}" }
  syntax-comment-dark: { backgroundColor: "{colors.dark-code}", textColor: "{colors.dark-syntax-comment}", typography: "{typography.code}" }
  error-text: { backgroundColor: "{colors.background}", textColor: "{colors.destructive}", typography: "{typography.body-ui}" }
  error-text-dark: { backgroundColor: "{colors.dark-background}", textColor: "{colors.dark-destructive}", typography: "{typography.body-ui}" }
  hairline: { backgroundColor: "{colors.border}", height: 1px }
  hairline-dark: { backgroundColor: "{colors.dark-border}", height: 1px }
  field-edge: { backgroundColor: "{colors.input}", height: 1px }
  field-edge-dark: { backgroundColor: "{colors.dark-input}", height: 1px }
  sidebar-edge: { backgroundColor: "{colors.sidebar-border}", width: 1px }
  sidebar-edge-dark: { backgroundColor: "{colors.dark-sidebar-border}", width: 1px }
  quote-rule: { backgroundColor: "{colors.brass}", width: 2px }
  quote-rule-dark: { backgroundColor: "{colors.dark-brass}", width: 2px }
  text-selection: { backgroundColor: "{colors.selection}", textColor: "{colors.foreground}" }
  text-selection-dark: { backgroundColor: "{colors.dark-selection}", textColor: "{colors.dark-foreground}" }
---

# Cyphor Paper & Slate

## Overview

Cyphor is a place to think in long answers. The interface is built around reading: replies are set like a well-made book page, the controls stay out of the way until they are needed, and nothing on screen competes with the text. It should feel quiet, tactile and literate, dense enough for real work and spacious enough to read a long reply without tiring.

The mood is a study rather than a dashboard. By day the surface is warm **paper** (`background`); by night it is cool **slate**. Both themes are tinted rather than neutral grey, so long sessions feel softer than pure white or pure black.

Three decisions give it a face of its own:

- **A serif for replies, a grotesque for the interface.** Literata carries everything the assistant writes; Schibsted Grotesk carries everything you operate. The change of voice tells you at a glance what is content and what is chrome.
- **Deep teal, not terracotta.** The primary colour is a bottle-glass teal. It is deliberately distant from the orange-brown that other chat products use, so Cyphor reads as its own product. A small **brass** accent is kept for hairline marks only.
- **One signature object: the cipher disk.** A 26-notch dial (the name is the idea) ticks once per keystroke in the composer and once per streamed chunk of a reply. It is the only decorative motion in the product and it always means that something is happening.

Cyphor is the same product on every device. The layout reshapes (see Layout), but the type, colour, radii and behaviour do not change between a 320 px phone and a 1920 px monitor.

## Colors

The palette is two tinted neutrals, one accent and one warning, plus a small set of syntax colours. Token names match the CSS custom properties in `app/globals.css`, so the two stay in step: `primary` is `--primary`, `muted-foreground` is `--muted-foreground`, and so on. Dark values carry a `dark-` prefix here and live under `.dark` in the stylesheet.

Several shadcn roles are identical to `foreground` and are not repeated as tokens: `card-foreground`, `popover-foreground`, `secondary-foreground`, `accent-foreground` and `sidebar-foreground`. The focus ring uses `primary`.

- **Primary (#166657 light, #5fb5a3 dark):** Teal for the single most important action in a view, for links in replies and for the focus ring. Text on it is `on-primary` (white in light, #0f1b18 in dark).
- **Background (#f5f3ee, #171c1e):** The paper and the slate. Everything else sits on this.
- **Foreground (#1a211f, #e8e5dc):** Body text. A green-black ink in light, a warm bone in dark.
- **Card and popover (#fbfaf7 and #fcfbf8 light, #1e2427 dark):** One step lighter than the page (light) or lifted from it (dark). The composer, cards, menus and dialogs use these.
- **Secondary, muted and accent (#ece9e1, #ebe8df, #e8e4da light; #262d30, #242b2d, #2a3235 dark):** Quiet fills for buttons, notes, hover states and the active tab. They are close in value on purpose; the difference is felt more than seen.
- **Muted foreground (#5b635d light, #9aa39e dark):** Secondary text such as timestamps, hints and captions. It was darkened from an earlier value so it passes AA on every surface it is used on.
- **Destructive (#b3412f light, #e0705d dark):** Errors and irreversible actions only.
- **Border and input (#e0dcd0 and #d6d1c3 light, #2c3438 and #364044 dark):** One-pixel lines. Depth in Cyphor comes from these hairlines and from tone, not from shadow.
- **Sidebar family (#efece4, #e5e1d6, #dcd7ca light; #12171a, #20272a, #232a2e dark):** The sidebar sits a little apart from the page. In dark it is darker than the page, like a margin.
- **Brass (#b58a3c light, #d2a85a dark):** The rule beside a blockquote and similar hairline marks. It is **never used for text**: on paper it measures 2.8:1, which is fine for decoration and not for reading.
- **Bubble (#ece8de light, #242b2e dark):** The fill behind your own messages. The assistant's replies have no bubble.
- **Code (#efece3 light, #12171a dark):** Code blocks and inline code.
- **Selection (#c6d8d1 light, #2b4743 dark):** The wash behind selected text. In the stylesheet it is translucent teal (22% in light, 28% in dark) so it works on every surface; the values here are what it looks like on the page, so tools that cannot do alpha can still use it.
- **Syntax (light on #efece3, dark on #12171a):** Keyword teal, string amber, number red, built-in blue, comment grey. Every pair clears 4.5:1; the lowest is the light-theme comment colour at 4.58:1.

Measured contrast for the pairs used most:

| Pair | Light | Dark |
| --- | --- | --- |
| foreground on background | 14.8:1 | 13.7:1 |
| muted-foreground on background | 5.6:1 | 6.6:1 |
| muted-foreground on card | 5.9:1 | 6.1:1 |
| muted-foreground on muted | 5.1:1 | 5.6:1 |
| primary on background (links) | 6.2:1 | 7.1:1 |
| on-primary on primary (buttons) | 6.8:1 | 7.3:1 |
| destructive on background | 5.1:1 | 5.4:1 |

## Typography

Three families, each with one job, and a fourth for readers who want it.

- **Literata** (serif) sets the greeting, every assistant reply and the headings inside replies. It has an optical-size axis, so it stays crisp at 16 px and elegant at 38 px.
- **Schibsted Grotesk** (sans) sets the interface: buttons, menus, your own messages, tables, captions.
- **Spline Sans Mono** sets code, and only code.
- **Atkinson Hyperlegible Next** replaces Literata for replies when a person chooses "Easy to read" in Settings. Line height drops from 1.72 to 1.65 for the sans options.

Replies are the product, so they get the care: **16.5 px at a line height of 1.72**, in a column no wider than **40 rem** (about 65 characters). Headings inside a reply are weight 650 with slightly tightened tracking and generous space above them. The home greeting is 38.4 px on tablets and desktops and 29.6 px on phones.

Body text is 15 px, captions 13 px and small labels 12 px. The only 11 px text is in badges and in the thumbnail previews on the Artifacts page. On touch screens every text input is at least 16 px so iOS does not zoom the page when it is focused.

Fallback stacks keep Devanagari working: Noto Sans Devanagari follows the sans stack and Noto Serif Devanagari follows the serif stack.

## Layout

Spacing follows a **4 px unit**. Controls are **36 px** tall and grow to **40 px** on touch screens, which is the minimum size of any tap target.

The reading column is **40 rem** wide and centred. Messages, the composer and the home greeting all share it, so the eye never has to re-find the left edge.

The shell reshapes at a few widths:

- **1024 px and up (docked).** The sidebar is **16 rem** wide and stays open. An artifact opens beside the chat in a resizable split: the chat is 54% by default and never narrower than 30%; the artifact is 46%, between 28% and 68%.
- **Below 1024 px (drawer).** The sidebar becomes an **18 rem** drawer. An artifact opens full screen with a Back button and only when you open its card; it never takes over the screen on its own.
- **Settings.** Below 640 px it is a full-screen sheet. From 640 px it is a centred dialog up to **56 rem** wide. Its sections are a horizontally scrolling strip below 768 px and a **14 rem** side navigation from 768 px.

Phones are treated as a first-class target rather than a shrunk desktop. The app height follows the visual viewport, so the composer stays above the on-screen keyboard. Safe-area insets pad the top and bottom edges. Nothing scrolls sideways at any width from 320 px up, and hover-only actions are always visible on touch screens.

## Elevation & Depth

Cyphor is a **tonal, hairline** design. Layers are told apart by a step in tone and a one-pixel `border`, in this order: page, then card, then popover. Shadows are rare and soft.

Two shadows exist:

- **Composer:** `0 1px 1px` at 4% ink plus `0 12px 30px -16px` at 20% ink. It lifts the input just enough to feel within reach.
- **Pop:** `0 1px 2px` at 6% ink plus `0 14px 34px -14px` at 26% ink, for menus, popovers and toasts.

In dark mode the same two shadows get deeper (25% and 55%; 30% and 60%) because a shadow has to be stronger to read against a dark surface.

The sidebar has no shadow at all. It is separated from the page by tone and a single border.

## Shapes

Corners are soft but not bubbly. The base radius is **10 px**. The scale runs 6, 8, 10, 14, 20 and 24 px, plus a pill shape for chips and round buttons.

- **8 px:** buttons, inputs, menus, table-cell highlights.
- **14 px:** cards and code blocks.
- **20 px:** your message bubble (with a tighter 8 px corner at the lower right, where the bubble points to you) and artifact cards.
- **1.6 rem (25.6 px):** the composer, the largest shape on screen, so the primary input is the most inviting thing on the page.
- **Pill:** prompt chips, the send and stop buttons, attachment chips and the scroll-to-bottom button.

## Components

Every component below exists in a light and a dark form; the dark tokens carry the `dark-` prefix.

- **Primary button:** teal fill, 36 px tall, 8 px radius, label type. One per view. The send button is the same teal in a circle.
- **Secondary and ghost buttons:** `secondary` fill for secondary actions; ghost buttons are transparent until hover or focus, then `accent`.
- **Prompt chip:** a pill on `card` with muted text and a hairline border. Hover lifts the border toward teal. On the home screen the chips scroll sideways on narrow screens rather than wrapping.
- **Composer:** the 25.6 px rounded card at the bottom of the chat with a soft shadow. It holds the text area, the attach menu, tool toggles (web search, research, thinking), the model picker and the send or stop button. The cipher disk beside it ticks as you type.
- **Your message:** a `bubble` with a Schibsted Grotesk body, up to 84% of the column on desktop and 92% on phones. Edit and copy sit under it.
- **Assistant reply:** no bubble. Serif text directly on the page, with copy, rate and try-again actions underneath. Retrying or editing makes a new branch, and a small version switcher ("2 / 2") moves between them.
- **Artifact card:** a compact card in the chat (icon tile, title, type and version) that opens the artifact. While it is being written the tile shows the live cipher disk. Its accessible name is built from its text, so it always matches what is on screen.
- **Artifact panel:** Preview and Code tabs, a version picker, copy, download, full screen and close. HTML previews run in a sandboxed frame that can run scripts but has no access to the app's storage or cookies.
- **Sidebar:** brand, New chat, Search, then chats grouped by time. The active chat uses `sidebar-accent`. Newly named chats appear with a short "decode" effect. The account menu at the bottom holds Settings, keyboard shortcuts and the theme switch.
- **Settings:** ten sections (General, Appearance, Model, Router, Capabilities, Styles, Connectors, Privacy, Usage, Shortcuts). It opens focused on the current section so a single Escape closes it.
- **Command palette:** Ctrl or Cmd + K. Searches chat titles and message text and offers commands.

The router and God Mode have their own surfaces. They follow the rules of the rest of the product: quiet, text first, hairlines before shadows, and no logos.

- **Provider monogram:** the first letters of a provider's name on a tinted square, its hue made from the provider's id so a name is also recognised by colour. It is decorative. The name always sits beside it, and the letters are drawn by CSS rather than written into the page, so a control's accessible name never lacks a letter its eye sees.
- **Model menu:** opens from the model button in the composer. It lists the six Cyphor models (Auto, Swift, Core, Deep, Code, God Mode), each with an icon, a one-line description and a **"Now: Provider · Model"** line that says which model the name stands for at this moment. Below come the Extended thinking switch and **Browse all models**.
- **Model library:** a dialog of cards, one per model: monogram, name, provider and context size, a tier badge (Flagship is the one filled badge; Strong, Balanced, Fast and Mini are outlined), four score bars for Reasoning, Coding, Writing and Speed out of 10, feature tags and a **Use** button. It filters by provider, searches by name and sorts by any score. The scores are estimates from a model's family and size, so they say where to start and are never presented as benchmark results.
- **Route chip:** in the action row under a reply, a pill with the provider monogram and the model's name (a warning triangle instead after a failover). It opens a popover, "How this reply was made", that says who chose the model (Chosen by Cyphor, Chosen by you, Switched after a failure, God Mode) and why.
- **God Mode panel:** a bordered card above the reply with a crown, the words "God Mode" and one line of summary ("Asking 4 providers… 2 answered", later "4 of 4 answered, merged by …"). It is open while the panel works and folds away when the reply is done. Each member is a row: monogram, "Provider · Model", a status (a spinner and "Drafting", the time it took, "Too slow" or "Failed") and the first words of its draft.
- **Sources:** pills under a reply, each with its number, the site and an external-link mark. The first four show, then "Show all N". Every pill says in words that it opens a new tab.
- **Router settings:** the connected providers by the name of the variable that holds their key (the screens never see a key, only that name), a Test button for each, the providers that are not connected with their variable names and a link to their documentation, the routing priority as four radio options, and the God Mode panel size as a slider.
- **Code block:** `code` fill, 14 px radius, a header with the language and a copy button, 13 px mono at 1.65.
- **Error note:** a destructive hairline and a very light destructive wash. It always says what happened and what to do next.

## Motion & Effects

Motion is rare, short and purposeful. Everything respects the **Effects** setting (Full, Subtle, Off) and the operating system's reduced-motion preference. With either set to reduce, entrance delays and loops are removed, so content is visible at once and nothing repeats.

- **Cipher disk:** ticks per keystroke and per stream chunk, with a small intro when the home screen loads.
- **Dial sweep:** switching theme wipes the new theme across the screen in 780 ms as a clockwise sweep that starts at the point you clicked. The sweep spends its time over the largest part of the screen, so it never seems to stall.
- **Decode:** a new chat title in the sidebar resolves out of scrambled letters, once.
- **Rise:** content on a new screen rises in with a short stagger.
- **Press feedback:** primary round buttons dip to 93% scale on press with a small springy return (160 ms).
- **Colour and border transitions** are 150 to 200 ms.

Streaming text is committed about every 60 ms rather than on every chunk, which keeps long replies smooth on slow phones.

## Accessibility

The interface is checked with axe-core against WCAG 2.0, 2.1 and 2.2 levels A and AA plus axe's best-practice rules, in light and dark, on desktop and phone, across home, chat, tables, code, artifacts, the command palette and every Settings section. With providers connected, the same check covers the Router settings, the model menu, the model library, a God Mode reply and the route and sources popovers. The Playwright suites in `tests/e2e/a11y.spec.ts` and `tests/e2e/router.spec.ts` repeat these checks.

- Text pairs are at least 4.5:1; large text and interface edges are at least 3:1.
- Every control has an accessible name that starts with, or equals, its visible text.
- Landmarks are named and unique. Exactly one `h1` per screen.
- Dialogs trap focus, restore it when they close and close with one Escape.
- Tooltips appear only where there is a pointer that can hover. Touch screens get larger tap targets instead.
- Keyboard shortcuts are listed in Settings and are never the only way to do anything.

## Do's and Don'ts

- Do keep replies in the serif at 16.5 px and a 1.72 line height, in a column no wider than 40 rem.
- Do use teal for the one most important action in a view and for links, and nothing else.
- Do separate layers with a tone step and a hairline before reaching for a shadow.
- Do keep every tap target at least 40 px and every text input at least 16 px on touch screens.
- Do give a new control a name that contains the text people can see.
- Do check any new colour pair for 4.5:1 in both themes before using it for text.
- Don't use brass for text, or any colour from other chat products' palettes.
- Don't add gradients, glass, glow or decorative blur. The cipher disk is the only ornament.
- Don't hide an action behind hover without making it visible on touch.
- Don't use more than two type families on one surface. Mono is for code only.
- Don't add motion that loops or that cannot be turned off.
- Don't put a tooltip on the first focusable element of a dialog: its tooltip opens on focus and swallows the first Escape.
- Don't show a key, or any part of one, anywhere in the interface. The screens know the name of the variable that holds a key and nothing more.
- Don't present a model's scores as a measurement. They are estimates, and the copy around them should say where to start, not who wins.
- Don't use a provider's logo. The monogram is the same for all of them, so no one provider looks more official than another.
