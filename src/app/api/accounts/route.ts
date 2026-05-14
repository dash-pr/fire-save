import { prisma } from "@/lib/prisma";
import type { Account, AccountType } from "@/domain/types";

const LOCAL_USER_ID = "local-user";
const validTypes = new Set<AccountType>(["checking", "savings", "credit", "brokerage"]);

function serialize(account: {
  id: string;
  name: string;
  type: AccountType;
  balanceYen: number;
  creditLimit: number | null;
  isArchived: boolean;
}): Account {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balanceYen: account.balanceYen,
    creditLimit: account.creditLimit ?? undefined,
    isArchived: account.isArchived,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; type?: AccountType; balanceYen?: number; creditLimit?: number };
  if (!body.name?.trim()) return Response.json({ error: "name is required." }, { status: 400 });
  if (!body.type || !validTypes.has(body.type)) return Response.json({ error: "type must be one of checking|savings|credit|brokerage." }, { status: 400 });
  if (!Number.isFinite(body.balanceYen)) return Response.json({ error: "balanceYen must be a finite number." }, { status: 400 });

  try {
    const account = await prisma.account.create({
      data: {
        localUserId: LOCAL_USER_ID,
        name: body.name.trim(),
        type: body.type,
        balanceYen: Math.round(body.balanceYen ?? 0),
        creditLimit: body.creditLimit !== undefined ? Math.round(body.creditLimit) : null,
      },
    });
    return Response.json({ account: serialize(account) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to create account." }, { status: 500 });
  }
}
