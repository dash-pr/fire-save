import { prisma } from "@/lib/prisma";

import type { SavingsGoal } from "@/domain/types";

type RouteContext = { params: Promise<{ id: string }> };
type GoalBody = Partial<Pick<SavingsGoal, "name" | "emoji" | "targetAmountYen" | "targetDate" | "notes" | "categoryId" | "fundingAccountId">> & { month?: string };

function serializeGoal(goal: {
  id: string;
  categoryId: string | null;
  fundingAccountId: string | null;
  emoji: string;
  name: string;
  currentSavedYen: number;
  targetAmountYen: number;
  monthlyAllocationYen: number;
  targetDate: Date;
  completedAt: Date | null;
}) {
  return {
    id: goal.id,
    categoryId: goal.categoryId ?? undefined,
    fundingAccountId: goal.fundingAccountId ?? undefined,
    emoji: goal.emoji,
    name: goal.name,
    currentSavedYen: goal.currentSavedYen,
    targetAmountYen: goal.targetAmountYen,
    monthlyAllocationYen: goal.monthlyAllocationYen,
    targetDate: goal.targetDate.toISOString().slice(0, 10),
    completedAt: goal.completedAt?.toISOString(),
  } satisfies SavingsGoal;
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as GoalBody;

  if (body.targetAmountYen !== undefined && (!Number.isFinite(body.targetAmountYen) || body.targetAmountYen < 0)) {
    return Response.json({ error: "targetAmountYen must be a non-negative integer." }, { status: 400 });
  }

  const goal = await prisma.savingsGoal.update({
    where: { id },
    data: {
      name: body.name?.trim() || undefined,
      emoji: body.emoji?.trim() || undefined,
      targetAmountYen: body.targetAmountYen === undefined ? undefined : Math.round(body.targetAmountYen),
      targetDate: body.targetDate ? new Date(`${body.targetDate}T00:00:00`) : undefined,
      categoryId: body.categoryId,
      fundingAccountId: body.fundingAccountId === undefined ? undefined : (body.fundingAccountId || null),
    },
  });

  return Response.json({ goal: serializeGoal(goal) });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? undefined;

  const result = await prisma.$transaction(async (tx) => {
    const goal = await tx.savingsGoal.findUnique({ where: { id }, select: { categoryId: true } });
    if (!goal) return { movedTransactions: 0, removedCategoryId: null as string | null };

    let movedTransactions = 0;
    if (goal.categoryId && month) {
      const start = new Date(`${month}-01T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const update = await tx.transaction.updateMany({
        where: { categoryId: goal.categoryId, date: { gte: start, lt: end } },
        data: { categoryId: null },
      });
      movedTransactions = update.count;
    }

    await tx.savingsGoal.delete({ where: { id } });

    if (goal.categoryId) {
      await tx.budget.deleteMany({ where: { categoryId: goal.categoryId } });
      await tx.category.delete({ where: { id: goal.categoryId } }).catch(async () => {
        await tx.category.update({ where: { id: goal.categoryId! }, data: { isArchived: true } });
      });
    }

    return { movedTransactions, removedCategoryId: goal.categoryId };
  });

  return Response.json({ deleted: true, ...result });
}
