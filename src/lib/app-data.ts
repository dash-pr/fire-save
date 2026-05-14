import type {
  Account,
  BudgetAssignment,
  Category,
  CategoryGroup,
  CreditDebt,
  ForecastInputs,
  IncomeEntry,
  Investment,
  MerchantRule,
  SavingsGoal,
  Transaction,
} from "@/domain/types";
import {
  accounts as sampleAccounts,
  budgetAssignments as sampleBudgetAssignments,
  categories as sampleCategories,
  categoryGroups as sampleCategoryGroups,
  currentMonth as sampleCurrentMonth,
  debts as sampleDebts,
  forecastInputs as sampleForecastInputs,
  incomeEntries as sampleIncomeEntries,
  investments as sampleInvestments,
  merchantRules as sampleMerchantRules,
  savingsGoals as sampleGoals,
  transactions as sampleTransactions,
} from "@/data/sample-data";
import { prisma } from "@/lib/prisma";

export type AppInitialData = {
  currentMonth: string;
  accounts: Account[];
  categoryGroups: CategoryGroup[];
  categories: Category[];
  budgetAssignments: BudgetAssignment[];
  incomeEntries: IncomeEntry[];
  transactions: Transaction[];
  debts: CreditDebt[];
  investments: Investment[];
  merchantRules: MerchantRule[];
  goals: SavingsGoal[];
  forecastInputs: ForecastInputs;
};

export const sampleAppInitialData: AppInitialData = {
  currentMonth: sampleCurrentMonth,
  accounts: sampleAccounts,
  categoryGroups: sampleCategoryGroups,
  categories: sampleCategories,
  budgetAssignments: sampleBudgetAssignments,
  incomeEntries: sampleIncomeEntries,
  transactions: sampleTransactions,
  debts: sampleDebts,
  investments: sampleInvestments,
  merchantRules: sampleMerchantRules,
  goals: sampleGoals,
  forecastInputs: sampleForecastInputs,
};

function dateToMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function latestMonth(transactions: Transaction[], incomeEntries: IncomeEntry[]): string {
  const months = [
    ...transactions.map((transaction) => transaction.date.slice(0, 7)),
    ...incomeEntries.map((entry) => entry.month),
  ].filter(Boolean).sort();
  return months.at(-1) ?? sampleCurrentMonth;
}

export async function loadAppInitialData(): Promise<AppInitialData> {
  try {
    const [
      accounts,
      categoryGroups,
      categories,
      budgets,
      incomeEntries,
      transactions,
      debts,
      investments,
      merchantRules,
      goals,
      settings,
    ] = await Promise.all([
      prisma.account.findMany({ where: { localUserId: "local-user" }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
      prisma.categoryGroup.findMany({ where: { localUserId: "local-user" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.category.findMany({ where: { localUserId: "local-user" }, orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }] }),
      prisma.budget.findMany({ where: { localUserId: "local-user" }, orderBy: [{ month: "asc" }] }),
      prisma.incomeEntry.findMany({ where: { localUserId: "local-user" }, orderBy: [{ month: "asc" }, { createdAt: "asc" }] }),
      prisma.transaction.findMany({ where: { localUserId: "local-user" }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
      prisma.creditDebt.findMany({ where: { localUserId: "local-user" }, orderBy: [{ createdAt: "asc" }] }),
      prisma.investment.findMany({ where: { localUserId: "local-user" }, orderBy: [{ accountName: "asc" }] }),
      prisma.merchantRule.findMany({ where: { localUserId: "local-user" }, orderBy: [{ createdAt: "desc" }] }),
      prisma.savingsGoal.findMany({ where: { localUserId: "local-user" }, orderBy: [{ priorityOrder: "asc" }] }),
      prisma.fatfireSettings.findFirst({ where: { localUserId: "local-user" } }),
    ]);

    if (accounts.length === 0 && categories.length === 0 && transactions.length === 0) {
      return sampleAppInitialData;
    }

    const serializedIncomeEntries: IncomeEntry[] = incomeEntries.map((entry) => ({
      id: entry.id,
      month: entry.month,
      sourceName: entry.sourceName,
      amountYen: entry.amountYen,
      createdAt: entry.createdAt.toISOString(),
    }));
    const serializedTransactions: Transaction[] = transactions.map((transaction) => ({
      id: transaction.id,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId ?? undefined,
      date: dateToDay(transaction.date),
      payee: transaction.payee,
      memo: transaction.memo ?? undefined,
      amountYen: transaction.amountYen,
      type: transaction.type,
      source: transaction.source,
    }));

    return {
      currentMonth: latestMonth(serializedTransactions, serializedIncomeEntries),
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        balanceYen: account.balanceYen,
        creditLimit: account.creditLimit ?? undefined,
        isArchived: account.isArchived,
      })),
      categoryGroups: categoryGroups.map((group) => ({
        id: group.id,
        name: group.name,
        categories: [],
      })),
      categories: categories.map((category) => ({
        id: category.id,
        groupId: category.groupId,
        name: category.name,
        source: category.source,
        isArchived: category.isArchived,
      })),
      budgetAssignments: budgets.map((budget) => ({
        categoryId: budget.categoryId,
        month: dateToMonth(budget.month),
        assignedYen: budget.assignedYen,
        isManuallySet: budget.isManuallySet,
      })),
      incomeEntries: serializedIncomeEntries,
      transactions: serializedTransactions,
      debts: debts.map((debt) => ({
        id: debt.id,
        accountId: debt.accountId ?? undefined,
        categoryId: debt.categoryId ?? undefined,
        type: debt.type,
        cardName: debt.cardName,
        description: debt.description ?? undefined,
        currentBalanceYen: debt.currentBalanceYen,
        originalAmountYen: debt.originalAmountYen ?? undefined,
        monthlyPaymentYen: debt.monthlyPaymentYen,
        paymentDueDay: debt.paymentDueDay,
        annualInterestRate: debt.annualInterestRate,
        monthlyInterestRate: debt.monthlyInterestRate,
        totalInstallments: debt.totalInstallments ?? undefined,
        installmentsPaid: debt.installmentsPaid ?? undefined,
        expectedBillingDate: debt.expectedBillingDate ? dateToDay(debt.expectedBillingDate) : undefined,
        isPaid: debt.isPaid,
      })),
      investments: investments.map((investment) => ({
        id: investment.id,
        accountName: investment.accountName,
        assetType: investment.assetType,
        accountSubtype: investment.accountSubtype,
        currentBalanceYen: investment.currentBalanceYen,
        initialInvestedAmount: investment.initialInvestedAmount ?? undefined,
        monthlyContributionYen: investment.monthlyContributionYen,
        notes: investment.notes ?? undefined,
      })),
      merchantRules: merchantRules.map((rule) => ({
        id: rule.id,
        pattern: rule.pattern,
        categoryName: rule.categoryName,
        categoryId: rule.categoryId,
        fuzzyMatch: rule.fuzzyMatch,
        createdAt: rule.createdAt.toISOString(),
      })),
      goals: goals.map((goal) => ({
        id: goal.id,
        categoryId: goal.categoryId ?? undefined,
        fundingAccountId: goal.fundingAccountId ?? undefined,
        emoji: goal.emoji,
        name: goal.name,
        currentSavedYen: goal.currentSavedYen,
        targetAmountYen: goal.targetAmountYen,
        monthlyAllocationYen: goal.monthlyAllocationYen,
        targetDate: dateToDay(goal.targetDate),
        completedAt: goal.completedAt?.toISOString(),
      })),
      forecastInputs: settings ? {
        ...sampleForecastInputs,
        dateOfBirth: dateToDay(settings.dateOfBirth),
        currentAge: settings.currentAge,
        targetRetirementAge: settings.targetRetirementAge,
        currentPortfolioYen: settings.currentInvestmentsOverrideYen ?? sampleForecastInputs.currentPortfolioYen,
        currentInvestmentsOverrideYen: settings.currentInvestmentsOverrideYen ?? undefined,
        monthlyInvestmentOverrideYen: settings.monthlyInvestmentOverrideYen ?? undefined,
        expectedAnnualReturn: settings.expectedAnnualReturn,
        inflationRate: settings.inflationRate,
        targetAnnualRetirementSpendYen: settings.targetAnnualRetirementSpendYen,
        safeWithdrawalRate: settings.safeWithdrawalRate,
        returnVolatility: settings.returnVolatility,
        retirementEndAge: settings.retirementEndAge,
        reserveThresholdYen: settings.reserveThresholdYen,
      } : sampleForecastInputs,
    };
  } catch (error) {
    console.error("Failed to load database-backed app data. Falling back to sample data.", error);
    return sampleAppInitialData;
  }
}
