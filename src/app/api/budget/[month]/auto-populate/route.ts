import { prisma } from "@/lib/prisma";
import type { BudgetAssignment, BudgetAutoPopulateResponse, IncomeEntry } from "@/domain/types";

const monthPattern = /^\d{4}-\d{2}$/;

type RouteContext = { params: Promise<{ month: string }> };

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthDate(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export async function GET(_request: Request, context: RouteContext) {
  const { month } = await context.params;
  if (!monthPattern.test(month)) return Response.json({ error: "Month must use YYYY-MM format." }, { status: 400 });

  const targetDate = monthDate(month);
  const existing = await prisma.budget.findMany({ where: { localUserId: "local-user", month: targetDate } });
  if (existing.length > 0) {
    const response: BudgetAutoPopulateResponse = {
      month,
      created: false,
      assignments: existing.map((budget): BudgetAssignment => ({ categoryId: budget.categoryId, month, assignedYen: budget.assignedYen })),
      incomeEntries: [],
      estimatedCategoryIds: [],
    };
    return Response.json(response);
  }

  const previousMonth = shiftMonth(month, -1);
  const previousDate = monthDate(previousMonth);
  const [categories, previousBudgets, previousIncome] = await Promise.all([
    prisma.category.findMany({ where: { localUserId: "local-user", isArchived: false } }),
    prisma.budget.findMany({ where: { localUserId: "local-user", month: previousDate } }),
    prisma.incomeEntry.findMany({ where: { localUserId: "local-user", month: previousMonth } }),
  ]);

  const previousIncomeTotal = previousIncome.reduce((total, entry) => total + entry.amountYen, 0);
  const previousBudgetByCategory = new Map(previousBudgets.map((budget) => [budget.categoryId, budget.assignedYen]));
  const fixedGroupNames = new Set(["Fixed Bills", "Debt Payments", "Investments", "Savings Goals"]);
  const categoryGroups = await prisma.categoryGroup.findMany({ where: { localUserId: "local-user" } });
  const groupNameById = new Map(categoryGroups.map((group) => [group.id, group.name]));
  const lifestyleCategories = categories.filter((category) => groupNameById.get(category.groupId) === "Everyday Spending");
  const fixedCategories = categories.filter((category) => fixedGroupNames.has(groupNameById.get(category.groupId) ?? ""));

  const nextByCategory = new Map(categories.map((category) => [category.id, previousBudgetByCategory.get(category.id) ?? 0]));
  const fixedAssigned = fixedCategories.reduce((total, category) => total + (nextByCategory.get(category.id) ?? 0), 0);
  const lifestyleAssigned = lifestyleCategories.reduce((total, category) => total + (nextByCategory.get(category.id) ?? 0), 0);
  let warning: string | undefined;

  if (previousIncomeTotal > 0 && fixedAssigned + lifestyleAssigned > previousIncomeTotal && lifestyleAssigned > 0) {
    const ratio = Math.max(0, previousIncomeTotal - fixedAssigned) / lifestyleAssigned;
    lifestyleCategories.forEach((category) => nextByCategory.set(category.id, Math.floor((nextByCategory.get(category.id) ?? 0) * ratio)));
    warning = "Budget adjusted to fit income. Review lifestyle categories.";
  }

  const createdBudgets = await prisma.$transaction([
    ...categories.map((category) => prisma.budget.create({
      data: {
        categoryId: category.id,
        month: targetDate,
        assignedYen: nextByCategory.get(category.id) ?? 0,
      },
    })),
    ...previousIncome.map((entry) => prisma.incomeEntry.create({
      data: {
        month,
        sourceName: entry.sourceName,
        amountYen: entry.amountYen,
      },
    })),
  ]);

  const assignments = createdBudgets.filter((item): item is Awaited<ReturnType<typeof prisma.budget.create>> => "assignedYen" in item).map((budget): BudgetAssignment => ({
    categoryId: budget.categoryId,
    month,
    assignedYen: budget.assignedYen,
  }));
  const incomeEntries = createdBudgets.filter((item): item is Awaited<ReturnType<typeof prisma.incomeEntry.create>> => "sourceName" in item).map((entry): IncomeEntry => ({
    id: entry.id,
    month: entry.month,
    sourceName: entry.sourceName,
    amountYen: entry.amountYen,
    createdAt: entry.createdAt.toISOString(),
  }));

  const response: BudgetAutoPopulateResponse = {
    month,
    created: true,
    assignments,
    incomeEntries,
    estimatedCategoryIds: lifestyleCategories.map((category) => category.id),
    warning: warning ?? (incomeEntries.length > 0 ? "Income auto-filled from last month. Update if it changed." : "First month created with category structure only. Add income and assignments to begin."),
  };

  return Response.json(response);
}
