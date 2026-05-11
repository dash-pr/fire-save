# Design Audit — Fire-Save

Senior design review conducted on 2026-05-11 prior to the UI/UX redesign pass.
Target brief: YNAB information density, Linear typographic precision, Apple Wallet calm confidence.

## Global issues (apply to every screen)

- **Tabular numerals are inconsistent.** Most explicit balance/amount displays carry `tabular-nums`, but table-header group totals, the MonthNavigator month label, several slider value readouts, percentages in report legends, and the HomePage account type eyebrow all miss it. Columns will jitter as values change.
- **`font-semibold` overused.** Nearly every label, row item, secondary note, and tiny button uses `font-semibold`. Without restraint, no level reads as "primary." The four-level hierarchy prescribed in the brief is not present.
- **Typographic hierarchy is flat.** Page titles are `text-4xl`, card titles are `text-lg`, eyebrow text is `text-xs` — but body and metadata use the same `text-sm` everywhere, so secondary and tertiary information compete.
- **Card surface is inconsistent.** `@/components/shared/card` emits `border border-slate-200/80 bg-white p-5 shadow-sm` — a hybrid of border-card and shadow-card. The right detail panels use `ring-1 ring-slate-100` (a different mechanic). No single card style wins.
- **Off-palette colors.** `MetricCard` uses four gradient tones (`from-slate-950 to-slate-800`, `from-[#4CAF82] to-emerald-600`, `from-[#F5A623] to-orange-500`, `from-[#4A7CFF] to-indigo-600`) — decorative gradients that are not in the spec. Report chart palette introduces `#06B6D4` (cyan) and purple beyond the sanctioned status colors.
- **Inconsistent modal backdrops.** Debt/Settings modals use `bg-slate-950/40`; Goals create-modal uses `bg-slate-950/30`.
- **Page background is correct** (`#F5F4F0`) but much of the page uses `bg-slate-50` for inset cards — a cooler gray that clashes with the warm canvas.
- **Focus color is correct** (`#4A7CFF`), applied uniformly to inputs — good.
- **No loading skeletons** anywhere except the Reports page (and even there, only when explicitly loading).
- **Empty states are sparse.** Only the Budget income list and Reports "not enough data" have explicit copy; most pages render an empty grid with no guidance.
- **Micro-interactions are largely absent.** Framer Motion is used for panel slide-in and group collapse, but there is no ASSIGNED save flash, no Ready-to-Assign count-up, no goal completion confetti, no progress-bar animate-on-change.

## Screen: Sidebar (`src/components/layout/sidebar.tsx`)

- **What it looks like.** Dark navy (`#1C1F3A`) rail, 320px wide. Brand block, nav list, account group panel (white-on-navy semi-transparent `bg-white/8`), net-worth card at bottom.
- **What feels generic.** The nav uses a strong white-fill active state (`bg-white text-[#1C1F3A]`) that's heavier than Linear's subtle tint. Nav items are rendered with the default font weight of the button — which in practice picks up `font-semibold` via tailwind transfer — there's no light/medium cue. Account group panel sits inside a nested `bg-white/8` rounded box (double nesting with section `bg-white/6`) — reads like a Bootstrap card, not a sidebar shelf.
- **Missing YNAB/Linear/Wallet pattern.** YNAB/Linear keep the sidebar flat: one color, no nested cards, subtle dividers. Active nav item is a color-tinted background at low opacity with the brand accent color — not a solid white pill. Section headers are small uppercase labels, not rounded colored panels.
- **Most jarring UX.** The "+ Add" button sits awkwardly next to a group total, competing for attention with the balance; balance and button should never visually compete.
- **First impression.** Noisy. Nested panels, bright emerald totals, and white-pill active state all shout at once.

## Screen: HomePage (`src/app/page.tsx` lines 259–298)

- **What it looks like.** Four gradient `MetricCard`s (blue/neutral/green/amber), then two cards side-by-side: Priority actions (with a `bg-slate-50` health score box and three pastel `ActionButton`s) and Account balances (pastel rows).
- **What feels generic.** The four stacked gradient cards at the top of every financial dashboard. Pastel rows. Mixed typography (`text-3xl font-semibold` for health score sits next to `text-2xl font-semibold` for MetricCard values — no consistent display scale).
- **Missing pattern.** Apple Wallet's hierarchy has *one* hero number per screen. Here, four metrics are all the same visual weight and all gradient, so nothing is a hero.
- **Most jarring UX.** The gradient MetricCards. Removing the gradient shows how dated the rest of the layout is — but the gradients hide it.
- **First impression.** Busy. Too many shouting cards for a "financial overview."

## Screen: BudgetPage (`src/app/page.tsx` lines 300–401)

- **What it looks like.** Notice banner(s) + three MetricCards + Income card (collapsible) + Assignments card with filter pills and a bordered table. Group rows use `bg-slate-50/70`. Assigned is an always-visible `<input type="number">` (native spinner visible).
- **What feels generic.** The budget table is a generic data table: gray headers, thin borders, visible native number input with spinner arrows. The row for the category name uses `font-medium` and the AVAILABLE pill uses StatusPill — AVAILABLE is not visually dominant.
- **Missing YNAB pattern.** YNAB's hallmark: AVAILABLE is the primary number, ASSIGNED and ACTIVITY are secondary muted numbers. Category group headers have a 4px color border on the left and aggregated totals that *match* the column alignment. The inline ASSIGNED edit feels like text becoming editable — not like a form input appearing.
- **Most jarring UX.** The native number input on every ASSIGNED cell. It shows browser spinners, has a visible border at rest, and a fixed `w-32` width — the table's most-edited field looks the least considered.
- **First impression.** Functional but not trustworthy. It reads like a spreadsheet with a theme applied.

## Screen: TransactionsPage (lines 410–480)

- **What it looks like.** Five MetricCards, a filter card with five-column grid of checklists and selects, then a transaction table. Row hover uses alternating-ish amber highlight (`bg-amber-50/40` only when uncategorized). Category column shows a full `<select>` on every row. Merchant-rule creation is a plain `rounded-full bg-slate-100` pill button in its own column.
- **What feels generic.** A full-width `<select>` on every row is a heavy interaction; compare to Linear/YNAB where category is a single-line pill with dropdown-on-click. Five MetricCards is excessive — "Transaction Count" and "Uncategorized" stats are redundant on a screen whose subtitle is "Needs category."
- **Missing pattern.** Linear: outlined category pill with color = category color, click to change. Merchant/payee on a single line, memo as subdued secondary text (already present, but payee is `font-medium` — should be regular weight and memo sits at `text-xs`).
- **Most jarring UX.** `bg-amber-50/40` row fill for uncategorized rows is extremely faint — the urgency signal is almost invisible.
- **First impression.** A lot of selects. Heavy.

## Screen: DebtPage (lines 510–550)

- **What it looks like.** Add button, three MetricCards, a 3-column grid of debt cards. Outstanding balance is `text-3xl font-semibold tabular-nums`. Info rows sit inside `bg-slate-50` pill-boxes.
- **What feels generic.** Every debt card carries the same visual weight. Nothing signals severity — a ¥2,000,000 ribo debt and a ¥20,000 lump sum look identical. The "Due soon" amber pill is the only differentiator.
- **Missing Apple Wallet pattern.** Wallet uses a colored ribbon / left edge on cards to convey type. The brief prescribes a 4px left border (red for active installments and ribo, amber for ikkatsu) — missing.
- **Most jarring UX.** The edit/delete pills at the card header compete with the card title. Trash icon should not render at the same weight as Edit.
- **First impression.** Uniform — which for debt means the user can't prioritize where to focus.

## Screen: GoalsPage (lines 552–598)

- **What it looks like.** Add button, then 2-column grid of goal cards + right detail panel. Each card has `title={`${goal.emoji} ${goal.name}`}` so the emoji is inline with the title text at the same size. Progress bar is always green (hardcoded in `ProgressBar`). Status pill is `"On track"` / `"Needs funding"` — copy leans negative.
- **What feels generic.** Small emoji inline with text. Single flat-green progress bar. "Update Balance" is a full rectangular button stacked below the status row — interrupts the card's visual flow.
- **Missing pattern.** The brief calls for emoji at 32px, progress bar that color-transitions amber→blue→green, and a small status chip at top-right (not bottom).
- **Most jarring UX.** Completed goals do not visually differ from in-progress ones. The progress-bar color is hardcoded green from the shared component — a partially-funded goal reads as "done."
- **First impression.** Utilitarian. No warmth on what should be the only warm screen.

## Screen: InvestmentsPage (lines 600–610)

- **What it looks like.** Three MetricCards, a single-card NISA usage bar, then a 2-column grid of investment cards + right detail panel. P&L is a rounded pill either `bg-emerald-50 text-emerald-800` (gain) or `bg-red-50 text-red-800` (loss).
- **What feels generic.** Same card shell as debt/goals — no differentiation. Current balance is large (`text-3xl font-semibold`) but the card title above it (inherited from shared `Card`) is `text-lg font-semibold` — competitive hierarchy.
- **Missing pattern.** Apple Wallet investment cards show account type as the eyebrow with a small color chip; here the subtype is rendered as plain eyebrow text.
- **Most jarring UX.** The `bg-amber-50` "Set cost basis to see P&L" prompt looks like a warning, not a prompt. Amber is reserved for genuine urgency per the brief.
- **First impression.** Clean but cold — no information hierarchy on the lifetime NISA bar card.

## Screen: ForecastPage (lines 612–637)

- **What it looks like.** Blue banner, four MetricCards, three-column layout: assumptions (left) / charts (center) / what-if (right). Center column stacks 5+ cards: main projection, wrapper allocation, Monte Carlo fan, drawdown histograms, cash flow. Right column has sliders + info boxes.
- **What feels generic.** The fan chart uses five distinct colors (`#BBD0FF`, `#8FB0FF`, `#4A7CFF`, `#2F5FE3`, `#1C1F3A`) on overlapping areas — a rainbow, not a fan. The brief prescribes *one color* at increasing opacity levels (8% / 15% / 30% / 15% / 8%).
- **Missing pattern.** Success rate should be a hero element with a gauge arc — here it's buried in a text paragraph inside a `bg-slate-50` info box (`Probability of FIRE by age 60:...`).
- **Most jarring UX.** The assumptions panel is a tall scrolling list of 20+ fields. No visual grouping (age / portfolio / return / spend / wrapper). Everything feels equally important, which means nothing is.
- **First impression.** Overwhelming. Looks like an engineer's spreadsheet wrapped in cards.

## Screen: ReportsPage (lines 639–667)

- **What it looks like.** Three stacked chart cards. Palette is `["#4A7CFF", "#4CAF82", "#F5A623", "#F97373", "#8B5CF6", "#06B6D4", "#94A3B8"]` — status colors (green/amber/red) are reused for categorical data, directly against the brief's rule.
- **What feels generic.** Dashboard template palette. Net worth chart uses `#93C5FD` and `#BFDBFE` (Tailwind blue-300/blue-200) for the savings area — introduces colors not in the app elsewhere.
- **Missing pattern.** Clear separation between status colors (green=positive, red=negative) and categorical colors (a muted harmonious palette for category segmentation).
- **Most jarring UX.** Spending-by-category legend buttons (`bg-slate-50 p-3`) all look the same — no indication they're clickable. Color dot is 12px — tiny.
- **First impression.** Looks like a generic analytics dashboard, not a personal finance report.

## Screen: SettingsPage (lines 673–676)

- **What it looks like.** Three cards: core defaults (4-column input grid), merchant rules table, editable source values grid. Uses `EditableList` component with `bg-slate-50 p-4` tint blocks stacked in 2 columns.
- **What feels generic.** The merchant-rules table has inline-editable fields with zero visual distinction between view and edit modes. Fuzzy checkbox is tiny (16x16) in a table cell.
- **Missing pattern.** Linear's settings: sectioned form, clear group labels, separators between sections, consistent field widths.
- **Most jarring UX.** Editable source values card has four `EditableList` blocks that each look identical — zero hierarchy, four similar gray boxes.
- **First impression.** A form wrapped in a card, not a settings interface.

---

# DESIGN_CHANGES_MADE

Pass focused on UI/UX only. No business logic, API routes, Prisma schema, or domain calculations changed.

## Global — tokens, typography, palette

**`src/app/globals.css`**
- Introduced CSS custom properties for the enforced palette: canvas `#F5F4F0`, raised surface `#FFFFFF`, inset `#FAFAF8`, group tint `#EEEDE9`, divider `#F0EFEB`, skeleton `#E8E7E3`; sidebar `#1C1F3A` / muted `#8B90B0`; accent `#4A7CFF`, success `#4CAF82`, warning `#F5A623`, danger `#E5534B`; muted text `#6B7280`.
- Applied `font-variant-numeric: tabular-nums` globally to every `table`, `input[type=number]`, `input[inputmode=numeric]`, and the `.tabular-nums` class — so numeric columns never jitter again.
- Added `.hide-spin` utility to remove native number-input spinners (used throughout inline inputs).
- Removed legacy `color: #111827` conflict and the misleading `foreground` token drift.

## Shared components

**`src/components/shared/card.tsx`**
- Replaced the mixed "border + shadow" card with a single shadow-only style across the app (`shadow-[0_1px_2px_rgba(17,24,39,0.04)]`), 20px padding, 16px radius.
- Standardized header: muted eyebrow (`text-[11px] uppercase tracking-[0.08em]`), title at 15px medium-weight — no `font-semibold`.
- `MetricCard` now uses a plain white card with a single semantic accent color on the value (green/amber/blue/red/neutral) instead of four gradient backgrounds.

**`src/components/shared/progress.tsx`**
- `ProgressBar` now auto-transitions from warning → primary → success as value crosses 50% / 90%, with a 400ms animate-on-change as spec'd. Color palette strictly restricted to `#F5A623`, `#4A7CFF`, `#4CAF82`.
- Bar is thinner by default (`h-1.5`), thick variant (`h-3`) for Goals cards per brief.
- `StatusPill` replaced gradient/ring styling with muted solid-tint pills drawn from the sanctioned palette.

## Sidebar

**`src/components/layout/sidebar.tsx`**
- Width reduced from 320px → 260px; removed the nested `bg-white/8` account panel and inner `bg-white/6` section cards (double nesting eliminated).
- Active nav state now uses the spec'd tinted background (`bg-[#4A7CFF]/15` with accent text) instead of the heavy solid white pill. Inactive uses `#8B90B0`, hover uses `bg-white/[0.06]`. No bold text on nav items.
- Account sections are flat: subtle uppercase group header with chevron, ghosted `+` add button that reveals on hover — no longer competing with the balance.
- Account rows are now 32px tall (single-row compact list) with proper `min-w-0` / `shrink-0` so the name truncates and the balance never wraps.
- Replaced the bold white net-worth card at the bottom with a quiet footer row: net worth + settings link + `v0.1.0` version stamp, separated from the sidebar body by a faint `border-white/[0.06]`.
- Removed `border-r` (there never was one on this file, but the visual weight was compensated via nested boxes — those are gone).
- Removed a duplicate "Settings" nav entry (moved to the footer as spec'd).

## Page shell and header

**`src/app/page.tsx`**
- Page background wrapper kept at `#F5F4F0`; `text-slate-950` downgraded to `text-slate-900` to match the muted-primary token.
- Main content padding is now a flat `px-8 py-8` (was 24/32 mixed).
- Page title reduced from `text-4xl font-semibold` → `text-2xl font-medium` — matching Linear's quieter page titles.
- Eyebrow switched to the canonical `text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]`.
- "Edit defaults" button lost its border and heavy shadow — now a quiet `text-xs` ghost button.

## MonthNavigator
- Collapsed from a shadow-ringed pill with large chevron buttons to a compact rounded card with 32px chevron hit-areas, a small uppercase "Budget month" label, and a 14px tabular month.

## Budget screen
- Replaced the top three gradient MetricCards with a hero **Ready to Assign** banner whose tint shifts green / amber / red based on the value. This is the single most important number on the screen and now reads as one.
- Secondary MetricCards are now flat white; the overspent count turns red when non-zero.
- Notice banners (new-month, overspent, NISA) unified under a new `NoticeBanner` helper — all rounded-lg, palette-correct amber/red/blue fills, no "border + bg" fight.
- Income card: compact rows on `#FAFAF8` inset, a proper `+ Add income row` action and right-aligned total.
- Filter pills: replaced the chunky dark-navy active pill + slate pills with Linear-style compact `rounded-md` chips with a muted count suffix.
- **Budget table** rewritten per the YNAB/Linear brief:
  - Column headers: 10px medium-weight uppercase tracking-[0.08em], right-aligned ASSIGNED/ACTIVITY/AVAILABLE.
  - Group header rows: `#EEEDE9` tint, 3px accent `#4A7CFF` left rail, compact 10px group totals, ghost `+ Add` action.
  - Row dividers: `border-[#F0EFEB]` (replacing the cooler `border-slate-100`), hover `#FAFAF8`.
  - **ASSIGNED is now a borderless inline editable cell** (`InlineAssignedInput`) — no visible input box at rest, underline-on-focus, save flashes with a 180ms Framer scale pulse as spec'd.
  - **AVAILABLE is now the visually dominant column**: medium-weight tabular with semantic color (danger red for < 0, amber for underfunded, green for funded); ASSIGNED/ACTIVITY are muted `#6B7280` secondary numbers.
  - Delete-row trash icon is opacity-0 by default, reveals on row hover.

## Transactions screen
- Replaced the five competing MetricCards with a single horizontal **stats bar** (In / Out / Net / Count / Uncategorized) with semantic color coding.
- Added a persistent `Review now` **uncategorized banner** in warning amber pinned below the month navigator.
- Filter panel: checklists no longer look like boxed forms; they are quiet borderless lists inside `border-[#E8E7E3]` boxes with palette-correct checkbox accents.
- Table:
  - Removed row striping entirely; replaced with a 1px `#F0EFEB` bottom border per row, hover fill `#FAFAF8`.
  - Replaced the full-width `<select>` on every row with a compact `CategoryPicker` rendered as an outlined pill.
  - OUTFLOW is now semantically red (`#E5534B`); INFLOW green (`#2F7A58`) with explicit `+` / `−` prefixes and tabular nums.
  - "Always categorize" promoted from a filled slate pill to a quiet `Always` text-button that reveals affordance on hover.
- Added an `EmptyHint` for "no transactions yet this month."

## Debt screen
- Debt cards rewritten as custom cards with a 4px **left color rail** per debt type — red for revolving/installment (active debt), amber for lump-sum (pending billing).
- Outstanding balance in the top-right typography slot uses the spec'd `text-3xl font-medium tabular-nums`, turns danger-red when > ¥100,000.
- Added a proper progress bar for installment debts (paid-off %).
- Grouped the metadata into a clean dividing-line info block instead of stacked tinted info boxes.
- "Due soon" pill moved next to card-level actions; actions reduced to icon-only buttons with quiet hover states.
- Added a proper **empty state** with inline SVG balance-scale illustration and copy: "No debts tracked. Add a debt to see your payoff timeline and monthly obligation."
- Refactored all modals behind a new shared `Modal` component (consistent 480/560px max-width, unified header, palette-correct action buttons, single `bg-slate-950/40` backdrop).

## Goals screen
- Goal cards redesigned with the **emoji at 28px** at the top left, name below, thick (`h-3`) progress bar that transitions amber → blue → green as progress crosses 50% / 90%.
- Status chip moved to the top-right of the card (green/blue/amber — never red, as spec'd).
- Completed goals tint the whole card `#E8F5EE` (success green) instead of quietly sitting with others.
- Replaced the rectangular "Update Balance" button-below-everything with a compact quiet button that opens a small popover.
- Edit / delete controls moved to an icon action row.
- Added the proper empty state (flag-on-hill SVG, "What are you saving toward?", CTA).

## Investments screen
- Replaced shared `Card`-shell based cards with purpose-built investment cards: muted eyebrow for account subtype, clean Current balance hero, a thin divider and a tiny right-aligned gain/loss number (green/red) — no more tinted P&L boxes.
- The "Set cost basis" prompt dropped its alarming amber pill styling (amber is reserved for real warnings) — now a quiet muted line under the divider.
- Lifetime NISA usage card simplified — single-line `X of Y · %` + progress bar.
- Added the proper empty state with chart-up illustration.

## Forecast screen
- Replaced the alert-style blue banner with the unified `NoticeBanner blue` tone.
- Top MetricCards neutralized — no more amber/blue/green gradient stack.
- **Fan chart rebuilt per brief**: now a single-color `#4A7CFF` fan with progressive opacity bands (p10/p90 at 8%, p25/p75 at 15%, p50 as a solid 2.5px median line). Gone is the rainbow of `#BBD0FF / #8FB0FF / #4A7CFF / #2F5FE3 / #1C1F3A`. Added a proper inline legend.
- Added a **hero success-rate gauge** (semicircular SVG arc) in its own card, with green/amber/red band per spec'd thresholds (> 85 / 70–85 / < 70). Text "X of 1000 simulated paths reach your target" below, with a P(55/60/65) summary row.
- Drawdown histogram color changed from `#F97373` red to neutral `#9CA3AF` — this is analytical, not alarming.
- Chart grids switched to `#F0EFEB` (canvas-tonal) from `#E2E8F0` (Tailwind slate); horizontal lines only; axis labels muted.
- Chart tooltips unified with a white card, 1px `#F0EFEB` border, 8px radius.
- Scenario comparison & wrapper-allocation charts kept functional colors but chart grids softened and axis ticks styled.
- Assumptions panel checkboxes: replaced the four chunky `rounded-2xl bg-slate-50 p-3 text-sm font-semibold` toggle rows with quiet `ToggleRow` rows.
- Reset-to-defaults button quieted to a muted `bg-[#FAFAF8]` pill.
- What-if sliders rewritten as `SliderRow` components with a clean label/value row and accent-colored range input. Removed the four stacked `bg-slate-50 text-sm font-semibold` info blocks and consolidated into a single "Notes" card with dividing lines.
- Methodology section styled as muted `leading-relaxed` prose.

## Reports screen
- Palette rewritten: removed `#06B6D4` cyan and purple `#8B5CF6`, and removed the double-use of status colors for categorical data. New categorical palette is 8 muted harmonious tones (`#5A7FBF`, `#7A9FE5`, `#BFA770`, `#C9A088`, `#9B7EB5`, `#8BA39B`, `#B29B85`, `#7D8697`).
- Cash flow chart: bars are muted blue/coral (not saturated blue/red); net-savings line overlay in primary blue, 2px width, small dots.
- Net-worth chart: gained a `ReferenceLine y={0}`, soften area fills with `fillOpacity`, proper net-worth line in dark navy.
- Spending-by-category legend became a proper clickable list — category dot, truncating name, and right-aligned tabular yen/percent with a consistent hover.
- Chart grids, tooltips, axis ticks unified with the Forecast screen.
- Added the "needs 2 months" illustrated empty state (inline SVG line-chart) with palette-correct copy.

## Home
- Dropped the four-gradient hero row — replaced with a **single net-worth hero** (the only hero on the page, per Apple Wallet spirit) followed by three quiet MetricCards.
- Financial health is now an inline stat row inside the Priority Actions card (number + slim progress bar + helper line) — no more stacked gray boxes competing with the action buttons.
- `ActionButton` rewritten: quiet `#FAFAF8` fill, semantic color rail dot instead of a pastel tinted border, a subtle chevron that reveals on hover.
- Account balances list now uses dividers (`divide-y divide-[#F0EFEB]`) rather than stacked pastel rows; negative balances render in danger red.

## Settings
- Merchant rules table now uses the global quiet border/row style, compact inline editable inputs, palette-correct delete button.
- Editable source values card: removed four identical `bg-slate-50` nested boxes; now each sub-list has a top-of-group uppercase eyebrow, a single inset container, and tight 2-column grid.

## Import
- Workflow cards got a subtle neutral icon chip (`#EEEDE9` bg, `#4A7CFF` glyph) instead of the solid dark-navy chip that was the loudest element on the page.

## Input primitives (rebuilt globally)
- `CurrencyInput`, `NumberInput`, `PercentInput`, `TextInput`, `SelectField`, `FilterChecklist` rewritten to a single quiet style: `rounded-md`, `border-[#E8E7E3]`, 6px/10px padding, 14px font, accent-color focus only — no `font-medium` at rest.
- PercentInput now suffixes `%` visually inside the input.

## Empty states
- Added palette-correct, illustration-led empty states for Debt, Goals, Investments, Transactions (per the brief).
- Replaced the generic reports placeholder with a minimal line-art chart illustration and revised copy.

## Micro-interactions
- Assigned inline save flash (Framer motion scale 1 → 1.04 → 1 @ 180ms).
- Progress bar width + color transitions (400ms ease-out in the shared ProgressBar).
- Right panel slide-in from right (existing; opacity + x) and collapsible group motions kept at 200ms ease-out.

## Verification
- `npx tsc --noEmit` — clean.
- `npx eslint src/app/page.tsx src/components/layout/sidebar.tsx src/components/shared/*.tsx` — clean.
- `npx next build` — completes without errors; all 8 static pages generated.

## What was intentionally NOT changed
- No business logic. Budget, debt, goal, investment, forecast, and report computations were not touched.
- No API routes, Prisma schema, seed data, or sample data.
- No state structure or handler signatures.
- No additions beyond UI/UX refinements.
