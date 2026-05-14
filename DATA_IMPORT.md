# Data Import Task

Read GOALS.md before starting. This task imports real user financial data into the Stashy database. Save this prompt to DATA_IMPORT.md before writing any code.

Place the file stashy_import.json in the project root. This file contains all source data.

## Step 1 — Schema verification and migration

Before importing any data, audit the Prisma schema against the requirements in stashy_import.json under schemaAdditionsRequired. Verify and add if missing:

- The CreditDebt model must have annualInterestRate Float, monthlyInterestRate Float, and paymentDueDay Int fields. If missing, add them and run prisma migrate dev --name add_debt_interest_fields.
- The Transaction model source enum or string field must accept pdf_smbc, pdf_jcb, pdf_saison, and pdf_paidy as valid values in addition to existing values. Update accordingly.
- The IncomeEntry model must exist as a separate table from MonthlyIncome to support multiple income sources per month. Schema: id String @id @default(cuid()), month String, sourceName String, amount Int, createdAt DateTime @default(now()). If MonthlyIncome is a single-amount model, add IncomeEntry as a new model alongside it. Do not delete MonthlyIncome if it is referenced elsewhere.
- The MerchantRule model must exist with fields: id, pattern String, categoryName String (use name-based lookup for import since category IDs are not yet known), fuzzyMatch Boolean @default(true), createdAt DateTime @default(now()).
- The RecurringExpense model must have a notes String? field.
- Run prisma migrate dev after all schema changes. Confirm zero TypeScript errors before proceeding.

## Step 2 — Create a one-shot import script

Create a file at scripts/import-user-data.ts. This script reads stashy_import.json and imports all data in dependency order. It must be idempotent — running it twice must not create duplicates. Use upsert where possible.

The script must be runnable with npx ts-node scripts/import-user-data.ts. Add ts-node as a dev dependency if not present.

Import order must be strictly: categories seed check → accounts → income entries → recurring expenses → credit debts → transactions → merchant rules. Each section logs progress to the console.

### Categories seed check

Before importing, verify that the default category set exists in the database. If any of these category names are missing, create them: 住宅, 通信費, 光熱費, 食料品, 外食, 食費, 交通費, 旅行・宿泊, 旅行・スキー, 健康・医療, 映画・エンタメ, 趣味・スポーツ, ショッピング, サブスクリプション, 事業経費, ローン返済, 送金, 交際費, 日用品, 収入, カフェ, その他, 未分類. Log any that were created as new.

### Accounts import

For each account in the JSON, upsert by name. Map type strings to the AccountType enum: checking, savings, credit, brokerage. Set balance from the JSON. Store the generated id in a local map keyed by the JSON id field (e.g. "acc_smbc") — this map is used when importing transactions and debts.

### Income entries import

For each month's entries in incomeEntries, upsert by month + sourceName + amount composite. If an entry with the same month and sourceName already exists, skip it.

### Recurring expenses import

For each recurring expense, upsert by name. Resolve category string to a category ID by looking up the category name created in the seed step. Set all fields including notes if present.

### Credit debts import

For each debt in creditDebts, upsert by cardName + debtType + description composite. Resolve accountId using the account ID map. Set annualInterestRate, monthlyInterestRate, and paymentDueDay. Log each debt with its outstanding balance.

For the Paidy Apple debt specifically: totalInstallments: 36, installmentsPaid: 16, monthlyPayment: 314600, outstandingBalance: 5978400. Verify this is imported correctly since it is the largest single debt item.

### Transactions import

For each transaction, upsert by date + merchant + amount + accountId composite to prevent duplicates. Resolve accountId using the account ID map. Resolve category string to a category ID by name lookup. If a category name does not exist, create it and log a warning. Set source from the JSON value. If source is not in the enum, map it to manual and log a warning.

Skip any transaction where accountId could not be resolved (log it). Skip any transaction with amount: 0.

After all transactions are imported, log: total imported, total skipped, total with unresolved categories.

### Merchant rules import

For each rule in merchantRules, upsert by pattern. Resolve categoryName to a category ID. If the category does not exist, skip the rule and log a warning.

## Step 3 — Verification queries

After the import script completes, run these verification checks and print results to the console:

- Total accounts count.
- Total transactions count.
- Transactions per month (group by YYYY-MM).
- Total credit debt outstanding (sum of all outstandingBalance).
- Total Paidy installment monthly obligation (sum of monthlyPayment where debtType = installment and cardName contains Paidy).
- Ribo total outstanding (SMBC + JCB + Saison combined).
- Income entries per month.
- Recurring expenses count.

Expected approximate values after successful import: 9 accounts, 115+ transactions, total ribo outstanding ~¥812,316 (115,960 + 115,960 + 580,416), Paidy Apple monthly payment ¥314,600.

## Step 4 — Fix budget screen for imported data

After import, open the app and verify:

- The Debt screen shows all 18 debts correctly grouped. Ribo-barai cards (SMBC, JCB, Saison) show their interest rates and payoff calculations. Paidy installments show remaining installment counts and 0% APR. The Paidy Apple 36-month plan shows correctly as ¥314,600/month with 16 of 36 paid.
- The sidebar shows all 9 accounts in their correct groups: Yucho and Sony in Savings, SMBC/JCB/Saison/Paidy/PayPay/Mercari/Rakuten in Credit Cards.
- The Budget screen for April 2026 shows transactions correctly attributed to their categories. The income section shows ¥905,756 total (594,672 salary + 75,741 + 178,425 freelance + 56,918 transfer).
- The Debt Payments budget category group is auto-populated with the correct monthly obligations: SMBC ribo ¥62,548, JCB ribo ¥57,177, Saison ribo ¥60,000, Paidy total ~¥30,494.

If any of these checks fail, debug and fix the import script. Do not modify the JSON source data.

## Step 5 — Commit

Commit: "data: import real user financial data — 9 accounts, 18 debts, 115 transactions". Do not commit the stashy_import.json file to version control — add it to .gitignore since it contains personal financial data. Instead commit only the import script and schema migrations.
