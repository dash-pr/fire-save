import type { BudgetAssignment, BudgetRow, BudgetStatus, Category, SavingsGoal, Transaction, Yen } from "./types";

export function getMonthKey(date: string | Date): string {
  const value = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function calculateActivityYen(transactions: Transaction[], categoryId: string, month: string): Yen {
  return transactions
    .filter((transaction) => transaction.categoryId === categoryId)
    .filter((transaction) => getMonthKey(transaction.date) === month)
    .filter((transaction) => transaction.type === "debit")
    .reduce((total, transaction) => total + Math.abs(transaction.amountYen), 0);
}

export function calculateAvailableYen(assignedYen: Yen, debitActivityYen: Yen): Yen {
  return assignedYen - Math.abs(debitActivityYen);
}

export function getBudgetStatus(assignedYen: Yen, activityYen: Yen, availableYen: Yen): BudgetStatus {
  if (availableYen < 0) return "overspent";
  if (assignedYen === 0 && activityYen === 0) return "funded";
  if (assignedYen === 0 || activityYen === 0) return "underfunded";
  return "funded";
}

export function calculateReadyToAssignYen(monthlyIncomeYen: Yen, assignments: BudgetAssignment[]): Yen {
  const assigned = assignments.reduce((total, assignment) => total + assignment.assignedYen, 0);
  return monthlyIncomeYen - assigned;
}

export function buildBudgetRows(args: {
  categories: Category[];
  assignments: BudgetAssignment[];
  transactions: Transaction[];
  month: string;
  goals?: SavingsGoal[];
}): BudgetRow[] {
  const goalsByCategoryId = new Map((args.goals ?? []).filter((goal) => goal.categoryId).map((goal) => [goal.categoryId!, goal]));
  return args.categories.map((category) => {
    const assignment = args.assignments.find(
      (item) => item.categoryId === category.id && item.month === args.month,
    );
    const assignedYen = assignment?.assignedYen ?? 0;
    const activityYen = calculateActivityYen(args.transactions, category.id, args.month);
    const availableYen = calculateAvailableYen(assignedYen, activityYen);

    // Goal-linked rows have different status semantics: there is no "spend" — only assignment.
    // The row is "funded" if the goal is complete OR the assignment meets the suggested target;
    // "underfunded" only when the user assigned less than the suggested amount.
    let status: BudgetStatus = getBudgetStatus(assignedYen, activityYen, availableYen);
    const goal = goalsByCategoryId.get(category.id);
    if (goal) {
      const isComplete = Boolean(goal.completedAt) || goal.currentSavedYen >= goal.targetAmountYen;
      if (isComplete || assignedYen >= suggestedMonthlyForGoal(goal, args.month)) {
        status = "funded";
      } else {
        status = "underfunded";
      }
    }

    return {
      category,
      assignedYen,
      activityYen,
      availableYen,
      status,
      isManuallySet: assignment?.isManuallySet ?? false,
    };
  });
}

export function sortBudgetRowsByActivity(rows: BudgetRow[]): BudgetRow[] {
  return [...rows].sort((a, b) => {
    if (a.activityYen === 0 && b.activityYen === 0) {
      return a.category.name.localeCompare(b.category.name);
    }
    if (a.activityYen === 0) return 1;
    if (b.activityYen === 0) return -1;
    return b.activityYen - a.activityYen;
  });
}

export function filterBudgetRows(rows: BudgetRow[], filter: "all" | BudgetStatus): BudgetRow[] {
  if (filter === "all") return rows;
  return rows.filter((row) => row.status === filter);
}

export function calculateSavingsRate(totalIncomeYen: Yen, totalExpenseYen: Yen): number {
  if (totalIncomeYen <= 0) return 0;
  return (totalIncomeYen - totalExpenseYen) / totalIncomeYen;
}

/**
 * Months from `currentMonth` (YYYY-MM) up to and including `targetDate` (YYYY-MM-DD).
 * Returns at least 1 — a goal whose target date is this month still needs one funding round.
 */
export function monthsUntilTarget(currentMonth: string, targetDate: string): number {
  const [fy, fm] = currentMonth.split("-").map(Number);
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return 1;
  return Math.max(1, (target.getFullYear() - fy) * 12 + (target.getMonth() + 1 - fm));
}

/**
 * The default monthly assignment for a goal. Computed as the still-needed amount divided by the
 * months remaining, rounded *up* to the nearest ¥1,000 so the user gets a clean number that
 * comfortably hits the target.
 */
export function suggestedMonthlyForGoal(goal: SavingsGoal, currentMonth: string): Yen {
  const remaining = Math.max(0, goal.targetAmountYen - goal.currentSavedYen);
  if (remaining === 0) return 0;
  const months = monthsUntilTarget(currentMonth, goal.targetDate);
  return Math.ceil(remaining / months / 1000) * 1000;
}
