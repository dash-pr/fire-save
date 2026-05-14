# Localisation Pass — English display layer with Japanese tooltips and secondary labels

Read GOALS.md, FEATURE_UPDATE.md, and DESIGN_AUDIT.md before touching any code. This is a language and localisation pass only. Do not change any business logic, calculations, API routes, or database schema. Only change display text, labels, category names, and UI copy.

## What this does

The app currently displays Japanese text throughout — category names, merchant names, account names, navigation labels, budget groups, debt types, and transaction descriptions. This pass converts all user-facing display text to English while preserving the Japanese original as a hover tooltip or subtle secondary label. The database stores whatever is already there — this is purely a display-layer change.

## Core principle

Every piece of Japanese text the user sees gets an English primary label. The Japanese original is never removed — it appears on hover as a tooltip, or as a small secondary line in denser views where space allows. This serves two purposes: the interface is immediately readable in English, and the Japanese is always one hover away for cross-referencing with bank statements.

## Rule 1 — Category names

Categories are the most frequently seen labels in the app. Every category name must be displayed in English.

Create a translation map in `lib/categories.ts`. This file is the single source of truth for all category display names. Every place in the app that renders a category name must go through this map.

```typescript
export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  // Housing & utilities
  "住宅": "Housing",
  "光熱費": "Utilities",
  "水道・光熱費": "Utilities",

  // Food
  "食料品": "Groceries",
  "食費": "Food",
  "外食": "Dining Out",
  "外食・バー": "Bars & Dining",
  "カフェ": "Cafés",

  // Transport
  "交通費": "Transport",

  // Travel
  "旅行": "Travel",
  "旅行・宿泊": "Travel & Hotels",
  "旅行・スキー": "Ski & Travel",

  // Health
  "健康・医療": "Health & Medical",
  "健康・美容": "Health & Beauty",

  // Entertainment
  "映画・エンタメ": "Entertainment",
  "趣味・娯楽": "Hobbies",
  "趣味・スポーツ": "Sports & Hobbies",

  // Shopping
  "ショッピング": "Shopping",
  "日用品": "Household",

  // Communications & subscriptions
  "通信費": "Communications",
  "サブスクリプション": "Subscriptions",

  // Work & finance
  "事業経費": "Business Expenses",
  "ローン返済": "Loan Repayments",
  "税金": "Taxes",
  "収入": "Income",
  "送金": "Transfers",

  // Social
  "交際費": "Social & Gifts",

  // Misc
  "その他": "Other",
  "未分類": "Uncategorized",
  "特別な支出": "One-off Expenses",
  "現金・カード": "Cash & Card",
}

export function getCategoryDisplayName(japaneseName: string): string {
  return CATEGORY_TRANSLATIONS[japaneseName] ?? japaneseName
}
```

The fallback `?? japaneseName` means any untranslated category still renders rather than breaking.

When rendering any category badge, pill, or label, always call `getCategoryDisplayName(category.name)`. Wrap the element in a tooltip that shows the original Japanese on hover.

```tsx
<Tooltip content={category.name}>
  <span>{getCategoryDisplayName(category.name)}</span>
</Tooltip>
```

## Rule 2 — Debt type labels

The three Japanese debt types must display in English with the Japanese term in a tooltip.

```typescript
export const DEBT_TYPE_LABELS: Record<string, { en: string; jp: string; description: string }> = {
  "revolving": {
    en: "Revolving Credit",
    jp: "リボ払い",
    description: "Monthly minimum payment with interest on the balance"
  },
  "installment": {
    en: "Installment",
    jp: "分割払い",
    description: "Fixed number of payments, often 0% interest"
  },
  "lump_sum": {
    en: "Deferred Lump Sum",
    jp: "一括払い",
    description: "Single payment due on a future billing date"
  }
}
```

On each debt card, show the English label as the primary badge. Hovering the badge shows a tooltip: "リボ払い — Monthly minimum payment with interest". The description line makes it self-explanatory to anyone unfamiliar with Japanese credit conventions.

## Rule 3 — Account names

Account names in the sidebar and account selectors need English context labels while preserving the institution name.

The institution names (三井住友カード, JCBプラチナ, etc.) are proper nouns — keep them as-is since they match the physical cards. But add an English type descriptor so the sidebar is immediately scannable.

```
三井住友カード                    →   SMBC Card  (三井住友カード)
JCBプラチナ                      →   JCB Platinum  (JCBプラチナ)
セゾンゴールド・アメックス          →   Saison Gold Amex  (セゾンゴールド・アメックス)
Paidy あと払い (Amazon)           →   Paidy Installments · Amazon
Paidy Apple専用 あと払い          →   Paidy · Apple 36-month
PayPayカード                      →   PayPay Card
メルカリカード                     →   Mercari Card  (メルカリカード)
楽天カード                        →   Rakuten Card  (楽天カード)
ゆうちょ銀行                      →   Japan Post Bank  (ゆうちょ銀行)
ソニー銀行                        →   Sony Bank  (ソニー銀行)
```

In the sidebar, show the English name as the primary label at full opacity. Show the Japanese name as secondary text at 60% opacity, one size smaller, on the same line or directly below for longer names. No tooltip needed here — the Japanese is always visible as context.

```tsx
<div className="flex justify-between items-center">
  <div className="min-w-0 flex-1">
    <span className="text-sm truncate">{account.englishName}</span>
    {account.japaneseName && (
      <span className="text-xs text-muted ml-1.5 opacity-60">{account.japaneseName}</span>
    )}
  </div>
  <span className="text-sm tabular-nums flex-shrink-0 ml-2">{formatJPY(account.balance)}</span>
</div>
```

Create a utility `lib/accounts.ts` with a `getAccountDisplayNames(accountName: string)` function that returns `{ primary: string, secondary: string | null }`. Hardcode the translations for known account names. For unknown accounts, return the original name as primary with null secondary.

## Rule 4 — Navigation and screen labels

All navigation items, screen titles, section headers, and tab labels must be in English. Audit every sidebar nav item, every page `<h1>`, every section header, every tab label, and every button label.

Required English labels:

- Navigation: Budget, Transactions, Debt, Goals, Investments, Forecast, Reports, Settings.
- Budget screen headers: Income, Fixed Bills, Debt Payments, Everyday Spending, Savings Goals, Investments, Custom. Column headers: Category, Assigned, Activity, Available. Ready to Assign banner: "Ready to Assign". Filter tabs: All, Overspent, Underfunded, Funded.
- Debt screen: "Revolving Credit" section header, "Installments" section header, "Pending Charges" section header. Debt card labels: Outstanding Balance, Monthly Payment, Interest Rate, Payment Due, Payoff Date, Months Remaining, Total Interest.
- Goals screen: "Add Goal" button, progress labels: "On Track", "Ahead", "Behind", "Completed". Projected completion: "On track to complete by [date]".
- Budget auto-populate banner: "Budget auto-filled from last month — review and adjust."
- Reports tabs: Spending Breakdown, Net Worth, Income vs Expense.
- Forecast sub-tabs: Projection, Cash Flow, Allocation, Spending Phases, Scenarios, Probability.
- Settings sections: Profile, FATFire Assumptions, Income, Merchant Rules, Export Data, Account.

## Rule 5 — Transaction merchant names

Merchant names in the transaction list are a special case. Many are Japanese institution names or convenience store names that users will recognise from their bank statements. Do not translate proper nouns. Instead apply these rules:

For convenience stores and common chains, add a subtle English type tag as a secondary label on the transaction row. Do not replace the merchant name — add context.

```typescript
export const MERCHANT_CONTEXT_TAGS: Record<string, string> = {
  "ファミリーマート": "Convenience Store",
  "セブン-イレブン": "Convenience Store",
  "ローソン": "Convenience Store",
  "デイリーヤマザキ": "Convenience Store",
  "セイコーマート": "Convenience Store",
  "ワイズマート": "Supermarket",
  "ハナマサプラス": "Wholesale Grocery",
  "マイバスケット": "Discount Grocery",
  "ドラッグセイムス": "Drug Store",
  "ダイソー": "100¥ Store",
  "マクドナルド": "McDonald's",
  "ドミノピザ": "Domino's Pizza",
  "一蘭": "Ramen · Ichiran",
  "シェイクシャック": "Shake Shack",
  "ヤマト運輸": "Yamato Delivery",
  "東京ガス": "Tokyo Gas",
  "NTT東日本": "NTT East · Internet",
  "楽天モバイル": "Rakuten Mobile",
  "GOアプリ": "GO Taxi",
  "ウーバーイーツ": "Uber Eats",
  "JALプラザ": "JAL",
  "日本航空": "Japan Airlines",
  "JR東日本 えきねっと": "JR East · Train Tickets",
  "ルスツリゾート": "Rusutsu Resort · Ski",
  "キロロリゾート": "Kiroro Resort · Ski",
  "苗場スキー場": "Naeba Ski Resort",
  "ニッポンレンタカー": "Nippon Rent-a-Car",
  "パークハイアット東京": "Park Hyatt Tokyo",
  "申告所得税": "Income Tax Payment",
}
```

In the transaction row, show the merchant name as-is (primary), and if a context tag exists, show it as a small muted secondary label. No tooltip needed here — the secondary label is always visible.

```tsx
<div>
  <span className="text-sm font-medium">{transaction.merchant}</span>
  {contextTag && (
    <span className="text-xs text-muted ml-1.5">· {contextTag}</span>
  )}
</div>
```

For transactions that have a memo field, show it as a third line in even smaller muted text, visible on row hover or expansion.

## Rule 6 — Ribo-barai and installment debt labels on debt cards

The debt cards need English explanations for the Japan-specific payment structures, since these are genuinely unfamiliar to non-Japanese users.

On each ribo (revolving) debt card, add a small info pill below the card type badge:
- `Revolving Credit  リボ払い`
- `ⓘ  Minimum monthly payment with 15% annual interest on balance`

On each Paidy installment card, add:
- `0% Installment  分割払い`
- `ⓘ  Interest-free fixed payments · [N] remaining of [total]`

On the Paidy Apple card specifically, add:
- `0% Installment · Apple  分割払い (Apple専用)`
- `ⓘ  Apple 36-month interest-free plan · ¥8,739/month`

The ⓘ icon is a small inline icon button (shadcn `<HoverCard>` or `<Tooltip>`) that shows the full explanation on hover. Use the existing shadcn tooltip component — do not add a new dependency.

## Rule 7 — Empty states and onboarding copy

All empty state messages must be in English. Audit every empty state in the app and confirm the copy is English. The motivating copy on the Goals empty state, the Debt empty state, the Transactions empty state, and the Budget empty state must all be in English as specified in the design prompt.

## Rule 8 — Financial health score labels

The score component and its breakdown labels must all be in English:
- Score components: Savings Rate, Emergency Fund, Debt Load, Monthly Cash Flow, Investment Activity. Status labels: Excellent, Good, Fair, Needs Attention. The one-sentence explanation per component must be in English: e.g. "Your savings rate is 18% — just below the 20% target."

## Rule 9 — Budget category group names

The five default category groups must display in English: Fixed Bills, Debt Payments, Everyday Spending, Savings Goals, Investments. The "Custom" group stays as Custom. These are group header rows in the budget table — update every place they are hardcoded or stored as display strings.

## Rule 10 — Tooltip component standard

Use a single consistent tooltip implementation throughout the app. Use the shadcn `<Tooltip>` component (from `@/components/ui/tooltip`). Do not use `title` attributes, data-tooltip CSS tricks, or custom implementations. The tooltip should appear after a 300ms delay on hover, disappear immediately on mouse-out, and show at most 2 lines of text. Tooltip text is always in the format: `Japanese · English explanation` or just the Japanese original when the English primary is already shown.

Tooltip styling: follow the existing shadcn theme. Background matches the card background in dark mode. Text is small (`text-xs`). Max width 200px. Do not animate the tooltip — instant appear after delay is cleaner for dense data tables.

## Implementation order

Do these in order. Do not jump ahead.

1. Create `lib/categories.ts`, `lib/accounts.ts`, `lib/merchants.ts`, `lib/debtTypes.ts`.
2. Budget screen.
3. Transactions screen.
4. Debt screen.
5. Goals screen.
6. Sidebar.
7. Reports, Forecast, Investments, Settings screens.
8. Audit every remaining screen for any missed Japanese text. Search for Unicode range `぀-ヿ㐀-䶿一-鿿`.

## What not to change

Do not translate: the app name `Stashy`, institution proper nouns on physical cards (三井住友, JCB, セゾン, etc. when used as card identifiers), currency symbol `¥`, date formats, or any database field values. The database stores Japanese as-is. Only display layer changes.

Do not change: API routes, Prisma schema, calculation logic, component structure, layout, spacing, colors, or animations.

## Definition of done

Every screen passes this check: a person who reads no Japanese can navigate the entire app and understand every label, every category, every debt type, and every status without confusion. Japanese text is present everywhere as secondary context for cross-referencing statements, accessible on hover or as a subtle secondary label, but never required for comprehension.

Run `tsc --noEmit` after all changes. No TypeScript errors. Commit: `localisation: full English display layer with Japanese tooltips and secondary labels`.
