# Lifeline Design

The visual design, screens, components and interface text for Lifeline. Section numbers are referenced by PLAN.md, so keep them stable.

- **Subject:** keeping a Nigerian hospital lit through a grid outage.
- **Audience:**
  - hackathon judges (energy and metering engineers at Anneru Solutions)
  - hospital administrators
  - EaaS investors
- **Primary job:** within 60 seconds, show that the ICU stays powered when the grid fails. Then make the numbers believable.

Built with the `ui-ux-pro-max` skill (real-time operations landing pattern, accessibility and chart rules) and the `frontend-design` skill (distinct direction, a design-plan review, copy).

---

## 1. Direction: "Light stays on"

The whole app is a night scene. The background is the darkness of a ward during an outage. **Warm lamp light means power is being delivered, and it never means anything else.** A room that is powered glows. A room whose load has been paused goes dark. A room where life-critical equipment has lost power pulses red. Colour is data, not decoration.

### Principles

1. **Amber only means "powered".** The primary call to action is also amber, because it is the action that turns the lights on. No amber is used for decoration.
2. **One memorable thing per screen.**
   - Home: the blackout hero.
   - Outage day: the living floor plan.
   - Plan: the money bar.
   - Everything else stays quiet: hairline panels, no drop shadows, no gradient washes.
3. **Engineer-grade honesty.** Every number has a source mark. Estimates are labelled "Estimate". Shortfalls are shown in red, never hidden.
4. **Hospital and electrical vocabulary for structure.** Architectural plan drawing for the wards, a single-line wire for the steps, a datasheet layout for the system size.

### Decisions changed during design review

- **Palette.** The `ui-ux-pro-max` proposal was slate `#0F172A` with green `#22C55E`. That is the generic "dark with acid-green accent" look, so we replaced it with ward-night indigo plus lamp amber, chosen from the subject itself.
- **Fonts.** The proposed Cinzel and Josefin are luxury real-estate faces with no link to this subject. We replaced them with Archivo and Atkinson Hyperlegible Next.
- **Glassmorphism.** Dropped. Blur reduces chart legibility and adds nothing to the meaning.
- **Event copy.** The middle-dot format ("Grid lost · ICU runway") was rewritten as two plain sentences.
- **Stats.** The "big number, small label" strip was replaced with stats set as full sentences, with the number counting up inside the sentence.

### Not doing

- An all-caps eyebrow label above headings.
- Arrow glyphs in buttons.
- Monospace data labels.
- Numbered markers, except on the three-step "How it works" row (a real sequence).
- The red-cross emblem, which is protected by the Geneva Conventions. Use the "H" hospital sign instead.
- The host's branding.

---

## 2. Tokens (`src/styles/tokens.css`)

The app is dark only on screen, because the identity is "night during an outage". The print proposal uses its own light tokens (§11). Use the tokens below; never put raw hex values in components.

```css
:root {
  /* Night: surfaces */
  --night-950: #0A1026;   /* page background */
  --night-900: #0E1530;   /* app background */
  --night-800: #17204A;   /* panels */
  --night-700: #212C5E;   /* raised controls, table header */
  --line:      #2E3A72;   /* hairlines, walls in floor plan */
  --line-strong:#4A5799;

  /* Text */
  --text:       #EEF1FF;  /* 15.6:1 on night-900 */
  --text-muted: #A9B1D6;  /* 8.1:1 */
  --text-faint: #7C86B8;  /* 4.7:1 — captions only, ≥14px */

  /* Meaning colours */
  --lamp:      #FFB547;   /* powered / primary action — 10.3:1 */
  --lamp-glow: rgba(255, 181, 71, 0.35);
  --t1:        #FFB547;   /* Life-critical served (full lamp) */
  --t2:        #C98A3A;   /* Essential served (dimmer lamp) */
  --t3:        #8A6A45;   /* Can wait served (dimmest; chart adds hatch) */
  --solar:     #FFF1C2;   /* PV line, pale sun */
  --battery:   #3FD0C9;   /* SoC line, battery room fill */
  --grid:      #6EA8FF;   /* grid-on strip, power line */
  --diesel:    #9AA0B5;   /* generator, baseline scenario */
  --warn:      #FF9F43;   /* runway < 2h */
  --alarm:     #FF4D5E;   /* life-critical without power — only use */
  --ok:        #7BD88F;   /* verdict tick only */

  /* Type */
  --font-display: "Archivo", system-ui, sans-serif;
  --font-body: "Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, sans-serif;
  --fs-xs: 12px; --fs-sm: 14px; --fs-base: 16px; --fs-md: 18px; --fs-lg: 21px;
  --fs-xl: 24px; --fs-2xl: 36px; --fs-3xl: 48px; --fs-display: clamp(44px, 7.2vw, 88px);
  --lh-body: 1.55; --lh-tight: 1.05;

  /* Space (4-pt) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px; --s-9: 96px;

  /* Radius by hierarchy: controls < panels; pills only for segmented controls/badges */
  --r-control: 6px; --r-panel: 14px; --r-pill: 999px;

  /* Motion */
  --dur-press: 100ms; --dur-fast: 180ms; --dur-base: 280ms; --dur-count: 900ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in: cubic-bezier(0.55, 0, 1, 0.45);

  /* Layers */
  --z-base: 0; --z-sticky: 20; --z-nav: 40; --z-toast: 100;

  /* Layout */
  --content-max: 1200px; --gutter: 16px;
}
@media (min-width: 768px)  { :root { --gutter: 24px; } }
@media (min-width: 1024px) { :root { --gutter: 40px; } }
```

### Glow rule

Glow (`box-shadow` or `filter: drop-shadow` using `--lamp-glow`) appears only on powered elements:
- lit rooms
- the headline
- the primary button on hover

Panels use a 1px `--line` border with no shadow.

---

## 3. Typography

Put this in `index.html`, exactly as written:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Atkinson+Hyperlegible+Next:wght@400;500;700&display=swap" rel="stylesheet">
```

If "Atkinson Hyperlegible Next" fails to load, the stack falls back to "Atkinson Hyperlegible". Add `family=Atkinson+Hyperlegible:wght@400;700` only if the browser check shows the Next family missing.

### Typefaces and roles

- **Archivo (variable width and weight)** is used for display text and all numbers. Its width axis is part of the design:
  - expanded for headlines (`font-stretch: 112%`)
  - condensed for live numbers, so they read like a patient monitor (`font-stretch: 75%`)
- **Atkinson Hyperlegible Next** is used for all body text, labels, form controls and tables. It was designed for low-vision readers, which suits a healthcare tool.

### Type styles

| Role | Font | Size / line-height | Settings |
|---|---|---|---|
| Display (home h1) | Archivo | `--fs-display` / 0.98 | wght 820, stretch 112%, tracking −0.02em, `text-wrap: balance` |
| H1 (pages) | Archivo | `--fs-3xl` / 1.05 | wght 760, stretch 106% |
| H2 | Archivo | `--fs-xl` / 1.15 | wght 700, stretch 100% |
| H3 | Atkinson | `--fs-md` / 1.3 | 700 |
| Body | Atkinson | `--fs-base` / 1.55 | 400, max 68ch |
| Small / caption | Atkinson | `--fs-sm` / 1.45 | 400, `--text-muted` |
| Live numbers (runway, clock, comparison) | Archivo | 64px (runway), 36px (comparison), 21px (clock) | wght 800, stretch 75%, `font-variant-numeric: tabular-nums` |
| Table figures | Atkinson | `--fs-sm` | `tabular-nums`, right-aligned |

### Text rules

- Text is left-aligned everywhere. Centred text appears only in the verdict banner.
- Labels are sentence case. There are no all-caps labels.
- The minimum text size is 12px, and only chart axis ticks use it.

---

## 4. Motion

Motion is reserved for meaning. Three non-user-triggered moments exist, and nothing else animates on its own.

### Tools

- **`motion` (`motion/react`)** handles anything driven by state or by the user: the hero blackout sequence (`useAnimate`), room state changes, CountUp, route transitions (`AnimatePresence`), collapsibles, popovers, the verdict banner and new event-log entries (`layout` and enter animations). `motion` animations can be interrupted, so a scrub or speed change mid-animation snaps cleanly to the new state.
- **CSS keyframes** handle the infinite loops: the alarm pulse and the flowing `stroke-dashoffset` power lines. They cost less and need no JavaScript per frame.
- **Reduced motion:** `<MotionConfig reducedMotion="user">` at the root, plus `@media (prefers-reduced-motion: reduce)` for the CSS loops.
- **Springs:** for room glow and layout, use `{ type: 'spring', stiffness: 260, damping: 30 }`. For fades, use `--dur-*` with `--ease-out` (in `motion` this is `ease: [0.22, 1, 0.36, 1]`).

1. **Home blackout (plays once on load, 2.6s total).**
   - The city windows and the hospital start lit.
   - At 0.9s, the power line flickers three times using `steps()` keyframes.
   - The city windows go dark in a left-to-right sweep (40ms stagger per column).
   - The hospital windows dip to 30% for 120ms, then return to full glow.
   - The caption "Battery took over. No gap." fades in.
2. **Alarm pulse.** A room with life-critical equipment unpowered pulses: `--alarm` outline opacity cycles 1 → 0.35 over 1.2s, on an infinite loop while the state lasts.
3. **Flowing power.** The power line and the cables inside the floor plan use a `stroke-dashoffset` animation while energy flows through them, at 1.6s per cycle, in the direction the energy travels.

### User-triggered motion

- **Playback.** Room glow transitions in `--dur-base`, and chart reveal advances with each step.
- **CountUp** takes `--dur-count`.
- **Route change** is a crossfade with a 6px rise, `--dur-fast`, `--ease-out`.
- **Collapsibles** open with a `grid-template-rows` 0fr→1fr transition, `--dur-base`.
- **Press feedback** is `transform: scale(0.97)` for `--dur-press`.

### Reduced motion (`prefers-reduced-motion: reduce`)

- The hero renders its final state at once: city dark, hospital lit, caption visible.
- No pulsing. The alarm shows a static outline plus the "No power" text.
- Power lines are drawn as static dashes.
- CountUp is instant.
- Route changes have no transition.
- Playback still works, but rooms change state instantly.

All animations use `transform`, `opacity`, `stroke-dashoffset` or `filter` only. Never animate width, height or top.

---

## 5. Layout and navigation

### Shell

- A top nav, sticky, with `--z-nav`.
- Content is constrained to `--content-max` and centred, with `--gutter` side padding.
- A skip link, "Skip to content", is the first focusable element.
- On route change, focus moves to `<main>`.

### Nav (`Nav.tsx`)

```
[lamp-window mark] Lifeline        Hospital profile   Outage day   Plan & finance   Method
```

- **Mark:** a 20px SVG of a lit window (4 panes, amber glow) next to "Lifeline" set in Archivo 700 at stretch 100%.
- **Links:** Atkinson 500 `--fs-sm`, in `--text-muted`. The active link uses `--text` with a 2px `--lamp` underline (the "lit" link) and `aria-current="page"`.
- **Below 768px:** the links collapse into a "Menu" button that opens a disclosure panel (`aria-expanded`). The nav never scrolls horizontally.

### Breakpoints

375, 768, 1024 and 1440. Design mobile first.

### Page layouts

The detailed wireframes are in §6. Every grid collapses to a single column below 768px, in the order given in each screen section.

---

## 6. Screens

### 6.0 Home (`#/`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ nav                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│  NIGHT SKY                                                           │
│  No hospital should                                                  │
│  go dark.                          (display, lit, left)              │
│  Lifeline sizes solar and batteries for Nigerian hospitals and       │
│  shows, minute by minute, that life-critical care stays powered      │
│  when the grid fails.                                                │
│  [ Simulate an outage ]   Size my hospital                           │
│                                                                      │
│  ▁▂▃ city windows ▃▂▁   ┌──H──┐  ▁▂▃ city ▃▂▁                       │
│  ─ ─ power line ─ ─ ─ ─ │▣▣▣▣│ ─ ─ ─ ─ ─                            │
│                          └────┘  "Battery took over. No gap."        │
├──────────────────────────────────────────────────────────────────────┤
│ Why it matters (h2)                                                  │
│  Nigerian hospitals lose grid power for 8 to 20 hours a day.¹        │
│  About 40% of primary health centres have no electricity at all.²   │
│  Solar at two Nigerian health centres cut service interruptions      │
│  by over 80%.³                                                       │
│  In 2025, a prolonged outage at Aminu Kano Teaching Hospital was     │
│  linked to deaths in its intensive care unit.⁴                       │
├──────────────────────────────────────────────────────────────────────┤
│ How it works (h2)                                                    │
│  ①───────────────②───────────────③   (single-line wire joins steps)  │
│  Describe your     Watch an         Get a plan                       │
│  hospital          outage day       and a price                      │
├──────────────────────────────────────────────────────────────────────┤
│ footer                                                               │
└──────────────────────────────────────────────────────────────────────┘
```

**Hero**
- The hero is a full-bleed `--night-950` area. Its height is at least 88vh on desktop, using `min-height: 88dvh`, and auto on mobile.
- Text is left-aligned in the left 55% on desktop. The scene is a single inline SVG anchored bottom, 100% wide with `preserveAspectRatio="xMidYMax slice"`.
- **Scene elements:**
  - city blocks: rectangles with a grid of window rects
  - a hospital: wider block, an "H" sign on a pole, windows, and a roof solar array of 6 tilted panels
  - a power line: poles plus a cable path with a flowing dash
- The motion follows §4.1.
- **Stats.** These are body sentences at `--fs-lg` with the number in Archivo 800, stretch 75%, `--lamp`, wrapped in `CountUp`. The animation triggers once when the block scrolls into view (`IntersectionObserver`). Each sentence ends with a `SourceRef`.
- The Kano sentence has no number and does not animate. It is set in `--text` with no amber, because it reports deaths and must stay sober.

**How it works**
- Three columns joined by a 2px `--line-strong` wire, with a small circle node at each step holding the step number in Archivo 700.
- Each step has a one-line description below:
  1. "Describe your hospital: Pick a preset or list your equipment and how many hours of grid power you get."
  2. "Watch an outage day: See every ward through a full day of outages, with and without Lifeline."
  3. "Get a plan and a price: Solar, battery and inverter sizes, a monthly fee below today's diesel bill, and a one-page proposal."

**Footer**
- Text: "Built for the Global Energy Hackathon 2026. Open the method and sources."
- The words "method and sources" link to `#/method`.
- Text is `--fs-sm`, `--text-muted`.

**Calls to action**
- Primary button "Simulate an outage": `--lamp` fill, `--night-950` text, 48px tall, `--r-control`. Hover adds a lamp glow.
- Secondary "Size my hospital": a text link in `--text` with an underline on hover.

### 6.1 Hospital profile (`#/profile`)

```
┌ h1: Hospital profile ─────────────────────────────────────────────┐
│ Start from  ( General Hospital, Kano | Primary Health Centre, FCT ) │
├───────────────────────────────┬──────────────────────────────────┤
│ Site                          │ Power today                       │
│  State [Kano ▾]  Beds [50]    │  Grid hours a day  ●────── 6 h    │
│                               │  Diesel per month  [1500] litres  │
│                               │  Generator size    [60] kVA       │
├───────────────────────────────┴──────────────────────────────────┤
│ Equipment (h2)                         [Add equipment ▾] [Add]    │
│  ICU (h3)                                                         │
│  ┌ Item ─────────── Priority ──── Watts ── Duty ── Qty ── ────┐  │
│  │ ICU ventilator   Life-critical  250     100%    [4]   Remove│  │
│  │ …                                                           │  │
│  Theatre (h3) …                                                   │
├──────────────────────────────────────────────────────────────────┤
│ sticky summary bar (bottom)                                       │
│  Daily use: Life-critical 107 kWh · … (see copy) Peak 9.6 kW      │
│                                             [ Run outage day ]    │
└──────────────────────────────────────────────────────────────────┘
```

- The equipment table is a real `<table>` with `<caption class="visually-hidden">`. It is grouped by ward with `<tbody>` per ward, and the `<th scope="rowgroup">` cell holds the ward name.
- Watts, duty and qty are inline `NumberField`s with compact styling. Each has a visible column header and an `aria-label` such as "ICU ventilator quantity".
- Duty is shown as a percentage, and the input takes 0–100. The reducer stores it as 0–1.
- Errors appear in a `role="alert"` box above the summary bar. Each error links to its field.
- The summary bar copy is: "Daily use: life-critical {a} kWh, essential {b} kWh, can wait {c} kWh. Peak {p} kW."
- On mobile, the table becomes stacked rows. Each item is a block showing its name, priority badge and three fields in one row.

### 6.2 Outage day (`#/outage`): the money shot

```
┌───────────────────────────────────────────────────────────────────────────┐
│ h1: Outage day     14:30   ( Typical day | Rainy season )  [New day]       │
│                            ( With Lifeline | Today: diesel only )          │
├─────────────────────────────────────────────┬─────────────────────────────┤
│ HOSPITAL MAP (SVG floor plan)               │ RUNWAY                      │
│  ┌─────────┬──────────┬─────────┐  ☀ roof   │ ICU covered for             │
│  │ ICU     │ Theatre  │Maternity│  array    │ 11h 20m   (64px, lamp)      │
│  │ (glow)  │ (glow)   │ (glow)  │           │ Battery 72%  Diesel 38 L    │
│  ├─────────┼──────────┼─────────┤           ├─────────────────────────────┤
│  │ Cold    │ Lab      │ Wards   │           │ EVENT LOG (live, newest top)│
│  │ chain   │ (dark:   │ (dim)   │           │ 14:30 Grid lost. ICU covered│
│  │         │  paused) │         │           │       for 11h 20m.          │
│  ├─────────┴──┬───────┴─────────┤           │ 14:45 Paused loads that can │
│  │ Battery ▮▮▯│ Generator (smoke)│ ← grid    │       wait (fans, office AC)│
│  └────────────┴─────────────────┘  cable    │ …                           │
├─────────────────────────────────────────────┴─────────────────────────────┤
│ LOAD CHART: grid strip (blue segments) on top; stacked lamp areas;        │
│ pale dashed sun; teal battery line (right axis %); grey dotted generator  │
│ ▶ Play  1× 4× 16×   [==========●---------------------] 00:00 … 23:45      │
├───────────────────────────────────────────────────────────────────────────┤
│ COMPARISON                                                                │
│  Today: diesel only            │  With Lifeline                           │
│  Life-critical without power   │  Life-critical without power             │
│  1h 15m  (alarm)               │  0 min  (lamp)                           │
│  Diesel 50 L   Cost ₦178K      │  Diesel 0 L   Cost ₦24K                  │
│  CO₂ 158 kg                    │  CO₂ 31 kg                               │
│  ── verdict banner at end of day ───────────────────────────────────────  │
└───────────────────────────────────────────────────────────────────────────┘
```

The numbers in the wireframe are illustrative. Real values come from the engine.

**HospitalMap (the memorable element)**
- The map is an SVG in architectural-plan style:
  - walls are 2px `--line-strong` strokes
  - door gaps are 12px breaks in the walls
  - room labels are Atkinson 14px `--text-muted`
- Room state is derived from the current step and the scenario being viewed:
  - **Lit:** every tier present in the room is served. Fill is `--lamp` at 22% opacity, with a soft inner glow (`filter: drop-shadow`) and small window ticks fully lit.
  - **Dim:** only part of the load is served (an essential or can-wait tier paused). Fill is `--lamp` at 8%, and the label adds "Partly paused".
  - **Dark:** nothing is served because all of the room's loads are paused. Fill is none, and the label adds "Paused".
  - **No power (alarm):** life-critical load in the room is unserved. A 2px `--alarm` outline pulses, an alert icon appears, and the label reads "No power".
- Wards on the map: ICU, Theatre, Maternity, Cold chain, Lab, Wards (merging Wards and Utilities lighting), Admin, a Battery room and a Generator.
  - The Battery room shows a 5-segment level in `--battery` that follows SoC.
  - The Generator shows three `--diesel` smoke puffs rising while `dieselKw > 0`. Puffs are hidden under reduced motion; the text "Running" is always shown.
- **Roof array.** Six panels whose fill opacity equals `pvKw / pvKwp`, in `--solar`.
- **Grid cable.** It enters at the left. It shows a flowing `--grid` dash while the grid is up. While the grid is down it is grey and broken, with an "×" at the meter.
- Clicking a room shows a popover with its items, their priority, whether each is served or paused, and its kW. Escape closes the popover. Every room is keyboard-focusable (`tabindex="0"`, `role="button"`, `aria-label="ICU: lit, 3.0 kW served"`).
- On mobile, the map comes first at full width. The runway follows, then the event log as a collapsible "Event log (12)".

**RunwayGauge**
- **Grid up:** shows "On grid power" in `--grid` with a small plug icon.
- **Grid down:** shows "ICU covered for" over `{duration}` in the 64px live-number style.
  - The colour is `--lamp`, or `--warn` when under 2 hours.
  - If life-critical load is already unpowered, it shows "ICU without power" in `--alarm`.
- Below it, a secondary line: "Battery {soc}%  Diesel left {L} L".
- It is not an aria-live region, to avoid noise. The event log announces changes instead.

**EventLog**
- An `<ol aria-live="polite">` list, newest first, capped to the last 40 items in view.
- Each item shows the time in Archivo 700 stretch 75% followed by the message.
- Alarm events (`t1_unpowered`, `fuel_out`) get an `--alarm` left rule and icon. Restore events get a `--lamp` rule.

**PlaybackBar**
- Play/pause button: 44px, with icon and visible text "Play" or "Pause".
- Speed: a `SegmentedControl` with 1×, 4× and 16×.
- Scrubber: a native range from 0 to 95, labelled "Time of day", with `aria-valuetext="14:30"`.
- Keyboard: Space toggles play when the bar has focus. Arrow keys move the scrubber natively.

**Scenario toggle**
- "With Lifeline" or "Today: diesel only". It switches the map, runway and chart to that scenario.
- The comparison panel always shows both scenarios.

**ComparisonPanel**
- Two columns. The Today column has a `--diesel` top rule and the Lifeline column has a `--lamp` top rule.
- Rows, in this order:
  1. "Life-critical without power"
  2. "Diesel burned"
  3. "Energy cost"
  4. "CO₂"
- Values count up live as playback advances. The life-critical value is coloured `--alarm` if above 0 and `--lamp` at 0.
- **Verdict banner.** It appears when step 95 is reached or the user seeks to the end. It is centred, `--fs-lg`, and fades in.
  - Copy for when Lifeline keeps life-critical loads powered all day:
    > "Today, life-critical equipment went {X} without power. With Lifeline: 0 minutes. Lifeline would also save ₦{Y} today."
  - If Lifeline still has a shortfall:
    > "With Lifeline, life-critical equipment still went {Z} without power. Increase battery or generator size on the plan page."
    The words "plan page" link to `#/plan`.

**Invalid profile state:** replace the page body with a single message, "This hospital profile has errors, so the outage day can't run.", followed by the link "Fix hospital profile" pointing to `#/profile`.

### 6.3 Plan & finance (`#/plan`)

```
┌ h1: Plan & finance ───────────────────────────────────────────────┐
├──────────────────────────────┬────────────────────────────────────┤
│ What to install (h2)         │ Who pays what (h2)                 │
│ datasheet rows:              │ Hospital saves ₦13.7M a year       │
│  [panel glyph] Solar  40 kWp │  (hero number, lamp)               │
│  [cell glyph] Battery 135 kWh│ Monthly cost                       │
│  [box glyph] Inverter 15 kW  │  Today      ████████████ ₦5.7M     │
│  each + one plain sentence   │  Lifeline   █████████▏   ₦4.6M     │
│                              │  Fee: 80% of today's spend ●──     │
│                              ├────────────────────────────────────┤
│                              │ For the investor (h3)              │
│                              │  Upfront cost ₦87.1M               │
│                              │  Payback 1.9 yrs   Return 52%/yr   │
│                              │  CO₂ avoided 42 t a year           │
├──────────────────────────────┴────────────────────────────────────┤
│ ▸ Assumptions (14)  — collapsible table w/ NumberFields + sources │
│ [ Download proposal ]                                              │
└───────────────────────────────────────────────────────────────────┘
```

- **SizeCards.** These are datasheet rows, not cards: one row each with an icon, label, value in Archivo 800 stretch 75% at 36px, and one sentence. The sentences are:
  - **Solar:** "{pv} kWp of panels, sized for {worstMonth} — the cloudiest month in {state}."
  - **Battery:** "{bat} kWh of lithium (LFP) storage, enough to carry life-critical and essential loads through the night."
  - **Inverter:** "{inv} kW, with 25% headroom over the peak of life-critical and essential loads."
- **FinancePanel.**
  - The hero line reads "Hospital saves {₦} a year".
  - The money bar is two horizontal bars on the same scale: Today in `--diesel` and Lifeline fee in `--lamp`. The gap is labelled "Saves {₦} a month".
  - The fee Slider is labelled "Monthly fee, as a share of today's spend", ranges 70%–85%, and shows its value as "{n}%".
  - Investor rows: "Upfront cost", "Payback", "Return over {years} years" (IRR as a percentage per year) and "CO₂ avoided".
  - `null` values show "n/a".
- **AssumptionsEditor.** It is a `<details>`-style disclosure built from a button with `aria-expanded`. Inside is a two-column grid of `NumberField`s, each with label, unit suffix, `SourceRef` and an "Estimate" tag. "Reset to defaults" sits at the bottom as a secondary button.
- **Warning alert.** Copy is fixed in PLAN Task 13. It renders as an `--alarm`-bordered box placed above "What to install".
- **"Download proposal".** A primary button with a download icon that opens the print dialog.

### 6.4 Method (`#/method`)

- This is a single readable column, max 68ch.
- **Sections (h2):**
  1. "How sizing works"
  2. "How the controller decides"
  3. "How the money works"
  4. "Sources"
  5. "Limits"
- Formulas are set as indented blocks in Atkinson with `tabular-nums`. They are not in code font. Variables are named in words, for example "battery size = night energy ÷ (0.8 × 0.9)".
- **Sources table** columns: Value, Number, Source and date, and Estimate. Rows carry `id="src-{id}"`. When a row is the anchor target, it gets a 1.2s `--lamp` outline flash. The flash is not used under reduced motion.
- **Limits copy** (a list):
  - "Simulates one representative day, not a full year."
  - "Equipment ratings are typical values, not a site audit. Field tests found real draw differs from labels by −45% to +56%."
  - "Prices are from October 2026 and change fast; edit them on the plan page."
  - "The grid outage pattern is generated, not measured. Real feeder data would replace it in a pilot."

---

## 7. Components (`src/components/`)

| Component | Props | Notes |
|---|---|---|
| `Nav` | none | §5 |
| `PageTransition` | `{ routeKey: string; children }` | Crossfades on key change. No transition under reduced motion. |
| `CountUp` | `{ value: number; format: (n: number) => string; durationMs?: number; startOnView?: boolean }` | `motion` `animate()` on a motion value, with ease-out from the previous value. `startOnView` uses `useInView({ once: true })`. With `useReducedMotion()` it renders the final value. The wrapper uses `tabular-nums`. |
| `TierBadge` | `{ tier: Tier }` | A pill showing a dot plus text: T1 "Life-critical", T2 "Essential", T3 "Can wait". The dot uses the tier colour and the text uses `--text`. Meaning is never carried by colour alone. |
| `Card` | `{ variant?: 'panel' \| 'inset'; as?: 'section' \| 'div'; children }` | `panel` has a `--night-800` background, 1px `--line` border and `--r-panel` radius. `inset` has a `--night-900` background and a `--r-control` radius. No shadows. |
| `Slider` | `{ label; min; max; step; value; onChange(v: number); format?(v: number): string }` | Native range input. A custom track is filled `--lamp` up to the thumb. The thumb is 20px with a 44px hit area. The value is shown to the right. |
| `NumberField` | `{ label; value; onChange(v: number); min?; max?; step?; suffix?; compact?: boolean }` | `type="number"` with `inputmode="decimal"`. It validates on blur. When out of range it shows `role="alert"` text below the field: "Enter a value from {min} to {max}." The field is linked to the error with `aria-describedby`. Min height 44px, or 36px when `compact` is set (inside tables only). |
| `SegmentedControl<T>` | `{ label: string; options: { value: T; label: string }[]; value: T; onChange(v: T) }` | A `role="radiogroup"` of buttons with `role="radio"` and `aria-checked`. Arrow keys move the selection. The selected option has a `--night-700` fill and a `--lamp` underline. |
| `SourceRef` | `{ id: string }` | A superscript link whose text is the 1-based index of the source in `SOURCES`, linking to `#/method#src-{id}`. Its `aria-label` is "Source: {label}". |
| Icons (`lucide-react`) | `size` 16, 20 or 24; `strokeWidth={1.75}` | No wrapper component. Global CSS sets `svg.lucide { stroke-width: 1.75; }`. An icon placed beside visible text keeps lucide's default `aria-hidden`. A standalone meaningful icon gets `aria-label` and `role="img"`. Map: play `Play`, pause `Pause`, solar `Sun`, battery `BatteryMedium`, grid `PlugZap`, generator `Fuel`, alarm `TriangleAlert`, add `Plus`, remove `Trash2`, disclosure `ChevronDown`, download `Download`, reset `RotateCcw`, menu `Menu`, info `Info`. The hospital floor plan, hero scene and logo mark stay custom SVG. |

### Shared component states

- **Buttons** come in two kinds:
  - Primary: lamp fill.
  - Secondary: transparent, with a 1px `--line-strong` border and `--text`.
- Hover lightens by 6% (primary also adds glow) over `--dur-fast`. Pressed is `scale(0.97)`.
- Disabled is 45% opacity with `cursor: not-allowed` and the `disabled` attribute.
- The focus ring on every interactive element is `outline: 2px solid var(--lamp); outline-offset: 3px`, applied on `:focus-visible`.

---

## 8. Interface text

Rules:
- Use sentence case and plain verbs.
- A control keeps the same name throughout the flow.
- Errors say what is wrong and how to fix it. They never apologise.
- Use "life-critical", "essential" and "can wait". Never write T1, T2 or T3 in the UI.

### Event messages (`formatEvent`, exact)

`{rw}` is `formatDuration(t1RunwayMin)`. Use "—" when the value is not finite.

| kind | text |
|---|---|
| grid_lost | Grid lost. ICU covered for {rw}. |
| grid_restored | Grid power is back. |
| shed_t3 | Paused loads that can wait (fans, office AC). |
| shed_t2 | Paused essential loads to protect life-critical care. |
| restore_t3 | Loads that can wait are back on. |
| restore_t2 | Essential loads are back on. |
| diesel_on | Generator started. |
| diesel_off | Generator stopped. |
| fuel_out | Diesel ran out. |
| t1_unpowered | Life-critical equipment has no power. |
| t1_restored | Life-critical power restored. |

### Other fixed strings

- Nav: "Hospital profile", "Outage day", "Plan & finance", "Method".
- Buttons:
  - "Simulate an outage"
  - "Size my hospital"
  - "Run outage day"
  - "Play"
  - "Pause"
  - "New day"
  - "Add equipment"
  - "Remove"
  - "Download proposal"
  - "Reset to defaults"
  - "Fix hospital profile"
- Toggles:
  - "Typical day" or "Rainy season"
  - "With Lifeline" or "Today: diesel only"
- Comparison headings: "Today: diesel only" and "With Lifeline". Tests must use these exact strings.
- Empty equipment state: "No equipment yet. Add the machines that must never lose power first." followed by the "Add equipment" control.
- Page `<title>`s: "Lifeline — Hospital Power Continuity" on home. Other pages use "{Page} — Lifeline".

---

## 9. Charts (`LoadChart`, Recharts)

- **Type:** `ComposedChart`, responsive container, 320px tall on desktop and 240px on mobile. Use `isAnimationActive={false}` on all series; the reveal comes from playback.
- **Data:** 96 points. Points after the current step have `null` for the served, PV and SoC values, so they are not drawn. The grid-down `ReferenceArea`s are drawn for the whole day in light form (8% `--night-950` overlay) so viewers see what is coming.
- **X axis:** labels "00:00", "04:00" … "20:00", ticks every 16 steps, `--fs-xs`, `--text-faint`.
- **Y axes:** left "kW" and right "Battery %" (0–100). Gridlines are horizontal only, `--line`, 0.5 opacity.
- **Series:**

| Series | Mark | Style |
|---|---|---|
| Served life-critical | stacked Area | `--t1`, 0.85 fill |
| Served essential | stacked Area | `--t2`, 0.8 fill |
| Served can wait | stacked Area | `--t3` with a diagonal hatch `<pattern>`, so it is told apart without colour |
| Solar output | Line | `--solar`, 2px, dashed `6 4` |
| Battery % | Line, right axis | `--battery`, 2px, solid, dot at current step |
| Generator kW | Line | `--diesel`, 2px, dotted `2 3` |

- **Grid strip:** a 10px band above the plot showing blue `--grid` segments where the grid is up, labelled "Grid" at left. Draw it as a separate small SVG aligned to the chart's x scale; it is simpler than using `ReferenceArea`.
- **Cursor:** a `ReferenceLine` at the current step, 1px `--text`.
- **Legend:** custom, placed above the chart, using the same mark style (swatch, dash or hatch) plus text. Every series is labelled.
- **Tooltip:** shows the time, each served tier in kW, solar kW, battery % and generator kW. All values are formatted to 1 decimal place.
- **Accessibility:**
  - The figure gets `role="img"` with an `aria-label` summary: "Load through the day. Grid off for {h} hours in {n} blocks. Life-critical load served all day."
  - The summary changes to "…unserved for {X}" if there is a shortfall.
  - A visually hidden `<table>` lists hourly values (24 rows).

---

## 10. Accessibility checklist

- [ ] Text contrast is at least 4.5:1, using the token pairs in §2. `--text-faint` is used only at 14px and above, on `--night-900`.
- [ ] A visible `:focus-visible` ring (§7) is on every control, and sticky UI never covers a focused control. Add `scroll-margin-top` equal to the nav height plus 16px.
- [ ] The skip link works, and focus moves to `<main>` on route change.
- [ ] Headings go h1 to h2 to h3 with no skipped levels. Each page has exactly one h1.
- [ ] Colour is never the only signal:
  - tier badges have text
  - the chart uses hatch and dash patterns
  - the alarm has an icon plus "No power"
  - room states have text labels
- [ ] Every field has a visible label. Errors appear below their fields and are linked with `aria-describedby`.
- [ ] Reduced motion is fully honoured (§4).
- [ ] Targets are at least 44×44px, except compact table inputs at 36px tall, which still have 8px spacing.
- [ ] Playback is fully operable by keyboard: play/pause, speed, scrubber and room popovers.
- [ ] The event log is `aria-live="polite"`. Nothing else announces automatically.
- [ ] No horizontal scroll at 375px. Use `overflow-wrap: anywhere` on long equipment names.

---

## 11. Print: proposal (`print.css`, `Proposal.tsx`)

- `@media print` hides `Nav`, the page content and all controls, and shows `<Proposal/>`. On screen, the proposal is `display: none`.
- Page setup: `@page { size: A4; margin: 16mm; }`. Use light paper tokens: white background, text `#141A33`, rules `#C9CEE6`, and accent `#B26A00`, a printable dark amber.
- **Layout, top to bottom:**
  1. The Lifeline mark plus "Power continuity proposal for {hospital name}", and today's date.
  2. A three-column system row: solar, battery and inverter.
  3. "Outage day result": a two-column comparison table covering life-critical minutes without power, diesel, cost and CO₂.
  4. "The offer": monthly fee, today's monthly spend, savings per year, and contract length.
  5. "For the investor": upfront cost, payback and return.
  6. "How we got these numbers": three lines plus "Full method and sources: {site URL}#/method".
  7. A small footer: "Generated by Lifeline. Figures are estimates for planning and need a site audit before contract."
- It must fit on one A4 page. Use `break-inside: avoid` on each block.
