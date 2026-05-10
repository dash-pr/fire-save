# FATFire Planner — MVP Goals

## Original User Request

Build a lean, reliable MVP personal finance app for 1–2 local users: a YNAB-inspired FATFire planning app for the Japanese financial context.

Core loop: enter or upload financial data → assign money to categories → track savings goals and debt → forecast FATFire timeline → evaluate drawdown and retirement risk.

Latest workflow preferences:

- Use git commits whenever possible.
- Use `npx create` inside this directory directly.
- Use subagents as much as useful.
- Deprioritize mobile polish compared with desktop MVP functionality.
- Deprioritize automated tests until the core product pages and calculations feel correct.
- Make sidebar navigation functional, even if initial navigation is client-side.
- Keep each page purposeful: Home is the full finance snapshot; Budget is only budgeting and allocation.
- Use production-ready product language, not prototype or implementation labels.
- Default date of birth is February 1, 1996, and FATFire output should emphasize FATFire age.
- Core default values must be manually editable and calculations must update from edited values.

## Product Vision

The UX should feel like a focused combination of YNAB, Linear, and Apple Wallet:

- Category-grouped budget table
- Sidebar account list with balances
- Ready to Assign income banner
- Transaction review and categorization flow
- Japanese finance support: JPY, ribo-barai, bunkatsu-barai, ikkatsu-barai, Japanese bank/card OCR
- FATFire forecast with deterministic projection, Monte Carlo simulation, drawdown analysis, and retirement survival risk analysis

## Non-Negotiable Constraints

- Modular monolith only.
- No microservices.
- No authentication for MVP.
- One hardcoded local user.
- No multi-user features.
- No bank integrations.
- No brokerage integrations.
- Manual data entry plus CSV/OCR import only.
- Simple deterministic logic before AI.
- AI only for OCR, categorization assistance, and monthly insights.
- Keep API routes thin.
- Put financial logic in pure TypeScript domain functions.
- Prefer boring, testable TypeScript.
- Avoid premature abstractions.
- Avoid background jobs unless absolutely necessary.
- No paid infrastructure for MVP.
- Keep the app understandable by one developer.
- Store all yen amounts as integers.
- Format currency as JPY with no decimal yen amounts.
- Do not store Monte Carlo simulation paths in the database for MVP.

## Free-Tier Infrastructure Requirement

Use free-tier services only.

### Vercel

- Use Vercel Hobby tier.
- Use Vercel CLI for deployment.
- Use Vercel CLI for environment variable workflows where possible.
- Avoid unnecessary server compute.
- Keep forecast simulations client-side.
- No paid analytics or observability tools.

### Supabase

- Use Supabase Free tier.
- Use Supabase PostgreSQL.
- Use Supabase Storage for uploaded OCR documents.
- Do not use Supabase Auth for MVP.
- Use Supabase CLI for local setup, linking, migrations, and database pushes.
- Keep seed data small enough for free tier.
- Auto-delete or allow cleanup of processed uploads to avoid storage bloat.

### OpenAI

- Use `gpt-4o` only for OCR when needed.
- Use `gpt-4o-mini` for insights and lightweight categorization assistance.
- Never send raw full transaction history for insights.
- Send aggregated monthly summaries only.
- Cache AI insights by month.
- Do not regenerate cached insights unless explicitly requested.
- Handle rate limits gracefully with user-facing fallback messages.

No paid services: no Sentry, Datadog, paid analytics, queues, hosted cron, or paid database add-ons.

## Required Tech Stack

- Next.js 14+ App Router
- TypeScript strict mode
- TailwindCSS
- shadcn/ui-compatible component structure
- Framer Motion for subtle transitions only
- Recharts for charts
- Next.js API routes
- Prisma ORM
- Supabase PostgreSQL
- Supabase Storage
- OpenAI for OCR and insights
- Vercel CLI
- Supabase CLI

## Explicitly Included MVP Features

### Foundation

- Root product memory in this file.
- Next.js app shell with sidebar navigation.
- Prisma schema and seed data.
- Supabase-oriented database and storage configuration.
- `.env.example` with required variables.
- Shared JPY formatting and date utilities.

### Budget

- Month selector.
- Ready to Assign banner and monthly income entry.
- Category-grouped budget table.
- Default category groups.
- Inline assigned editing.
- Activity and available calculations.
- Overspent, underfunded, funded filters.
- Category detail panel with trend and linked goal/debt information.

### Transactions

- Account filters.
- Transaction table.
- Add/edit transaction panel.
- Inline category editing.
- Uncategorized banner.
- Bulk categorize.
- Manual recurring transaction generation.
- Import entry point.

### Debt Tracker

- Japanese credit card debt support: ribo-barai, bunkatsu-barai, ikkatsu-barai.
- Payoff calculations.
- What-if extra payment.
- Debt feeds budget, net worth, health score, and forecast assumptions.

### Goals

- Goals grid.
- Progress/status calculations.
- Goal-budget category linking.
- Completion state.

### Investments

- Manual investment entries.
- Investment summary.
- Weighted expected return.
- Feed into forecast.

### Forecast and Risk Analysis

- Deterministic FATFire projection.
- Client-side what-if calculations.
- Monte Carlo simulation.
- Drawdown analysis.
- Withdrawal-phase survival analysis.
- Sequence-of-returns risk explanation.
- Recharts charts.
- Disclaimer: projections are estimates, not financial advice.

### Reports

- Spending breakdown.
- Net worth trend.
- Income vs expense.

### Import, OCR, and AI

- Supabase Storage upload.
- JPG, PNG, PDF, CSV import entry points.
- OCR extraction with structured transaction review.
- CSV mapper.
- Confirm selected transactions.
- AI insights generated on demand and cached by month.

### Export

- Transactions CSV export.
- Full MVP data backup if practical.

## Explicitly Excluded Features

Do not build:

- Authentication
- Login/signup
- Sessions
- Multi-user/team features
- Bank sync
- Brokerage sync
- Trading tools
- Tax filing
- Notification systems
- Websockets
- Realtime collaboration
- Microservices
- Kubernetes
- Event buses
- Paid infrastructure
- Complex role/permission systems
- Overly generic plugin systems
- Full accounting ledger beyond MVP needs

## Parallel Agent Requirement

Use parallel agents when work can safely proceed independently.

Recommended parallelization:

- Foundation and schema first.
- Budget and transactions after schema and shared components are stable.
- Debt and goals after budget categories exist.
- Investments and forecast once settings and investment models exist.
- Forecast math, Monte Carlo, and drawdown engines can be built independently from chart UI as pure domain logic.
- OCR/import after transaction and account models are stable.
- Reports after core data is available.

Rules:

- Define shared types first.
- Keep domain logic pure and isolated.
- Avoid duplicate helpers.
- Prefer shared `CurrencyInput`, `MonthNavigator`, `RightPanel`, `EmptyState`, `LoadingSkeleton`, and `CategoryDropdown`.
- Merge only after TypeScript passes.
- If unsure, inspect this file before expanding scope.

## Implementation Order

1. Product memory.
2. Foundation.
3. Budget.
4. Transactions.
5. Debt and Goals.
6. Investments and Forecast.
7. Reports.
8. AI and Import.
9. Polish and Launch.

Mobile is required to be usable eventually, but desktop MVP functionality is prioritized first.

## MVP Launch Checklist

### Foundation

- [ ] This `goals.md` exists and reflects product scope.
- [ ] Supabase CLI workflow works.
- [ ] Vercel CLI workflow works.
- [ ] Seed data loads.
- [ ] Environment variables documented.
- [ ] TypeScript strict mode passes.
- [ ] Production build passes.

### Budget

- [ ] Budget table renders correctly.
- [ ] Assigned editing persists.
- [ ] Activity calculates correctly.
- [ ] Available calculates correctly.
- [ ] Ready to Assign calculates correctly.
- [ ] Filters work.
- [ ] Month navigation works.

### Transactions

- [ ] Add transaction works.
- [ ] Edit transaction works.
- [ ] Delete transaction works.
- [ ] Category dropdown works.
- [ ] Uncategorized banner works.
- [ ] Account filters work.
- [ ] Recurring generation works.

### Debt

- [ ] Ribo payoff correct.
- [ ] Bunkatsu payoff correct.
- [ ] Ikkatsu future liability visible.
- [ ] Debt payments feed budget.
- [ ] Debt affects net worth.
- [ ] What-if payment recalculates.

### Goals

- [ ] Goals create budget categories.
- [ ] Progress updates.
- [ ] Status labels work.
- [ ] Completion state works.

### Investments and Forecast

- [ ] Investments sum correctly.
- [ ] FATFire target correct.
- [ ] Deterministic forecast renders.
- [ ] What-if recalculates client-side.
- [ ] Monte Carlo runs client-side.
- [ ] Monte Carlo success probability displays.
- [ ] Percentile fan chart renders.
- [ ] Drawdown analysis displays.
- [ ] Withdrawal survival probability displays.
- [ ] Health score displays component breakdown.

### Reports

- [ ] Spending breakdown correct.
- [ ] Net worth trend correct.
- [ ] Income vs expense correct.

### OCR and AI

- [ ] Upload works.
- [ ] OCR extraction works or fails gracefully.
- [ ] Review table editable.
- [ ] CSV mapper works.
- [ ] AI insights generate on demand.
- [ ] Cached insights are reused.

### Quality

- [ ] No paid services required.
- [ ] No auth accidentally introduced.
- [ ] No bank integration introduced.
- [ ] No brokerage integration introduced.
- [ ] Loading states present.
- [ ] Empty states present.
- [ ] Mobile works at 375px.
- [ ] Japanese text renders correctly.
- [ ] Currency always formatted as JPY.
- [ ] No console errors in production.
- [ ] Deployed to Vercel Hobby with Supabase Free using CLI workflows.
