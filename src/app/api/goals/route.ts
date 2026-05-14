import { prisma } from "@/lib/prisma";
import type { SavingsGoal } from "@/domain/types";

const LOCAL_USER_ID = "local-user";

function serialize(goal: {
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
}): SavingsGoal {
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
  };
}

export async function GET() {
  const goals = await prisma.savingsGoal.findMany({
    where: { localUserId: LOCAL_USER_ID },
    orderBy: { priorityOrder: "asc" },
  });
  return Response.json({ goals: goals.map(serialize) });
}

type CreateBody = {
  name?: string;
  emoji?: string;
  targetAmountYen?: number;
  targetDate?: string;
  categoryId?: string;
  fundingAccountId?: string;
  currentSavedYen?: number;
  monthlyAllocationYen?: number;
  notes?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreateBody;
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "name is required." }, { status: 400 });
  if (!Number.isFinite(body.targetAmountYen) || (body.targetAmountYen ?? 0) < 0) {
    return Response.json({ error: "targetAmountYen must be a non-negative number." }, { status: 400 });
  }
  if (!body.targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) {
    return Response.json({ error: "targetDate must use YYYY-MM-DD format." }, { status: 400 });
  }

  try {
    const goal = await prisma.savingsGoal.create({
      data: {
        name,
        emoji: body.emoji?.trim() || "🎯",
        targetAmountYen: Math.round(body.targetAmountYen ?? 0),
        targetDate: new Date(`${body.targetDate}T00:00:00.000Z`),
        currentSavedYen: Math.max(0, Math.round(body.currentSavedYen ?? 0)),
        monthlyAllocationYen: Math.max(0, Math.round(body.monthlyAllocationYen ?? 0)),
        categoryId: body.categoryId || null,
        fundingAccountId: body.fundingAccountId || null,
      },
    });
    return Response.json({ goal: serialize(goal) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to create goal." }, { status: 500 });
  }
}
