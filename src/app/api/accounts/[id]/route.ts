import { prisma } from "@/lib/prisma";
import type { Account } from "@/domain/types";

const LOCAL_USER_ID = "local-user";
type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as Partial<Account>;
  const data: { name?: string; balanceYen?: number; creditLimit?: number | null; isArchived?: boolean } = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return Response.json({ error: "name cannot be empty." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.balanceYen !== undefined) {
    if (!Number.isFinite(body.balanceYen)) return Response.json({ error: "balanceYen must be a finite number." }, { status: 400 });
    data.balanceYen = Math.round(body.balanceYen);
  }
  if (body.creditLimit !== undefined) data.creditLimit = body.creditLimit === null ? null : Math.round(body.creditLimit);
  if (body.isArchived !== undefined) data.isArchived = body.isArchived;

  try {
    const account = await prisma.account.update({ where: { id, localUserId: LOCAL_USER_ID }, data });
    return Response.json({
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        balanceYen: account.balanceYen,
        creditLimit: account.creditLimit ?? undefined,
        isArchived: account.isArchived,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to update account." }, { status: 500 });
  }
}
