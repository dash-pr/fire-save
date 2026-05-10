"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bot, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Pencil, Plus, SlidersHorizontal, Trash2, UploadCloud, X } from "lucide-react";
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
  monthlyIncome,
  nisaContributions,
  savingsGoals,
  transactions,
} from "@/data/sample-data";
import { buildBudgetRows, calculateReadyToAssignYen, calculateSavingsRate } from "@/domain/budget";
import { calculateBunkatsuRemaining, calculateDebtSummary, calculateRiboPayoff } from "@/domain/debt";
import {
  analyzeDrawdowns,
  calculateAgeFromDob,
  calculateDeterministicForecast,
  getCurrentAge,
  runMonteCarloSimulation,
  simulateWithdrawalSurvival,
  type MonteCarloResult,
} from "@/domain/forecast";
import { calculateHypotheticalForecast, defaultHypotheticalForecastInputs, runHypotheticalMonteCarlo, type ForecastMonteCarloResult } from "@/domain/forecasting";
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
  const [simulation, setSimulation] = useState<MonteCarloResult | null>(null);
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
  const withdrawal = simulateWithdrawalSurvival(effectiveForecastInputs, deterministic.targetPortfolioYen, 500);
  const drawdown = simulation ? analyzeDrawdowns(simulation.maxDrawdowns) : null;
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

  const setAssumption = (field: keyof ForecastInputs, value: string | number | undefined) => {
    setAssumptions((previous) => ({ ...previous, [field]: value }));
    setSimulation(null);
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
    <div className="min-h-screen bg-[#F5F4F0] text-slate-950">
      <div className="flex">
        <Sidebar accounts={accountState} investments={investmentState} netWorthYen={netWorth.netWorthYen} activePage={activePage} onNavigate={(pageKey) => setActivePage(pageKey as PageKey)} onAddAccount={(account) => setAccountState((previous) => [...previous, account])} onEditAccount={(id, changes) => setAccountState((previous) => previous.map((account) => account.id === id ? { ...account, ...changes } : account))} onSelectAccount={(accountId) => { setTransactionAccountFilterIds([accountId]); setActivePage("transactions"); }} />
        <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{formatMonth(selectedMonth)}</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">{page.title}</h1>
              <p className="mt-2 max-w-3xl text-slate-600">{page.subtitle}</p>
            </div>
            <button type="button" onClick={() => setActivePage("settings")} className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 lg:flex">
              <SlidersHorizontal className="h-4 w-4" /> Edit defaults
            </button>
          </header>

          {activePage === "home" && <HomePage readyToAssignYen={readyToAssignYen} netWorthYen={netWorth.netWorthYen} savingsRate={savingsRate} fatfireAge={deterministic.estimatedFatfireAge} healthScore={health.score} uncategorizedCount={uncategorizedCount} overspentCount={overspentCount} contributionDeltaYen={deterministic.contributionDeltaYen} accounts={accountState} onNavigate={setActivePage} />}

          {activePage === "budget" && <BudgetPage month={selectedMonth} setMonth={openBudgetMonth} incomeEntries={currentIncomeEntries} setIncomeEntries={setIncomeEntryState} readyToAssignYen={readyToAssignYen} budgetRows={visibleBudgetRows} fullBudgetRows={budgetRows} budgetFilter={budgetFilter} setBudgetFilter={setBudgetFilter} categoryList={activeCategories} setCategories={setCategoryState} transactions={transactionState} setTransactions={setTransactionState} budgetNotice={budgetNotice} estimatedAssignments={estimatedAssignments} setAssignment={(categoryId, value) => setAssignmentState((previous) => ({ ...previous, [budgetKey(selectedMonth, categoryId)]: value }))} assignments={assignments} />}

          {activePage === "transactions" && <TransactionsPage month={selectedMonth} setMonth={setSelectedMonth} transactions={ruledTransactions} rawTransactions={transactionState} setTransactions={setTransactionState} accounts={accountState} categories={activeCategories} merchantRules={merchantRuleState} setMerchantRules={setMerchantRuleState} initialAccountIds={transactionAccountFilterIds} />}
          {activePage === "debt" && <DebtPage debts={debtState} setDebts={setDebtState} totalMonthlyObligationYen={debtSummary.totalMonthlyObligationYen} totalOutstandingYen={debtSummary.totalOutstandingYen} />}
          {activePage === "goals" && <GoalsPage month={selectedMonth} goals={goalState} setGoals={setGoalState} assignments={assignments} />}
          {activePage === "investments" && <InvestmentsPage investments={investmentState} setInvestments={setInvestmentState} />}
          {activePage === "forecast" && <ForecastPage inputs={effectiveForecastInputs} assumptions={assumptions} setAssumption={setAssumption} />}
          {activePage === "reports" && <ReportsPage budgetRows={budgetRows} netWorthYen={netWorth.netWorthYen} incomeYen={incomeYen} totalExpensesYen={totalExpensesYen} />}
          {activePage === "import" && <ImportPage />}
          {activePage === "settings" && <SettingsPage assumptions={assumptions} setAssumption={setAssumption} accounts={accountState} setAccounts={setAccountState} investments={investmentState} setInvestments={setInvestmentState} debts={debtState} setDebts={setDebtState} goals={goalState} setGoals={setGoalState} categories={activeCategories} merchantRules={merchantRuleState} setMerchantRules={setMerchantRuleState} />}
        </main>
      </div>
    </div>
  );
}

function HomePage({ readyToAssignYen, netWorthYen, savingsRate, fatfireAge, healthScore, uncategorizedCount, overspentCount, contributionDeltaYen, accounts, onNavigate }: { readyToAssignYen: number; netWorthYen: number; savingsRate: number; fatfireAge: number | null; healthScore: number; uncategorizedCount: number; overspentCount: number; contributionDeltaYen: number; accounts: Account[]; onNavigate: (page: PageKey) => void }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Ready to Assign" value={formatJPY(readyToAssignYen)} detail="Available for this month" tone="blue" />
        <MetricCard label="Net Worth" value={formatJPY(netWorthYen)} detail="Assets minus liabilities" />
        <MetricCard label="Savings Rate" value={formatPercent(savingsRate)} detail="Current month actuals" tone="green" />
        <MetricCard label="FATFire Age" value={fatfireAge ? fatfireAge.toFixed(1) : "Not reached"} detail="Based on current assumptions" tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card title="Priority actions" eyebrow="Needs attention">
          <div className="mb-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Financial health score</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="text-3xl font-semibold tabular-nums">{healthScore}</div>
              <ProgressBar value={healthScore} className="flex-1" />
            </div>
          </div>
          <div className="grid gap-3">
            <ActionButton title="Review uncategorized transactions" detail={`${uncategorizedCount} item needs a category before reports are final.`} tone="amber" onClick={() => onNavigate("transactions")} />
            <ActionButton title="Resolve overspent categories" detail={`${overspentCount} category balance needs a funding decision.`} tone={overspentCount > 0 ? "red" : "green"} onClick={() => onNavigate("budget")} />
            <ActionButton title="Review required contribution" detail={`${formatJPY(Math.max(contributionDeltaYen, 0))} more per month needed for the target age.`} tone="blue" onClick={() => onNavigate("forecast")} />
          </div>
        </Card>

        <Card title="Account balances" eyebrow="Manual balances">
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                <div><p className="font-semibold">{account.name}</p><p className="text-xs uppercase tracking-wide text-slate-500">{account.type}</p></div>
                <p className="text-lg font-semibold tabular-nums">{formatJPY(account.balanceYen)}</p>
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [activityCategoryId, setActivityCategoryId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState({ payee: "", amountYen: 0 });
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [nisaWarning, setNisaWarning] = useState<string | null>(null);
  const totalIncomeYen = incomeEntries.reduce((total, entry) => total + entry.amountYen, 0);
  const totalActivityYen = fullBudgetRows.reduce((total, row) => total + row.activityYen, 0);
  const overspentByYen = Math.max(0, totalActivityYen - totalIncomeYen);

  useEffect(() => {
    try {
      setCollapsedGroups(JSON.parse(localStorage.getItem("fire-save-budget-collapsed-groups") ?? "{}") as Record<string, boolean>);
    } catch {
      setCollapsedGroups({});
    }
  }, []);

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

  return (
    <div className="space-y-6">
      <MonthNavigator month={month} onPrevious={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} />
      {budgetNotice && <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">{budgetNotice}</div>}
      {overspentByYen > 0 && <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">You spent {formatJPY(overspentByYen)} more than you earned this month.</div>}
      {nisaWarning && <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">{nisaWarning}</div>}

      <section className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Total Income This Month" value={formatJPY(totalIncomeYen)} detail="Entered in monthly income rows" tone="blue" />
        <MetricCard label="Ready to Assign" value={formatJPY(readyToAssignYen)} detail="Income minus assigned amounts" tone={readyToAssignYen >= 0 ? "green" : "amber"} />
        <MetricCard label="Overspent" value={`${fullBudgetRows.filter((row) => row.status === "overspent").length}`} detail="Categories below zero available" tone="amber" />
      </section>

      <Card title="Income" eyebrow="Monthly sources" action={<button type="button" onClick={() => setIncomeCollapsed(!incomeCollapsed)} className="rounded-full bg-slate-100 p-2 text-slate-600"><ChevronDown className={`h-4 w-4 transition ${incomeCollapsed ? "-rotate-90" : ""}`} /></button>}>
        <AnimatePresence initial={false}>{!incomeCollapsed && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="overflow-hidden"><div className="space-y-3">{incomeEntries.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No income entered for this month yet.</p>}{incomeEntries.map((entry) => <div key={entry.id} className="grid gap-3 rounded-2xl bg-slate-50 p-3 md:grid-cols-[1fr_180px_auto]"><TextInput label="Source" value={entry.sourceName} onChange={(value) => updateIncomeRow(entry.id, { sourceName: value })} /><CurrencyInput label="Amount" value={entry.amountYen} onChange={(value) => updateIncomeRow(entry.id, { amountYen: value })} /><button type="button" onClick={() => deleteIncomeRow(entry.id)} className="self-end rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}<button type="button" onClick={addIncomeRow} className="inline-flex items-center gap-2 rounded-2xl bg-[#1C1F3A] px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add Income Row</button><p className="text-lg font-semibold">Total Income This Month: {formatJPY(totalIncomeYen)}</p></div></motion.div>}</AnimatePresence>
      </Card>

      <Card title="Monthly assignments" eyebrow="Budget workspace">
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map((filter) => <button key={filter} type="button" onClick={() => setBudgetFilter(filter)} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${budgetFilter === filter ? "bg-[#1C1F3A] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{filter} {filter !== "all" ? fullBudgetRows.filter((row) => row.status === filter).length : fullBudgetRows.length}</button>)}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Assigned</th><th className="px-4 py-3 text-right">Activity</th><th className="px-4 py-3 text-right">Available</th></tr></thead>
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

function TransactionsPage({ month, setMonth, transactions, rawTransactions, setTransactions, accounts, categories, merchantRules, setMerchantRules, initialAccountIds }: { month: string; setMonth: (month: string) => void; transactions: Transaction[]; rawTransactions: Transaction[]; setTransactions: Dispatch<SetStateAction<Transaction[]>>; accounts: Account[]; categories: Category[]; merchantRules: MerchantRule[]; setMerchantRules: Dispatch<SetStateAction<MerchantRule[]>>; initialAccountIds: string[] }) {
  const [filters, setFilters] = useState<TransactionFilterState>({ search: "", accountIds: initialAccountIds, categoryIds: [], type: "all" });
  const [groupBy, setGroupBy] = useState<"none" | "category" | "date">("none");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  useEffect(() => {
    if (initialAccountIds.length > 0) setFilters((previous) => ({ ...previous, accountIds: initialAccountIds }));
  }, [initialAccountIds]);
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

  return <div className="space-y-6"><MonthNavigator month={month} onPrevious={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} /><section className="grid gap-4 xl:grid-cols-5"><MetricCard label="Total In" value={formatJPY(stats.totalIn)} detail="Filtered credits" tone="blue" /><MetricCard label="Total Out" value={formatJPY(stats.totalOut)} detail="Filtered debits" tone="amber" /><MetricCard label="Net" value={formatJPY(stats.totalIn - stats.totalOut)} detail="Income minus outflow" tone={stats.totalIn - stats.totalOut >= 0 ? "green" : "amber"} /><MetricCard label="Transactions" value={`${stats.count}`} detail="Filtered count" /><MetricCard label="Uncategorized" value={`${stats.uncategorized}`} detail="Needs category" tone={stats.uncategorized > 0 ? "amber" : "green"} /></section><Card title="Filter transactions" eyebrow="Monthly review"><div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.8fr]"><TextInput label="Search merchant or memo" value={filters.search} onChange={(value) => setFilters((previous) => ({ ...previous, search: value }))} /><FilterChecklist title="Accounts">{accounts.map((account) => <label key={account.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.accountIds.includes(account.id)} onChange={() => toggleFilterValue("accountIds", account.id)} />{account.name}</label>)}</FilterChecklist><FilterChecklist title="Categories">{categories.map((category) => <label key={category.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.categoryIds.includes(category.id)} onChange={() => toggleFilterValue("categoryIds", category.id)} />{category.name}</label>)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.categoryIds.includes("uncategorized")} onChange={() => toggleFilterValue("categoryIds", "uncategorized")} />Uncategorized</label></FilterChecklist><SelectField label="Type" value={filters.type} onChange={(value) => setFilters((previous) => ({ ...previous, type: value as TransactionFilterState["type"] }))}><option value="all">All</option><option value="debit">Debit only</option><option value="credit">Credit only</option></SelectField><SelectField label="Group by" value={groupBy} onChange={(value) => setGroupBy(value as typeof groupBy)}><option value="none">None</option><option value="category">By Category</option><option value="date">By Date</option></SelectField></div>{inlineMessage && <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{inlineMessage}</p>}</Card><Card title="Transactions" eyebrow="Categorize and review"><div className="overflow-hidden rounded-2xl border border-slate-100"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Payee</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Rule</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{grouped.map((group) => { const subtotal = group.rows.reduce((total, transaction) => total + (transaction.type === "debit" ? -transaction.amountYen : transaction.amountYen), 0); const isCollapsed = collapsed[group.key] ?? false; return <FragmentGroup key={group.key} label={group.label} count={group.rows.length} subtotal={subtotal} isCollapsed={isCollapsed} toggle={() => setCollapsed((previous) => ({ ...previous, [group.key]: !isCollapsed }))}>{group.rows.map((transaction) => <tr key={transaction.id} className={`border-t border-slate-100 ${transaction.categoryId ? "" : "bg-amber-50/40"}`}><td className="px-4 py-3 text-slate-500">{transaction.date}</td><td className="px-4 py-3 font-medium"><div>{transaction.payee}</div>{transaction.memo && <div className="text-xs text-slate-500">{transaction.memo}</div>}</td><td className="px-4 py-3 text-slate-600">{accounts.find((account) => account.id === transaction.accountId)?.name ?? "Unknown"}</td><td className="px-4 py-3"><select value={transaction.categoryId ?? ""} onChange={(event) => updateCategory(transaction, event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#4A7CFF]"><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td><td className="px-4 py-3"><button type="button" onClick={() => addMerchantRule(transaction)} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">Always categorize</button></td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${transaction.type === "credit" ? "text-emerald-700" : "text-slate-900"}`}>{transaction.type === "credit" ? "+" : "-"}{formatJPY(transaction.amountYen)}</td></tr>)}</FragmentGroup>; })}</tbody></table></div></Card></div>;
}

function DebtPage({ debts, setDebts, totalMonthlyObligationYen, totalOutstandingYen }: { debts: CreditDebt[]; setDebts: (debts: CreditDebt[]) => void; totalMonthlyObligationYen: number; totalOutstandingYen: number }) {
  const updateDebt = (id: string, changes: Partial<CreditDebt>) => setDebts(debts.map((debt) => debt.id === id ? { ...debt, ...changes } : debt));
  return <div className="space-y-6"><section className="grid gap-4 xl:grid-cols-3"><MetricCard label="Outstanding Debt" value={formatJPY(totalOutstandingYen)} detail="Active balances" tone="amber" /><MetricCard label="Monthly Obligation" value={formatJPY(totalMonthlyObligationYen)} detail="Minimum planned payments" /><MetricCard label="Active Debt Items" value={`${debts.filter((debt) => !debt.isPaid).length}`} detail="Ribo, bunkatsu, and ikkatsu" tone="blue" /></section><section className="grid gap-6 xl:grid-cols-3">{debts.map((debt) => { const ribo = debt.type === "revolving" ? calculateRiboPayoff({ balanceYen: debt.currentBalanceYen, monthlyPaymentYen: debt.monthlyPaymentYen, annualInterestRate: debt.annualInterestRate }) : null; const bunkatsu = debt.type === "installment" ? calculateBunkatsuRemaining({ monthlyPaymentYen: debt.monthlyPaymentYen, totalInstallments: debt.totalInstallments ?? 0, installmentsPaid: debt.installmentsPaid ?? 0 }) : null; return <Card key={debt.id} title={debt.cardName} eyebrow={debt.description ?? debt.type}><div className="space-y-3"><CurrencyInput label="Balance" value={debt.currentBalanceYen} onChange={(value) => updateDebt(debt.id, { currentBalanceYen: value })} /><CurrencyInput label="Monthly payment" value={debt.monthlyPaymentYen} onChange={(value) => updateDebt(debt.id, { monthlyPaymentYen: value })} /><PercentInput label="APR" value={debt.annualInterestRate} onChange={(value) => updateDebt(debt.id, { annualInterestRate: value })} />{debt.type === "installment" && <NumberInput label="Installments paid" value={debt.installmentsPaid ?? 0} onChange={(value) => updateDebt(debt.id, { installmentsPaid: value })} />}<div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{ribo && `${ribo.monthsToPayoff} months to payoff · ${formatJPY(ribo.totalInterestYen)} interest`}{bunkatsu && `${bunkatsu.remainingInstallments} installments left · ${formatJPY(bunkatsu.remainingBalanceYen)} remaining`}{debt.type === "lump_sum" && `Expected billing date: ${debt.expectedBillingDate}`}</div></div></Card>; })}</section></div>;
}

function GoalsPage({ month, goals, setGoals, assignments }: { month: string; goals: SavingsGoal[]; setGoals: (goals: SavingsGoal[]) => void; assignments: BudgetAssignment[] }) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [balanceGoalId, setBalanceGoalId] = useState<string | null>(null);
  const [draftGoal, setDraftGoal] = useState({ name: "", emoji: "🎯", targetAmountYen: 0, targetDate: `${month}-28`, notes: "" });
  const updateGoal = (id: string, changes: Partial<SavingsGoal>) => setGoals(goals.map((goal) => goal.id === id ? { ...goal, ...changes } : goal));
  const editingGoal = goals.find((goal) => goal.id === editingGoalId) ?? null;
  const getMonthlyAllocation = (goal: SavingsGoal) => assignments.find((assignment) => assignment.categoryId === goal.categoryId)?.assignedYen ?? 0;
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

  return <div className="space-y-6"><div className="flex justify-end"><button type="button" onClick={() => setIsCreating(true)} className="inline-flex items-center gap-2 rounded-2xl bg-[#1C1F3A] px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add Goal</button></div><section className="grid gap-6 xl:grid-cols-[1fr_360px]"><div className="grid gap-6 xl:grid-cols-2">{goals.map((goal) => { const allocation = getMonthlyAllocation(goal); const progress = goal.targetAmountYen > 0 ? (goal.currentSavedYen / goal.targetAmountYen) * 100 : 0; const onTrack = allocation > 0 && new Date(projectedDate(goal, allocation)) <= new Date(goal.targetDate); return <Card key={goal.id} title={`${goal.emoji} ${goal.name}`} eyebrow="Savings target" action={<button type="button" onClick={() => setEditingGoalId(goal.id)} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"><Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit</button>}><ProgressBar value={progress} /><div className="mt-3 space-y-2 text-sm text-slate-600"><p>{formatJPY(goal.currentSavedYen)} of {formatJPY(goal.targetAmountYen)} · target {goal.targetDate}</p><p className="font-semibold text-slate-900">Monthly allocation from budget: {formatJPY(allocation)}</p><p>Projected completion: {projectedDate(goal, allocation)}</p><StatusPill tone={onTrack ? "green" : "amber"}>{onTrack ? "On track" : "Needs funding"}</StatusPill></div><div className="relative mt-4"><button type="button" onClick={() => setBalanceGoalId(balanceGoalId === goal.id ? null : goal.id)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Update Balance</button>{balanceGoalId === goal.id && <div className="absolute left-0 top-12 z-20 w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl"><CurrencyInput label="Current saved amount" value={goal.currentSavedYen} onChange={(value) => updateGoal(goal.id, { currentSavedYen: value })} /><button type="button" onClick={() => setBalanceGoalId(null)} className="mt-3 w-full rounded-2xl bg-[#1C1F3A] px-4 py-2 text-sm font-semibold text-white">Save balance</button></div>}</div></Card>; })}</div><AnimatePresence>{editingGoal && <motion.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2, ease: "easeOut" }} className="sticky top-6 h-fit rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Right detail panel</p><h3 className="text-xl font-semibold">Edit goal</h3></div><button type="button" onClick={() => setEditingGoalId(null)} className="rounded-full bg-slate-100 p-2 text-slate-500"><X className="h-4 w-4" /></button></div><div className="space-y-3"><TextInput label="Name" value={editingGoal.name} onChange={(value) => updateGoal(editingGoal.id, { name: value })} /><TextInput label="Emoji" value={editingGoal.emoji} onChange={(value) => updateGoal(editingGoal.id, { emoji: value })} /><CurrencyInput label="Target amount" value={editingGoal.targetAmountYen} onChange={(value) => updateGoal(editingGoal.id, { targetAmountYen: value })} /><TextInput label="Target date" type="date" value={editingGoal.targetDate} onChange={(value) => updateGoal(editingGoal.id, { targetDate: value })} /><TextInput label="Notes" value={editingGoal.notes ?? ""} onChange={(value) => updateGoal(editingGoal.id, { notes: value })} /><p className="rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">Monthly allocation is set exclusively in the Budget tab.</p></div></motion.aside>}</AnimatePresence></section>{isCreating && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-6"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create flow</p><h3 className="text-2xl font-semibold">Add Goal</h3></div><button type="button" onClick={() => setIsCreating(false)} className="rounded-full bg-slate-100 p-2 text-slate-500"><X className="h-4 w-4" /></button></div><div className="grid gap-3"><TextInput label="Name" value={draftGoal.name} onChange={(value) => setDraftGoal({ ...draftGoal, name: value })} /><TextInput label="Emoji" value={draftGoal.emoji} onChange={(value) => setDraftGoal({ ...draftGoal, emoji: value })} /><CurrencyInput label="Target amount" value={draftGoal.targetAmountYen} onChange={(value) => setDraftGoal({ ...draftGoal, targetAmountYen: value })} /><TextInput label="Target date" type="date" value={draftGoal.targetDate} onChange={(value) => setDraftGoal({ ...draftGoal, targetDate: value })} /><TextInput label="Notes" value={draftGoal.notes} onChange={(value) => setDraftGoal({ ...draftGoal, notes: value })} /><button type="button" onClick={addGoal} className="rounded-2xl bg-[#1C1F3A] px-4 py-3 text-sm font-semibold text-white">Create goal</button></div></div></div>}</div>;
}

function InvestmentsPage({ investments, setInvestments }: { investments: Investment[]; setInvestments: (investments: Investment[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedInvestment = investments.find((investment) => investment.id === selectedId) ?? null;
  const updateInvestment = (id: string, changes: Partial<Investment>) => setInvestments(investments.map((investment) => investment.id === id ? { ...investment, ...changes } : investment));
  const investedTotal = investments.reduce((total, investment) => total + investment.currentBalanceYen, 0);
  const nisaLifetime = calculateLifetimeNisaUsage(investments);
  const nisaUsage = (nisaLifetime / NISA_LIFETIME_LIMIT_YEN) * 100;
  const annualNisaTotal = nisaContributions.reduce((total, item) => total + item.totalContributed, 0);

  return <div className="space-y-6"><section className="grid gap-4 xl:grid-cols-3"><MetricCard label="Invested Assets" value={formatJPY(investedTotal)} detail="Manual current balances only" tone="green" /><MetricCard label="Investment Accounts" value={`${investments.length}`} detail="NISA, iDeCo, and taxable" tone="blue" /><MetricCard label="Annual NISA Contributions" value={formatJPY(annualNisaTotal)} detail="Tracked against yearly limits" /></section><Card title="Lifetime NISA usage" eyebrow="Japanese limit tracking"><div className="flex items-center justify-between text-sm"><span className="font-semibold">Lifetime NISA: {formatJPY(nisaLifetime)} of {formatJPY(NISA_LIFETIME_LIMIT_YEN)} used ({Math.round(nisaUsage)}%).</span><span className="text-slate-500">Current balances only</span></div><ProgressBar value={nisaUsage} className="mt-3" /></Card><section className="grid gap-6 xl:grid-cols-[1fr_360px]"><div className="grid gap-6 xl:grid-cols-2">{investments.map((investment) => { const pnl = calculateInvestmentGain(investment); return <Card key={investment.id} title={investment.accountName} eyebrow={formatInvestmentSubtype(investment.accountSubtype)} action={<button type="button" onClick={() => setSelectedId(investment.id)} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"><Pencil className="h-3.5 w-3.5" /> Edit</button>}><div className="space-y-4"><div><p className="text-sm text-slate-500">Current balance</p><p className="mt-1 text-3xl font-semibold tabular-nums">{formatJPY(investment.currentBalanceYen)}</p></div>{pnl.gainYen === null ? <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Set cost basis to see P&amp;L.</p> : <div className={`rounded-2xl p-3 text-sm font-semibold ${pnl.gainYen >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>Current gain/loss: {formatJPY(pnl.gainYen)} · {formatPercent(pnl.returnRate ?? 0, 1)}</div>}{investment.notes && <p className="text-sm text-slate-500">{investment.notes}</p>}</div></Card>; })}</div><AnimatePresence>{selectedInvestment && <motion.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2, ease: "easeOut" }} className="sticky top-6 h-fit rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Right detail panel</p><h3 className="text-xl font-semibold">Edit investment</h3></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-full bg-slate-100 p-2 text-slate-500"><X className="h-4 w-4" /></button></div><div className="space-y-3"><TextInput label="Account name" value={selectedInvestment.accountName} onChange={(value) => updateInvestment(selectedInvestment.id, { accountName: value })} /><SelectField label="Account type" value={selectedInvestment.accountSubtype} onChange={(value) => updateInvestment(selectedInvestment.id, { accountSubtype: value as Investment["accountSubtype"] })}><option value="growth">NISA Growth / 成長投資枠</option><option value="tsumitate">NISA Tsumitate / 積立NISA</option><option value="ideco">iDeCo</option><option value="taxable">Taxable</option></SelectField><CurrencyInput label="Current balance" value={selectedInvestment.currentBalanceYen} onChange={(value) => updateInvestment(selectedInvestment.id, { currentBalanceYen: value })} /><CurrencyInput label="Initial invested amount" value={selectedInvestment.initialInvestedAmount ?? 0} onChange={(value) => updateInvestment(selectedInvestment.id, { initialInvestedAmount: value })} /><TextInput label="Notes" value={selectedInvestment.notes ?? ""} onChange={(value) => updateInvestment(selectedInvestment.id, { notes: value })} /><p className="rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">Expected return fields are intentionally excluded here. Projection assumptions live only in FATFire Forecast.</p></div></motion.aside>}</AnimatePresence></section></div>;
}

function ForecastPage({ inputs, assumptions, setAssumption }: { inputs: ForecastInputs; assumptions: ForecastInputs; setAssumption: (field: keyof ForecastInputs, value: string | number | undefined) => void }) {
  const [whatIf, setWhatIf] = useState({ monthlyContributionYen: inputs.monthlyContributionYen, expectedAnnualReturn: inputs.expectedAnnualReturn });
  const [monteCarlo, setMonteCarlo] = useState<ForecastMonteCarloResult>(() => runHypotheticalMonteCarlo(inputs, 1000));
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const deterministic = calculateHypotheticalForecast({ ...inputs, monthlyContributionYen: whatIf.monthlyContributionYen, expectedAnnualReturn: whatIf.expectedAnnualReturn });
  const baseMonteCarlo = useMemo(() => runHypotheticalMonteCarlo(inputs, 1000), [inputs]);
  useEffect(() => {
    const id = window.setTimeout(() => setMonteCarlo(runHypotheticalMonteCarlo({ ...inputs, monthlyContributionYen: whatIf.monthlyContributionYen, expectedAnnualReturn: whatIf.expectedAnnualReturn }, 1000)), 300);
    return () => window.clearTimeout(id);
  }, [inputs, whatIf]);
  const successTone = monteCarlo.successRate > 0.85 ? "text-emerald-700" : monteCarlo.successRate >= 0.7 ? "text-amber-700" : "text-red-700";
  const resetDefaults = () => Object.entries(defaultHypotheticalForecastInputs).forEach(([key, value]) => setAssumption(key as keyof ForecastInputs, value));
  const contributionDelta = whatIf.monthlyContributionYen - inputs.monthlyContributionYen;
  const successDelta = monteCarlo.successRate - baseMonteCarlo.successRate;

  return <div className="space-y-6"><div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-900">Hypothetical projection — adjust inputs to model your optimal path. This screen is fully separate from actual Budget and Investment data.</div><section className="grid gap-4 xl:grid-cols-4"><MetricCard label="FATFire target" value={formatJPY(deterministic.targetPortfolioYen)} detail="Target spend ÷ SWR" /><MetricCard label="Projected FATFire age" value={deterministic.projectedFatfireAge?.toFixed(1) ?? "Not reached"} detail="Deterministic base case" tone="amber" /><MetricCard label="Years remaining" value={deterministic.yearsRemaining?.toFixed(1) ?? "—"} detail="From current age" tone="blue" /><MetricCard label="Portfolio at target age" value={formatJPY(deterministic.projectedPortfolioAtTargetAgeYen)} detail="Monthly compounding" tone="green" /></section><section className="grid gap-6 xl:grid-cols-[340px_1fr_340px]"><Card title="Hypothetical inputs" eyebrow="Manual scenario"><div className="grid gap-3"><NumberInput label="Current age" value={assumptions.currentAge ?? 30} onChange={(value) => setAssumption("currentAge", value)} /><NumberInput label="Target retirement age" value={assumptions.targetRetirementAge} onChange={(value) => setAssumption("targetRetirementAge", value)} /><CurrencyInput label="Current investable assets" value={assumptions.currentPortfolioYen} onChange={(value) => setAssumption("currentPortfolioYen", value)} /><CurrencyInput label="Monthly investment amount" value={assumptions.monthlyContributionYen} onChange={(value) => { setAssumption("monthlyContributionYen", value); setWhatIf((previous) => ({ ...previous, monthlyContributionYen: value })); }} /><PercentInput label="Expected annual return" value={assumptions.expectedAnnualReturn} onChange={(value) => { setAssumption("expectedAnnualReturn", value); setWhatIf((previous) => ({ ...previous, expectedAnnualReturn: value })); }} /><PercentInput label="Inflation rate" value={assumptions.inflationRate} onChange={(value) => setAssumption("inflationRate", value)} /><CurrencyInput label="Retirement annual spend" value={assumptions.targetAnnualRetirementSpendYen} onChange={(value) => setAssumption("targetAnnualRetirementSpendYen", value)} /><PercentInput label="Safe withdrawal rate" value={assumptions.safeWithdrawalRate} onChange={(value) => setAssumption("safeWithdrawalRate", value)} /><button type="button" onClick={resetDefaults} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Reset to defaults</button></div></Card><div className="space-y-6"><Card title="Success rate" eyebrow="1000 simulations"><p className={`text-6xl font-semibold tabular-nums ${successTone}`}>{formatPercent(monteCarlo.successRate)}</p><p className="mt-2 text-sm text-slate-500">Green above 85%, amber 70–85%, red below 70%.</p></Card><Card title="Fan chart" eyebrow="Portfolio percentiles"><div className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monteCarlo.fanChart}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="year" label={{ value: "Years", position: "insideBottom", offset: -4 }} /><YAxis tickFormatter={compactCurrency} width={56} label={{ value: "Portfolio", angle: -90, position: "insideLeft" }} /><Tooltip formatter={(value) => formatJPY(Number(value))} /><Area type="monotone" dataKey="p90" stroke="#BBD0FF" fill="#E8EFFF" /><Area type="monotone" dataKey="p75" stroke="#8FB0FF" fill="#D7E2FF" /><Area type="monotone" dataKey="p50" stroke="#4A7CFF" fill="#BBD0FF" /><Area type="monotone" dataKey="p25" stroke="#2F5FE3" fill="#8FB0FF" /><Area type="monotone" dataKey="p10" stroke="#1C1F3A" fill="#4A7CFF" /></AreaChart></ResponsiveContainer></div></Card><Card title="Drawdown histogram" eyebrow="Worst single-year losses"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={monteCarlo.drawdownHistogram}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="bucket" label={{ value: "Loss % bucket", position: "insideBottom", offset: -4 }} /><YAxis label={{ value: "Count", angle: -90, position: "insideLeft" }} /><Tooltip /><Bar dataKey="count" fill="#F97373" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></Card></div><Card title="What-if panel" eyebrow="Instant recalculation"><div className="space-y-5"><Field label="Monthly contribution"><input type="range" min={0} max={800000} step={10000} value={whatIf.monthlyContributionYen} onChange={(event) => setWhatIf((previous) => ({ ...previous, monthlyContributionYen: Number(event.target.value) }))} className="w-full" /><p className="font-semibold tabular-nums">{formatJPY(whatIf.monthlyContributionYen)}</p></Field><Field label="Expected return"><input type="range" min={0} max={15} step={0.1} value={Math.round(whatIf.expectedAnnualReturn * 1000) / 10} onChange={(event) => setWhatIf((previous) => ({ ...previous, expectedAnnualReturn: Number(event.target.value) / 100 }))} className="w-full" /><p className="font-semibold tabular-nums">{formatPercent(whatIf.expectedAnnualReturn, 1)}</p></Field><p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">Investing {formatJPY(contributionDelta)} more/month changes success rate by {formatPercent(successDelta, 1)}.</p><div className="rounded-2xl bg-slate-50 p-3 text-sm"><p className="font-semibold">Sequence of returns risk</p><p>Early bad decade success rate: {formatPercent(monteCarlo.sequenceRisk.earlyBadDecadeSuccessRate)} vs Late bad decade: {formatPercent(monteCarlo.sequenceRisk.lateBadDecadeSuccessRate)}.</p></div><div className="rounded-2xl bg-slate-50 p-3 text-sm"><p className="font-semibold">Final portfolio</p><p>P10 {formatJPY(monteCarlo.finalPortfolioSummary.p10)}</p><p>P50 {formatJPY(monteCarlo.finalPortfolioSummary.p50)}</p><p>P90 {formatJPY(monteCarlo.finalPortfolioSummary.p90)}</p></div></div></Card></section><Card title="How is this calculated?" eyebrow="Methodology" action={<button type="button" onClick={() => setMethodologyOpen(!methodologyOpen)} className="rounded-full bg-slate-100 p-2"><ChevronDown className={`h-4 w-4 transition ${methodologyOpen ? "" : "-rotate-90"}`} /></button>}><AnimatePresence>{methodologyOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="overflow-hidden"><div className="space-y-3 text-sm leading-6 text-slate-600"><p>The deterministic projection compounds the current hypothetical portfolio monthly and adds the hypothetical monthly contribution after each month.</p><p>Monte Carlo runs 1000 alternate futures. Each simulated year draws an annual return from a normal distribution centered on your expected return with a 12% standard deviation, then applies it monthly.</p><p>A 12% standard deviation means annual outcomes commonly vary meaningfully above or below the average. It is a simplified volatility assumption, not a guarantee.</p><p>Sequence-of-returns risk compares bad returns early versus late in accumulation. Early losses can hurt more because fewer future gains compound from a smaller base.</p><p>The safe withdrawal rate converts desired annual retirement spending into a portfolio target: annual spend divided by SWR.</p></div></motion.div>}</AnimatePresence></Card></div>;
}

function ReportsPage({ budgetRows, netWorthYen, incomeYen, totalExpensesYen }: { budgetRows: ReturnType<typeof buildBudgetRows>; netWorthYen: number; incomeYen: number; totalExpensesYen: number }) {
  const groupData = categoryGroups.map((group) => ({ name: group.name, assigned: budgetRows.filter((row) => row.category.groupId === group.id).reduce((sum, row) => sum + row.assignedYen, 0) }));
  return <section className="grid gap-6 xl:grid-cols-2"><Card title="Spending by category group" eyebrow="Budget allocation"><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={groupData}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tickFormatter={compactCurrency} width={48} /><Tooltip formatter={(value) => formatJPY(Number(value))} /><Bar dataKey="assigned" fill="#4A7CFF" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></Card><Card title="Income, spending, and net worth" eyebrow="Monthly summary"><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={[{ name: "Income", value: incomeYen }, { name: "Spending", value: totalExpensesYen }, { name: "Net worth", value: netWorthYen }]}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="name" /><YAxis tickFormatter={compactCurrency} width={56} /><Tooltip formatter={(value) => formatJPY(Number(value))} /><Line type="monotone" dataKey="value" stroke="#4CAF82" strokeWidth={3} /></LineChart></ResponsiveContainer></div></Card></section>;
}

function ImportPage() {
  return <section className="grid gap-6 xl:grid-cols-3"><WorkflowCard icon={<UploadCloud className="h-5 w-5" />} title="Upload statement or CSV" detail="Supports JPG, PNG, PDF, and CSV files within Supabase free-tier storage limits." /><WorkflowCard icon={<CheckCircle2 className="h-5 w-5" />} title="Review extracted transactions" detail="Japanese dates and integer JPY amounts are normalized before confirmation." /><WorkflowCard icon={<Bot className="h-5 w-5" />} title="Generate monthly insight" detail="Insights use aggregated monthly summaries only and are cached by month." /></section>;
}

function SettingsPage({ assumptions, setAssumption, accounts, setAccounts, investments, setInvestments, debts, setDebts, goals, setGoals, categories, merchantRules, setMerchantRules }: { assumptions: ForecastInputs; setAssumption: (field: keyof ForecastInputs, value: string | number | undefined) => void; accounts: Account[]; setAccounts: (accounts: Account[]) => void; investments: Investment[]; setInvestments: (investments: Investment[]) => void; debts: CreditDebt[]; setDebts: (debts: CreditDebt[]) => void; goals: SavingsGoal[]; setGoals: (goals: SavingsGoal[]) => void; categories: Category[]; merchantRules: MerchantRule[]; setMerchantRules: Dispatch<SetStateAction<MerchantRule[]>> }) {
  const updateRule = (id: string, changes: Partial<MerchantRule>) => setMerchantRules((previous) => previous.map((rule) => rule.id === id ? { ...rule, ...changes } : rule));
  return <div className="space-y-6"><Card title="Core planning defaults" eyebrow="Shared assumptions"><div className="grid gap-3 xl:grid-cols-4"><TextInput label="Date of birth" value={assumptions.dateOfBirth ?? "1996-02-01"} type="date" onChange={(value) => setAssumption("dateOfBirth", value)} /><NumberInput label="Calculated age" value={Math.floor(calculateAgeFromDob(assumptions.dateOfBirth ?? "1996-02-01"))} onChange={() => undefined} disabled /><NumberInput label="Target FATFire age" value={assumptions.targetRetirementAge} onChange={(value) => setAssumption("targetRetirementAge", value)} /><CurrencyInput label="Annual retirement spend" value={assumptions.targetAnnualRetirementSpendYen} onChange={(value) => setAssumption("targetAnnualRetirementSpendYen", value)} /><PercentInput label="Safe withdrawal rate" value={assumptions.safeWithdrawalRate} onChange={(value) => setAssumption("safeWithdrawalRate", value)} /><PercentInput label="Expected return" value={assumptions.expectedAnnualReturn} onChange={(value) => setAssumption("expectedAnnualReturn", value)} /><PercentInput label="Inflation" value={assumptions.inflationRate} onChange={(value) => setAssumption("inflationRate", value)} /><PercentInput label="Volatility" value={assumptions.returnVolatility} onChange={(value) => setAssumption("returnVolatility", value)} /><NumberInput label="Retirement end age" value={assumptions.retirementEndAge} onChange={(value) => setAssumption("retirementEndAge", value)} /><CurrencyInput label="Reserve threshold" value={assumptions.reserveThresholdYen} onChange={(value) => setAssumption("reserveThresholdYen", value)} /></div></Card><Card title="Merchant Rules" eyebrow="Intelligent categorization"><div className="overflow-hidden rounded-2xl border border-slate-100"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Pattern</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Fuzzy</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{merchantRules.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No merchant rules yet. Create rules from the Transactions screen.</td></tr> : merchantRules.map((rule) => <tr key={rule.id} className="border-t border-slate-100"><td className="px-4 py-3"><input value={rule.pattern} onChange={(event) => updateRule(rule.id, { pattern: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-[#4A7CFF]" /></td><td className="px-4 py-3"><select value={rule.categoryId} onChange={(event) => updateRule(rule.id, { categoryId: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#4A7CFF]">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td><td className="px-4 py-3"><input type="checkbox" checked={rule.fuzzyMatch} onChange={(event) => updateRule(rule.id, { fuzzyMatch: event.target.checked })} /></td><td className="px-4 py-3 text-slate-500">{rule.createdAt ? rule.createdAt.slice(0, 10) : "—"}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setMerchantRules((previous) => previous.filter((item) => item.id !== rule.id))} className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">Delete</button></td></tr>)}</tbody></table></div></Card><Card title="Editable source values" eyebrow="Manual data entry"><div className="grid gap-6 xl:grid-cols-2"><EditableList title="Accounts">{accounts.map((account) => <CurrencyInput key={account.id} label={account.name} value={account.balanceYen} onChange={(value) => setAccounts(accounts.map((item) => item.id === account.id ? { ...item, balanceYen: value } : item))} />)}</EditableList><EditableList title="Investments">{investments.map((investment) => <CurrencyInput key={investment.id} label={investment.accountName} value={investment.currentBalanceYen} onChange={(value) => setInvestments(investments.map((item) => item.id === investment.id ? { ...item, currentBalanceYen: value } : item))} />)}</EditableList><EditableList title="Debt balances">{debts.map((debt) => <CurrencyInput key={debt.id} label={debt.cardName} value={debt.currentBalanceYen} onChange={(value) => setDebts(debts.map((item) => item.id === debt.id ? { ...item, currentBalanceYen: value } : item))} />)}</EditableList><EditableList title="Goal balances">{goals.map((goal) => <CurrencyInput key={goal.id} label={goal.name} value={goal.currentSavedYen} onChange={(value) => setGoals(goals.map((item) => item.id === goal.id ? { ...item, currentSavedYen: value } : item))} />)}</EditableList></div></Card></div>;
}

function MonthNavigator({ month, onPrevious, onNext }: { month: string; onPrevious: () => void; onNext: () => void }) {
  return <div className="flex items-center justify-between rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100"><button type="button" onClick={onPrevious} className="rounded-2xl bg-slate-100 p-3 text-slate-600 transition hover:bg-slate-200"><ChevronLeft className="h-5 w-5" /></button><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Budget Month</p><p className="text-xl font-semibold">{formatMonth(month)}</p></div><button type="button" onClick={onNext} className="rounded-2xl bg-slate-100 p-3 text-slate-600 transition hover:bg-slate-200"><ChevronRight className="h-5 w-5" /></button></div>;
}

function BudgetGroup({ name, rows, isCollapsed, toggleCollapsed, addCategory, deleteCategory, setAssignment, month, transactions, openActivityCategoryId, setOpenActivityCategoryId, expenseDraft, setExpenseDraft, logExpense, expenseError, estimatedAssignments }: { groupId: string; name: string; rows: ReturnType<typeof buildBudgetRows>; isCollapsed: boolean; toggleCollapsed: () => void; addCategory: () => void; deleteCategory: (category: Category) => void; setAssignment: (categoryId: string, value: number) => void; month: string; transactions: Transaction[]; openActivityCategoryId: string | null; setOpenActivityCategoryId: (categoryId: string | null) => void; expenseDraft: { payee: string; amountYen: number }; setExpenseDraft: (draft: { payee: string; amountYen: number }) => void; logExpense: (categoryId: string) => void; expenseError: string | null; estimatedAssignments: Record<string, boolean> }) {
  const groupAssigned = rows.reduce((total, row) => total + row.assignedYen, 0);
  const groupActivity = rows.reduce((total, row) => total + row.activityYen, 0);
  const groupAvailable = rows.reduce((total, row) => total + row.availableYen, 0);
  return <><tr onClick={toggleCollapsed} className="cursor-pointer border-t border-slate-100 bg-slate-50/70"><td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><span className="inline-flex items-center gap-2"><ChevronDown className={`h-4 w-4 transition ${isCollapsed ? "-rotate-90" : ""}`} />{name}</span></td><td className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{formatJPY(groupAssigned)}</td><td className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{formatJPY(groupActivity)}</td><td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-3"><span className="text-xs font-semibold text-slate-500">{formatJPY(groupAvailable)}</span><button type="button" onClick={(event) => { event.stopPropagation(); addCategory(); }} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"><Plus className="mr-1 inline h-3 w-3" /> Add Category</button></div></td></tr><AnimatePresence initial={false}>{!isCollapsed && rows.map((row) => { const tone = row.status === "overspent" ? "red" : row.status === "underfunded" ? "amber" : "green"; const rowTransactions = transactions.filter((transaction) => transaction.categoryId === row.category.id && transaction.date.startsWith(month)); const isActivityOpen = openActivityCategoryId === row.category.id; return <motion.tr key={row.category.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="group border-t border-slate-100"><td className="px-4 py-3 font-medium"><div className="flex items-center gap-2"><button type="button" onClick={() => deleteCategory(row.category)} className="opacity-0 transition group-hover:opacity-100 rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button><span>{row.category.name}</span>{estimatedAssignments[budgetKey(month, row.category.id)] && <span className="text-xs font-semibold text-amber-600">estimated — based on last month</span>}</div></td><td className="px-4 py-3 text-right"><input value={row.assignedYen} onChange={(event) => setAssignment(row.category.id, Number(event.target.value) || 0)} type="number" className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right tabular-nums outline-none focus:border-[#4A7CFF]" /></td><td className="relative px-4 py-3 text-right tabular-nums"><button type="button" onClick={() => setOpenActivityCategoryId(isActivityOpen ? null : row.category.id)} className="rounded-xl px-3 py-2 font-semibold transition hover:bg-slate-100">{formatJPY(row.activityYen)}</button>{isActivityOpen && <div className="absolute right-4 top-12 z-20 w-80 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-xl"><p className="font-semibold">{row.category.name} activity</p><div className="mt-3 max-h-40 space-y-2 overflow-auto">{rowTransactions.length === 0 ? <p className="text-sm text-slate-500">No transactions in this category this month.</p> : rowTransactions.map((transaction) => <div key={transaction.id} className="flex justify-between gap-3 rounded-2xl bg-slate-50 p-2 text-sm"><span className="truncate">{transaction.payee}</span><span className="font-semibold tabular-nums">{formatJPY(transaction.amountYen)}</span></div>)}</div><div className="mt-3 grid gap-2"><TextInput label="Payee" value={expenseDraft.payee} onChange={(value) => setExpenseDraft({ ...expenseDraft, payee: value })} /><CurrencyInput label="Amount" value={expenseDraft.amountYen} onChange={(value) => setExpenseDraft({ ...expenseDraft, amountYen: value })} /><button type="button" onClick={() => logExpense(row.category.id)} className="rounded-2xl bg-[#1C1F3A] px-4 py-2 text-sm font-semibold text-white">+ Log Expense</button>{expenseError && <p className="text-xs font-semibold text-red-600">{expenseError}</p>}</div></div>}</td><td className="px-4 py-3 text-right"><StatusPill tone={tone}>{formatJPY(row.availableYen)}</StatusPill></td></motion.tr>; })}</AnimatePresence></>;
}

function CurrencyInput({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <Field label={label}><input disabled={disabled} type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right font-medium tabular-nums outline-none focus:border-[#4A7CFF] disabled:bg-slate-100" /></Field>;
}

function PercentInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><input type="number" step="0.1" value={Math.round(value * 1000) / 10} onChange={(event) => onChange((Number(event.target.value) || 0) / 100)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right font-medium tabular-nums outline-none focus:border-[#4A7CFF]" /></Field>;
}

function NumberInput({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <Field label={label}><input disabled={disabled} type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right font-medium tabular-nums outline-none focus:border-[#4A7CFF] disabled:bg-slate-100" /></Field>;
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <Field label={label}><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium outline-none focus:border-[#4A7CFF]" /></Field>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium outline-none focus:border-[#4A7CFF]">{children}</select></Field>;
}

function FilterChecklist({ title, children }: { title: string; children: ReactNode }) {
  return <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><div className="max-h-32 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-3">{children}</div></div>;
}

function FragmentGroup({ label, count, subtotal, isCollapsed, toggle, children }: { label: string; count: number; subtotal: number; isCollapsed: boolean; toggle: () => void; children: ReactNode }) {
  return <><tr onClick={toggle} className="cursor-pointer border-t border-slate-100 bg-slate-50/80"><td colSpan={6} className="px-4 py-3"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><ChevronDown className={`h-4 w-4 transition ${isCollapsed ? "-rotate-90" : ""}`} />{label} · {count} items</span><span className="font-semibold tabular-nums text-slate-600">{formatJPY(subtotal)}</span></div></td></tr>{!isCollapsed && children}</>;
}

function RiskStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>;
}

function ActionButton({ title, detail, tone, onClick }: { title: string; detail: string; tone: "green" | "amber" | "red" | "blue"; onClick: () => void }) {
  const tones = { green: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50", red: "border-red-200 bg-red-50", blue: "border-blue-200 bg-blue-50" };
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition hover:shadow-sm ${tones[tone]}`}><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-slate-600">{detail}</p></button>;
}

function WorkflowCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <Card title={title} eyebrow="Workflow step"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#1C1F3A] text-white">{icon}</div><p className="mt-4 text-sm leading-6 text-slate-600">{detail}</p></Card>;
}

function EditableList({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><h3 className="mb-3 font-semibold">{title}</h3><div className="grid gap-3">{children}</div></div>;
}
