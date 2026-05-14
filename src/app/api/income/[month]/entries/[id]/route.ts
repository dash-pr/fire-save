import { prisma } from "@/lib/prisma";

const monthPattern = /^\d{4}-\d{2}$/;
const LOCAL_USER_ID = "local-user";

type RouteContext = { params: Promise<{ month: string; id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { month, id } = await context.params;
  if (!monthPattern.test(month)) return Response.json({ error: "Month must use YYYY-MM format." }, { status: 400 });
  const body = (await request.json()) as { sourceName?: string; amountYen?: number };
  const data: { sourceName?: string; amountYen?: number } = {};
  if (body.sourceName !== undefined) {
    if (!body.sourceName.trim()) return Response.json({ error: "sourceName cannot be empty." }, { status: 400 });
    data.sourceName = body.sourceName.trim();
  }
  if (body.amountYen !== undefined) {
    if (!Number.isFinite(body.amountYen) || body.amountYen < 0) {
      return Response.json({ error: "amountYen must be a non-negative number." }, { status: 400 });
    }
    data.amountYen = Math.round(body.amountYen);
  }

  try {
    const entry = await prisma.incomeEntry.update({
      where: { id, localUserId: LOCAL_USER_ID, month },
      data,
    });
    return Response.json({
      entry: {
        id: entry.id,
        month: entry.month,
        sourceName: entry.sourceName,
        amountYen: entry.amountYen,
        createdAt: entry.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to update income entry." }, { status: 500 });
  }
}
