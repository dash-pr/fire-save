export type Yen = number;

export type AccountType = "checking" | "savings" | "credit" | "brokerage";
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
  isArchived?: boolean;
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
  source: "manual" | "OCR" | "CSV" | "csv" | "pdf_smbc" | "pdf_jcb" | "pdf_saison" | "pdf_paidy" | "recurring";
};

export type BudgetAssignment = {
  categoryId: string;
  month: string;
  assignedYen: Yen;
  isManuallySet?: boolean;
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
  isManuallySet: boolean;
};

export type CreditDebt = {
  id: string;
  accountId?: string;
  categoryId?: string;
  type: DebtType;
  cardName: string;
  description?: string;
  currentBalanceYen: Yen;
  originalAmountYen?: Yen;
  monthlyPaymentYen: Yen;
  paymentDueDay?: number;
  annualInterestRate: number;
  monthlyInterestRate?: number;
  totalInstallments?: number;
  installmentsPaid?: number;
  expectedBillingDate?: string;
  isPaid?: boolean;
};

export type SavingsGoal = {
  id: string;
  categoryId?: string;
  fundingAccountId?: string;
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

export type GoalMutationResponse = {
  goal: SavingsGoal;
};

export type GoalDeleteResponse = {
  deleted: boolean;
  movedTransactions: number;
  removedCategoryId?: string | null;
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
  categoryName: string;
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

export type DebtListResponse = {
  debts: CreditDebt[];
};

export type DebtMutationResponse = {
  debt: CreditDebt;
};

export type DebtDeleteResponse = {
  deleted: boolean;
  movedTransactions: number;
  removedCategoryId?: string | null;
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
  initialNetMonthlyYen?: Yen;
  incomeGrowthRate?: number;
  incomeGrowthIntervalYears?: number;
  netSalaryCapYen?: Yen;
  annualContributionIncreaseRate?: number;
  currentIDeCoYen?: Yen;
  currentNisaYen?: Yen;
  nisaLifetimeUsedYen?: Yen;
  leanAnnualSpendYen?: Yen;
  regularAnnualSpendYen?: Yen;
  fatAnnualSpendYen?: Yen;
  swrBufferRate?: number;
  idecoMonthlyContributionYen?: Yen;
  idecoPlanType?: "full" | "dc";
  retirementResidenceTaxRate?: number;
  nisaAnnualLimitYen?: Yen;
  nisaLifetimeLimitYen?: Yen;
  taxableCapitalGainsTaxRate?: number;
  taxWrapperMode?: "split" | "nisa" | "ideco" | "taxable";
  showNominal?: boolean;
  bullRealReturn?: number;
  baseRealReturn?: number;
  bearRealReturn?: number;
  customRealReturn?: number;
  customScenarioLabel?: string;
  activeScenario?: "bear" | "base" | "bull" | "custom";
  // Scenario-specific mortgage rate paths (Bear +0.3%/y cap 4%, Base +0.15%/y cap 3%, Bull 0% cap 1.5%).
  // If omitted, falls back to `mortgageRateAnnualIncrease` / `mortgageRateCap` for all scenarios.
  scenarioMortgageRateGrowth?: Partial<Record<"bear" | "base" | "bull" | "custom", { annualIncrease: number; cap: number }>>;
  includePension?: boolean;
  pensionMonthlyYen?: Yen;
  includeMortgage?: boolean;
  propertyPurchaseAge?: number;
  propertyValueYen?: Yen;
  mortgageInterestRate?: number;
  mortgageTermYears?: number;
  mortgageRateAnnualIncrease?: number;
  mortgageRateCap?: number;
  partnerHousingShareRate?: number;
  rentMonthlyYen?: Yen;
  utilitiesMonthlyYen?: Yen;
  phoneInternetMonthlyYen?: Yen;
  condoManagementFeeMonthlyYen?: Yen;
  propertyTaxAnnualYen?: Yen;
  groceriesMonthlyYen?: Yen;
  transportMonthlyYen?: Yen;
  personalCareMonthlyYen?: Yen;
  fineDiningMonthlyYen?: Yen;
  drinkingMonthlyYen?: Yen;
  travelAnnualYen?: Yen;
  bridgePhaseEnabled?: boolean;
  bridgeStartAge?: number;
  bridgeEndAge?: number;
  bridgeMonthlyIncomeYen?: Yen;
  spendingPhasesEnabled?: boolean;
  goGoSpendingMultiplier?: number;
  slowGoSpendingMultiplier?: number;
  noGoSpendingMultiplier?: number;
  slowGoStartAge?: number;
  noGoStartAge?: number;
  lifeEvents?: Array<{
    id: string;
    age: number;
    type: "incomeChange" | "recurringExpense" | "windfall" | "expense";
    amountYen: Yen;
    label: string;
    endAge?: number;
    lifestyleReductionRate?: number;
  }>;
};
