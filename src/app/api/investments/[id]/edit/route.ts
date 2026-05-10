import { prisma } from "@/lib/prisma";
import type { Investment, InvestmentAccountSubtype } from "@/domain/types";

type RouteContext = { params: Promise<{ id: string }> };

function serializeInvestment(investment: {
  id: string;
  accountName: string;
  assetType: Investment["assetType"];
  accountSubtype: InvestmentAccountSubtype;
  currentBalanceYen: number;
  initialInvestedAmount: number | null;
  monthlyContributionYen: number;
  notes: string | null;
}): Investment {
  return {
    id: investment.id,
    accountName: investment.accountName,
    assetType: investment.assetType,
    accountSubtype: investment.accountSubtype,
    currentBalanceYen: investment.currentBalanceYen,
    initialInvestedAmount: investment.initialInvestedAmount ?? undefined,
    monthlyContributionYen: investment.monthlyContributionYen,
    notes: investment.notes ?? undefined,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const investment = await prisma.investment.findFirst({ where: { id, localUserId: "local-user" } });
  if (!investment) return Response.json({ error: "Investment not found." }, { status: 404 });
  return Response.json({ investment: serializeInvestment(investment) });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as Partial<Investment>;
  const investment = await prisma.investment.update({
    where: { id },
    data: {
      accountName: body.accountName,
      accountSubtype: body.accountSubtype,
      currentBalanceYen: typeof body.currentBalanceYen === "number" ? Math.round(body.currentBalanceYen) : undefined,
      initialInvestedAmount: typeof body.initialInvestedAmount === "number" ? Math.round(body.initialInvestedAmount) : undefined,
      notes: body.notes,
    },
  });
  return Response.json({ investment: serializeInvestment(investment) });
}
