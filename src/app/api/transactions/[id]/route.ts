import { prisma } from "@/lib/prisma";
import type { Transaction } from "@/domain/types";

type RouteContext = { params: Promise<{ id: string }> };

type UpdateBody = {
  accountId?: string;
  categoryId?: string | null;
  date?: string;
  payee?: string;
  memo?: string | null;
  amountYen?: number;
  type?: Transaction["type"];
};

function serializeTransaction(transaction: {
  id: string;
  accountId: string;
  categoryId: string | null;
  date: Date;
  payee: string;
  memo: string | null;
  amountYen: number;
  type: Transaction["type"];
  source: Transaction["source"];
  convertedToRiboAt: Date | null;
}): Transaction {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId ?? undefined,
    date: transaction.date.toISOString().slice(0, 10),
    payee: transaction.payee,
    memo: transaction.memo ?? undefined,
    amountYen: transaction.amountYen,
    type: transaction.type,
    source: transaction.source,
    convertedToRiboAt: transaction.convertedToRiboAt?.toISOString(),
  };
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as UpdateBody;
  const data: {
    accountId?: string;
    categoryId?: string | null;
    date?: Date;
    payee?: string;
    memo?: string | null;
    amountYen?: number;
    type?: Transaction["type"];
  } = {};

  if (body.accountId !== undefined) data.accountId = body.accountId;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
  if (body.date !== undefined) {
    const parsed = parseDate(body.date);
    if (!parsed) return Response.json({ error: "date must use YYYY-MM-DD format." }, { status: 400 });
    data.date = parsed;
  }
  if (body.payee !== undefined) {
    if (!body.payee.trim()) return Response.json({ error: "payee cannot be empty." }, { status: 400 });
    data.payee = body.payee.trim();
  }
  if (body.memo !== undefined) data.memo = body.memo?.trim() || null;
  if (body.amountYen !== undefined) {
    if (!Number.isFinite(body.amountYen) || body.amountYen < 0) return Response.json({ error: "amountYen must be a non-negative number." }, { status: 400 });
    data.amountYen = Math.round(body.amountYen);
  }
  if (body.type !== undefined) {
    if (body.type !== "debit" && body.type !== "credit") return Response.json({ error: "type must be debit or credit." }, { status: 400 });
    data.type = body.type;
  }

  const transaction = await prisma.transaction.update({
    where: { id, localUserId: "local-user" },
    data,
  });

  return Response.json({ transaction: serializeTransaction(transaction) });
}

export const PATCH = PUT;

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    await prisma.transaction.delete({ where: { id, localUserId: "local-user" } });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to delete transaction." }, { status: 500 });
  }
}
