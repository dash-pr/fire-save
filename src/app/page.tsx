"use client";

import { useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bot, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, SlidersHorizontal, Trash2, UploadCloud, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, MetricCard } from "@/components/shared/card";
import { ProgressBar, StatusPill } from "@/components/shared/progress";
import {
  accounts,
  budgetAssignments,
  categories,
  categoryGroups,
  currentMonth,
  debts,
  forecastInputs,
  incomeEntries,
  investments,
  merchantRules,
  nisaContributions,
  savingsGoals,
  transactions,
} from "@/data/sample-data";
import { buildBudgetRows, calculateReadyToAssignYen, calculateSavingsRate } from "@/domain/budget";
import { calculateBunkatsuRemaining, calculateDebtSummary, calculateRiboPayoff } from "@/domain/debt";
import {
  calculateAgeFromDob,
  calculateDeterministicForecast,
  getCurrentAge,
} from "@/domain/forecast";
import { ForecastPage } from "@/components/forecast/forecast-page";
import { calculateHealthScore, calculateNetWorth } from "@/domain/finance";
import { calculateInvestmentGain, calculateLifetimeNisaUsage, formatInvestmentSubtype, NISA_LIFETIME_LIMIT_YEN } from "@/domain/investments";
import type { Account, BudgetAssignment, Category, CreditDebt, ForecastInputs, IncomeEntry, Investment, MerchantRule, SavingsGoal, Transaction } from "@/domain/types";
import { formatJPY, formatMonth, formatPercent } from "@/lib/format";

type PageKey = "home" | "budget" | "transactions" | "debt" | "goals" | "investments" | "forecast" | "reports" | "import" | "settings";

const pageTitles: Record<PageKey, { title: string; subtitle: string }> = {
  home: { title: "Financial Overview", subtitle: "A concise operating view for this month, focused on decisions that need attention." },
  budget: { title: "Monthly Budget", subtitle: "Assign income to categories, review activity, and keep available balances accurate." },
  transactions: { title: "Transaction Review", subtitle: "Review spending, identify uncategorized activity, and prepare imports for categorization." },
  debt: { title: "Debt Payoff Plan", subtitle: "Track ribo-barai, bunkatsu-barai, and upcoming ikkatsu liabilities with editable assumptions." },
  goals: { title: "Savings Goals", subtitle: "Monitor goal funding and monthly allocations that feed the budget." },
  investments: { title: "Investment Plan", subtitle: "Maintain manual balances, contributions, and return assumptions used by the forecast." },
  forecast: { title: "FATFire Projection", subtitle: "Model FATFire age, risk, drawdowns, and retirement survival from editable assumptions." },
  reports: { title: "Reports", subtitle: "Review spending allocation, net worth, and income-versus-expense trends." },
  import: { title: "Add Transactions", subtitle: "Upload CSV or Japanese statements, review extracted rows, and confirm only verified transactions." },
  settings: { title: "Planning Defaults", subtitle: "Edit the default values that drive calculations across the local planning workspace." },
};

const compactCurrency = (value: number) => `¥${Math.round(value / 1_000_000)}M`;
const budgetKey = (month: string, categoryId: string) => `${month}:${categoryId}`;
const monthStartDate = (month: string) => new Date(`${month}-01T00:00:00`);
const makeLocalId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const NISA_GROWTH_ANNUAL_LIMIT_YEN = 2_400_000;
const NISA_COMBINED_ANNUAL_LIMIT_YEN = 3_600_000;

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isLifestyleCategory(category: Category): boolean {
  return category.groupId === "grp-everyday";
}

function isFixedPriorityCategory(category: Category): boolean {
  return ["grp-fixed", "grp-debt", "grp-investments", "grp-goals"].includes(category.groupId);
}

function normalizeMerchant(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ン一-龥]/g, "");
}

function matchesMerchantRule(payee: string, rule: MerchantRule): boolean {
  const merchant = normalizeMerchant(payee);
  const pattern = normalizeMerchant(rule.pattern);
  return rule.fuzzyMatch ? merchant.includes(pattern) : merchant === pattern;
}

function weekOfMonth(date: string): string {
  const day = new Date(`${date}T00:00:00`).getDate();
  return `Week ${Math.ceil(day / 7)}`;
}

export default function Home() {
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [transactionAccountFilterIds, setTransactionAccountFilterIds] = useState<string[]>([]);
  const [transactionCategoryFilterIds, setTransactionCategoryFilterIds] = useState<string[]>([]);
  const [accountState, setAccountState] = useState<Account[]>(accounts);
  const [incomeEntryState, setIncomeEntryState] = useState<IncomeEntry[]>(incomeEntries);
  const [categoryState, setCategoryState] = useState<Category[]>(categories);
  const [transactionState, setTransactionState] = useState<Transaction[]>(transactions);
  const [merchantRuleState, setMerchantRuleState] = useState<MerchantRule[]>(merchantRules);
  const [assignmentState, setAssignmentState] = useState<Record<string, number>>(
    Object.fromEntries(budgetAssignments.map((assignment) => [budgetKey(assignment.month, assignment.categoryId), assignment.assignedYen])),
  );
  const [estimatedAssignments, setEstimatedAssignments] = useState<Record<string, boolean>>({});
  const [budgetNotice, setBudgetNotice] = useState<string | null>(null);
  const [debtState, setDebtState] = useState<CreditDebt[]>(debts);
  const [goalState, setGoalState] = useState<SavingsGoal[]>(savingsGoals);
  const [investmentState, setInvestmentState] = useState<Investment[]>(investments);
  const [assumptions, setAssumptions] = useState<ForecastInputs>(forecastInputs);
  const [budgetFilter, setBudgetFilter] = useState<"all" | "overspent" | "underfunded" | "funded">("all");

  const activeCategories = categoryState.filter((category) => !category.isArchived);
  const currentIncomeEntries = incomeEntryState.filter((entry) => entry.month === selectedMonth);
  const incomeYen = currentIncomeEntries.reduce((total, entry) => total + entry.amountYen, 0);

  const currentAge = getCurrentAge(assumptions);
  const monthlyContributionYen = investmentState.reduce((total, investment) => total + investment.monthlyContributionYen, 0);
  const effectiveForecastInputs: ForecastInputs = {
    ...assumptions,
    currentAge,
    currentPortfolioYen: assumptions.currentInvestmentsOverrideYen ?? assumptions.currentPortfolioYen,
    monthlyContributionYen: assumptions.monthlyInvestmentOverrideYen ?? assumptions.monthlyContributionYen,
  };
  const assignments = useMemo(
    () => activeCategories.map((category) => ({ categoryId: category.id, month: selectedMonth, assignedYen: assignmentState[budgetKey(selectedMonth, category.id)] ?? 0 })),
    [activeCategories, assignmentState, selectedMonth],
  );
  const budgetRows = useMemo(
    () => buildBudgetRows({ categories: activeCategories, assignments, transactions: transactionState, month: selectedMonth }),
    [activeCategories, assignments, selectedMonth, transactionState],
  );
  const ruledTransactions = useMemo(
    () => transactionState.map((transaction) => {
      if (transaction.categoryId) return transaction;
      const rule = merchantRuleState.find((item) => matchesMerchantRule(transaction.payee, item));
      return rule ? { ...transaction, categoryId: rule.categoryId } : transaction;
    }),
    [merchantRuleState, transactionState],
  );
  const visibleBudgetRows = budgetRows.filter((row) => budgetFilter === "all" || row.status === budgetFilter);
  const readyToAssignYen = calculateReadyToAssignYen(incomeYen, assignments);
  const totalExpensesYen = transactionState.filter((transaction) => transaction.type === "debit" && transaction.date.startsWith(selectedMonth)).reduce((total, transaction) => total + transaction.amountYen, 0);
  const savingsRate = calculateSavingsRate(incomeYen, totalExpensesYen);
  const netWorth = calculateNetWorth({ accounts: accountState, investments: investmentState, debts: debtState });
  const debtSummary = calculateDebtSummary(debtState);
  const deterministic = calculateDeterministicForecast(effectiveForecastInputs);
  const uncategorizedCount = ruledTransactions.filter((transaction) => !transaction.categoryId && transaction.date.startsWith(selectedMonth)).length;
  const overspentCount = budgetRows.filter((row) => row.status === "overspent").length;
  const health = calculateHealthScore({
    savingsRate,
    emergencyFundMonths: (accountState.find((account) => account.type === "savings")?.balanceYen ?? 0) / Math.max(totalExpensesYen, 1),
    debtServiceRatio: debtSummary.totalMonthlyObligationYen / incomeYen,
    monthlyCashFlowYen: incomeYen - totalExpensesYen,
    monthlyInvestmentContributionYen: monthlyContributionYen,
    monthlyIncomeYen: incomeYen,
  });

  const setAssumption = (field: keyof ForecastInputs, value: string | number | boolean | undefined) => {
    setAssumptions((previous) => ({ ...previous, [field]: value }));
  };

  const openBudgetMonth = (month: string) => {
    setSelectedMonth(month);
    const hasExistingBudget = Object.keys(assignmentState).some((key) => key.startsWith(`${month}:`));
    if (hasExistingBudget) {
      setBudgetNotice(null);
      return;
    }

    const previousMonth = shiftMonth(month, -1);
    const previousIncomeEntries = incomeEntryState.filter((entry) => entry.month === previousMonth);
    const previousIncome = previousIncomeEntries.reduce((total, entry) => total + entry.amountYen, 0);
    const nextAssignments: Record<string, number> = {};
    let fixedAssigned = 0;
    let lifestyleAssigned = 0;

    activeCategories.forEach((category) => {
      const previousAmount = assignmentState[budgetKey(previousMonth, category.id)] ?? 0;
      if (isFixedPriorityCategory(category)) fixedAssigned += previousAmount;
      else if (isLifestyleCategory(category)) lifestyleAssigned += previousAmount;
      nextAssignments[budgetKey(month, category.id)] = previousAmount;
    });

    let notice = "New month created from the previous month. Review estimates before relying on them.";
    if (previousIncomeEntries.length > 0 && incomeEntryState.every((entry) => entry.month !== month)) {
      setIncomeEntryState((previous) => [
        ...previous,
        ...previousIncomeEntries.map((entry) => ({ ...entry, id: makeLocalId("income"), month })),
      ]);
      notice = "Income auto-filled from last month. Update if it changed.";
    }

    if (previousIncome > 0 && fixedAssigned + lifestyleAssigned > previousIncome && lifestyleAssigned > 0) {
      const availableForLifestyle = Math.max(0, previousIncome - fixedAssigned);
      const trimRatio = availableForLifestyle / lifestyleAssigned;
      activeCategories.filter(isLifestyleCategory).forEach((category) => {
        const key = budgetKey(month, category.id);
        nextAssignments[key] = Math.floor((nextAssignments[key] ?? 0) * trimRatio);
      });
      notice = "Budget adjusted to fit income. Review lifestyle categories.";
    }

    setAssignmentState((previous) => ({ ...previous, ...nextAssignments }));
    setEstimatedAssignments((previous) => ({
      ...previous,
      ...Object.fromEntries(activeCategories.filter(isLifestyleCategory).map((category) => [budgetKey(month, category.id), true])),
    }));
    setBudgetNotice(previousIncomeEntries.length > 0 ? notice : "First month created with category structure only. Add income and assignments to begin.");
  };

  const page = pageTitles[activePage];

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-slate-900">
      <div className="flex">
        <Sidebar accounts={accountState} investments={investmentState} netWorthYen={netWorth.netWorthYen} activePage={activePage} onNavigate={(pageKey) => setActivePage(pageKey as PageKey)} onAddAccount={(account) => setAccountState((previous) => [...previous, account])} onEditAccount={(id, changes) => setAccountState((previous) => previous.map((account) => account.id === id ? { ...account, ...changes } : account))} onSelectAccount={(accountId) => { setTransactionAccountFilterIds([accountId]); setActivePage("transactions"); }} />
        <main className="min-w-0 flex-1 px-8 py-8">
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{formatMonth(selectedMonth)}</p>
              <h1 className="mt-2 text-2xl font-medium tracking-tight text-slate-900">{page.title}</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#6B7280]">{page.subtitle}</p>
            </div>
            <button type="button" onClick={() => setActivePage("settings")} className="hidden items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#6B7280] shadow-[0_1px_2px_rgba(17,24,39,0.04)] transition hover:text-slate-900 lg:flex">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Edit defaults
            </button>
          </header>

          {activePage === "home" && <HomePage readyToAssignYen={readyToAssignYen} netWorthYen={netWorth.netWorthYen} savingsRate={savingsRate} fatfireAge={deterministic.estimatedFatfireAge} healthScore={health.score} uncategorizedCount={uncategorizedCount} overspentCount={overspentCount} contributionDeltaYen={deterministic.contributionDeltaYen} accounts={accountState} onNavigate={setActivePage} />}

          {activePage === "budget" && <BudgetPage month={selectedMonth} setMonth={openBudgetMonth} incomeEntries={currentIncomeEntries} setIncomeEntries={setIncomeEntryState} readyToAssignYen={readyToAssignYen} budgetRows={visibleBudgetRows} fullBudgetRows={budgetRows} budgetFilter={budgetFilter} setBudgetFilter={setBudgetFilter} categoryList={activeCategories} setCategories={setCategoryState} transactions={transactionState} setTransactions={setTransactionState} budgetNotice={budgetNotice} estimatedAssignments={estimatedAssignments} setAssignment={(categoryId, value) => setAssignmentState((previous) => ({ ...previous, [budgetKey(selectedMonth, categoryId)]: value }))} assignments={assignments} />}

          {activePage === "transactions" && <TransactionsPage key={`${transactionAccountFilterIds.join(",")}:${transactionCategoryFilterIds.join(",")}`} month={selectedMonth} setMonth={setSelectedMonth} transactions={ruledTransactions} rawTransactions={transactionState} setTransactions={setTransactionState} accounts={accountState} categories={activeCategories} merchantRules={merchantRuleState} setMerchantRules={setMerchantRuleState} initialAccountIds={transactionAccountFilterIds} initialCategoryIds={transactionCategoryFilterIds} />}
          {activePage === "debt" && <DebtPage month={selectedMonth} debts={debtState} setDebts={setDebtState} totalMonthlyObligationYen={debtSummary.totalMonthlyObligationYen} totalOutstandingYen={debtSummary.totalOutstandingYen} categories={activeCategories} setCategories={setCategoryState} transactions={transactionState} setTransactions={setTransactionState} />}
          {activePage === "goals" && <GoalsPage month={selectedMonth} goals={goalState} setGoals={setGoalState} assignments={assignments} setCategories={setCategoryState} transactions={transactionState} setTransactions={setTransactionState} />}
          {activePage === "investments" && <InvestmentsPage investments={investmentState} setInvestments={setInvestmentState} />}
          {activePage === "forecast" && <ForecastPage inputs={effectiveForecastInputs} assumptions={assumptions} setAssumption={setAssumption} />}
          {activePage === "reports" && <ReportsPage selectedMonth={selectedMonth} transactions={transactionState} incomeEntries={incomeEntryState} categories={activeCategories} accounts={accountState} investments={investmentState} debts={debtState} onCategoryClick={(categoryId) => { setTransactionCategoryFilterIds([categoryId]); setActivePage("transactions"); }} />}
          {activePage === "import" && <ImportPage />}
          {activePage === "settings" && <SettingsPage assumptions={assumptions} setAssumption={setAssumption} accounts={accountState} setAccounts={setAccountState} investments={investmentState} setInvestments={setInvestmentState} debts={debtState} setDebts={setDebtState} goals={goalState} setGoals={setGoalState} categories={activeCategories} merchantRules={merchantRuleState} setMerchantRules={setMerchantRuleState} />}
        </main>
      </div>
    </div>
  );
}

function HomePage({ readyToAssignYen, netWorthYen, savingsRate, fatfireAge, healthScore, uncategorizedCount, overspentCount, contributionDeltaYen, accounts, onNavigate }: { readyToAssignYen: number; netWorthYen: number; savingsRate: number; fatfireAge: number | null; healthScore: number; uncategorizedCount: number; overspentCount: number; contributionDeltaYen: number; accounts: Account[]; onNavigate: (page: PageKey) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white px-6 py-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Net worth</p>
        <p className="mt-2 text-4xl font-medium tabular-nums text-slate-900">{formatJPY(netWorthYen)}</p>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Ready to assign" value={formatJPY(readyToAssignYen)} detail="Available for this month" tone={readyToAssignYen > 0 ? "green" : readyToAssignYen < 0 ? "red" : "neutral"} />
        <MetricCard label="Savings rate" value={formatPercent(savingsRate)} detail="Current month actuals" />
        <MetricCard label="FATFire age" value={fatfireAge ? fatfireAge.toFixed(1) : "Not reached"} detail="Based on current assumptions" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Card title="Priority actions" eyebrow="Needs attention">
          <div className="mb-4 flex items-center gap-4 rounded-lg bg-[#FAFAF8] px-4 py-3">
            <div className="flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Financial health</p>
              <p className="mt-1 text-xs text-[#6B7280]">Derived from savings, debt, and cash flow</p>
            </div>
            <div className="text-2xl font-medium tabular-nums text-slate-900">{healthScore}</div>
            <ProgressBar value={healthScore} className="w-24" />
          </div>
          <div className="grid gap-1.5">
            <ActionButton title="Review uncategorized transactions" detail={`${uncategorizedCount} transactions need a category before reports are final.`} tone="amber" onClick={() => onNavigate("transactions")} />
            <ActionButton title="Resolve overspent categories" detail={`${overspentCount} categories are below zero available.`} tone={overspentCount > 0 ? "red" : "green"} onClick={() => onNavigate("budget")} />
            <ActionButton title="Review required contribution" detail={`${formatJPY(Math.max(contributionDeltaYen, 0))} more per month needed for the target age.`} tone="blue" onClick={() => onNavigate("forecast")} />
          </div>
        </Card>

        <Card title="Account balances" eyebrow="Manual balances">
          <div className="divide-y divide-[#F0EFEB]">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-900">{account.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[#6B7280]">{account.type}</p>
                </div>
                <p className={`text-sm font-medium tabular-nums ${account.balanceYen < 0 ? "text-[#E5534B]" : "text-slate-900"}`}>{formatJPY(account.balanceYen)}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function BudgetPage({ month, setMonth, incomeEntries, setIncomeEntries, readyToAssignYen, budgetRows, fullBudgetRows, budgetFilter, setBudgetFilter, categoryList, setCategories, transactions, setTransactions, budgetNotice, estimatedAssignments, setAssignment, assignments }: { month: string; setMonth: (month: string) => void; incomeEntries: IncomeEntry[]; setIncomeEntries: Dispatch<SetStateAction<IncomeEntry[]>>; readyToAssignYen: number; budgetRows: ReturnType<typeof buildBudgetRows>; fullBudgetRows: ReturnType<typeof buildBudgetRows>; budgetFilter: "all" | "overspent" | "underfunded" | "funded"; setBudgetFilter: (filter: "all" | "overspent" | "underfunded" | "funded") => void; categoryList: Category[]; setCategories: Dispatch<SetStateAction<Category[]>>; transactions: Transaction[]; setTransactions: Dispatch<SetStateAction<Transaction[]>>; budgetNotice: string | null; estimatedAssignments: Record<string, boolean>; setAssignment: (categoryId: string, value: number) => void; assignments: BudgetAssignment[] }) {
  const filters = ["all", "overspent", "underfunded", "funded"] as const;
  const [incomeCollapsed, setIncomeCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("fire-save-budget-collapsed-groups") ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const [activityCategoryId, setActivityCategoryId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState({ payee: "", amountYen: 0 });
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [nisaWarning, setNisaWarning] = useState<string | null>(null);
  const totalIncomeYen = incomeEntries.reduce((total, entry) => total + entry.amountYen, 0);
  const totalActivityYen = fullBudgetRows.reduce((total, row) => total + row.activityYen, 0);
  const overspentByYen = Math.max(0, totalActivityYen - totalIncomeYen);

  const persistCollapsedGroups = (next: Record<string, boolean>) => {
    setCollapsedGroups(next);
    localStorage.setItem("fire-save-budget-collapsed-groups", JSON.stringify(next));
  };

  const addIncomeRow = () => setIncomeEntries((previous) => [...previous, { id: makeLocalId("income"), month, sourceName: "Income", amountYen: 0 }]);
  const updateIncomeRow = (id: string, changes: Partial<IncomeEntry>) => setIncomeEntries((previous) => previous.map((entry) => entry.id === id ? { ...entry, ...changes } : entry));
  const deleteIncomeRow = (id: string) => setIncomeEntries((previous) => previous.filter((entry) => entry.id !== id));

  const addCategory = (groupId: string) => {
    const name = window.prompt("Category name");
    if (!name?.trim()) return;
    setCategories((previous) => [...previous, { id: makeLocalId("cat"), groupId, name: name.trim(), source: "custom" }]);
  };

  const deleteCategory = (category: Category) => {
    const count = transactions.filter((transaction) => transaction.categoryId === category.id && transaction.date.startsWith(month)).length;
    if (count > 0 && !window.confirm(`This category has ${count} transactions this month. Move them to Uncategorized?`)) return;
    setTransactions((previous) => previous.map((transaction) => transaction.categoryId === category.id && transaction.date.startsWith(month) ? { ...transaction, categoryId: undefined } : transaction));
    setCategories((previous) => category.source === "custom" ? previous.filter((item) => item.id !== category.id) : previous.map((item) => item.id === category.id ? { ...item, isArchived: true } : item));
  };

  const assignWithNisaCheck = (categoryId: string, value: number) => {
    if (categoryId !== "cat-nisa") {
      setAssignment(categoryId, value);
      return;
    }
    const year = Number(month.slice(0, 4));
    const growthUsed = nisaContributions.find((item) => item.year === year && item.accountType === "growth")?.totalContributed ?? 0;
    const tsumitateUsed = nisaContributions.find((item) => item.year === year && item.accountType === "tsumitate")?.totalContributed ?? 0;
    const remaining = Math.max(0, Math.min(NISA_GROWTH_ANNUAL_LIMIT_YEN - growthUsed, NISA_COMBINED_ANNUAL_LIMIT_YEN - growthUsed - tsumitateUsed));
    if (value > remaining) {
      const overflow = value - remaining;
      setAssignment("cat-nisa", remaining);
      setAssignment("cat-taxable", (assignments.find((assignment) => assignment.categoryId === "cat-taxable")?.assignedYen ?? 0) + overflow);
      setNisaWarning(`${formatJPY(overflow)} moved to Taxable account — NISA limit reached for this year.`);
      return;
    }
    setAssignment(categoryId, value);
    setNisaWarning(remaining - value <= 200_000 ? `NISA annual limit almost reached — ${formatJPY(Math.max(0, remaining - value))} remaining.` : null);
  };

  const logExpense = (categoryId: string) => {
    if (expenseDraft.amountYen <= 0 || !expenseDraft.payee.trim()) {
      setExpenseError("Enter a payee and amount before logging the expense.");
      return;
    }
    setTransactions((previous) => [...previous, { id: makeLocalId("txn"), accountId: "acct-checking", categoryId, date: `${month}-15`, payee: expenseDraft.payee.trim(), amountYen: expenseDraft.amountYen, type: "debit", source: "manual" }]);
    setExpenseDraft({ payee: "", amountYen: 0 });
    setExpenseError(null);
  };

  const readyTone = readyToAssignYen > 0 ? "green" : readyToAssignYen < 0 ? "red" : "amber";
  const readyBg = readyTone === "green" ? "bg-[#E8F5EE]" : readyTone === "red" ? "bg-[#FBE5E3]" : "bg-[#FBEFD9]";
  const readyText = readyTone === "green" ? "text-[#2F7A58]" : readyTone === "red" ? "text-[#A32D27]" : "text-[#8A5A10]";

  return (
    <div className="space-y-4">
      <MonthNavigator month={month} onPrevious={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />

      <div className={`rounded-2xl ${readyBg} px-5 py-4`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={`text-[11px] font-medium uppercase tracking-[0.08em] ${readyText}`}>Ready to assign</p>
            <p className={`mt-1 text-3xl font-medium tabular-nums ${readyText}`}>{formatJPY(readyToAssignYen)}</p>
          </div>
          <p className={`max-w-xs text-right text-xs leading-relaxed ${readyText}/80`}>
            {readyToAssignYen > 0 ? "Assign every yen to a category to give it a job." : readyToAssignYen < 0 ? "You've assigned more than you've earned this month." : "Every yen is assigned."}
          </p>
        </div>
      </div>

      {budgetNotice && <NoticeBanner tone="amber">{budgetNotice}</NoticeBanner>}
      {overspentByYen > 0 && <NoticeBanner tone="red">You spent {formatJPY(overspentByYen)} more than you earned this month.</NoticeBanner>}
      {nisaWarning && <NoticeBanner tone="amber">{nisaWarning}</NoticeBanner>}

      <section className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Total income this month" value={formatJPY(totalIncomeYen)} detail="Entered in monthly income rows" tone="blue" />
        <MetricCard label="Total assigned" value={formatJPY(totalIncomeYen - readyToAssignYen)} detail="Across all categories" />
        <MetricCard label="Overspent categories" value={`${fullBudgetRows.filter((row) => row.status === "overspent").length}`} detail="Categories below zero available" tone={fullBudgetRows.filter((row) => row.status === "overspent").length > 0 ? "red" : "neutral"} />
      </section>

      <Card title="Income" eyebrow="Monthly sources" action={
        <button type="button" onClick={() => setIncomeCollapsed(!incomeCollapsed)} aria-label="Toggle income" className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F5F4F0] hover:text-slate-900">
          <ChevronDown className={`h-4 w-4 transition ${incomeCollapsed ? "-rotate-90" : ""}`} />
        </button>
      }>
        <AnimatePresence initial={false}>
          {!incomeCollapsed && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="overflow-hidden">
              <div className="space-y-2">
                {incomeEntries.length === 0 && (
                  <EmptyHint>No income entered yet this month. Add a source below to start assigning.</EmptyHint>
                )}
                {incomeEntries.map((entry) => (
                  <div key={entry.id} className="grid items-end gap-3 rounded-lg bg-[#FAFAF8] p-3 md:grid-cols-[1fr_180px_auto]">
                    <TextInput label="Source" value={entry.sourceName} onChange={(value) => updateIncomeRow(entry.id, { sourceName: value })} />
                    <CurrencyInput label="Amount" value={entry.amountYen} onChange={(value) => updateIncomeRow(entry.id, { amountYen: value })} />
                    <button type="button" onClick={() => deleteIncomeRow(entry.id)} aria-label="Remove income" className="self-end rounded-md p-2 text-[#6B7280] transition hover:bg-[#FBE5E3] hover:text-[#E5534B]"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <button type="button" onClick={addIncomeRow} className="inline-flex items-center gap-2 rounded-lg bg-[#4A7CFF] px-3 py-2 text-sm font-medium text-white hover:bg-[#3F6DE8]">
                    <Plus className="h-3.5 w-3.5" /> Add income row
                  </button>
                  <p className="text-sm text-[#6B7280]">Total <span className="ml-2 tabular-nums font-medium text-slate-900">{formatJPY(totalIncomeYen)}</span></p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card title="Monthly assignments" eyebrow="Budget workspace">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {filters.map((filter) => {
            const count = filter !== "all" ? fullBudgetRows.filter((row) => row.status === filter).length : fullBudgetRows.length;
            const active = budgetFilter === filter;
            return (
              <button key={filter} type="button" onClick={() => setBudgetFilter(filter)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${active ? "bg-slate-900 text-white" : "bg-[#FAFAF8] text-[#6B7280] hover:bg-[#EEEDE9]"}`}>
                {filter}
                <span className={`tabular-nums ${active ? "text-white/70" : "text-[#6B7280]/70"}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="overflow-hidden rounded-lg border border-[#F0EFEB]">
          <table className="w-full border-collapse text-sm">
            <thead><tr className="bg-[#FAFAF8]">
              <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Category</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Assigned</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Activity</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Available</th>
            </tr></thead>
            <tbody>{categoryGroups.map((group) => { const rows = budgetRows.filter((row) => row.category.groupId === group.id); if (rows.length === 0 && categoryList.every((category) => category.groupId !== group.id)) return null; return <BudgetGroup key={group.id} groupId={group.id} name={group.name} rows={rows} isCollapsed={collapsedGroups[group.id] ?? false} toggleCollapsed={() => persistCollapsedGroups({ ...collapsedGroups, [group.id]: !(collapsedGroups[group.id] ?? false) })} addCategory={() => addCategory(group.id)} deleteCategory={deleteCategory} setAssignment={assignWithNisaCheck} month={month} transactions={transactions} openActivityCategoryId={activityCategoryId} setOpenActivityCategoryId={setActivityCategoryId} expenseDraft={expenseDraft} setExpenseDraft={setExpenseDraft} logExpense={logExpense} expenseError={expenseError} estimatedAssignments={estimatedAssignments} />; })}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

type TransactionFilterState = {
  search: string;
  accountIds: string[];
  categoryIds: string[];
  type: "all" | "debit" | "credit";
};

function TransactionsPage({ month, setMonth, transactions, rawTransactions, setTransactions, accounts, categories, merchantRules, setMerchantRules, initialAccountIds, initialCategoryIds }: { month: string; setMonth: (month: string) => void; transactions: Transaction[]; rawTransactions: Transaction[]; setTransactions: Dispatch<SetStateAction<Transaction[]>>; accounts: Account[]; categories: Category[]; merchantRules: MerchantRule[]; setMerchantRules: Dispatch<SetStateAction<MerchantRule[]>>; initialAccountIds: string[]; initialCategoryIds: string[] }) {
  const [filters, setFilters] = useState<TransactionFilterState>({ search: "", accountIds: initialAccountIds, categoryIds: initialCategoryIds, type: "all" });
  const [groupBy, setGroupBy] = useState<"none" | "category" | "date">("none");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(month));
  const filteredTransactions = useMemo(() => {
    const search = normalizeMerchant(filters.search);
    return monthTransactions.filter((transaction) => {
      const matchesSearch = !search || normalizeMerchant(`${transaction.payee} ${transaction.memo ?? ""}`).includes(search);
      const matchesAccount = filters.accountIds.length === 0 || filters.accountIds.includes(transaction.accountId);
      const matchesCategory = filters.categoryIds.length === 0 || (transaction.categoryId ? filters.categoryIds.includes(transaction.categoryId) : filters.categoryIds.includes("uncategorized"));
      const matchesType = filters.type === "all" || transaction.type === filters.type;
      return matchesSearch && matchesAccount && matchesCategory && matchesType;
    });
  }, [filters, monthTransactions]);
  const stats = {
    totalIn: filteredTransactions.filter((transaction) => transaction.type === "credit").reduce((total, transaction) => total + transaction.amountYen, 0),
    totalOut: filteredTransactions.filter((transaction) => transaction.type === "debit").reduce((total, transaction) => total + transaction.amountYen, 0),
    count: filteredTransactions.length,
    uncategorized: filteredTransactions.filter((transaction) => !transaction.categoryId).length,
  };
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "All Transactions", rows: filteredTransactions }];
    const groups = new Map<string, Transaction[]>();
    filteredTransactions.forEach((transaction) => {
      const key = groupBy === "category" ? transaction.categoryId ?? "uncategorized" : weekOfMonth(transaction.date);
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });
    return Array.from(groups.entries()).map(([key, rows]) => ({
      key,
      label: groupBy === "category" ? categories.find((category) => category.id === key)?.name ?? "Uncategorized" : key,
      rows,
    }));
  }, [categories, filteredTransactions, groupBy]);

  const toggleFilterValue = (field: "accountIds" | "categoryIds", value: string) => setFilters((previous) => ({
    ...previous,
    [field]: previous[field].includes(value) ? previous[field].filter((item) => item !== value) : [...previous[field], value],
  }));

  const updateCategory = (transaction: Transaction, categoryId: string) => {
    const previousMerchantCategory = rawTransactions.find((item) => item.id !== transaction.id && item.categoryId && normalizeMerchant(item.payee) === normalizeMerchant(transaction.payee))?.categoryId;
    const finalCategoryId = previousMerchantCategory ?? categoryId;
    setTransactions((previous) => previous.map((item) => item.id === transaction.id ? { ...item, categoryId: finalCategoryId } : item));
    if (previousMerchantCategory && previousMerchantCategory !== categoryId) {
      const categoryName = categories.find((category) => category.id === previousMerchantCategory)?.name ?? "previous category";
      setInlineMessage(`${transaction.payee} was previously categorized as ${categoryName}; previous category auto-applied.`);
    } else {
      setInlineMessage(null);
    }
  };

  const addMerchantRule = (transaction: Transaction) => {
    if (!transaction.categoryId) {
      setInlineMessage("Choose a category before creating a merchant rule.");
      return;
    }
    const exists = merchantRules.some((rule) => normalizeMerchant(rule.pattern) === normalizeMerchant(transaction.payee));
    if (exists) {
      setInlineMessage("A merchant rule already exists for this payee.");
      return;
    }
    const rule: MerchantRule = { id: makeLocalId("rule"), pattern: transaction.payee, categoryId: transaction.categoryId, fuzzyMatch: true, createdAt: new Date().toISOString() };
    setMerchantRules((previous) => [...previous, rule]);
    setTransactions((previous) => previous.map((item) => matchesMerchantRule(item.payee, rule) ? { ...item, categoryId: rule.categoryId } : item));
    setInlineMessage(`Always categorize ${transaction.payee} rule created.`);
  };

  const netYen = stats.totalIn - stats.totalOut;
  return (
    <div className="space-y-4">
      <MonthNavigator month={month} onPrevious={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />

      {stats.uncategorized > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg bg-[#FBEFD9] px-4 py-2.5">
          <p className="text-sm text-[#8A5A10]">
            <span className="tabular-nums font-medium">{stats.uncategorized}</span> uncategorized {stats.uncategorized === 1 ? "transaction" : "transactions"} this month.
          </p>
          <button type="button" onClick={() => setFilters((previous) => ({ ...previous, categoryIds: ["uncategorized"] }))} className="rounded-md bg-[#8A5A10] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6F480D]">Review now</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-white px-5 py-3 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
        <Stat label="Total in" value={formatJPY(stats.totalIn)} tone="success" />
        <Stat label="Total out" value={formatJPY(stats.totalOut)} tone="danger" />
        <Stat label="Net" value={formatJPY(netYen)} tone={netYen >= 0 ? "success" : "danger"} />
        <Stat label="Count" value={`${stats.count}`} />
        <Stat label="Uncategorized" value={`${stats.uncategorized}`} tone={stats.uncategorized > 0 ? "warning" : undefined} />
      </div>

      <Card title="Filter transactions" eyebrow="Monthly review">
        <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr]">
          <TextInput label="Search merchant or memo" value={filters.search} onChange={(value) => setFilters((previous) => ({ ...previous, search: value }))} />
          <FilterChecklist title="Accounts">
            {accounts.map((account) => (
              <label key={account.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-[#FAFAF8]">
                <input type="checkbox" checked={filters.accountIds.includes(account.id)} onChange={() => toggleFilterValue("accountIds", account.id)} className="accent-[#4A7CFF]" />
                <span className="truncate">{account.name}</span>
              </label>
            ))}
          </FilterChecklist>
          <FilterChecklist title="Categories">
            {categories.map((category) => (
              <label key={category.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-[#FAFAF8]">
                <input type="checkbox" checked={filters.categoryIds.includes(category.id)} onChange={() => toggleFilterValue("categoryIds", category.id)} className="accent-[#4A7CFF]" />
                <span className="truncate">{category.name}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-[#FAFAF8]">
              <input type="checkbox" checked={filters.categoryIds.includes("uncategorized")} onChange={() => toggleFilterValue("categoryIds", "uncategorized")} className="accent-[#4A7CFF]" />
              <span>Uncategorized</span>
            </label>
          </FilterChecklist>
          <SelectField label="Type" value={filters.type} onChange={(value) => setFilters((previous) => ({ ...previous, type: value as TransactionFilterState["type"] }))}>
            <option value="all">All</option>
            <option value="debit">Debit only</option>
            <option value="credit">Credit only</option>
          </SelectField>
          <SelectField label="Group by" value={groupBy} onChange={(value) => setGroupBy(value as typeof groupBy)}>
            <option value="none">None</option>
            <option value="category">By category</option>
            <option value="date">By date</option>
          </SelectField>
        </div>
        {inlineMessage && <p className="mt-3 rounded-md bg-[#E6EDFF] px-3 py-2 text-xs text-[#2450B5]">{inlineMessage}</p>}
      </Card>

      <Card title="Transactions" eyebrow="Categorize and review">
        {monthTransactions.length === 0 ? (
          <EmptyHint>No transactions yet this month. Import from your bank statement or add one manually.</EmptyHint>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EFEB]">
                  <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Date</th>
                  <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Payee</th>
                  <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Account</th>
                  <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Category</th>
                  <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]"></th>
                  <th className="pb-2 pr-0 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => {
                  const subtotal = group.rows.reduce((total, transaction) => total + (transaction.type === "debit" ? -transaction.amountYen : transaction.amountYen), 0);
                  const isCollapsed = collapsed[group.key] ?? false;
                  const content = group.rows.map((transaction) => {
                    const category = categories.find((c) => c.id === transaction.categoryId);
                    return (
                      <tr key={transaction.id} className={`border-b border-[#F0EFEB] transition hover:bg-[#FAFAF8] ${transaction.categoryId ? "" : "bg-[#FBEFD9]/40"}`}>
                        <td className="py-2 pr-4 text-xs tabular-nums text-[#6B7280]">{transaction.date}</td>
                        <td className="py-2 pr-4">
                          <div className="text-sm text-slate-900">{transaction.payee}</div>
                          {transaction.memo && <div className="text-[11px] text-[#6B7280]">{transaction.memo}</div>}
                        </td>
                        <td className="py-2 pr-4 text-xs text-[#6B7280]">{accounts.find((account) => account.id === transaction.accountId)?.name ?? "Unknown"}</td>
                        <td className="py-2 pr-4">
                          <CategoryPicker value={transaction.categoryId ?? ""} onChange={(value) => updateCategory(transaction, value)} options={categories} currentName={category?.name} />
                        </td>
                        <td className="py-2 pr-4">
                          <button type="button" onClick={() => addMerchantRule(transaction)} className="rounded-md px-2 py-0.5 text-[11px] font-medium text-[#6B7280] transition hover:bg-[#EEEDE9] hover:text-slate-900" title={`Always categorize ${transaction.payee} this way`}>Always</button>
                        </td>
                        <td className={`py-2 pr-0 text-right text-sm tabular-nums ${transaction.type === "credit" ? "text-[#2F7A58]" : "text-[#E5534B]"}`}>
                          {transaction.type === "credit" ? "+" : "−"}{formatJPY(transaction.amountYen)}
                        </td>
                      </tr>
                    );
                  });
                  if (groupBy === "none") return content;
                  return (
                    <FragmentGroup key={group.key} label={group.label} count={group.rows.length} subtotal={subtotal} isCollapsed={isCollapsed} toggle={() => setCollapsed((previous) => ({ ...previous, [group.key]: !isCollapsed }))}>
                      {content}
                    </FragmentGroup>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" | "warning" }) {
  const color = tone === "success" ? "text-[#2F7A58]" : tone === "danger" ? "text-[#E5534B]" : tone === "warning" ? "text-[#8A5A10]" : "text-slate-900";
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function CategoryPicker({ value, onChange, options, currentName }: { value: string; onChange: (value: string) => void; options: Category[]; currentName?: string }) {
  return (
    <div className="relative inline-block">
      <select value={value} onChange={(event) => onChange(event.target.value)} className="appearance-none rounded-full border border-[#E8E7E3] bg-transparent px-2.5 py-0.5 pr-6 text-[11px] text-slate-900 outline-none transition hover:border-[#4A7CFF] focus:border-[#4A7CFF]">
        <option value="">{currentName ?? "Uncategorized"}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#6B7280]" />
    </div>
  );
}

const emptyDebtDraft: CreditDebt = {
  id: "",
  type: "revolving",
  cardName: "",
  description: "",
  currentBalanceYen: 0,
  monthlyPaymentYen: 0,
  paymentDueDay: 27,
  annualInterestRate: 0,
  totalInstallments: 12,
  installmentsPaid: 0,
};

function ordinalDay(day: number): string {
  const suffix = day % 10 === 1 && day % 100 !== 11 ? "st" : day % 10 === 2 && day % 100 !== 12 ? "nd" : day % 10 === 3 && day % 100 !== 13 ? "rd" : "th";
  return `${day}${suffix}`;
}

function isDebtDueSoon(debt: CreditDebt): boolean {
  if (debt.isPaid || debt.currentBalanceYen <= 0 || !debt.paymentDueDay) return false;
  const today = new Date();
  const currentMonthDue = new Date(today.getFullYear(), today.getMonth(), debt.paymentDueDay);
  const nextMonthDue = new Date(today.getFullYear(), today.getMonth() + 1, debt.paymentDueDay);
  const candidate = currentMonthDue.getTime() >= today.getTime() ? currentMonthDue : nextMonthDue;
  const daysUntilDue = Math.ceil((candidate.getTime() - today.getTime()) / 86_400_000);
  return daysUntilDue >= 0 && daysUntilDue <= 5;
}

function DebtPage({ month, debts, setDebts, totalMonthlyObligationYen, totalOutstandingYen, categories, setCategories, transactions, setTransactions }: { month: string; debts: CreditDebt[]; setDebts: (debts: CreditDebt[]) => void; totalMonthlyObligationYen: number; totalOutstandingYen: number; categories: Category[]; setCategories: Dispatch<SetStateAction<Category[]>>; transactions: Transaction[]; setTransactions: Dispatch<SetStateAction<Transaction[]>> }) {
  const [draftDebt, setDraftDebt] = useState<CreditDebt | null>(null);
  const [deleteDebtId, setDeleteDebtId] = useState<string | null>(null);
  const deleteDebt = debts.find((debt) => debt.id === deleteDebtId) ?? null;
  const deleteLinkedTransactionCount = deleteDebt?.categoryId ? transactions.filter((transaction) => transaction.categoryId === deleteDebt.categoryId && transaction.date.startsWith(month)).length : 0;
  const updateDraft = (changes: Partial<CreditDebt>) => setDraftDebt((previous) => previous ? { ...previous, ...changes } : previous);
  const openAddDebt = () => setDraftDebt({ ...emptyDebtDraft, id: makeLocalId("debt") });
  const openEditDebt = (debt: CreditDebt) => setDraftDebt({ ...emptyDebtDraft, ...debt });
  const saveDebt = () => {
    if (!draftDebt?.cardName.trim()) return;
    const normalized: CreditDebt = {
      ...draftDebt,
      cardName: draftDebt.cardName.trim(),
      description: draftDebt.description?.trim() || undefined,
      paymentDueDay: Math.min(31, Math.max(1, Math.round(draftDebt.paymentDueDay ?? 1))),
      currentBalanceYen: Math.max(0, Math.round(draftDebt.currentBalanceYen)),
      monthlyPaymentYen: Math.max(0, Math.round(draftDebt.monthlyPaymentYen)),
      annualInterestRate: Math.max(0, draftDebt.annualInterestRate),
      totalInstallments: draftDebt.type === "installment" ? Math.max(0, Math.round(draftDebt.totalInstallments ?? 0)) : undefined,
      installmentsPaid: draftDebt.type === "installment" ? Math.max(0, Math.round(draftDebt.installmentsPaid ?? 0)) : undefined,
      expectedBillingDate: draftDebt.type === "lump_sum" ? draftDebt.expectedBillingDate : undefined,
    };
    setDebts(debts.some((debt) => debt.id === normalized.id) ? debts.map((debt) => debt.id === normalized.id ? normalized : debt) : [...debts, normalized]);
    setDraftDebt(null);
  };
  const removeDebt = (debt: CreditDebt) => {
    setDebts(debts.filter((item) => item.id !== debt.id));
    setDeleteDebtId(null);
    if (!debt.categoryId) return;
    setTransactions((previous) => previous.map((transaction) => transaction.categoryId === debt.categoryId && transaction.date.startsWith(month) ? { ...transaction, categoryId: undefined } : transaction));
    setCategories((previous) => previous.filter((category) => category.id !== debt.categoryId));
  };
  const requestDeleteDebt = (debt: CreditDebt) => {
    if (debt.currentBalanceYen <= 0 || debt.isPaid) {
      removeDebt(debt);
      return;
    }
    setDeleteDebtId(debt.id);
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openAddDebt} className="inline-flex items-center gap-2 rounded-lg bg-[#4A7CFF] px-3 py-2 text-sm font-medium text-white hover:bg-[#3F6DE8]">
          <Plus className="h-3.5 w-3.5" /> Add debt
        </button>
      </div>
      <section className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Outstanding debt" value={formatJPY(totalOutstandingYen)} detail="Active balances" tone={totalOutstandingYen > 0 ? "red" : "neutral"} />
        <MetricCard label="Monthly obligation" value={formatJPY(totalMonthlyObligationYen)} detail="Minimum planned payments" />
        <MetricCard label="Active debt items" value={`${debts.filter((debt) => !debt.isPaid).length}`} detail="Ribo, bunkatsu, and ikkatsu" />
      </section>
      {debts.length === 0 ? (
        <Card>
          <EmptyIllustration
            icon={
              <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M40 14 V66" strokeLinecap="round" />
                <path d="M22 24 H58" strokeLinecap="round" />
                <ellipse cx="22" cy="36" rx="10" ry="4" />
                <path d="M12 36 V44 Q22 50 32 44 V36" />
                <ellipse cx="58" cy="36" rx="10" ry="4" />
                <path d="M48 36 V44 Q58 50 68 44 V36" />
              </svg>
            }
            title="No debts tracked"
            detail="Add a debt to see your payoff timeline and monthly obligation."
            cta={<button type="button" onClick={openAddDebt} className="inline-flex items-center gap-2 rounded-lg bg-[#4A7CFF] px-3 py-2 text-sm font-medium text-white hover:bg-[#3F6DE8]"><Plus className="h-3.5 w-3.5" /> Add debt</button>}
          />
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-3">
          {debts.map((debt) => {
            const ribo = debt.type === "revolving" ? calculateRiboPayoff({ balanceYen: debt.currentBalanceYen, monthlyPaymentYen: debt.monthlyPaymentYen, annualInterestRate: debt.annualInterestRate }) : null;
            const bunkatsu = debt.type === "installment" ? calculateBunkatsuRemaining({ monthlyPaymentYen: debt.monthlyPaymentYen, totalInstallments: debt.totalInstallments ?? 0, installmentsPaid: debt.installmentsPaid ?? 0 }) : null;
            const category = categories.find((item) => item.id === debt.categoryId);
            const railColor = debt.type === "lump_sum" ? "bg-[#F5A623]" : "bg-[#E5534B]";
            const paidPct = debt.type === "installment" && debt.totalInstallments ? Math.min(100, Math.round(((debt.installmentsPaid ?? 0) / debt.totalInstallments) * 100)) : null;
            return (
              <div key={debt.id} className="relative overflow-hidden rounded-2xl bg-white p-5 pl-6 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${railColor}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{debt.type === "revolving" ? "Ribo-barai" : debt.type === "installment" ? "Bunkatsu-barai" : "Ikkatsu-barai"}</p>
                    <h3 className="mt-1 truncate text-[15px] font-medium text-slate-900">{debt.cardName}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    {isDebtDueSoon(debt) && <span className="rounded-full bg-[#FBEFD9] px-2 py-0.5 text-[10px] font-medium text-[#8A5A10]">Due soon</span>}
                    <button type="button" onClick={() => openEditDebt(debt)} aria-label="Edit debt" className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#FAFAF8] hover:text-slate-900"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => requestDeleteDebt(debt)} aria-label={`Delete ${debt.cardName}`} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#FBE5E3] hover:text-[#E5534B]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Outstanding balance</p>
                  <p className={`mt-1 text-3xl font-medium tabular-nums ${debt.currentBalanceYen > 100_000 ? "text-[#E5534B]" : "text-slate-900"}`}>{formatJPY(debt.currentBalanceYen)}</p>
                </div>
                {paidPct !== null && (
                  <div className="mt-3">
                    <ProgressBar value={paidPct} tone="success" />
                    <p className="mt-1 text-[11px] tabular-nums text-[#6B7280]">{paidPct}% paid off</p>
                  </div>
                )}
                <div className="mt-4 grid gap-1 border-t border-[#F0EFEB] pt-3 text-xs leading-relaxed text-[#6B7280]">
                  <div className="flex justify-between"><span>Monthly payment</span><span className="tabular-nums text-slate-900">{formatJPY(debt.monthlyPaymentYen)}</span></div>
                  <div className="flex justify-between"><span>Monthly interest</span><span className="tabular-nums">{formatPercent(debt.annualInterestRate / 12, 2)}</span></div>
                  <div className="flex justify-between"><span>Due day</span><span className="tabular-nums">{debt.paymentDueDay ? ordinalDay(debt.paymentDueDay) : "—"}</span></div>
                  <div className="flex justify-between"><span>Category</span><span className="truncate text-slate-700">{category?.name ?? "Unlinked"}</span></div>
                  {ribo && <div className="flex justify-between"><span>Payoff</span><span className="tabular-nums">{ribo.monthsToPayoff} mo · {formatJPY(ribo.totalInterestYen)} interest</span></div>}
                  {bunkatsu && <div className="flex justify-between"><span>Remaining</span><span className="tabular-nums">{bunkatsu.remainingInstallments} installments · {formatJPY(bunkatsu.remainingBalanceYen)}</span></div>}
                  {debt.type === "lump_sum" && <div className="flex justify-between"><span>Expected billing</span><span className="tabular-nums">{debt.expectedBillingDate ?? "Not set"}</span></div>}
                </div>
              </div>
            );
          })}
        </section>
      )}
      {draftDebt && (
        <Modal onClose={() => setDraftDebt(null)} title={debts.some((debt) => debt.id === draftDebt.id) ? "Edit debt" : "Add debt"} width="560px">
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput label="Card or lender name" value={draftDebt.cardName} onChange={(value) => updateDraft({ cardName: value })} />
            <SelectField label="Debt type" value={draftDebt.type} onChange={(value) => updateDraft({ type: value as CreditDebt["type"] })}>
              <option value="revolving">Ribo-barai revolving</option>
              <option value="installment">Bunkatsu-barai installment</option>
              <option value="lump_sum">Ikkatsu-barai lump sum</option>
            </SelectField>
            <SelectField label="Category" value={draftDebt.categoryId ?? ""} onChange={(value) => updateDraft({ categoryId: value || undefined })}>
              <option value="">Unlinked</option>
              {categoryGroups.map((group) => (
                <optgroup key={group.id} label={group.name}>
                  {categories.filter((category) => category.groupId === group.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </optgroup>
              ))}
            </SelectField>
            <CurrencyInput label="Outstanding balance" value={draftDebt.currentBalanceYen} onChange={(value) => updateDraft({ currentBalanceYen: value })} />
            <CurrencyInput label="Monthly payment amount" value={draftDebt.monthlyPaymentYen} onChange={(value) => updateDraft({ monthlyPaymentYen: value })} />
            <PercentInput label="Monthly interest rate" value={draftDebt.annualInterestRate / 12} onChange={(value) => updateDraft({ annualInterestRate: value * 12 })} />
            <NumberInput label="Payment due day" value={draftDebt.paymentDueDay ?? 1} onChange={(value) => updateDraft({ paymentDueDay: value })} />
            {draftDebt.type === "installment" && <><NumberInput label="Total installments" value={draftDebt.totalInstallments ?? 0} onChange={(value) => updateDraft({ totalInstallments: value })} /><NumberInput label="Installments already paid" value={draftDebt.installmentsPaid ?? 0} onChange={(value) => updateDraft({ installmentsPaid: value })} /></>}
            {draftDebt.type === "lump_sum" && <TextInput label="Expected billing date" type="date" value={draftDebt.expectedBillingDate ?? ""} onChange={(value) => updateDraft({ expectedBillingDate: value })} />}
            <div className="md:col-span-2"><TextInput label="Optional notes" value={draftDebt.description ?? ""} onChange={(value) => updateDraft({ description: value })} /></div>
            <div className="md:col-span-2 mt-2 flex gap-3">
              <button type="button" onClick={() => setDraftDebt(null)} className="flex-1 rounded-lg bg-[#F5F4F0] px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#EEEDE9]">Cancel</button>
              <button type="button" onClick={saveDebt} className="flex-1 rounded-lg bg-[#4A7CFF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3F6DE8]">Save debt</button>
            </div>
          </div>
        </Modal>
      )}
      {deleteDebt && (
        <Modal onClose={() => setDeleteDebtId(null)} title="Remove debt?" width="420px">
          <p className="text-sm leading-relaxed text-[#6B7280]">This debt still has <span className="tabular-nums text-slate-900">{formatJPY(deleteDebt.currentBalanceYen)}</span> outstanding. Are you sure you want to remove it from tracking?</p>
          {deleteLinkedTransactionCount > 0 && (
            <p className="mt-3 rounded-md bg-[#FBEFD9] px-3 py-2 text-xs text-[#8A5A10]">{deleteLinkedTransactionCount} current-month transactions will move to Uncategorized before the Debt Payments row is removed.</p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setDeleteDebtId(null)} className="rounded-lg bg-[#F5F4F0] px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#EEEDE9]">Cancel</button>
            <button type="button" onClick={() => removeDebt(deleteDebt)} className="rounded-lg bg-[#E5534B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#CE4842]">Delete anyway</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ onClose, title, children, width = "480px" }: { onClose: () => void; title: string; children: ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-6">
      <div className="w-full overflow-auto rounded-2xl bg-white shadow-[0_20px_48px_rgba(17,24,39,0.18)]" style={{ maxWidth: width, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between border-b border-[#F0EFEB] px-6 py-4">
          <h3 className="text-base font-medium text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-[#6B7280] hover:bg-[#FAFAF8] hover:text-slate-900"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function EmptyIllustration({ icon, title, detail, cta }: { icon: ReactNode; title: string; detail: string; cta?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-10 text-center text-[#6B7280]">
      <div className="text-[#C9C7C0]">{icon}</div>
      <p className="mt-4 text-sm text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed">{detail}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

function GoalsPage({ month, goals, setGoals, assignments, setCategories, transactions, setTransactions }: { month: string; goals: SavingsGoal[]; setGoals: (goals: SavingsGoal[]) => void; assignments: BudgetAssignment[]; setCategories: Dispatch<SetStateAction<Category[]>>; transactions: Transaction[]; setTransactions: Dispatch<SetStateAction<Transaction[]>> }) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [balanceGoalId, setBalanceGoalId] = useState<string | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [draftGoal, setDraftGoal] = useState({ name: "", emoji: "🎯", targetAmountYen: 0, targetDate: `${month}-28`, notes: "" });
  const updateGoal = (id: string, changes: Partial<SavingsGoal>) => setGoals(goals.map((goal) => goal.id === id ? { ...goal, ...changes } : goal));
  const editingGoal = goals.find((goal) => goal.id === editingGoalId) ?? null;
  const deleteGoal = goals.find((goal) => goal.id === deleteGoalId) ?? null;
  const deleteLinkedTransactionCount = deleteGoal?.categoryId ? transactions.filter((transaction) => transaction.categoryId === deleteGoal.categoryId && transaction.date.startsWith(month)).length : 0;
  const getMonthlyAllocation = (goal: SavingsGoal) => assignments.find((assignment) => assignment.categoryId === goal.categoryId)?.assignedYen ?? 0;
  const goalProgress = (goal: SavingsGoal) => goal.targetAmountYen > 0 ? Math.min(100, Math.round((goal.currentSavedYen / goal.targetAmountYen) * 100)) : 0;
  const isGoalComplete = (goal: SavingsGoal) => Boolean(goal.completedAt) || goal.currentSavedYen >= goal.targetAmountYen;
  const removeGoal = (goal: SavingsGoal) => {
    setGoals(goals.filter((item) => item.id !== goal.id));
    setEditingGoalId((current) => current === goal.id ? null : current);
    setBalanceGoalId((current) => current === goal.id ? null : current);
    setDeleteGoalId(null);
    if (!goal.categoryId) return;
    setTransactions((previous) => previous.map((transaction) => transaction.categoryId === goal.categoryId && transaction.date.startsWith(month) ? { ...transaction, categoryId: undefined } : transaction));
    setCategories((previous) => previous.filter((category) => category.id !== goal.categoryId));
  };
  const requestDeleteGoal = (goal: SavingsGoal) => {
    if (isGoalComplete(goal)) {
      removeGoal(goal);
      return;
    }
    setDeleteGoalId(goal.id);
  };
  const projectedDate = (goal: SavingsGoal, allocationYen: number) => {
    if (allocationYen <= 0) return "Set budget allocation";
    const remaining = Math.max(0, goal.targetAmountYen - goal.currentSavedYen);
    const months = Math.ceil(remaining / allocationYen);
    const date = monthStartDate(month);
    date.setMonth(date.getMonth() + months);
    return formatMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };
  const addGoal = () => {
    if (!draftGoal.name.trim()) return;
    const id = makeLocalId("goal");
    setGoals([...goals, { id, emoji: draftGoal.emoji, name: draftGoal.name.trim(), currentSavedYen: 0, targetAmountYen: draftGoal.targetAmountYen, monthlyAllocationYen: 0, targetDate: draftGoal.targetDate, notes: draftGoal.notes }]);
    setDraftGoal({ name: "", emoji: "🎯", targetAmountYen: 0, targetDate: `${month}-28`, notes: "" });
    setIsCreating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setIsCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#4A7CFF] px-3 py-2 text-sm font-medium text-white hover:bg-[#3F6DE8]">
          <Plus className="h-3.5 w-3.5" /> Add goal
        </button>
      </div>
      {goals.length === 0 ? (
        <Card>
          <EmptyIllustration
            icon={
              <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 64 L20 18" strokeLinecap="round" />
                <path d="M20 18 L52 18 L46 28 L52 38 L20 38" strokeLinejoin="round" />
                <path d="M8 64 H60" strokeLinecap="round" />
              </svg>
            }
            title="What are you saving toward?"
            detail="Add your first goal to start tracking progress."
            cta={<button type="button" onClick={() => setIsCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#4A7CFF] px-3 py-2 text-sm font-medium text-white hover:bg-[#3F6DE8]"><Plus className="h-3.5 w-3.5" /> Add goal</button>}
          />
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((goal) => {
              const allocation = getMonthlyAllocation(goal);
              const progress = goal.targetAmountYen > 0 ? (goal.currentSavedYen / goal.targetAmountYen) * 100 : 0;
              const complete = isGoalComplete(goal);
              const onTrack = allocation > 0 && new Date(projectedDate(goal, allocation)) <= new Date(goal.targetDate);
              const statusTone: "green" | "amber" | "blue" = complete ? "green" : onTrack ? "blue" : "amber";
              const statusLabel = complete ? "Complete" : onTrack ? "On track" : "Behind";
              return (
                <div key={goal.id} className={`relative overflow-hidden rounded-2xl p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)] ${complete ? "bg-[#E8F5EE]" : "bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[28px] leading-none">{goal.emoji}</div>
                      <h3 className="mt-2 text-[15px] font-medium text-slate-900">{goal.name}</h3>
                    </div>
                    <div className="flex items-start gap-1">
                      <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={progress} thick tone={complete ? "success" : "auto"} />
                    <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-[#6B7280]">
                      <span>{formatJPY(goal.currentSavedYen)} of {formatJPY(goal.targetAmountYen)}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-1 border-t border-[#F0EFEB] pt-3 text-xs leading-relaxed text-[#6B7280]">
                    <div className="flex justify-between"><span>Target date</span><span className="tabular-nums text-slate-700">{goal.targetDate}</span></div>
                    <div className="flex justify-between"><span>Monthly from budget</span><span className="tabular-nums text-slate-900">{formatJPY(allocation)}</span></div>
                    <div className="flex justify-between"><span>Projected</span><span className="text-slate-700">{projectedDate(goal, allocation)}</span></div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="relative">
                      <button type="button" onClick={() => setBalanceGoalId(balanceGoalId === goal.id ? null : goal.id)} className="rounded-md bg-[#FAFAF8] px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#EEEDE9]">Update balance</button>
                      {balanceGoalId === goal.id && (
                        <div className="absolute left-0 top-10 z-20 w-72 rounded-xl bg-white p-4 shadow-[0_12px_32px_rgba(17,24,39,0.12)] ring-1 ring-[#F0EFEB]">
                          <CurrencyInput label="Current saved amount" value={goal.currentSavedYen} onChange={(value) => updateGoal(goal.id, { currentSavedYen: value })} />
                          <button type="button" onClick={() => setBalanceGoalId(null)} className="mt-3 w-full rounded-lg bg-[#4A7CFF] px-3 py-2 text-sm font-medium text-white hover:bg-[#3F6DE8]">Save balance</button>
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setEditingGoalId(goal.id)} aria-label="Edit goal" className="ml-auto rounded-md p-1.5 text-[#6B7280] hover:bg-[#FAFAF8] hover:text-slate-900"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => requestDeleteGoal(goal)} aria-label={`Delete ${goal.name}`} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#FBE5E3] hover:text-[#E5534B]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {editingGoal && (
              <motion.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2, ease: "easeOut" }} className="sticky top-6 h-fit rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Edit</p>
                    <h3 className="mt-1 text-base font-medium text-slate-900">{editingGoal.name}</h3>
                  </div>
                  <button type="button" onClick={() => setEditingGoalId(null)} aria-label="Close" className="rounded-md p-1 text-[#6B7280] hover:bg-[#FAFAF8] hover:text-slate-900"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3">
                  <TextInput label="Name" value={editingGoal.name} onChange={(value) => updateGoal(editingGoal.id, { name: value })} />
                  <TextInput label="Emoji" value={editingGoal.emoji} onChange={(value) => updateGoal(editingGoal.id, { emoji: value })} />
                  <CurrencyInput label="Target amount" value={editingGoal.targetAmountYen} onChange={(value) => updateGoal(editingGoal.id, { targetAmountYen: value })} />
                  <TextInput label="Target date" type="date" value={editingGoal.targetDate} onChange={(value) => updateGoal(editingGoal.id, { targetDate: value })} />
                  <TextInput label="Notes" value={editingGoal.notes ?? ""} onChange={(value) => updateGoal(editingGoal.id, { notes: value })} />
                  <p className="rounded-md bg-[#E6EDFF] px-3 py-2 text-xs text-[#2450B5]">Monthly allocation is set exclusively in the Budget tab.</p>
                  <button type="button" onClick={() => requestDeleteGoal(editingGoal)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FBE5E3] px-4 py-2.5 text-sm font-medium text-[#A32D27] hover:bg-[#F5CBC7]"><Trash2 className="h-3.5 w-3.5" /> Delete goal</button>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </section>
      )}
      {deleteGoal && (
        <Modal onClose={() => setDeleteGoalId(null)} title="Delete goal?" width="420px">
          <p className="text-sm leading-relaxed text-[#6B7280]">This goal isn&apos;t complete yet — you&apos;re <span className="tabular-nums text-slate-900">{goalProgress(deleteGoal)}%</span> of the way there. Are you sure?</p>
          {deleteLinkedTransactionCount > 0 && (
            <p className="mt-3 rounded-md bg-[#FBEFD9] px-3 py-2 text-xs text-[#8A5A10]">{deleteLinkedTransactionCount} current-month transactions will move to Uncategorized before the budget category row is removed.</p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setDeleteGoalId(null)} className="rounded-lg bg-[#F5F4F0] px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-[#EEEDE9]">Cancel</button>
            <button type="button" onClick={() => removeGoal(deleteGoal)} className="rounded-lg bg-[#E5534B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#CE4842]">Delete anyway</button>
          </div>
        </Modal>
      )}
      {isCreating && (
        <Modal onClose={() => setIsCreating(false)} title="Add goal" width="480px">
          <div className="space-y-3">
            <TextInput label="Name" value={draftGoal.name} onChange={(value) => setDraftGoal({ ...draftGoal, name: value })} />
            <TextInput label="Emoji" value={draftGoal.emoji} onChange={(value) => setDraftGoal({ ...draftGoal, emoji: value })} />
            <CurrencyInput label="Target amount" value={draftGoal.targetAmountYen} onChange={(value) => setDraftGoal({ ...draftGoal, targetAmountYen: value })} />
            <TextInput label="Target date" type="date" value={draftGoal.targetDate} onChange={(value) => setDraftGoal({ ...draftGoal, targetDate: value })} />
            <TextInput label="Notes" value={draftGoal.notes} onChange={(value) => setDraftGoal({ ...draftGoal, notes: value })} />
            <button type="button" onClick={addGoal} className="w-full rounded-lg bg-[#4A7CFF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#3F6DE8]">Create goal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InvestmentsPage({ investments, setInvestments }: { investments: Investment[]; setInvestments: (investments: Investment[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedInvestment = investments.find((investment) => investment.id === selectedId) ?? null;
  const updateInvestment = (id: string, changes: Partial<Investment>) => setInvestments(investments.map((investment) => investment.id === id ? { ...investment, ...changes } : investment));
  const investedTotal = investments.reduce((total, investment) => total + investment.currentBalanceYen, 0);
  const nisaLifetime = calculateLifetimeNisaUsage(investments);
  const nisaUsage = (nisaLifetime / NISA_LIFETIME_LIMIT_YEN) * 100;
  const annualNisaTotal = nisaContributions.reduce((total, item) => total + item.totalContributed, 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Invested assets" value={formatJPY(investedTotal)} detail="Manual current balances only" />
        <MetricCard label="Accounts" value={`${investments.length}`} detail="NISA, iDeCo, and taxable" />
        <MetricCard label="Annual NISA contributions" value={formatJPY(annualNisaTotal)} detail="Tracked against yearly limits" />
      </section>
      <Card title="Lifetime NISA usage" eyebrow="Japanese limit tracking">
        <div className="flex items-center justify-between text-xs">
          <span className="tabular-nums text-slate-900"><span className="font-medium">{formatJPY(nisaLifetime)}</span> <span className="text-[#6B7280]">of {formatJPY(NISA_LIFETIME_LIMIT_YEN)}</span></span>
          <span className="tabular-nums text-[#6B7280]">{Math.round(nisaUsage)}% used</span>
        </div>
        <ProgressBar value={nisaUsage} className="mt-2" tone="primary" />
      </Card>
      {investments.length === 0 ? (
        <Card>
          <EmptyIllustration
            icon={
              <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 62 L28 46 L42 54 L68 24" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M58 24 H68 V34" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            title="No investments yet"
            detail="Add your investment accounts to track your portfolio and NISA usage."
          />
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-4 md:grid-cols-2">
            {investments.map((investment) => {
              const pnl = calculateInvestmentGain(investment);
              return (
                <div key={investment.id} className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{formatInvestmentSubtype(investment.accountSubtype)}</p>
                      <h3 className="mt-1 truncate text-[15px] font-medium text-slate-900">{investment.accountName}</h3>
                    </div>
                    <button type="button" onClick={() => setSelectedId(investment.id)} aria-label="Edit investment" className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#FAFAF8] hover:text-slate-900"><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Current balance</p>
                    <p className="mt-1 text-3xl font-medium tabular-nums text-slate-900">{formatJPY(investment.currentBalanceYen)}</p>
                  </div>
                  <div className="mt-3 border-t border-[#F0EFEB] pt-3">
                    {pnl.gainYen === null ? (
                      <p className="text-xs text-[#6B7280]">Set cost basis in edit panel to see P&amp;L.</p>
                    ) : (
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-[#6B7280]">Gain/loss</span>
                        <span className={`tabular-nums ${pnl.gainYen >= 0 ? "text-[#2F7A58]" : "text-[#E5534B]"}`}>
                          {pnl.gainYen >= 0 ? "+" : ""}{formatJPY(pnl.gainYen)} · {formatPercent(pnl.returnRate ?? 0, 1)}
                        </span>
                      </div>
                    )}
                  </div>
                  {investment.notes && <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">{investment.notes}</p>}
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {selectedInvestment && (
              <motion.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2, ease: "easeOut" }} className="sticky top-6 h-fit rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Edit</p>
                    <h3 className="mt-1 text-base font-medium text-slate-900">{selectedInvestment.accountName}</h3>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} aria-label="Close" className="rounded-md p-1 text-[#6B7280] hover:bg-[#FAFAF8] hover:text-slate-900"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3">
                  <TextInput label="Account name" value={selectedInvestment.accountName} onChange={(value) => updateInvestment(selectedInvestment.id, { accountName: value })} />
                  <SelectField label="Account type" value={selectedInvestment.accountSubtype} onChange={(value) => updateInvestment(selectedInvestment.id, { accountSubtype: value as Investment["accountSubtype"] })}>
                    <option value="growth">NISA Growth / 成長投資枠</option>
                    <option value="tsumitate">NISA Tsumitate / 積立NISA</option>
                    <option value="ideco">iDeCo</option>
                    <option value="taxable">Taxable</option>
                  </SelectField>
                  <CurrencyInput label="Current balance" value={selectedInvestment.currentBalanceYen} onChange={(value) => updateInvestment(selectedInvestment.id, { currentBalanceYen: value })} />
                  <CurrencyInput label="Initial invested amount" value={selectedInvestment.initialInvestedAmount ?? 0} onChange={(value) => updateInvestment(selectedInvestment.id, { initialInvestedAmount: value })} />
                  <TextInput label="Notes" value={selectedInvestment.notes ?? ""} onChange={(value) => updateInvestment(selectedInvestment.id, { notes: value })} />
                  <p className="rounded-md bg-[#E6EDFF] px-3 py-2 text-xs text-[#2450B5]">Expected return lives only in FATFire Forecast — this screen shows actuals.</p>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

function ReportsPage({ selectedMonth, transactions, incomeEntries, categories, accounts, investments, debts, onCategoryClick }: { selectedMonth: string; transactions: Transaction[]; incomeEntries: IncomeEntry[]; categories: Category[]; accounts: Account[]; investments: Investment[]; debts: CreditDebt[]; onCategoryClick: (categoryId: string) => void }) {
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(selectedMonth, index - 5));
  const availableDataMonths = new Set([...transactions.map((transaction) => transaction.date.slice(0, 7)), ...incomeEntries.map((entry) => entry.month)]);
  const hasEnoughData = months.filter((month) => availableDataMonths.has(month)).length >= 2;
  // Muted categorical palette (not status colors — green/amber/red are reserved for meaning).
  const palette = ["#5A7FBF", "#7A9FE5", "#BFA770", "#C9A088", "#9B7EB5", "#8BA39B", "#B29B85", "#7D8697"];
  const cashFlowData = months.map((month) => {
    const income = incomeEntries.filter((entry) => entry.month === month).reduce((total, entry) => total + entry.amountYen, 0);
    const spending = transactions.filter((transaction) => transaction.type === "debit" && transaction.date.startsWith(month)).reduce((total, transaction) => total + transaction.amountYen, 0);
    return { month, income, spending, net: income - spending };
  });
  const categoryData = months.map((month) => {
    const row: Record<string, string | number> = { month };
    categories.forEach((category) => {
      row[category.id] = transactions.filter((transaction) => transaction.type === "debit" && transaction.categoryId === category.id && transaction.date.startsWith(month)).reduce((total, transaction) => total + transaction.amountYen, 0);
    });
    return row;
  });
  const currentMonthSpending = categories.map((category, index) => {
    const amount = Number(categoryData.at(-1)?.[category.id] ?? 0);
    return { category, amount, color: palette[index % palette.length] };
  }).filter((item) => item.amount > 0);
  const currentMonthTotal = currentMonthSpending.reduce((total, item) => total + item.amount, 0);
  const savingsTotal = accounts.filter((account) => account.type !== "credit").reduce((total, account) => total + account.balanceYen, 0);
  const investmentTotal = investments.reduce((total, investment) => total + investment.currentBalanceYen, 0);
  const liabilitiesTotal = accounts.filter((account) => account.type === "credit").reduce((total, account) => total + account.balanceYen, 0) - debts.reduce((total, debt) => total + Math.max(0, debt.currentBalanceYen), 0);
  const netWorthData = months.map((month) => ({ month, savings: savingsTotal, investments: investmentTotal, liabilities: liabilitiesTotal, netWorth: savingsTotal + investmentTotal + liabilitiesTotal }));

  return (
    <div className="space-y-4">
      <ChartReportCard title="Monthly cash flow" hasEnoughData={hasEnoughData}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#6B7280", fontSize: 11 }} />
            <YAxis tickFormatter={compactCurrency} width={56} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <Tooltip formatter={(value) => formatJPY(Number(value))} contentStyle={{ backgroundColor: "white", border: "1px solid #F0EFEB", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="income" name="Income" fill="#7A9FE5" radius={[2, 2, 0, 0]} />
            <Bar dataKey="spending" name="Spending" fill="#D98A86" radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="net" name="Net savings" stroke="#4A7CFF" strokeWidth={2} dot={{ r: 3, fill: "#4A7CFF" }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartReportCard>
      <ChartReportCard title="Spending by category" hasEnoughData={hasEnoughData}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" horizontal={false} />
            <XAxis type="number" tickFormatter={compactCurrency} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <YAxis dataKey="month" type="category" width={76} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <Tooltip formatter={(value, name) => [formatJPY(Number(value)), categories.find((category) => category.id === name)?.name ?? name]} contentStyle={{ backgroundColor: "white", border: "1px solid #F0EFEB", borderRadius: 8, fontSize: 12 }} />
            {categories.map((category, index) => <Bar key={category.id} dataKey={category.id} stackId="spend" fill={palette[index % palette.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      </ChartReportCard>
      {currentMonthSpending.length > 0 && (
        <Card eyebrow="This month by category" title="Category legend">
          <div className="grid gap-1 md:grid-cols-2 xl:grid-cols-3">
            {currentMonthSpending.map((item) => (
              <button key={item.category.id} type="button" onClick={() => onCategoryClick(item.category.id)} className="group flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-[#FAFAF8]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-slate-900">{item.category.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-[#6B7280]">{formatJPY(item.amount)} <span className="text-[#6B7280]/70">· {formatPercent(currentMonthTotal > 0 ? item.amount / currentMonthTotal : 0)}</span></span>
              </button>
            ))}
          </div>
        </Card>
      )}
      <ChartReportCard title="Net worth over time" hasEnoughData={hasEnoughData}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={netWorthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#6B7280", fontSize: 11 }} />
            <YAxis tickFormatter={compactCurrency} width={56} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <Tooltip formatter={(value) => formatJPY(Number(value))} contentStyle={{ backgroundColor: "white", border: "1px solid #F0EFEB", borderRadius: 8, fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#C9C7C0" />
            <Area type="monotone" dataKey="savings" name="Savings" stackId="assets" stroke="none" fill="#7A9FE5" fillOpacity={0.5} />
            <Area type="monotone" dataKey="investments" name="Investments" stackId="assets" stroke="none" fill="#4A7CFF" fillOpacity={0.6} />
            <Area type="monotone" dataKey="liabilities" name="Liabilities" stroke="none" fill="#D98A86" fillOpacity={0.6} />
            <Line type="monotone" dataKey="netWorth" name="Net worth" stroke="#1C1F3A" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartReportCard>
    </div>
  );
}

function ImportPage() {
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <WorkflowCard icon={<UploadCloud className="h-4 w-4" />} title="Upload statement or CSV" detail="Supports JPG, PNG, PDF, and CSV files within Supabase free-tier storage limits." />
      <WorkflowCard icon={<CheckCircle2 className="h-4 w-4" />} title="Review extracted transactions" detail="Japanese dates and integer JPY amounts are normalized before confirmation." />
      <WorkflowCard icon={<Bot className="h-4 w-4" />} title="Generate monthly insight" detail="Insights use aggregated monthly summaries only and are cached by month." />
    </section>
  );
}

function SettingsPage({ assumptions, setAssumption, accounts, setAccounts, investments, setInvestments, debts, setDebts, goals, setGoals, categories, merchantRules, setMerchantRules }: { assumptions: ForecastInputs; setAssumption: (field: keyof ForecastInputs, value: string | number | boolean | undefined) => void; accounts: Account[]; setAccounts: (accounts: Account[]) => void; investments: Investment[]; setInvestments: (investments: Investment[]) => void; debts: CreditDebt[]; setDebts: (debts: CreditDebt[]) => void; goals: SavingsGoal[]; setGoals: (goals: SavingsGoal[]) => void; categories: Category[]; merchantRules: MerchantRule[]; setMerchantRules: Dispatch<SetStateAction<MerchantRule[]>> }) {
  const updateRule = (id: string, changes: Partial<MerchantRule>) => setMerchantRules((previous) => previous.map((rule) => rule.id === id ? { ...rule, ...changes } : rule));
  return (
    <div className="space-y-4">
      <Card title="Core planning defaults" eyebrow="Shared assumptions">
        <div className="grid gap-3 xl:grid-cols-4">
          <TextInput label="Date of birth" value={assumptions.dateOfBirth ?? "1996-02-01"} type="date" onChange={(value) => setAssumption("dateOfBirth", value)} />
          <NumberInput label="Calculated age" value={Math.floor(calculateAgeFromDob(assumptions.dateOfBirth ?? "1996-02-01"))} onChange={() => undefined} disabled />
          <NumberInput label="Target FATFire age" value={assumptions.targetRetirementAge} onChange={(value) => setAssumption("targetRetirementAge", value)} />
          <CurrencyInput label="Annual retirement spend" value={assumptions.targetAnnualRetirementSpendYen} onChange={(value) => setAssumption("targetAnnualRetirementSpendYen", value)} />
          <PercentInput label="Safe withdrawal rate" value={assumptions.safeWithdrawalRate} onChange={(value) => setAssumption("safeWithdrawalRate", value)} />
          <PercentInput label="Expected return" value={assumptions.expectedAnnualReturn} onChange={(value) => setAssumption("expectedAnnualReturn", value)} />
          <PercentInput label="Inflation" value={assumptions.inflationRate} onChange={(value) => setAssumption("inflationRate", value)} />
          <PercentInput label="Volatility" value={assumptions.returnVolatility} onChange={(value) => setAssumption("returnVolatility", value)} />
          <NumberInput label="Retirement end age" value={assumptions.retirementEndAge} onChange={(value) => setAssumption("retirementEndAge", value)} />
          <CurrencyInput label="Reserve threshold" value={assumptions.reserveThresholdYen} onChange={(value) => setAssumption("reserveThresholdYen", value)} />
        </div>
      </Card>
      <Card title="Merchant rules" eyebrow="Intelligent categorization">
        {merchantRules.length === 0 ? (
          <EmptyHint>No merchant rules yet. Create rules from the Transactions screen.</EmptyHint>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F0EFEB]">
                <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Pattern</th>
                <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Category</th>
                <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Fuzzy</th>
                <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Created</th>
                <th className="pb-2 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Action</th>
              </tr>
            </thead>
            <tbody>
              {merchantRules.map((rule) => (
                <tr key={rule.id} className="border-b border-[#F0EFEB]">
                  <td className="py-2 pr-4"><input value={rule.pattern} onChange={(event) => updateRule(rule.id, { pattern: event.target.value })} className="w-full rounded-md border border-[#E8E7E3] bg-white px-2 py-1 text-sm outline-none focus:border-[#4A7CFF]" /></td>
                  <td className="py-2 pr-4"><select value={rule.categoryId} onChange={(event) => updateRule(rule.id, { categoryId: event.target.value })} className="rounded-md border border-[#E8E7E3] bg-white px-2 py-1 text-sm outline-none focus:border-[#4A7CFF]">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td>
                  <td className="py-2 pr-4"><input type="checkbox" checked={rule.fuzzyMatch} onChange={(event) => updateRule(rule.id, { fuzzyMatch: event.target.checked })} className="accent-[#4A7CFF]" /></td>
                  <td className="py-2 pr-4 text-xs tabular-nums text-[#6B7280]">{rule.createdAt ? rule.createdAt.slice(0, 10) : "—"}</td>
                  <td className="py-2 text-right"><button type="button" onClick={() => setMerchantRules((previous) => previous.filter((item) => item.id !== rule.id))} className="rounded-md px-2 py-0.5 text-xs font-medium text-[#A32D27] hover:bg-[#FBE5E3]">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Editable source values" eyebrow="Manual data entry">
        <div className="grid gap-4 xl:grid-cols-2">
          <EditableList title="Accounts">{accounts.map((account) => <CurrencyInput key={account.id} label={account.name} value={account.balanceYen} onChange={(value) => setAccounts(accounts.map((item) => item.id === account.id ? { ...item, balanceYen: value } : item))} />)}</EditableList>
          <EditableList title="Investments">{investments.map((investment) => <CurrencyInput key={investment.id} label={investment.accountName} value={investment.currentBalanceYen} onChange={(value) => setInvestments(investments.map((item) => item.id === investment.id ? { ...item, currentBalanceYen: value } : item))} />)}</EditableList>
          <EditableList title="Debt balances">{debts.map((debt) => <CurrencyInput key={debt.id} label={debt.cardName} value={debt.currentBalanceYen} onChange={(value) => setDebts(debts.map((item) => item.id === debt.id ? { ...item, currentBalanceYen: value } : item))} />)}</EditableList>
          <EditableList title="Goal balances">{goals.map((goal) => <CurrencyInput key={goal.id} label={goal.name} value={goal.currentSavedYen} onChange={(value) => setGoals(goals.map((item) => item.id === goal.id ? { ...item, currentSavedYen: value } : item))} />)}</EditableList>
        </div>
      </Card>
    </div>
  );
}

function MonthNavigator({ month, onPrevious, onNext }: { month: string; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
      <button type="button" onClick={onPrevious} aria-label="Previous month" className="rounded-md p-1.5 text-[#6B7280] transition hover:bg-[#F5F4F0] hover:text-slate-900"><ChevronLeft className="h-4 w-4" /></button>
      <div className="text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Budget month</p>
        <p className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">{formatMonth(month)}</p>
      </div>
      <button type="button" onClick={onNext} aria-label="Next month" className="rounded-md p-1.5 text-[#6B7280] transition hover:bg-[#F5F4F0] hover:text-slate-900"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}

function BudgetGroup({ name, rows, isCollapsed, toggleCollapsed, addCategory, deleteCategory, setAssignment, month, transactions, openActivityCategoryId, setOpenActivityCategoryId, expenseDraft, setExpenseDraft, logExpense, expenseError, estimatedAssignments }: { groupId: string; name: string; rows: ReturnType<typeof buildBudgetRows>; isCollapsed: boolean; toggleCollapsed: () => void; addCategory: () => void; deleteCategory: (category: Category) => void; setAssignment: (categoryId: string, value: number) => void; month: string; transactions: Transaction[]; openActivityCategoryId: string | null; setOpenActivityCategoryId: (categoryId: string | null) => void; expenseDraft: { payee: string; amountYen: number }; setExpenseDraft: (draft: { payee: string; amountYen: number }) => void; logExpense: (categoryId: string) => void; expenseError: string | null; estimatedAssignments: Record<string, boolean> }) {
  const groupAssigned = rows.reduce((total, row) => total + row.assignedYen, 0);
  const groupActivity = rows.reduce((total, row) => total + row.activityYen, 0);
  const groupAvailable = rows.reduce((total, row) => total + row.availableYen, 0);
  return (
    <>
      <tr onClick={toggleCollapsed} className="cursor-pointer border-t border-[#F0EFEB] bg-[#EEEDE9] hover:bg-[#E8E7E3]">
        <td className="relative py-2.5 pl-4 pr-4">
          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-[#4A7CFF]" />
          <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-800">
            <ChevronDown className={`h-3.5 w-3.5 text-[#6B7280] transition ${isCollapsed ? "-rotate-90" : ""}`} />
            {name}
          </span>
        </td>
        <td className="py-2.5 pr-4 text-right text-[11px] tabular-nums text-[#6B7280]">{formatJPY(groupAssigned)}</td>
        <td className="py-2.5 pr-4 text-right text-[11px] tabular-nums text-[#6B7280]">{formatJPY(groupActivity)}</td>
        <td className="py-2.5 pr-4 text-right">
          <div className="inline-flex items-center gap-2">
            <span className="text-[11px] tabular-nums text-[#6B7280]">{formatJPY(groupAvailable)}</span>
            <button type="button" onClick={(event) => { event.stopPropagation(); addCategory(); }} className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#6B7280] transition hover:bg-white hover:text-slate-900" title="Add category">
              <Plus className="mr-0.5 inline h-3 w-3" /> Add
            </button>
          </div>
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {!isCollapsed && rows.map((row) => {
          const tone: "green" | "amber" | "red" = row.status === "overspent" ? "red" : row.status === "underfunded" ? "amber" : "green";
          const available = row.availableYen;
          const availableClass = available < 0 ? "text-[#E5534B]" : available === 0 ? "text-[#6B7280]" : tone === "amber" ? "text-[#8A5A10]" : "text-[#2F7A58]";
          const rowTransactions = transactions.filter((transaction) => transaction.categoryId === row.category.id && transaction.date.startsWith(month));
          const isActivityOpen = openActivityCategoryId === row.category.id;
          return (
            <motion.tr key={row.category.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} className="group border-t border-[#F0EFEB] transition hover:bg-[#FAFAF8]">
              <td className="py-2 pl-8 pr-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => deleteCategory(row.category)} aria-label="Delete category" className="opacity-0 transition group-hover:opacity-100 rounded p-0.5 text-[#6B7280] hover:bg-[#FBE5E3] hover:text-[#E5534B]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-sm text-slate-900">{row.category.name}</span>
                  {estimatedAssignments[budgetKey(month, row.category.id)] && (
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A5A10]">estimated</span>
                  )}
                </div>
              </td>
              <td className="py-2 pr-4 text-right">
                <InlineAssignedInput value={row.assignedYen} onChange={(value) => setAssignment(row.category.id, value)} />
              </td>
              <td className="relative py-2 pr-4 text-right tabular-nums">
                <button type="button" onClick={() => setOpenActivityCategoryId(isActivityOpen ? null : row.category.id)} className="rounded px-2 py-1 text-sm text-[#6B7280] transition hover:bg-[#EEEDE9] hover:text-slate-900">
                  {formatJPY(row.activityYen)}
                </button>
                {isActivityOpen && (
                  <div className="absolute right-4 top-10 z-20 w-80 rounded-xl bg-white p-4 text-left shadow-[0_12px_32px_rgba(17,24,39,0.12)] ring-1 ring-[#F0EFEB]">
                    <p className="text-sm font-medium text-slate-900">{row.category.name} activity</p>
                    <div className="mt-3 max-h-40 space-y-1 overflow-auto scroll-soft">
                      {rowTransactions.length === 0 ? (
                        <p className="text-xs text-[#6B7280]">No transactions in this category this month.</p>
                      ) : (
                        rowTransactions.map((transaction) => (
                          <div key={transaction.id} className="flex justify-between gap-3 py-1 text-xs">
                            <span className="truncate text-slate-900">{transaction.payee}</span>
                            <span className="tabular-nums text-[#6B7280]">{formatJPY(transaction.amountYen)}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-3 space-y-2 border-t border-[#F0EFEB] pt-3">
                      <TextInput label="Payee" value={expenseDraft.payee} onChange={(value) => setExpenseDraft({ ...expenseDraft, payee: value })} />
                      <CurrencyInput label="Amount" value={expenseDraft.amountYen} onChange={(value) => setExpenseDraft({ ...expenseDraft, amountYen: value })} />
                      <button type="button" onClick={() => logExpense(row.category.id)} className="w-full rounded-lg bg-[#4A7CFF] px-3 py-2 text-sm font-medium text-white hover:bg-[#3F6DE8]">Log expense</button>
                      {expenseError && <p className="text-[11px] text-[#E5534B]">{expenseError}</p>}
                    </div>
                  </div>
                )}
              </td>
              <td className="py-2 pr-4 text-right">
                <span className={`text-sm font-medium tabular-nums ${availableClass}`}>{formatJPY(available)}</span>
              </td>
            </motion.tr>
          );
        })}
      </AnimatePresence>
    </>
  );
}

function InlineAssignedInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [local, setLocal] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const displayed = local ?? String(value);
  const commit = () => {
    const raw = local ?? String(value);
    const parsed = Number(raw.replace(/[^\d-]/g, "")) || 0;
    if (parsed !== value) {
      onChange(parsed);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 180);
    }
    setLocal(null);
  };
  return (
    <motion.input
      type="text"
      inputMode="numeric"
      value={displayed}
      onFocus={() => setLocal(String(value))}
      onChange={(event) => setLocal(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }}
      animate={flash ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.18 }}
      className="hide-spin w-24 rounded border-b border-transparent bg-transparent px-1 py-1 text-right text-sm tabular-nums text-slate-900 outline-none transition focus:border-[#4A7CFF] focus:bg-white"
    />
  );
}

function NoticeBanner({ tone, children }: { tone: "amber" | "red" | "blue" | "green"; children: ReactNode }) {
  const map = {
    amber: "bg-[#FBEFD9] text-[#8A5A10]",
    red: "bg-[#FBE5E3] text-[#A32D27]",
    blue: "bg-[#E6EDFF] text-[#2450B5]",
    green: "bg-[#E8F5EE] text-[#2F7A58]",
  } as const;
  return <div className={`rounded-lg px-4 py-2.5 text-sm leading-relaxed ${map[tone]}`}>{children}</div>;
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-[#FAFAF8] px-4 py-6 text-center text-xs leading-relaxed text-[#6B7280]">{children}</p>;
}

function CurrencyInput({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const parseCurrency = (raw: string) => Number(raw.replace(/[^\d-]/g, "")) || 0;
  return <Field label={label}><input disabled={disabled} type="text" inputMode="numeric" value={formatJPY(value)} onChange={(event) => onChange(parseCurrency(event.target.value))} onBlur={(event) => onChange(parseCurrency(event.target.value))} className="w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 text-right text-sm tabular-nums outline-none transition focus:border-[#4A7CFF] disabled:bg-[#FAFAF8] disabled:text-[#6B7280]" /></Field>;
}

function PercentInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><div className="relative"><input type="number" step="0.1" value={Math.round(value * 1000) / 10} onChange={(event) => onChange((Number(event.target.value) || 0) / 100)} className="hide-spin w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 pr-7 text-right text-sm tabular-nums outline-none focus:border-[#4A7CFF]" /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">%</span></div></Field>;
}

function NumberInput({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <Field label={label}><input disabled={disabled} type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="hide-spin w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-[#4A7CFF] disabled:bg-[#FAFAF8] disabled:text-[#6B7280]" /></Field>;
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <Field label={label}><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#4A7CFF]" /></Field>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>{children}</label>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#4A7CFF]">{children}</select></Field>;
}

function FilterChecklist({ title, children }: { title: string; children: ReactNode }) {
  return <div><p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{title}</p><div className="scroll-soft max-h-32 space-y-0.5 overflow-auto rounded-md border border-[#E8E7E3] bg-white p-2 text-sm">{children}</div></div>;
}

function FragmentGroup({ label, count, subtotal, isCollapsed, toggle, children }: { label: string; count: number; subtotal: number; isCollapsed: boolean; toggle: () => void; children: ReactNode }) {
  return (
    <>
      <tr onClick={toggle} className="cursor-pointer border-t border-[#F0EFEB] bg-[#FAFAF8] hover:bg-[#EEEDE9]">
        <td colSpan={6} className="px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-700">
              <ChevronDown className={`h-3.5 w-3.5 text-[#6B7280] transition ${isCollapsed ? "-rotate-90" : ""}`} />
              {label} <span className="tabular-nums text-[#6B7280]">· {count}</span>
            </span>
            <span className="tabular-nums text-[11px] text-[#6B7280]">{formatJPY(subtotal)}</span>
          </div>
        </td>
      </tr>
      {!isCollapsed && children}
    </>
  );
}

function ChartReportCard({ title, hasEnoughData, isLoading = false, children }: { title: string; hasEnoughData: boolean; isLoading?: boolean; children: ReactNode }) {
  return (
    <Card title={title} eyebrow="Last 6 months">
      <div className="h-80">
        {isLoading ? (
          <div className="h-full animate-pulse rounded-lg bg-[#E8E7E3]" />
        ) : !hasEnoughData ? (
          <div className="grid h-full place-items-center rounded-lg bg-[#FAFAF8] p-6 text-center">
            <div>
              <svg viewBox="0 0 80 80" className="mx-auto h-12 w-12 text-[#C9C7C0]" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="12" y="20" width="56" height="48" rx="2" />
                <path d="M20 56 L30 44 L40 50 L50 36 L60 42" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-3 text-sm text-slate-700">Reports need at least 2 months of data.</p>
              <p className="mt-1 text-xs text-[#6B7280]">Keep tracking and come back soon.</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

function ActionButton({ title, detail, tone, onClick }: { title: string; detail: string; tone: "green" | "amber" | "red" | "blue"; onClick: () => void }) {
  const rail = { green: "bg-[#4CAF82]", amber: "bg-[#F5A623]", red: "bg-[#E5534B]", blue: "bg-[#4A7CFF]" } as const;
  return (
    <button type="button" onClick={onClick} className="group relative flex items-start gap-3 rounded-lg bg-[#FAFAF8] p-3 text-left transition hover:bg-[#EEEDE9]">
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${rail[tone]}`} />
      <span className="min-w-0 flex-1">
        <p className="text-sm text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[#6B7280]">{detail}</p>
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6B7280] opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}

function WorkflowCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <Card title={title} eyebrow="Workflow step">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#EEEDE9] text-[#4A7CFF]">{icon}</div>
      <p className="mt-3 text-xs leading-relaxed text-[#6B7280]">{detail}</p>
    </Card>
  );
}

function EditableList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{title}</h3>
      <div className="grid gap-2 rounded-lg bg-[#FAFAF8] p-3">{children}</div>
    </div>
  );
}

