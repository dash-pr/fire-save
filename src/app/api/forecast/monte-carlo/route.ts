import { runHypotheticalMonteCarlo } from "@/domain/forecasting";
import type { ForecastInputs } from "@/domain/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const inputs: ForecastInputs = {
    currentAge: Number(searchParams.get("currentAge") ?? 30),
    targetRetirementAge: Number(searchParams.get("targetRetirementAge") ?? 50),
    retirementEndAge: 90,
    currentPortfolioYen: Number(searchParams.get("currentPortfolioYen") ?? 0),
    monthlyContributionYen: Number(searchParams.get("monthlyContributionYen") ?? 150000),
    expectedAnnualReturn: Number(searchParams.get("expectedAnnualReturn") ?? 0.07),
    inflationRate: Number(searchParams.get("inflationRate") ?? 0.02),
    targetAnnualRetirementSpendYen: Number(searchParams.get("targetAnnualRetirementSpendYen") ?? 6000000),
    safeWithdrawalRate: Number(searchParams.get("safeWithdrawalRate") ?? 0.04),
    returnVolatility: 0.12,
    reserveThresholdYen: 3000000,
  };

  try {
    return Response.json(runHypotheticalMonteCarlo(inputs, 1000));
  } catch {
    return Response.json({ error: "Monte Carlo computation failed." }, { status: 500 });
  }
}
