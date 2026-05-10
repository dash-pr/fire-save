import { prisma } from "@/lib/prisma";
import { NISA_COMBINED_ANNUAL_LIMIT_YEN, NISA_GROWTH_ANNUAL_LIMIT_YEN, NISA_TSUMITATE_ANNUAL_LIMIT_YEN } from "@/domain/investments";

type RouteContext = { params: Promise<{ year: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { year: rawYear } = await context.params;
  const year = Number(rawYear);
  if (!Number.isInteger(year)) return Response.json({ error: "year must be an integer." }, { status: 400 });

  const contributions = await prisma.nisaContribution.findMany({ where: { localUserId: "local-user", year } });
  const growth = contributions.find((item) => item.accountType === "growth")?.totalContributed ?? 0;
  const tsumitate = contributions.find((item) => item.accountType === "tsumitate")?.totalContributed ?? 0;
  const combined = growth + tsumitate;

  return Response.json({
    year,
    annualLimits: {
      growth: NISA_GROWTH_ANNUAL_LIMIT_YEN,
      tsumitate: NISA_TSUMITATE_ANNUAL_LIMIT_YEN,
      combined: NISA_COMBINED_ANNUAL_LIMIT_YEN,
    },
    contributed: { growth, tsumitate, combined },
    remaining: {
      growth: Math.max(0, NISA_GROWTH_ANNUAL_LIMIT_YEN - growth),
      tsumitate: Math.max(0, NISA_TSUMITATE_ANNUAL_LIMIT_YEN - tsumitate),
      combined: Math.max(0, NISA_COMBINED_ANNUAL_LIMIT_YEN - combined),
    },
  });
}
