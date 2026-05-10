-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('checking', 'savings', 'credit');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('manual', 'OCR', 'CSV', 'recurring');

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('default', 'custom', 'system');

-- CreateEnum
CREATE TYPE "DebtType" AS ENUM ('revolving', 'installment', 'lump_sum');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('stocks', 'ETF', 'mutual_fund', 'cash', 'crypto', 'other');

-- CreateEnum
CREATE TYPE "InvestmentAccountSubtype" AS ENUM ('growth', 'tsumitate', 'ideco', 'taxable');

-- CreateEnum
CREATE TYPE "NisaAccountType" AS ENUM ('growth', 'tsumitate');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "balanceYen" INTEGER NOT NULL,
    "creditLimit" INTEGER,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryGroup" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCollapsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CategoryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "CategorySource" NOT NULL DEFAULT 'default',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "date" DATE NOT NULL,
    "payee" TEXT NOT NULL,
    "memo" TEXT,
    "amountYen" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "source" "TransactionSource" NOT NULL DEFAULT 'manual',
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "payee" TEXT NOT NULL,
    "memo" TEXT,
    "amountYen" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL DEFAULT 'debit',
    "dayOfMonth" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunMonth" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "categoryId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "assignedYen" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeEntry" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "month" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "amountYen" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "categoryId" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🎯',
    "name" TEXT NOT NULL,
    "currentSavedYen" INTEGER NOT NULL DEFAULT 0,
    "targetAmountYen" INTEGER NOT NULL,
    "monthlyAllocationYen" INTEGER NOT NULL DEFAULT 0,
    "targetDate" DATE NOT NULL,
    "priorityOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalBalanceUpdate" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalBalanceUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditDebt" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "categoryId" TEXT,
    "type" "DebtType" NOT NULL,
    "cardName" TEXT NOT NULL,
    "last4" TEXT,
    "description" TEXT,
    "currentBalanceYen" INTEGER NOT NULL DEFAULT 0,
    "originalAmountYen" INTEGER,
    "monthlyPaymentYen" INTEGER NOT NULL DEFAULT 0,
    "minimumPaymentYen" INTEGER,
    "annualInterestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalInstallments" INTEGER,
    "installmentsPaid" INTEGER,
    "expectedBillingDate" DATE,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditDebt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "accountName" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "accountSubtype" "InvestmentAccountSubtype" NOT NULL,
    "currentBalanceYen" INTEGER NOT NULL DEFAULT 0,
    "initialInvestedAmount" INTEGER,
    "monthlyContributionYen" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantRule" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "pattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "fuzzyMatch" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NisaContribution" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "year" INTEGER NOT NULL,
    "accountType" "NisaAccountType" NOT NULL,
    "totalContributed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NisaContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FatfireSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "dateOfBirth" DATE NOT NULL,
    "currentAge" INTEGER NOT NULL DEFAULT 30,
    "targetRetirementAge" INTEGER NOT NULL DEFAULT 50,
    "currentLiquidSavingsYen" INTEGER NOT NULL DEFAULT 0,
    "currentInvestmentsOverrideYen" INTEGER,
    "monthlyInvestmentOverrideYen" INTEGER,
    "expectedAnnualReturn" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "inflationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "targetAnnualRetirementSpendYen" INTEGER NOT NULL DEFAULT 6000000,
    "safeWithdrawalRate" DOUBLE PRECISION NOT NULL DEFAULT 0.04,
    "returnVolatility" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "retirementEndAge" INTEGER NOT NULL DEFAULT 90,
    "reserveThresholdYen" INTEGER NOT NULL DEFAULT 3000000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FatfireSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSnapshot" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "date" DATE NOT NULL,
    "assetsYen" INTEGER NOT NULL,
    "liabilitiesYen" INTEGER NOT NULL,
    "netWorthYen" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "extractedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL,
    "localUserId" TEXT NOT NULL DEFAULT 'local-user',
    "month" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "insight" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_localUserId_type_idx" ON "Account"("localUserId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Account_localUserId_name_key" ON "Account"("localUserId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryGroup_localUserId_name_key" ON "CategoryGroup"("localUserId", "name");

-- CreateIndex
CREATE INDEX "Category_groupId_idx" ON "Category"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_localUserId_name_key" ON "Category"("localUserId", "name");

-- CreateIndex
CREATE INDEX "Transaction_localUserId_date_idx" ON "Transaction"("localUserId", "date");

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_date_idx" ON "Transaction"("categoryId", "date");

-- CreateIndex
CREATE INDEX "RecurringExpense_localUserId_isActive_idx" ON "RecurringExpense"("localUserId", "isActive");

-- CreateIndex
CREATE INDEX "Budget_localUserId_month_idx" ON "Budget"("localUserId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_categoryId_month_key" ON "Budget"("categoryId", "month");

-- CreateIndex
CREATE INDEX "IncomeEntry_localUserId_month_idx" ON "IncomeEntry"("localUserId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsGoal_categoryId_key" ON "SavingsGoal"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsGoal_localUserId_name_key" ON "SavingsGoal"("localUserId", "name");

-- CreateIndex
CREATE INDEX "GoalBalanceUpdate_goalId_updatedAt_idx" ON "GoalBalanceUpdate"("goalId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditDebt_categoryId_key" ON "CreditDebt"("categoryId");

-- CreateIndex
CREATE INDEX "CreditDebt_localUserId_type_isPaid_idx" ON "CreditDebt"("localUserId", "type", "isPaid");

-- CreateIndex
CREATE UNIQUE INDEX "Investment_localUserId_accountName_key" ON "Investment"("localUserId", "accountName");

-- CreateIndex
CREATE INDEX "MerchantRule_localUserId_pattern_idx" ON "MerchantRule"("localUserId", "pattern");

-- CreateIndex
CREATE UNIQUE INDEX "NisaContribution_localUserId_year_accountType_key" ON "NisaContribution"("localUserId", "year", "accountType");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSnapshot_localUserId_date_key" ON "FinancialSnapshot"("localUserId", "date");

-- CreateIndex
CREATE INDEX "UploadedDocument_localUserId_status_idx" ON "UploadedDocument"("localUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiInsight_localUserId_month_key" ON "AiInsight"("localUserId", "month");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CategoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "UploadedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalBalanceUpdate" ADD CONSTRAINT "GoalBalanceUpdate_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SavingsGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDebt" ADD CONSTRAINT "CreditDebt_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantRule" ADD CONSTRAINT "MerchantRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
