# FATFire Forecast — Implementation Audit

Comparison of our implementation against the reference Japan-FIRE app at `../japan-fire`.

**Reference source files:** `simulation.js` (374 lines), `monteCarlo.js` (74), `gapAnalysis.js` (135), `lib/constants.js` (17), `FatFIREOptimizer.jsx` (top-level), `components/tabs/*.jsx` (8 tabs), `components/panels/*.jsx` (6 panels).

**Our source files:** `src/domain/forecasting-japan.ts` (485), `src/domain/forecast.ts` (302), `src/domain/forecasting.ts` (155), `ForecastPage` in `src/app/page.tsx`, `src/app/api/forecast/monte-carlo/route.ts`.

**Scope decision (user-directed):** Implement critical calc fixes + sub-tab restructure + input-panel consolidation + server-side Monte Carlo. Defer the long tail (gap-analysis engine expansion, sensitivity tornado with per-param re-simulation, full BudgetSettings editor, full spending-phases editor with binary search, life-events UI panel with presets) to follow-up. Audit still lists them so nothing is lost.

---

## Section 1 — Present and correct

| Feature | Reference | Ours |
| --- | --- | --- |
| iDeCo marginal rate table (30.42% / 33.48% / 43.69%) | `simulation.js:1–8` | `forecasting-japan.ts:121–125` |
| Residence tax linear interpolation (¥650k → ¥46k, ¥995k → ¥100.6k) | `simulation.js:17–22` | `forecasting-japan.ts:127–132` |
| Mortgage amortization `(P·r) / (1 − (1+r)^−n)` | `simulation.js:10–15` | `forecasting-japan.ts:134–140` |
| Tax-wrapper contribution order iDeCo → NISA → taxable | `simulation.js:248–254` | `forecasting-japan.ts:276–290` |
| Withdrawal waterfall taxable → NISA → iDeCo-60+ | `simulation.js:270–273` | `forecasting-japan.ts:296–302` |
| NISA lifetime ¥18M cap tracking | `simulation.js:160, 251–254` | `forecasting-japan.ts:283–287` |
| Capital gains 20.315% drag on taxable growth | `simulation.js:147–148` | `forecasting-japan.ts:83, 307` |
| Bridge phase income override with zero residence tax | `simulation.js:188–189` | `forecasting-japan.ts:232–235` |
| Mortgage 5-year recalculation rule (5年ルール) | `simulation.js:204–206` | `forecasting-japan.ts:243–244` |
| Home-loan deduction ¥17,500/mo for 13 years | `simulation.js:237` | `forecasting-japan.ts:268` |
| Box-Muller normal sampling (Monte Carlo) | `monteCarlo.js:3–8` | `forecasting-japan.ts:115–119` |
| iDeCo ¥23k/mo and NISA ¥3.6M/y, ¥18M lifetime caps | `lib/constants.js:102–108` | `forecasting-japan.ts:84–85, 279, 284` |
| Salary growth step (`growthRate` every `growthStep` years, capped at `netSalaryCap`) | `simulation.js:172–176` | `forecasting-japan.ts:229–230` |
| iDeCo annual tax saving = contribution × marginal rate | `simulation.js:243` | `forecasting-japan.ts:351` |
| Scenario-specific mean returns for Monte Carlo | `monteCarlo.js` | `forecasting-japan.ts` (sigma 8%) |
| Coast-FIRE / depletion / FIRE-crossing booleans on each row | (not in ref) | `forecasting-japan.ts:322–327` — ours richer than reference |

## Section 2 — Present but incorrect

| Issue | Our code | Reference behaviour | Our behaviour | Severity |
| --- | --- | --- | --- | --- |
| **Mortgage rate scenario paths collapse to one curve** | `forecasting-japan.ts:206–208` | Bear `+0.3%/yr cap 4%`, Base `+0.15%/yr cap 3%`, Bull flat `cap 1.5%` as three distinct rate trajectories | Single linear path `baseMortgageRate + mortgageRateAnnualIncrease × yearsSincePurchase`, scenario-agnostic | 🔴 Scenario sensitivity is lost — Bull/Bear/Base all end up paying ~the same mortgage stream |
| **FIRE target excludes post-retirement residence tax** | `forecasting-japan.ts:195–197` | `realAnnualExpenses = totalExpenses + residenceTax`; target = `(spend + tax) / SWR` | `fatAnnualSpendYen / SWR` only | 🟡 Target is ~5–8% optimistic for typical ¥6M spend |
| **Nenkin offset exists but its effect is muddy** | `forecasting-japan.ts:294–295` | Reference docs admit the effect is cosmetic; they still subtract it from required withdrawal | We subtract it too, but do not surface the interaction with the target calculation — user can't tell if nenkin lowered anything | 🟡 Confusing UX; functionally close to ref |
| **iDeCo cap hardcoded to ¥23k/mo** | `forecasting-japan.ts:279` | `¥23k/mo` standard, `¥12k/mo` if DC pension plan (parameterized) | ¥23k only | 🟡 Misses DC-plan variant |
| **Mortgage + deduction deflation diverges from reference** | `forecasting-japan.ts:216, 268` | Reference applies mortgage/deduction at **nominal** yen (acknowledged simplification) | We divide by `deflator` to express them in real yen | 🟢 Arguably more correct; flagged because it's a knowing divergence |
| **Monte Carlo runs client-side and on every input change** | `page.tsx ForecastPage` `useEffect` | Reference runs on demand via a "Run Monte Carlo" button; computation stays off the main thread only because it's short (500 paths) | We run 1000 paths in a 300ms-debounced effect — the browser stalls for seconds | 🔴 UX: must move to API route and gate behind explicit button |

## Section 3 — Missing entirely

**Deferred per user scope** — documented here so nothing is lost.

| Feature | Reference | Effort | Decision |
| --- | --- | --- | --- |
| Sub-tab navigation within the Forecast screen | `FatFIREOptimizer.jsx`, 8 tabs | Medium | **In scope** — restructure page into 6 sub-tabs. |
| FIRE crossing dots on projection chart | `TabFatFire.jsx:105–109` | Trivial | **In scope.** |
| Reference lines for mortgage payoff / property purchase / nenkin start / life events on projection | `TabFatFire.jsx:93–98` | Trivial | **In scope.** |
| Zoom controls (to retirement age / to age 90) on projection | `TabFatFire.jsx` | Small | **In scope.** |
| Nominal vs real display toggle (render-time deflation/inflation) | `FatFIREOptimizer.jsx:114` | Small | **In scope** — we already have `showNominal` input; wire it through the chart renderers. |
| Mortgage rate sensitivity table (1.0% / 1.5% / 2.0% / 2.5% × Bear / Base / Bull) | `TabCompare.jsx` | Medium | **In scope** on the Scenarios sub-tab. |
| Progress Tracker panel (actual age + actual portfolio → % of target, ahead/behind) | `ProgressTracker.jsx` | Small | **In scope** on the Projection sub-tab. |
| Bridge phase UI (start age / end age / monthly income sliders) | `BridgePhasePanel.jsx` | Small | **In scope** as part of the Bridge group in the consolidated input panel. |
| Custom scenario editor (return / salary growth / inflation / mortgage path / label) | `FatFIREOptimizer.jsx` | Small | **In scope** on the Scenarios sub-tab. |
| Salary ROI panel ("how much faster does a ¥X raise reach FIRE?" with ~43% tax drag) | `SalaryROIPanel.jsx` | Small | **In scope** on the Cash Flow sub-tab (simple form; uses existing sim). |
| Life events UI panel (windfall / expense / incomeChange / recurringExpense + presets) | `LifeEventsPanel.jsx` | High | **Deferred** — engine already supports `lifeEvents[]` in `ForecastInputs`; no UI surfaces them. Deferred; placeholder panel on Projection sub-tab with "Coming soon." |
| Full BudgetSettings panel (15 categories: rent / utilities / phone / groceries / transport / personal care / fine dining / drinking + annual trips + post-purchase condo fee / property tax) | `BudgetSettings.jsx` | High | **Deferred** — engine supports each field; consolidated input panel exposes only the most-edited ones with a "Coming soon: full expense editor" hint. |
| Full Spending Phases editor (phase cards with start/end age, spending multiplier slider per phase, SWR per phase) + **max-sustainable Go-Go multiplier via binary search** + longevity table (90/95/100) | `TabSpendingPhases.jsx` | Very high | **Deferred** — Spending Phases sub-tab shows defaults (Go-Go 1.2 / Slow-Go 0.85 / No-Go 0.65) and existing phased-vs-flat comparison; editor placeholder. |
| Gap-analysis engine expansion to 11 categories × 3 tiers with re-sim per candidate cut and top-12 by ROI | `gapAnalysis.js` | Very high | **Deferred** — existing `suggestions` (~7 categories) stays. Projection sub-tab shows them in a simplified card. |
| Sensitivity tornado (10 vars: real return / salary growth / inflation / mortgage rate / partner share / SWR / lifestyle / SWR buffer / purchase age / income step — each ±1 unit, re-sim) | `SensitivityChart.jsx` | Very high | **Deferred** — Scenarios sub-tab shows mortgage-rate sensitivity table instead. |
| Scenario-specific mortgage rate paths (Bear +0.3%/yr cap 4%, Base +0.15%/yr cap 3%, Bull flat cap 1.5%) | `simulation.js` per-scenario branch | Small | **In scope** — listed here because it's both a "missing feature" and the fix for Section 2's critical bug. |

## Section 4 — Redundant / confusing in our implementation

| Item | Rationale | Decision |
| --- | --- | --- |
| Main chart shows three scenario lines **plus** three FIRE-target horizontal dashed lines (Lean / Regular / FAT) | Reference shows one FIRE target dashed line. Three targets + three scenarios + reference lines = visual soup | **Consolidate** — keep FAT target as the hero dashed line on the Projection sub-tab; move Lean/Regular into a legend or KPI card |
| Four top MetricCards (Pre-tax FATFire / Post-tax FATFire / Projected FATFire age / Coast FIRE) | These are screen-wide and are shown regardless of sub-tab. Reference shows context-appropriate KPIs per tab. | **Keep but make sub-tab-aware**: each sub-tab chooses which of the four top metrics to show (Projection shows all four; Cash Flow shows net / expenses / investable; Probability shows Monte Carlo KPIs) |
| "What-if" slider panel (5 sliders: monthly contribution / return / contribution increase / FAT spend / SWR) duplicates inputs that already live in the assumptions panel | Changes made here don't persist into the canonical `assumptions` object, so it's confusing whether the chart reflects what-if or actuals | **Remove** — the assumptions panel is now the single source of truth. A "Reset to defaults" button is enough. |
| Methodology collapsible long-prose explainer | Not harmful but wordy; reference has tab-level captions | **Keep on Projection sub-tab**, but shorten |
| "Wrapper allocation" area chart lives alongside the fan chart on the same page | Reference puts this on the Allocation tab | **Move** to Allocation sub-tab |
| Drawdown + FIRE-age histograms live alongside the fan chart | Reference puts them on Monte Carlo / Probability tab | **Move** to Probability sub-tab |
| "Cash flow and Japan tax context" card (income / residence tax / iDeCo saving) | Reference puts this on the Cash Flow tab | **Move** to Cash Flow sub-tab |
| Survival metric cards (Depletion age / P10 depletion / Survive to 90 / 100) are mixed into the Forecast screen | Reference shows them in a dedicated section | **Move** to the Probability sub-tab alongside the Monte Carlo output |
| `baseInputs` / `whatIfInputs` / `scenario` derivations in `ForecastPage` | Two parallel input shapes lead to the "what does this chart actually reflect?" problem | **Simplify** — `assumptions` is the only input, scenario is read directly from `assumptions.activeScenario` |

---

## Fixes and additions this pass will ship

1. **Scenario-specific mortgage rate paths** — per-scenario caps and growth rates wired into `runJapanFireProjection`.
2. **FIRE target includes post-retirement residence tax** — lookup at `fatAnnualSpend` via the existing `residenceTax(netAnnualIncome)` helper, added to target.
3. **Monte Carlo moves server-side** — client calls `/api/forecast/monte-carlo` via a "Run Monte Carlo" button on the Probability tab; page load does not trigger it.
4. **Six sub-tabs with URL persistence** (`?forecastTab=projection|cashflow|allocation|phases|scenarios|probability`).
5. **Consolidated 8-group input panel** with localStorage-persisted collapsed state; "Reset to defaults" at the bottom.
6. **iDeCo `¥12k/mo` DC-plan variant** surfaced in Income group.
7. **Reference dots and reference lines** on the Projection chart — FIRE crossings per scenario, property purchase age, mortgage payoff, nenkin start (65), life events if any.
8. **Mortgage rate sensitivity table** on the Scenarios sub-tab (6 cells: 3 rate paths × 3 scenarios → FIRE age).
9. **Progress Tracker** on the Projection sub-tab (enter actual age + actual portfolio → % of FAT target, years ahead/behind base).
10. **Salary ROI** on the Cash Flow sub-tab (enter raise ¥, show years saved at ~43% combined tax).
11. **Nominal toggle actually toggles** — deflation is reversed for display when `showNominal` is on; simulation always runs in real yen.
12. **Removes the What-if panel**, moves the four survival metric cards into Probability, moves the wrapper-allocation chart into Allocation, moves the cash-flow bar chart into Cash Flow, moves the drawdown/FIRE-age histograms into Probability.

All forecast calculation logic stays inside `/domain/forecasting*` — pure TypeScript, no React. Components under `src/app` and `src/components/forecast` consume it.

---

# DEFERRED — re-open after this pass

- Life events UI panel with presets (engine already accepts `lifeEvents[]`).
- Full BudgetSettings panel (all 15 expense line items with +/− buttons).
- Spending Phases editor with max-sustainable-Go-Go binary search and longevity table.
- Gap-analysis engine expansion (11 categories × 3 tiers, re-sim per candidate cut, top-12 by ROI).
- Sensitivity tornado chart (10 parameters ±1 unit, re-sim each, sorted by span).

Each of these is a half-day at minimum and is tracked as a separate deferrable workstream.
