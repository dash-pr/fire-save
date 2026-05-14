-- Extend account and transaction enums for the real data import.
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'brokerage';
ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'csv';
ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'pdf_smbc';
ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'pdf_jcb';
ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'pdf_saison';
ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'pdf_paidy';

-- Add import-required fields.
ALTER TABLE "RecurringExpense" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "CreditDebt" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "CreditDebt" ADD COLUMN IF NOT EXISTS "monthlyInterestRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
UPDATE "CreditDebt" SET "monthlyInterestRate" = COALESCE("monthlyInterestRate", "annualInterestRate" / 12, 0);
UPDATE "CreditDebt" SET "paymentDueDay" = 1 WHERE "paymentDueDay" IS NULL;
ALTER TABLE "CreditDebt" ALTER COLUMN "paymentDueDay" SET DEFAULT 1;
ALTER TABLE "CreditDebt" ALTER COLUMN "paymentDueDay" SET NOT NULL;

ALTER TABLE "MerchantRule" ADD COLUMN IF NOT EXISTS "categoryName" TEXT;
UPDATE "MerchantRule" AS mr
SET "categoryName" = c."name"
FROM "Category" AS c
WHERE mr."categoryId" = c."id" AND mr."categoryName" IS NULL;
UPDATE "MerchantRule" SET "categoryName" = '未分類' WHERE "categoryName" IS NULL;
ALTER TABLE "MerchantRule" ALTER COLUMN "categoryName" SET NOT NULL;

-- Idempotent import keys.
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_localUserId_date_payee_amountYen_accountId_key" ON "Transaction"("localUserId", "date", "payee", "amountYen", "accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "RecurringExpense_localUserId_payee_key" ON "RecurringExpense"("localUserId", "payee");
CREATE UNIQUE INDEX IF NOT EXISTS "IncomeEntry_localUserId_month_sourceName_amountYen_key" ON "IncomeEntry"("localUserId", "month", "sourceName", "amountYen");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditDebt_localUserId_cardName_type_description_key" ON "CreditDebt"("localUserId", "cardName", "type", "description");
CREATE INDEX IF NOT EXISTS "CreditDebt_accountId_idx" ON "CreditDebt"("accountId");
DROP INDEX IF EXISTS "MerchantRule_localUserId_pattern_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantRule_localUserId_pattern_key" ON "MerchantRule"("localUserId", "pattern");

ALTER TABLE "CreditDebt" DROP CONSTRAINT IF EXISTS "CreditDebt_accountId_fkey";
ALTER TABLE "CreditDebt" ADD CONSTRAINT "CreditDebt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
