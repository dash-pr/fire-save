import type { ForecastInputs, Yen } from "./types";

export type HypotheticalForecastResult = {
  targetPortfolioYen: Yen;
  projectedFatfireAge: number | null;
  yearsRemaining: number | null;
  projectedPortfolioAtTargetAgeYen: Yen;
};

export type ForecastMonteCarloResult = {
  simulations: number;
  successRate: number;
  fanChart: Array<{ year: number; p10: Yen; p25: Yen; p50: Yen; p75: Yen; p90: Yen }>;
  drawdownHistogram: Array<{ bucket: string; count: number }>;
  sequenceRisk: { earlyBadDecadeSuccessRate: number; lateBadDecadeSuccessRate: number };
  finalPortfolioSummary: { p10: Yen; p50: Yen; p90: Yen };
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function randomNormal(): number {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.max(Number.EPSILON, Math.random());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function monthlyProjectedBalance(currentYen: Yen, monthlyContributionYen: Yen, annualReturn: number, months: number): Yen {
  const monthlyReturn = annualReturn / 12;
  let balance = currentYen;
  for (let month = 0; month < months; month += 1) balance = balance * (1 + monthlyReturn) + monthlyContributionYen;
  return Math.max(0, Math.round(balance));
}

export function calculateHypotheticalForecast(inputs: ForecastInputs): HypotheticalForecastResult {
  const currentAge = inputs.currentAge ?? 30;
  const monthsToTargetAge = Math.max(0, Math.round((inputs.targetRetirementAge - currentAge) * 12));
  const targetPortfolioYen = Math.round(inputs.targetAnnualRetirementSpendYen / Math.max(0.001, inputs.safeWithdrawalRate));
  const projectedPortfolioAtTargetAgeYen = monthlyProjectedBalance(inputs.currentPortfolioYen, inputs.monthlyContributionYen, inputs.expectedAnnualReturn, monthsToTargetAge);
  let projectedFatfireAge: number | null = inputs.currentPortfolioYen >= targetPortfolioYen ? currentAge : null;
  let balance = inputs.currentPortfolioYen;
  const monthlyReturn = inputs.expectedAnnualReturn / 12;
  for (let month = 1; month <= Math.max(monthsToTargetAge, 600); month += 1) {
    balance = balance * (1 + monthlyReturn) + inputs.monthlyContributionYen;
    if (projectedFatfireAge === null && balance >= targetPortfolioYen) {
      projectedFatfireAge = Math.round((currentAge + month / 12) * 10) / 10;
      break;
    }
  }
  return {
    targetPortfolioYen,
    projectedFatfireAge,
    yearsRemaining: projectedFatfireAge === null ? null : Math.max(0, projectedFatfireAge - currentAge),
    projectedPortfolioAtTargetAgeYen,
  };
}

function runPaths(inputs: ForecastInputs, simulations: number, forceBadDecade?: "early" | "late") {
  const currentAge = inputs.currentAge ?? 30;
  const years = Math.max(1, Math.ceil(inputs.targetRetirementAge - currentAge));
  const targetYen = calculateHypotheticalForecast(inputs).targetPortfolioYen;
  const paths: number[][] = [];
  const finals: number[] = [];
  const drawdowns: number[] = [];
  let successes = 0;

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let balance = inputs.currentPortfolioYen;
    let peak = balance;
    let worstDrawdown = 0;
    let reached = balance >= targetYen;
    const path = [Math.round(balance)];

    for (let year = 1; year <= years; year += 1) {
      let annualReturn = inputs.expectedAnnualReturn + randomNormal() * 0.12;
      const inEarlyBadDecade = forceBadDecade === "early" && year <= 10;
      const inLateBadDecade = forceBadDecade === "late" && year >= 20 && year <= 30;
      if (inEarlyBadDecade || inLateBadDecade) annualReturn = Math.min(annualReturn, -0.08 - Math.abs(randomNormal()) * 0.08);
      const monthlyReturn = Math.max(-0.75, annualReturn) / 12;
      const startOfYear = balance;
      for (let month = 0; month < 12; month += 1) {
        balance = Math.max(0, balance * (1 + monthlyReturn) + inputs.monthlyContributionYen);
        peak = Math.max(peak, balance);
        if (peak > 0) worstDrawdown = Math.max(worstDrawdown, (peak - balance) / peak);
        if (!reached && balance >= targetYen) reached = true;
      }
      const singleYearLoss = startOfYear > 0 ? Math.max(0, (startOfYear - balance) / startOfYear) : 0;
      worstDrawdown = Math.max(worstDrawdown, singleYearLoss);
      path.push(Math.round(balance));
    }

    if (reached) successes += 1;
    finals.push(Math.round(balance));
    drawdowns.push(worstDrawdown);
    paths.push(path);
  }

  return { years, paths, finals, drawdowns, successRate: successes / simulations };
}

export function runHypotheticalMonteCarlo(inputs: ForecastInputs, simulations = 1000): ForecastMonteCarloResult {
  const base = runPaths(inputs, simulations);
  const fanChart = Array.from({ length: base.years + 1 }, (_, year) => {
    const values = base.paths.map((path) => path[year]).sort((a, b) => a - b);
    return {
      year,
      p10: Math.round(percentile(values, 0.1)),
      p25: Math.round(percentile(values, 0.25)),
      p50: Math.round(percentile(values, 0.5)),
      p75: Math.round(percentile(values, 0.75)),
      p90: Math.round(percentile(values, 0.9)),
    };
  });
  const buckets = Array.from({ length: 10 }, (_, index) => ({ min: index * 0.05, max: (index + 1) * 0.05, count: 0 }));
  base.drawdowns.forEach((drawdown) => {
    const bucket = buckets[Math.min(buckets.length - 1, Math.floor(drawdown / 0.05))];
    bucket.count += 1;
  });
  const sortedFinals = [...base.finals].sort((a, b) => a - b);
  return {
    simulations,
    successRate: base.successRate,
    fanChart,
    drawdownHistogram: buckets.map((bucket) => ({ bucket: `${Math.round(bucket.min * 100)}-${Math.round(bucket.max * 100)}%`, count: bucket.count })),
    sequenceRisk: {
      earlyBadDecadeSuccessRate: runPaths(inputs, 500, "early").successRate,
      lateBadDecadeSuccessRate: runPaths(inputs, 500, "late").successRate,
    },
    finalPortfolioSummary: {
      p10: Math.round(percentile(sortedFinals, 0.1)),
      p50: Math.round(percentile(sortedFinals, 0.5)),
      p90: Math.round(percentile(sortedFinals, 0.9)),
    },
  };
}

export const defaultHypotheticalForecastInputs: ForecastInputs = {
  currentAge: 30,
  targetRetirementAge: 50,
  retirementEndAge: 90,
  currentPortfolioYen: 0,
  monthlyContributionYen: 150_000,
  expectedAnnualReturn: 0.07,
  inflationRate: 0.02,
  targetAnnualRetirementSpendYen: 6_000_000,
  safeWithdrawalRate: 0.04,
  returnVolatility: 0.12,
  reserveThresholdYen: 3_000_000,
};
