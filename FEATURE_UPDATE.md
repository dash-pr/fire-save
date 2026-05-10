# Feature Update Request

Save this entire prompt to FEATURE_UPDATE.md in the project root before writing any code. Read GOALS.md first to understand the original product vision. This prompt describes targeted changes and additions to the existing MVP. Do not rebuild what already works. Surgical edits only.

Read first before touching any code
Read the existing codebase structure, especially: the current Budget screen implementation, the Investment screen, the Transaction screen, the Forecast/FATFire screen, the Prisma schema, and the Japan FIRE project at ../japan-fire/* for projection calculation reference. Understand what exists before changing anything.

Change 1: Budget screen — rebuild as the financial control center
This is the most significant change. The Budget tab becomes the single source of truth for all monthly financial data. Everything else derives from it.

Monthly isolation
Each month's budget is completely independent. Navigating to a new month does not carry over the previous month's data except via the intelligent auto-population described below. The month navigator (left/right arrows) already exists — ensure every budget API call is scoped to the exact YYYY-MM string.

Income input — move into budget tab, remove from settings
Remove the preset monthly income from Settings entirely. Income is now entered directly in the Budget tab each month. There can be multiple income sources per month (salary, freelance, rental, etc.). At the top of the Budget screen, above the category table, add an Income section:

Collapsible section header "Income" with total income shown
Each income row: source name (e.g. "Salary", "Freelance"), amount input, delete button
Add Income Row button
Total income calculated and displayed prominently as "Total Income This Month: ¥X,XXX,XXX"
This total feeds the Ready to Assign banner
Category rows — add and remove dynamically
Every category group must support adding and removing rows. Each group header has a small "+ Add Category" button on the right. Each category row has a delete button (trash icon, appears on hover). Deleting a category that has transactions this month shows a confirmation: "This category has X transactions this month. Move them to Uncategorized?" Built-in system categories (Rent, Groceries, etc.) cannot be deleted but can be hidden.

Collapsible category groups
All category groups are collapsible. Clicking the group header row toggles the group open or closed. State persists in localStorage per user. Default: all groups expanded. Collapsed group header still shows group totals (assigned, activity, available).

Manual spending entry within budget tab
Each category row now has a direct way to log a one-off spend without going to the Transactions screen. Clicking the ACTIVITY cell of any category opens a small popover showing transactions in that category this month with a "+ Log Expense" button at the bottom. This creates a transaction and updates the activity total immediately (optimistic update).

Intelligent auto-population when a new month opens
When a user navigates to a month that has no budget data yet, the system auto-populates it using this priority order. Run this as a server action:

Fixed costs first: copy all recurring expenses from the previous month at their exact amounts. Assign them fully.
Investments second: carry forward the same investment contributions as last month. Respect NISA limits (see Change 3). If NISA limit would be exceeded, automatically redirect overflow to the Taxable account.
Savings goals third: carry forward the same monthly allocation per active goal.
Lifestyle expenses last: copy previous month's assigned amounts for non-fixed categories (groceries, dining, transport, etc.) but flag them visually as "estimated — based on last month" in amber text. These should be reviewed and confirmed by the user.
If no previous month exists at all (first month ever), populate with category structure only, all amounts at zero.
Assume the same total income as the previous month when no income has been entered yet. Show a banner: "Income auto-filled from last month. Update if it changed."
The auto-population must not exceed total income. If the sum of all assigned amounts would exceed income, trim lifestyle expenses proportionally until it fits, and show a warning: "Budget adjusted to fit income. Review lifestyle categories."

End-of-month overspend enforcement
Calculate total expenditure at end of month (last day). If total spending (ACTIVITY total across all expense categories) exceeds total income for that month, display a prominent warning banner at the top of the budget screen: "You spent ¥X more than you earned this month." This is a warning only, not a hard block, since transactions are historical facts. Do not prevent saving transactions.

Change 2: Transaction screen — rebuild as monthly, filterable, intelligent
Monthly view
The transaction screen is now month-scoped, matching the budget screen. Month navigator at the top. All transactions shown are for the selected month only. Default to current month on load.

Stats bar
Below the month navigator, show a horizontal stats bar: Total In | Total Out | Net | Transaction Count | Uncategorized Count. These are calculated from the filtered view.

Filtering and grouping
Filter bar with: search (merchant/memo fuzzy search), account selector (multi-select), category selector (multi-select), type toggle (all/debit/credit only). Group by toggle: None | By Category | By Date. When grouped by category, show a group header with category name, item count, and subtotal. Collapse/expand groups. When grouped by date, group by week within the month.

Intelligent categorization
When a transaction is saved with a category, the system checks if this merchant has been categorized differently before. If yes, it auto-applies the previous category. Add an option per merchant: "Always categorize [merchant name] as [category]". This creates a merchant rule stored in a new MerchantRule table (merchant pattern, category id, fuzzy match flag). On import (OCR or CSV), apply all existing merchant rules before presenting the review table. Fuzzy match means: lowercase, strip punctuation, and check if the pattern is a substring of the merchant name.

Merchant rules management
In Settings, add a Merchant Rules section: table of all rules (pattern, category, created date), edit and delete per row.

Change 3: Investment screen — current state only, no projections
The Investment screen shows only what the user actually holds right now. Remove all projection or expected return rate display from this screen. Projections live exclusively in the FATFire Forecast screen.

Account types
Support four account types: NISA Growth (つみたてNISA / 成長投資枠 — specify which), NISA Tsumitate (積立NISA), iDeCo, and Taxable. Remove the generic "brokerage" type.

Default values
All investment balances default to 0 on first load. No pre-seeded amounts. The user sees empty cards with an Edit button. Clicking Edit on a card opens an edit panel with fields for the account details. There is no inline number input on the main investment screen — only the edit panel.

Edit panel per investment account
Each investment account card has an Edit button (pencil icon). Clicking it opens the right panel with: account name (editable), account type selector (NISA Growth / NISA Tsumitate / iDeCo / Taxable), current balance (editable), notes. No expected return field here — that lives in FATFire settings only.

Current P&L and return
Add two optional fields to each investment account: initial invested amount (what you put in total, manually entered), and current balance. Display: current gain/loss in yen (balance minus initial), return percentage ((balance minus initial) / initial * 100). If initial amount is not set, show "Set cost basis to see P&L" prompt. No calculations beyond this — no projected future value.

NISA limit warnings
NISA has annual and lifetime contribution limits under current Japanese law. 2024 onward limits: NISA Growth annual limit ¥2,400,000, NISA Tsumitate annual limit ¥1,200,000, combined NISA annual limit ¥3,600,000, lifetime limit ¥18,000,000 per person.

Track cumulative contributions to NISA accounts per calendar year. When the user assigns money to NISA investment categories in the Budget tab, the system checks if this would exceed the annual limit. Show a warning inline in the budget tab: "NISA annual limit almost reached — ¥X remaining." When the limit is reached, auto-redirect the budget assignment overflow to the Taxable account category and show: "¥X,XXX moved to Taxable account — NISA limit reached for this year."

Track lifetime NISA balance (sum of all NISA account balances) and show a lifetime limit usage bar on the Investment screen: "Lifetime NISA: ¥X of ¥18,000,000 used (X%)."

Store annual NISA contribution tracking in a new table: NisaContribution (year, accountType, totalContributed).

Change 4: Goals screen — add button only, derives from budget
No number inputs on the main goals screen
Remove all inline contribution inputs from goal cards. The monthly contribution for each goal is set exclusively in the Budget tab's Savings Goals category group. The Goals screen reads that assignment and shows it as "Monthly allocation from budget: ¥X,XXX."

Creating goals
Single "+ Add Goal" button at the top of the Goals screen. Opens a modal with: name, emoji picker, target amount, target date, optional notes. No monthly allocation field in this modal — that is set in the budget. Default current amount to 0 — the user manually updates current amount via an Edit button on the goal card, not inline.

Goal card
Shows: name, emoji, progress bar (currentAmount / targetAmount), current amount, target amount, monthly allocation from budget this month, projected completion date based on allocation, on-track status. Edit button opens the same modal to update name/emoji/target/date. A separate "Update Balance" button opens a simple popover with one input to set the current saved amount (manual update, not derived from transactions).

Change 5: Sidebar account management — collapsible groups with manual add
Account grouping in sidebar
Group sidebar accounts into three collapsible sections with toggle arrows: Credit Cards (show total owed, red if any balance), Savings Accounts (show total saved, sum of all savings balances), Investments (show total invested, sum of all investment account balances). Each section collapses to show only the header and total. Clicking the arrow expands to show individual accounts.

Manual account creation
Each sidebar section has a small "+ Add" button next to its header (visible on hover or always visible). Clicking opens a small modal: account name, account type (pre-set by which section was clicked), starting balance (default 0). For credit cards: also collect credit limit and current balance owed (stored as negative). For savings: just name and balance. Investments are managed from the Investment screen, not the sidebar add flow — the sidebar investment section links to the Investment screen.

Account cards in sidebar
Each account row shows: name, balance (formatted ¥X,XXX,XXX, red if negative). Clicking an account row navigates to the Transactions screen filtered to that account. Long press or right-click shows: Edit, Archive options.

Change 6: FATFire Forecast screen — completely independent, hypothetical only
Full separation from actual data
The FATFire Forecast screen is completely disconnected from the actual Investment screen balances and the actual Budget screen assignments. It uses its own independent set of hypothetical inputs. This is an "optimal scenario planning" tool, not a real-time tracker. Add a prominent label at the top of the screen: "Hypothetical projection — adjust inputs to model your optimal path."

Reference implementation
Read and adapt the calculation logic from ../japan-fire/*. Use that project's approach for the core projection engine. Do not rewrite it from scratch if it is already correct — wrap or adapt it.

Forecast inputs (all manual, all hypothetical)
All inputs live in the left panel and are independent of any other screen data. Inputs: current age, target retirement age, current total investable assets (hypothetical starting point), monthly investment amount (hypothetical), expected annual return (%), inflation rate (%), target annual spend in retirement (JPY), safe withdrawal rate (%). Add a "Reset to defaults" button that sets sensible defaults (age 30, retire 50, 7% return, 2% inflation, ¥6,000,000/year spend, 4% SWR).

Deterministic projection
Base case: compound growth formula with monthly contributions. Show: FATFire target portfolio (targetSpend / SWR), projected FATFire age, years remaining, projected portfolio at target age.

Monte Carlo simulation
Run 1000 simulations. Each simulation: step month by month from today to retirement age. Each year draw an annual return from a normal distribution with mean = expectedReturn and standard deviation = 12%. Apply monthly. Track portfolio value every step. Record: final portfolio value, whether target was reached before retirement age, worst single-year portfolio loss (max drawdown), year in accumulation phase when worst drawdown occurred.

From 1000 runs compute and display:

Success rate: percentage of simulations that reached the target before retirement age. Show as a large number with color coding (green above 85%, amber 70–85%, red below 70%).
Fan chart (area chart with multiple bands): p10, p25, p50, p75, p90 portfolio paths. Recharts area chart with five overlapping bands in progressively lighter shades.
Drawdown histogram: distribution of worst single-year losses across all simulations. Bar chart, x-axis is loss percentage buckets, y-axis is count.
Sequence of returns risk: run two sub-analyses — 500 simulations where the worst decade hits years 1–10 of accumulation, 500 where it hits years 20–30. Show the success rate difference. Label it: "Early bad decade success rate: X% vs Late bad decade: Y%."
P10 / P50 / P90 final portfolio values in a summary table.
What-if panel
Right panel. Sliders for monthly contribution and expected return. All Monte Carlo results recalculate instantly client-side when sliders move. Debounce recalculation by 300ms. Show delta vs base case: "Investing ¥20,000 more/month improves success rate by X%."

Expandable methodology section
"How is this calculated?" expandable section at the bottom. Plain English explanation of compound growth formula, Monte Carlo method, what standard deviation of 12% means, what sequence-of-returns risk means, what the safe withdrawal rate means.

Change 7: Monthly reports — fix charts, make them useful
Replace the current unclear monthly summary chart with the following three clearly labeled charts:

Chart 1: Monthly Cash Flow (bar chart) Side-by-side bars per month: Income (blue bar) and Total Spending (red/coral bar). Net savings as a line overlaid. Tooltip shows exact values. X-axis: last 6 months. This immediately shows whether the user is spending more or less than they earn each month.

Chart 2: Spending by Category (horizontal stacked bar) One bar per month (last 6 months). Each segment is a category, color coded. Hovering a segment shows: category name, amount, percentage of total spending. Below the chart: a legend with category name, color swatch, current month amount, and percentage. Clicking a category name filters the transaction view to that category.

Chart 3: Net Worth Over Time (area chart) X-axis: month. Y-axis: value. Three stacked areas: savings (light blue), investments (medium blue), total liabilities (red, shown below zero line). Net worth as a bold line. Tooltip per month shows breakdown.

All three charts use the same color palette as the rest of the app. All amounts in ¥X,XXX,XXX format. All charts must have: empty state when fewer than 2 months of data exist, loading skeleton, clear title and axis labels.

Database additions required
Add to Prisma schema:


MerchantRule: id, pattern, categoryId, fuzzyMatch (boolean), createdAt
NisaContribution: id, year (int), accountType (growth/tsumitate), totalContributed (int), updatedAt — unique on year+accountType
GoalBalanceUpdate: id, goalId, amount, note, updatedAt
Update Investment model: add fields initialInvestedAmount (int, nullable), accountSubtype (growth/tsumitate/ideco/taxable). Remove expectedReturnRate field from Investment model — it belongs only in FatfireSettings.

Update Account model: add creditLimit (int, nullable) for credit card accounts.

Update MonthlyIncome: change from single amount per month to a one-to-many. New model: IncomeEntry (id, month YYYY-MM, sourceName, amount, createdAt). Remove the single MonthlyIncome model or repurpose it as a computed view.

New API routes required

GET/POST/DELETE /api/income/[month]/entries
GET/POST/PUT/DELETE /api/merchant-rules
GET /api/nisa/limits/[year]
POST /api/nisa/check — check if a contribution would exceed limits
GET/PUT /api/investments/[id]/edit
POST /api/goals/[id]/balance — update current saved amount
GET /api/budget/[month]/auto-populate — triggers intelligent auto-population
GET /api/forecast/monte-carlo — runs 1000 simulations, returns results as JSON
Build phases — commit to git after each one
Phase 1: Schema changes. Update Prisma schema with all new models and field changes. Run migration. Update seed to reflect new defaults (investment balances default to 0, no pre-seeded income). Commit: "schema: add merchant rules, nisa tracking, income entries, investment subtypes".

Phase 2: Budget screen rebuild. Monthly isolation, multiple income entries, collapsible groups, add/remove rows, manual spend entry from activity cell, intelligent auto-population logic, NISA overflow detection in assignment, end-of-month overspend warning. Commit: "budget: rebuild as monthly control center with intelligent auto-populate".

Phase 3: Transaction screen rebuild. Monthly scope, stats bar, filter and group UI, intelligent categorization with merchant rules, merchant rule creation from category dropdown. Commit: "transactions: monthly view with filtering grouping and merchant rules".

Phase 4: Investment screen rebuild. Remove projections, add account subtypes, default-to-zero with edit panel, P&L display, NISA limit tracking and warnings, lifetime limit bar. Commit: "investments: current state only with nisa limits".

Phase 5: Goals screen rebuild. Add button only, no inline inputs, balance update popover, budget-derived allocation display. Commit: "goals: add button flow and budget-derived allocations".

Phase 6: Sidebar rebuild. Collapsible account groups, manual add flow for credit cards and savings, account navigation. Commit: "sidebar: collapsible account groups with manual add".

Phase 7: FATFire Forecast rebuild. Full separation from actuals, independent inputs, reference japan-fire project for calculations, deterministic projection, Monte Carlo with 1000 runs, fan chart, drawdown histogram, sequence-of-returns analysis, what-if panel. Commit: "forecast: independent monte carlo engine with drawdown and sequence analysis".

Phase 8: Reports rebuild. Replace broken chart with three new charts (cash flow, spending by category, net worth over time). Correct colors, labels, tooltips, empty states. Commit: "reports: rebuild with three clear charts".

Phase 9: Polish and QA. Loading skeletons everywhere new. Empty states everywhere new. TypeScript compilation clean. No console errors. Merchant rules settings page. NISA contribution tracking visible. Vercel redeploy. Commit: "polish: skeletons empty states and final qa".

UI/UX principles for all changes
Every new screen or component must follow these rules before being considered done:

The right detail panel pattern is used consistently — selecting a row or clicking edit always opens the right panel, never a centered modal except for create flows (adding a new goal, adding a new account). Create flows use a centered modal because they are not contextual to a selected row.

All currency inputs must format as ¥X,XXX,XXX as the user types. Use a controlled input that applies formatting on blur.

All charts must have a title, axis labels, a tooltip on hover, an empty state for fewer than 2 data points, and a loading skeleton.

Collapsible sections must animate open and close using Framer Motion with a 200ms ease-out. Collapsed state persists in localStorage.

Any action that can fail (API call, OCR upload, Monte Carlo computation) must show an inline error message below the triggering element, not a toast, not a modal. Toasts are only for success confirmation.

All new API routes must return typed responses matching the TypeScript interfaces defined in /domain types files.

Do not touch the FATFire Forecast screen when editing the Investment screen and vice versa. They are fully decoupled. Enforce this by keeping forecast calculation logic exclusively in /domain/forecasting and investment displlay logic exclusively in /domain/investments with no shared state.
