import type {
  Account,
  BudgetAssignment,
  Category,
  CategoryGroup,
  CreditDebt,
  ForecastInputs,
  IncomeEntry,
  Investment,
  MonthlyIncome,
  MerchantRule,
  NisaContribution,
  SavingsGoal,
  Transaction,
} from "@/domain/types";

export const currentMonth = "2026-05";

export const accounts: Account[] = [
  { id: "acct-checking", name: "SMBC Checking", type: "checking", balanceYen: 820000 },
  { id: "acct-savings", name: "Emergency Savings", type: "savings", balanceYen: 1250000 },
  { id: "acct-card", name: "Rakuten Card", type: "credit", balanceYen: -180000, creditLimit: 800000 },
];

export const categories: Category[] = [
  { id: "cat-rent", groupId: "grp-fixed", name: "Rent / Housing", source: "default" },
  { id: "cat-utilities", groupId: "grp-fixed", name: "Utilities", source: "default" },
  { id: "cat-phone", groupId: "grp-fixed", name: "Internet / Phone", source: "default" },
  { id: "cat-ribo", groupId: "grp-debt", name: "Rakuten Ribo Payment", source: "system" },
  { id: "cat-bunkatsu", groupId: "grp-debt", name: "Camera Bunkatsu", source: "system" },
  { id: "cat-groceries", groupId: "grp-everyday", name: "Groceries", source: "default" },
  { id: "cat-transport", groupId: "grp-everyday", name: "Transport", source: "default" },
  { id: "cat-dining", groupId: "grp-everyday", name: "Dining Out", source: "default" },
  { id: "cat-entertainment", groupId: "grp-everyday", name: "Entertainment", source: "default" },
  { id: "cat-gaming-pc", groupId: "grp-goals", name: "Gaming PC", source: "system" },
  { id: "cat-europe", groupId: "grp-goals", name: "Europe Trip", source: "system" },
  { id: "cat-nisa", groupId: "grp-investments", name: "NISA Contribution", source: "default" },
  { id: "cat-ideco", groupId: "grp-investments", name: "iDeCo Contribution", source: "default" },
];

export const categoryGroups: CategoryGroup[] = [
  { id: "grp-fixed", name: "Fixed Bills", categories: categories.filter((category) => category.groupId === "grp-fixed") },
  { id: "grp-debt", name: "Debt Payments", categories: categories.filter((category) => category.groupId === "grp-debt") },
  { id: "grp-everyday", name: "Everyday Spending", categories: categories.filter((category) => category.groupId === "grp-everyday") },
  { id: "grp-goals", name: "Savings Goals", categories: categories.filter((category) => category.groupId === "grp-goals") },
  { id: "grp-investments", name: "Investments", categories: categories.filter((category) => category.groupId === "grp-investments") },
];

export const monthlyIncome: MonthlyIncome = { month: currentMonth, incomeYen: 0 };

export const incomeEntries: IncomeEntry[] = [];

export const budgetAssignments: BudgetAssignment[] = [
  { categoryId: "cat-rent", month: currentMonth, assignedYen: 240000 },
  { categoryId: "cat-utilities", month: currentMonth, assignedYen: 26000 },
  { categoryId: "cat-phone", month: currentMonth, assignedYen: 12000 },
  { categoryId: "cat-ribo", month: currentMonth, assignedYen: 15000 },
  { categoryId: "cat-bunkatsu", month: currentMonth, assignedYen: 10000 },
  { categoryId: "cat-groceries", month: currentMonth, assignedYen: 68000 },
  { categoryId: "cat-transport", month: currentMonth, assignedYen: 22000 },
  { categoryId: "cat-dining", month: currentMonth, assignedYen: 45000 },
  { categoryId: "cat-entertainment", month: currentMonth, assignedYen: 18000 },
  { categoryId: "cat-gaming-pc", month: currentMonth, assignedYen: 35000 },
  { categoryId: "cat-europe", month: currentMonth, assignedYen: 65000 },
  { categoryId: "cat-nisa", month: currentMonth, assignedYen: 100000 },
  { categoryId: "cat-ideco", month: currentMonth, assignedYen: 23000 },
];

export const transactions: Transaction[] = [
  { id: "txn-income", accountId: "acct-checking", date: "2026-05-25", payee: "Salary", amountYen: 780000, type: "credit", source: "manual" },
  { id: "txn-rent", accountId: "acct-checking", categoryId: "cat-rent", date: "2026-05-01", payee: "Tokyo Rent", amountYen: 240000, type: "debit", source: "recurring" },
  { id: "txn-power", accountId: "acct-checking", categoryId: "cat-utilities", date: "2026-05-07", payee: "TEPCO", amountYen: 13200, type: "debit", source: "OCR" },
  { id: "txn-phone", accountId: "acct-card", categoryId: "cat-phone", date: "2026-05-10", payee: "Docomo", amountYen: 9800, type: "debit", source: "CSV" },
  { id: "txn-grocery-1", accountId: "acct-card", categoryId: "cat-groceries", date: "2026-05-11", payee: "Life Supermarket", amountYen: 18420, type: "debit", source: "CSV" },
  { id: "txn-grocery-2", accountId: "acct-card", categoryId: "cat-groceries", date: "2026-05-17", payee: "Summit Store", amountYen: 22300, type: "debit", source: "manual" },
  { id: "txn-transport", accountId: "acct-checking", categoryId: "cat-transport", date: "2026-05-12", payee: "Suica Charge", amountYen: 12000, type: "debit", source: "manual" },
  { id: "txn-dining", accountId: "acct-card", categoryId: "cat-dining", date: "2026-05-13", payee: "Izakaya", amountYen: 16800, type: "debit", source: "OCR" },
  { id: "txn-uncat", accountId: "acct-card", date: "2026-05-18", payee: "Unknown Merchant", amountYen: 7300, type: "debit", source: "OCR" },
  { id: "txn-ribo", accountId: "acct-checking", categoryId: "cat-ribo", date: "2026-05-20", payee: "Rakuten Ribo", amountYen: 15000, type: "debit", source: "manual" },
  { id: "txn-nisa", accountId: "acct-checking", categoryId: "cat-nisa", date: "2026-05-21", payee: "SBI NISA", amountYen: 100000, type: "debit", source: "recurring" },
];

export const savingsGoals: SavingsGoal[] = [
  { id: "goal-gaming-pc", emoji: "🖥️", name: "Gaming PC", currentSavedYen: 84000, targetAmountYen: 200000, monthlyAllocationYen: 35000, targetDate: "2026-09-30" },
  { id: "goal-europe", emoji: "✈️", name: "Europe Trip", currentSavedYen: 155000, targetAmountYen: 500000, monthlyAllocationYen: 65000, targetDate: "2027-03-31" },
];

export const debts: CreditDebt[] = [
  { id: "debt-ribo", type: "revolving", cardName: "Rakuten Card", description: "Ribo-barai", currentBalanceYen: 300000, monthlyPaymentYen: 15000, annualInterestRate: 0.15 },
  { id: "debt-bunkatsu", type: "installment", cardName: "JCB Card", description: "Camera bunkatsu", currentBalanceYen: 80000, originalAmountYen: 120000, monthlyPaymentYen: 10000, annualInterestRate: 0, totalInstallments: 12, installmentsPaid: 4 },
  { id: "debt-ikkatsu", type: "lump_sum", cardName: "Amazon Mastercard", description: "Ikkatsu billing", currentBalanceYen: 45000, monthlyPaymentYen: 45000, annualInterestRate: 0, expectedBillingDate: "2026-06-10" },
];

export const investments: Investment[] = [
  { id: "inv-nisa-growth", accountName: "SBI NISA Growth", assetType: "ETF", accountSubtype: "growth", currentBalanceYen: 0, monthlyContributionYen: 0, notes: "成長投資枠" },
  { id: "inv-nisa-tsumitate", accountName: "SBI NISA Tsumitate", assetType: "mutual_fund", accountSubtype: "tsumitate", currentBalanceYen: 0, monthlyContributionYen: 0, notes: "積立NISA" },
  { id: "inv-ideco", accountName: "iDeCo", assetType: "mutual_fund", accountSubtype: "ideco", currentBalanceYen: 0, monthlyContributionYen: 0 },
  { id: "inv-taxable", accountName: "Taxable Brokerage", assetType: "ETF", accountSubtype: "taxable", currentBalanceYen: 0, monthlyContributionYen: 0 },
];

export const merchantRules: MerchantRule[] = [];

export const nisaContributions: NisaContribution[] = [
  { id: "nisa-2026-growth", year: 2026, accountType: "growth", totalContributed: 0 },
  { id: "nisa-2026-tsumitate", year: 2026, accountType: "tsumitate", totalContributed: 0 },
];

export const forecastInputs: ForecastInputs = {
  dateOfBirth: "1996-02-01",
  currentAge: 30,
  targetRetirementAge: 50,
  retirementEndAge: 90,
  currentPortfolioYen: 0,
  monthlyContributionYen: 150000,
  expectedAnnualReturn: 0.07,
  inflationRate: 0.02,
  targetAnnualRetirementSpendYen: 6000000,
  safeWithdrawalRate: 0.04,
  returnVolatility: 0.12,
  reserveThresholdYen: 3000000,
};
