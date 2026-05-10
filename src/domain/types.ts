export type Yen = number;

export type AccountType = "checking" | "savings" | "credit";
export type TransactionType = "debit" | "credit";
export type DebtType = "revolving" | "installment" | "lump_sum";
export type AssetType = "stocks" | "ETF" | "mutual_fund" | "cash" | "crypto" | "other";
export type InvestmentAccountSubtype = "growth" | "tsumitate" | "ideco" | "taxable";
export type NisaAccountType = "growth" | "tsumitate";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  balanceYen: Yen;
  creditLimit?: Yen;
};

export type CategoryGroup = {
  id: string;
  name: string;
  categories: Category[];
};

export type Category = {
  id: string;
  groupId: string;
  name: string;
  source: "default" | "custom" | "system";
  isArchived?: boolean;
};

export type Transaction = {
  id: string;
  accountId: string;
  categoryId?: string;
  date: string;
  payee: string;
  memo?: string;
  amountYen: Yen;
  type: TransactionType;
  source: "manual" | "OCR" | "CSV" | "recurring";
};

export type BudgetAssignment = {
  categoryId: string;
  month: string;
  assignedYen: Yen;
};

export type MonthlyIncome = {
  month: string;
  incomeYen: Yen;
};

export type IncomeEntry = {
  id: string;
  month: string;
  sourceName: string;
  amountYen: Yen;
  createdAt?: string;
};

export type BudgetStatus = "overspent" | "underfunded" | "funded";

export type BudgetRow = {
  category: Category;
  assignedYen: Yen;
  activityYen: Yen;
  availableYen: Yen;
  status: BudgetStatus;
};

export type CreditDebt = {
  id: string;
  type: DebtType;
  cardName: string;
  description?: string;
  currentBalanceYen: Yen;
  originalAmountYen?: Yen;
  monthlyPaymentYen: Yen;
  annualInterestRate: number;
  totalInstallments?: number;
  installmentsPaid?: number;
  expectedBillingDate?: string;
  isPaid?: boolean;
};

export type SavingsGoal = {
  id: string;
  categoryId?: string;
  emoji: string;
  name: string;
  currentSavedYen: Yen;
  targetAmountYen: Yen;
  monthlyAllocationYen: Yen;
  targetDate: string;
  notes?: string;
  completedAt?: string;
};

export type GoalBalanceUpdate = {
  id: string;
  goalId: string;
  amount: Yen;
  note?: string;
  updatedAt?: string;
};

export type Investment = {
  id: string;
  accountName: string;
  assetType: AssetType;
  accountSubtype: InvestmentAccountSubtype;
  currentBalanceYen: Yen;
  initialInvestedAmount?: Yen;
  monthlyContributionYen: Yen;
  notes?: string;
};

export type MerchantRule = {
  id: string;
  pattern: string;
  categoryId: string;
  fuzzyMatch: boolean;
  createdAt?: string;
};

export type NisaContribution = {
  id: string;
  year: number;
  accountType: NisaAccountType;
  totalContributed: Yen;
};

export type IncomeEntriesResponse = {
  entries: IncomeEntry[];
  totalIncomeYen: Yen;
};

export type BudgetAutoPopulateResponse = {
  month: string;
  created: boolean;
  assignments: BudgetAssignment[];
  incomeEntries: IncomeEntry[];
  estimatedCategoryIds: string[];
  warning?: string;
};

export type NisaCheckResponse = {
  year: number;
  accountType: NisaAccountType;
  requestedYen: Yen;
  allowedYen: Yen;
  overflowYen: Yen;
  remainingAnnualYen: Yen;
  message?: string;
};

export type ForecastInputs = {
  dateOfBirth?: string;
  currentAge?: number;
  targetRetirementAge: number;
  retirementEndAge: number;
  currentPortfolioYen: Yen;
  monthlyContributionYen: Yen;
  currentInvestmentsOverrideYen?: Yen;
  monthlyInvestmentOverrideYen?: Yen;
  expectedAnnualReturn: number;
  inflationRate: number;
  targetAnnualRetirementSpendYen: Yen;
  safeWithdrawalRate: number;
  returnVolatility: number;
  reserveThresholdYen: Yen;
};
