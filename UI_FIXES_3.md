Read GOALS.md, DESIGN_AUDIT.md, LOCALISATION.md, and UI_FIXES_2.md before touching anything. These are targeted UI/UX fixes only. No schema changes unless explicitly stated. No API route restructuring.
Save this prompt to UI_FIXES_3.md.

Fix 1 — Reports: spending chart colour palette
The spending by category chart uses colours that are too visually similar. Replace with a perceptually distinct palette.
Create lib/chartColors.ts as the single source of truth for all chart colours:
typescriptexport const CATEGORY_COLORS = [
  '#4A7CFF', // Blue
  '#E5534B', // Red-coral
  '#F5A623', // Amber
  '#4CAF82', // Green
  '#9B59B6', // Purple
  '#E67E22', // Orange
  '#1ABC9C', // Teal
  '#E91E8C', // Pink
  '#607D8B', // Blue-grey
  '#795548', // Brown
  '#00BCD4', // Cyan
  '#8BC34A', // Light green
]

export function getCategoryColor(categoryName: string, index?: number): string {
  if (index !== undefined) return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
  let hash = 0
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}
Apply getCategoryColor everywhere category colours are used. Remove all hardcoded colour arrays.

Fix 2 — All charts: sort descending, hide sub-¥100 values
Create lib/chartUtils.ts:
typescriptexport function sortChartDataDescending<T extends { value: number }>(data: T[]): T[] {
  return [...data].sort((a, b) => b.value - a.value)
}

export function filterLegendItems<T extends { value: number }>(items: T[]): T[] {
  return items.filter(item => item.value >= 100)
}

export const suppressSmallValues = (value: number): string => {
  if (value < 100) return ''
  return formatJPY(value)
}

export const filterTooltipPayload = (payload: any[]) =>
  payload.filter(p => Math.abs(p.value) >= 100)
Apply filterLegendItems(sortChartDataDescending(data)) before rendering every chart's legend and data across the entire app — reports, transactions, budget, dashboard. Every axis tickFormatter, every <LabelList>, every custom tooltip renderer must use these helpers. Sub-¥100 values never appear anywhere in any chart or legend.

Fix 3 — Credit card sidebar: ribo payment shown inline on the card row, no warning icons
Do not add warning icons or visual alarm signals to bad debt entries. The goal is clarity, not alarm.
The sidebar Credit Cards section splits into two clearly labelled subsections — no further collapsing within them:
▼ Credit Cards                          −¥X,XXX,XXX total revolving
  ── Paid in Full
      SMBC Card                                  ¥0
      JCB Platinum                               ¥0
  ── Revolving & Installments
      Saison Gold Amex     −¥634,000
      Paidy · Amazon        −¥66,537
      Paidy · Apple        −¥174,778
      PayPay Card          −¥173,000
      Mercari Card          −¥28,000
Classification logic: a card is "Revolving & Installments" if it has an active CreditDebt record with outstandingBalance > 0. Otherwise it is "Paid in Full."
Sort each subsection descending by absolute balance. Paid-in-full cards at ¥0 are sorted alphabetically.
The group header total shows only revolving/installment balances summed — not full-payment cards.
Subsection labels use text-xs uppercase tracking-wide text-muted — consistent with existing group header styling.
For cards in "Revolving & Installments," add a second line under the card name showing the monthly obligation amount in muted small text: ¥62,548/mo or ¥8,739/mo · 20 remaining. This line is always visible — not on hover. It communicates the monthly cash flow impact at a glance without needing to open the debt screen.
For cards in "Paid in Full," show nothing extra — the ¥0 balance is sufficient.

Fix 4 — Credit card debt screen: ribo balance and end-of-cycle charge separated on same card
On the Debt screen, each credit card that has both a ribo-barai revolving balance AND regular one-time charges in the current billing period must show both on the same card, clearly separated. This models how Japanese credit card statements actually work — the ¥62,548 ribo repayment and the ¥5,687 internet charge are billed together on the same card but are completely different in nature.
Each debt card for a revolving card has two distinct sections, separated by a subtle horizontal divider within the card:
Section A — Revolving Balance (リボ払い)

Label: "Revolving Balance" with リボ払い as a small secondary label
Outstanding balance in large numerals, danger red
Monthly repayment amount
Interest rate
Estimated payoff date
What-if extra payment calculator (existing)

Section B — This Billing Cycle (Today's Charges)

Label: "This Billing Cycle" with the billing period dates in muted text (e.g. "Apr 11 – May 10")
Sum of all one-time (1回払い) transactions on this card in the current billing period
These are charges that will be debited in full on the next payment date — no interest, no rollover
Payment date shown: "Due May 26" or "Clears in 12 days"
A small list of the top 3–5 transactions by amount for this period, with merchant name and amount

Section B data comes from the existing transactions table — query transactions for this account in the current billing period, type debit, source not = ribo. If there are no one-time charges this cycle, Section B shows "No new charges this cycle."
The visual treatment: Section A uses a left border in danger red. Section B uses a left border in the primary blue #4A7CFF. This distinguishes "ongoing debt I owe" from "upcoming full payment I expect."
This only applies to cards that have an active revolving debt record. Paidy installment cards and lump-sum cards do not show Section B — they show only their installment details.

Fix 5 — Budget screen: rebuild the mental model and auto-assignment
This is the most important fix. The current Budget screen is confusing because the relationship between Assigned, Activity, and Available is not self-evident, and users do not understand that they need to manually type in the Assigned column. The screen needs both a UX explanation layer and automatic behaviour when transactions are imported.
5a — Auto-assign when transactions are added or updated
The Assigned column must auto-populate based on actual spending, not require manual entry. Implement this rule: whenever a transaction is created, updated, or imported for a given month, recalculate the Budget record for that transaction's category and month as follows.
If no Budget record exists for this category + month yet, create one and set assigned = actual activity amount. This means the first time a category has spending in a month, the budget is automatically set to match what was actually spent — it acknowledges reality rather than showing a confusing mismatch.
If a Budget record already exists and the user has manually edited the assigned value (track this with a boolean isManuallySet on the Budget model), do not overwrite it. Respect user intent.
If a Budget record exists but has never been manually edited (isManuallySet = false), update assigned to match the current activity total each time transactions change. This keeps the budget screen reflecting reality until the user deliberately takes control.
Add isManuallySet Boolean @default(false) to the Budget model in Prisma and run a migration.
When a user clicks and edits the Assigned cell directly, set isManuallySet = true for that record. If they delete the value and leave the cell blank, set it back to false and let it auto-calculate again.
5b — Clarify the three columns with inline help
Add a persistent but non-intrusive explanation bar immediately below the column headers. This is a single line of small muted text that explains the three columns. It is always visible — not hidden behind a tooltip. It disappears only on screens narrower than 640px.
Assigned = what you plan to spend  ·  Activity = what you actually spent  ·  Available = what's left
Style this explanation bar as: text-xs text-muted, full width of the table, border-b border-muted/20 pb-1 mb-1. It sits between the column headers row and the first category group.
5c — Assigned column visual treatment
The Assigned cell currently looks like a read-only number. It must visually communicate that it is editable. Change the treatment to:
Default state: show the number with a subtle dashed underline (border-b border-dashed border-muted/40). This signals editability without adding a persistent input field to every row.
Hover state: the dashed underline becomes solid, the background shifts to #F0EFF0 (a very subtle hover tint). A small pencil icon (12px) appears to the right of the number on hover.
Active/editing state: the cell becomes a proper input, no background, cursor visible, blue ring (ring-2 ring-primary/30). Tab moves to the next category row's Assigned cell.
After committing an edit (Enter or blur): set isManuallySet = true, save to DB, show the brief scale animation (existing behaviour). If the user typed a value that is less than the current Activity (i.e. they assigned less than they already spent), the Available cell immediately turns red and shows the negative amount.
If a cell has isManuallySet = false (auto-calculated), show a small "auto" badge in muted text next to the number: ¥12,450 auto. This tells the user the value was set automatically and they can take control by clicking it.
5d — Ready to Assign banner clarity
The existing banner text "Ready to Assign" is not self-explanatory. Update it to be more descriptive based on its current value:
When positive: ¥X,XXX available to assign — money not yet allocated to any category
When zero: All income assigned — your budget is fully allocated
When negative: Over-assigned by ¥X,XXX — reduce some categories to balance
In the negative state, the banner turns amber (not red — this is a planning warning, not an error). The negative amount is shown prominently. Do not use alarm language.
5e — Category rows sorted descending by Activity within each group
Within each category group (Fixed Bills, Everyday Spending, etc.), rows are sorted by their Activity value for the current month, descending. The category with the highest actual spend appears at the top of its group. This matches how users naturally think — the biggest spends are most important to review first.
This sort is recalculated every time the month changes or transactions update. It is not a user-configurable sort — it is the permanent default.
Zero-activity categories (no transactions this month) are sorted to the bottom of their group. Within the zero-activity group, sort alphabetically.
Implement this sort in the API route for GET /api/budget/[month] — return rows already sorted. Do not sort client-side.
5f — Add a one-line budget summary below each group header
Each collapsible group header row currently shows only the group name and group totals (Assigned, Activity, Available). Add a one-line budget status summary in muted small text directly below the group name:
For a group where all categories are within budget: All categories on track
For a group with one or more overspent categories: 2 categories over budget
For a group where assigned < activity total: ¥X,XXX over assigned amount
This gives the user a scannable signal at the group level without needing to expand every group.

Fix 6 — Transactions page: add category pie chart
Add a donut chart panel above the transaction table. Default: expanded. Collapsible, state persists in localStorage.
Chart specs: Recharts PieChart, donut style (outerRadius 90, innerRadius 55). In the donut centre: total spend for the month in large tabular numerals, Total Spent label in small muted text below. Only debit transactions, only amounts ≥ ¥100, sorted descending by amount.
Legend: right of the donut on desktop. Each item: colour swatch (10×10px rounded square), English category name, amount right-aligned, percentage in muted text. Apply filterLegendItems(sortChartDataDescending(data)) — no sub-¥100 entries in the legend.
Hover behaviour: hovering a segment highlights it and shows a Recharts tooltip with category name, amount, and percentage of total.
Updates: reacts to month navigator changes. Empty state when no debit transactions in the month.

Implementation order

Create lib/chartColors.ts and lib/chartUtils.ts.
Apply to all existing charts (Fix 1 and Fix 2).
Add isManuallySet to Budget model, run migration.
Implement auto-assign logic — fire on every transaction create/update/import (Fix 5a). Test with the imported data: every category that has transactions should immediately have an Assigned value in the budget screen.
Update Budget screen UI — explanation bar, Assigned cell visual treatment, auto badge, Ready to Assign banner copy, group summary line (Fix 5b–5f).
Implement descending sort by Activity in budget API (Fix 5e).
Implement sidebar credit card subsections with monthly obligation line (Fix 3).
Implement debt card dual sections for ribo + billing cycle (Fix 4).
Build transactions pie chart (Fix 6).
Final zero-suppression audit across all charts.

Run tsc --noEmit. Fix all TypeScript errors. Commit: "ui: budget auto-assign, chart colours, descending sort, debt card ribo separation, sidebar monthly obligations, transactions pie chart".
