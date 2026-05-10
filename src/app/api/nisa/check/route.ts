import { prisma } from "@/lib/prisma";
import type { NisaAccountType, NisaCheckResponse } from "@/domain/types";

const GROWTH_ANNUAL_LIMIT_YEN = 2_400_000;
const TSUMITATE_ANNUAL_LIMIT_YEN = 1_200_000;
const COMBINED_ANNUAL_LIMIT_YEN = 3_600_000;

export async function POST(request: Request) {
  const body = (await request.json()) as { year?: number; accountType?: NisaAccountType; requestedYen?: number };
  const year = body.year ?? new Date().getFullYear();
  const accountType = body.accountType;
  const requestedYen = Math.max(0, Math.round(body.requestedYen ?? 0));

  if (accountType !== "growth" && accountType !== "tsumitate") {
    return Response.json({ error: "accountType must be growth or tsumitate." }, { status: 400 });
  }

  const contributions = await prisma.nisaContribution.findMany({ where: { localUserId: "local-user", year } });
  const growthUsed = contributions.find((item) => item.accountType === "growth")?.totalContributed ?? 0;
  const tsumitateUsed = contributions.find((item) => item.accountType === "tsumitate")?.totalContributed ?? 0;
  const accountLimit = accountType === "growth" ? GROWTH_ANNUAL_LIMIT_YEN : TSUMITATE_ANNUAL_LIMIT_YEN;
  const accountUsed = accountType === "growth" ? growthUsed : tsumitateUsed;
  const accountRemaining = Math.max(0, accountLimit - accountUsed);
  const combinedRemaining = Math.max(0, COMBINED_ANNUAL_LIMIT_YEN - growthUsed - tsumitateUsed);
  const allowedYen = Math.min(requestedYen, accountRemaining, combinedRemaining);
  const overflowYen = Math.max(0, requestedYen - allowedYen);
  const remainingAnnualYen = Math.max(0, Math.min(accountRemaining, combinedRemaining) - allowedYen);
  const response: NisaCheckResponse = {
    year,
    accountType,
    requestedYen,
    allowedYen,
    overflowYen,
    remainingAnnualYen,
    message: overflowYen > 0 ? `${overflowYen} moved to Taxable account — NISA limit reached for this year.` : remainingAnnualYen <= 200_000 ? `NISA annual limit almost reached — ${remainingAnnualYen} remaining.` : undefined,
  };

  return Response.json(response);
}
