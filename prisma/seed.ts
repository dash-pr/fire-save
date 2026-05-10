import { PrismaClient } from "@prisma/client";
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
} from "../src/data/sample-data";

const prisma = new PrismaClient();
const monthDate = new Date(`${currentMonth}-01T00:00:00.000Z`);

async function main() {
  await prisma.aiInsight.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.recurringExpense.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.incomeEntry.deleteMany();
  await prisma.merchantRule.deleteMany();
  await prisma.nisaContribution.deleteMany();
  await prisma.goalBalanceUpdate.deleteMany();
  await prisma.savingsGoal.deleteMany();
  await prisma.creditDebt.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.financialSnapshot.deleteMany();
  await prisma.uploadedDocument.deleteMany();
  await prisma.category.deleteMany();
  await prisma.categoryGroup.deleteMany();
  await prisma.account.deleteMany();
  await prisma.fatfireSettings.deleteMany();

  await prisma.account.createMany({ data: accounts });

  for (const group of categoryGroups) {
    await prisma.categoryGroup.create({
      data: { id: group.id, name: group.name, sortOrder: categoryGroups.findIndex((item) => item.id === group.id) },
    });
  }

  await prisma.category.createMany({
    data: categories.map((category, index) => ({ ...category, sortOrder: index })),
  });

  if (incomeEntries.length > 0) {
    await prisma.incomeEntry.createMany({ data: incomeEntries });
  }

  await prisma.budget.createMany({
    data: budgetAssignments.map((assignment) => ({
      categoryId: assignment.categoryId,
      month: monthDate,
      assignedYen: assignment.assignedYen,
    })),
  });

  await prisma.transaction.createMany({
    data: transactions.map((transaction) => ({
      ...transaction,
      date: new Date(`${transaction.date}T00:00:00.000Z`),
    })),
  });

  await prisma.savingsGoal.createMany({
    data: savingsGoals.map((goal) => ({
      ...goal,
      categoryId: goal.id === "goal-gaming-pc" ? "cat-gaming-pc" : "cat-europe",
      targetDate: new Date(`${goal.targetDate}T00:00:00.000Z`),
    })),
  });

  await prisma.creditDebt.createMany({
    data: debts.map((debt) => ({
      ...debt,
      categoryId: debt.id === "debt-ribo" ? "cat-ribo" : debt.id === "debt-bunkatsu" ? "cat-bunkatsu" : undefined,
      expectedBillingDate: debt.expectedBillingDate ? new Date(`${debt.expectedBillingDate}T00:00:00.000Z`) : undefined,
    })),
  });

  await prisma.investment.createMany({ data: investments });

  if (merchantRules.length > 0) {
    await prisma.merchantRule.createMany({ data: merchantRules });
  }

  await prisma.nisaContribution.createMany({ data: nisaContributions });

  await prisma.fatfireSettings.create({
    data: {
      dateOfBirth: new Date("1996-02-01T00:00:00.000Z"),
      currentAge: forecastInputs.currentAge ?? 30,
      targetRetirementAge: forecastInputs.targetRetirementAge,
      currentLiquidSavingsYen: accounts.find((account) => account.type === "savings")?.balanceYen ?? 0,
      expectedAnnualReturn: forecastInputs.expectedAnnualReturn,
      inflationRate: forecastInputs.inflationRate,
      targetAnnualRetirementSpendYen: forecastInputs.targetAnnualRetirementSpendYen,
      safeWithdrawalRate: forecastInputs.safeWithdrawalRate,
      returnVolatility: forecastInputs.returnVolatility,
      retirementEndAge: forecastInputs.retirementEndAge,
      reserveThresholdYen: forecastInputs.reserveThresholdYen,
    },
  });

  await prisma.uploadedDocument.create({
    data: {
      fileName: "sample-rakuten-card.csv",
      storagePath: "sample/sample-rakuten-card.csv",
      mimeType: "text/csv",
      status: "processed",
      extractedCount: 3,
    },
  });

  await prisma.aiInsight.create({
    data: {
      month: monthDate,
      summary: "Spending is on plan and investment contributions are consistent.",
      insight: "Groceries and dining are the biggest controllable categories this month.",
      recommendation: "Keep the NISA contribution steady and review uncategorized OCR transactions before month-end.",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
