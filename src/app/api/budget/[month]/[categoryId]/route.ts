import { prisma } from "@/lib/prisma";

const monthPattern = /^\d{4}-\d{2}$/;
const LOCAL_USER_ID = "local-user";

type RouteContext = { params: Promise<{ month: string; categoryId: string }> };

function monthDate(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

export async function PUT(request: Request, context: RouteContext) {
  const { month, categoryId } = await context.params;
  if (!monthPattern.test(month)) return Response.json({ error: "Month must use YYYY-MM format." }, { status: 400 });
  const body = (await request.json()) as { assignedYen?: number; isManuallySet?: boolean };
  if (!Number.isFinite(body.assignedYen)) {
    return Response.json({ error: "assignedYen must be a finite number." }, { status: 400 });
  }
  const assignedYen = Math.round(body.assignedYen ?? 0);
  const isManuallySet = body.isManuallySet ?? true;
  const date = monthDate(month);

  try {
    const budget = await prisma.budget.upsert({
      where: { categoryId_month: { categoryId, month: date } },
      create: {
        localUserId: LOCAL_USER_ID,
        categoryId,
        month: date,
        assignedYen,
        isManuallySet,
      },
      update: {
        assignedYen,
        isManuallySet,
      },
    });
    return Response.json({
      assignment: {
        categoryId: budget.categoryId,
        month,
        assignedYen: budget.assignedYen,
        isManuallySet: budget.isManuallySet,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to save budget assignment." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { month, categoryId } = await context.params;
  if (!monthPattern.test(month)) return Response.json({ error: "Month must use YYYY-MM format." }, { status: 400 });
  await prisma.budget.deleteMany({ where: { localUserId: LOCAL_USER_ID, categoryId, month: monthDate(month) } });
  return Response.json({ success: true });
}
