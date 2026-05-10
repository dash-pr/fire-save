import { prisma } from "@/lib/prisma";
import type { IncomeEntriesResponse } from "@/domain/types";

const monthPattern = /^\d{4}-\d{2}$/;

type RouteContext = { params: Promise<{ month: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { month } = await context.params;
  if (!monthPattern.test(month)) return Response.json({ error: "Month must use YYYY-MM format." }, { status: 400 });

  const entries = await prisma.incomeEntry.findMany({
    where: { localUserId: "local-user", month },
    orderBy: { createdAt: "asc" },
  });
  const response: IncomeEntriesResponse = {
    entries: entries.map((entry) => ({
      id: entry.id,
      month: entry.month,
      sourceName: entry.sourceName,
      amountYen: entry.amountYen,
      createdAt: entry.createdAt.toISOString(),
    })),
    totalIncomeYen: entries.reduce((total, entry) => total + entry.amountYen, 0),
  };

  return Response.json(response);
}

export async function POST(request: Request, context: RouteContext) {
  const { month } = await context.params;
  if (!monthPattern.test(month)) return Response.json({ error: "Month must use YYYY-MM format." }, { status: 400 });

  const body = (await request.json()) as { sourceName?: string; amountYen?: number };
  if (!body.sourceName?.trim()) return Response.json({ error: "sourceName is required." }, { status: 400 });
  if (!Number.isFinite(body.amountYen) || (body.amountYen ?? 0) < 0) return Response.json({ error: "amountYen must be a non-negative integer." }, { status: 400 });

  const entry = await prisma.incomeEntry.create({
    data: {
      month,
      sourceName: body.sourceName.trim(),
      amountYen: Math.round(body.amountYen ?? 0),
    },
  });

  return Response.json({
    entry: {
      id: entry.id,
      month: entry.month,
      sourceName: entry.sourceName,
      amountYen: entry.amountYen,
      createdAt: entry.createdAt.toISOString(),
    },
  }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { month } = await context.params;
  if (!monthPattern.test(month)) return Response.json({ error: "Month must use YYYY-MM format." }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id query parameter is required." }, { status: 400 });

  await prisma.incomeEntry.deleteMany({ where: { id, month, localUserId: "local-user" } });
  return Response.json({ success: true });
}
