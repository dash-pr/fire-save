import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { amount?: number; note?: string };
  if (!Number.isFinite(body.amount) || (body.amount ?? 0) < 0) {
    return Response.json({ error: "amount must be a non-negative integer." }, { status: 400 });
  }

  const amount = Math.round(body.amount ?? 0);
  const result = await prisma.$transaction(async (tx) => {
    const goal = await tx.savingsGoal.update({ where: { id }, data: { currentSavedYen: amount } });
    const update = await tx.goalBalanceUpdate.create({
      data: {
        goalId: id,
        amount,
        note: body.note,
      },
    });
    return { goal, update };
  });

  return Response.json({
    goal: {
      id: result.goal.id,
      categoryId: result.goal.categoryId ?? undefined,
      emoji: result.goal.emoji,
      name: result.goal.name,
      currentSavedYen: result.goal.currentSavedYen,
      targetAmountYen: result.goal.targetAmountYen,
      monthlyAllocationYen: result.goal.monthlyAllocationYen,
      targetDate: result.goal.targetDate.toISOString().slice(0, 10),
      completedAt: result.goal.completedAt?.toISOString(),
    },
    balanceUpdate: {
      id: result.update.id,
      goalId: result.update.goalId,
      amount: result.update.amount,
      note: result.update.note ?? undefined,
      updatedAt: result.update.updatedAt.toISOString(),
    },
  });
}
