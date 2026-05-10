import type { BudgetAssignment, BudgetRow, BudgetStatus, Category, Transaction, Yen } from "./types";

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
}): BudgetRow[] {
  return args.categories.map((category) => {
    const assignedYen = args.assignments.find(
      (assignment) => assignment.categoryId === category.id && assignment.month === args.month,
    )?.assignedYen ?? 0;
    const activityYen = calculateActivityYen(args.transactions, category.id, args.month);
    const availableYen = calculateAvailableYen(assignedYen, activityYen);

    return {
      category,
      assignedYen,
      activityYen,
      availableYen,
      status: getBudgetStatus(assignedYen, activityYen, availableYen),
    };
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
