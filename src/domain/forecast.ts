import type { ForecastInputs, Yen } from "./types";

export type DeterministicForecast = {
  targetPortfolioYen: Yen;
  estimatedFatfireAge: number | null;
  yearsRemaining: number | null;
  monthsRemaining: number | null;
  requiredMonthlyContributionYen: Yen;
  contributionDeltaYen: Yen;
  timeline: ForecastPoint[];
};

export type ForecastPoint = {
  month: number;
  age: number;
  baseYen: Yen;
  pessimisticYen: Yen;
  optimisticYen: Yen;
};

export type MonteCarloResult = {
  simulations: number;
  successProbability: number;
  medianFatfireAge: number | null;
  p10FatfireAge: number | null;
  p90FatfireAge: number | null;
  percentileFan: Array<{ year: number; p10: Yen; p25: Yen; p50: Yen; p75: Yen; p90: Yen }>;
  maxDrawdowns: number[];
  reserveBreachProbability: number;
  paths: number[][];
};

export function calculateAgeFromDob(dateOfBirth: string, asOf = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return 0;

  const years = asOf.getFullYear() - dob.getFullYear();
  const birthdayThisYear = new Date(asOf.getFullYear(), dob.getMonth(), dob.getDate());
  const completedYears = asOf < birthdayThisYear ? years - 1 : years;
  const lastBirthday = new Date(asOf.getFullYear() - (asOf < birthdayThisYear ? 1 : 0), dob.getMonth(), dob.getDate());
  const nextBirthday = new Date(lastBirthday.getFullYear() + 1, dob.getMonth(), dob.getDate());
  const fraction = (asOf.getTime() - lastBirthday.getTime()) / (nextBirthday.getTime() - lastBirthday.getTime());

  return Math.max(0, completedYears + fraction);
}

export function getCurrentAge(inputs: ForecastInputs): number {
  if (inputs.dateOfBirth) return calculateAgeFromDob(inputs.dateOfBirth);
  return inputs.currentAge ?? 0;
}

export type WithdrawalSurvivalResult = {
  survivalProbability: number;
  medianEndingPortfolioYen: Yen;
  likelyDepletionYear: number | null;
  saferAnnualWithdrawalFor90Yen: Yen;
};

export function calculateFatfireTargetYen(annualSpendYen: Yen, safeWithdrawalRate: number): Yen {
  if (safeWithdrawalRate <= 0) return 0;
  return Math.round(annualSpendYen / safeWithdrawalRate);
}

export function projectBalanceYen(currentYen: Yen, monthlyContributionYen: Yen, annualReturn: number, months: number): Yen {
  const monthlyReturn = annualReturn / 12;
  let balance = currentYen;

  for (let month = 0; month < months; month += 1) {
    balance = balance * (1 + monthlyReturn) + monthlyContributionYen;
  }

  return Math.max(0, Math.round(balance));
}

export function calculateMonthsToTarget(args: {
  currentYen: Yen;
  monthlyContributionYen: Yen;
  annualReturn: number;
  targetYen: Yen;
  maxMonths?: number;
}): number | null {
  const maxMonths = args.maxMonths ?? 1200;
  if (args.currentYen >= args.targetYen) return 0;

  let balance = args.currentYen;
  const monthlyReturn = args.annualReturn / 12;

  for (let month = 1; month <= maxMonths; month += 1) {
    balance = balance * (1 + monthlyReturn) + args.monthlyContributionYen;
    if (balance >= args.targetYen) return month;
  }

  return null;
}

export function calculateRequiredMonthlyContribution(args: {
  currentYen: Yen;
  targetYen: Yen;
  annualReturn: number;
  months: number;
}): Yen {
  if (args.months <= 0) return 0;
  const monthlyReturn = args.annualReturn / 12;
  const growthOfCurrent = args.currentYen * (1 + monthlyReturn) ** args.months;

  if (monthlyReturn === 0) {
    return Math.max(0, Math.ceil((args.targetYen - args.currentYen) / args.months));
  }

  const annuityFactor = (((1 + monthlyReturn) ** args.months) - 1) / monthlyReturn;
  return Math.max(0, Math.ceil((args.targetYen - growthOfCurrent) / annuityFactor));
}

export function calculateDeterministicForecast(inputs: ForecastInputs): DeterministicForecast {
  const currentAge = getCurrentAge(inputs);
  const targetPortfolioYen = calculateFatfireTargetYen(
    inputs.targetAnnualRetirementSpendYen,
    inputs.safeWithdrawalRate,
  );
  const maxMonths = Math.max(1, Math.ceil((inputs.retirementEndAge - currentAge) * 12));
  const monthsRemaining = calculateMonthsToTarget({
    currentYen: inputs.currentPortfolioYen,
    monthlyContributionYen: inputs.monthlyContributionYen,
    annualReturn: inputs.expectedAnnualReturn,
    targetYen: targetPortfolioYen,
    maxMonths,
  });
  const requiredMonthlyContributionYen = calculateRequiredMonthlyContribution({
    currentYen: inputs.currentPortfolioYen,
    targetYen: targetPortfolioYen,
    annualReturn: inputs.expectedAnnualReturn,
    months: Math.max(1, Math.ceil((inputs.targetRetirementAge - currentAge) * 12)),
  });

  const timelineLength = Math.floor(Math.min(maxMonths, 360) / 12) + 1;
  const timeline = Array.from({ length: timelineLength }, (_, index) => index * 12).map(
    (month) => ({
      month,
      age: Math.round((currentAge + month / 12) * 10) / 10,
      baseYen: projectBalanceYen(inputs.currentPortfolioYen, inputs.monthlyContributionYen, inputs.expectedAnnualReturn, month),
      pessimisticYen: projectBalanceYen(
        inputs.currentPortfolioYen,
        inputs.monthlyContributionYen,
        inputs.expectedAnnualReturn - 0.02,
        month,
      ),
      optimisticYen: projectBalanceYen(
        inputs.currentPortfolioYen,
        inputs.monthlyContributionYen,
        inputs.expectedAnnualReturn + 0.02,
        month,
      ),
    }),
  );

  return {
    targetPortfolioYen,
    estimatedFatfireAge: monthsRemaining === null ? null : Math.round((currentAge + monthsRemaining / 12) * 2) / 2,
    yearsRemaining: monthsRemaining === null ? null : monthsRemaining / 12,
    monthsRemaining,
    requiredMonthlyContributionYen,
    contributionDeltaYen: requiredMonthlyContributionYen - inputs.monthlyContributionYen,
    timeline,
  };
}

function randomNormal(): number {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.max(Number.EPSILON, Math.random());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * p));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function calculateMaxDrawdown(path: number[]): number {
  let peak = path[0] ?? 0;
  let maxDrawdown = 0;

  for (const value of path) {
    peak = Math.max(peak, value);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
    }
  }

  return maxDrawdown;
}

export function runMonteCarloSimulation(inputs: ForecastInputs, simulations = 1000): MonteCarloResult {
  const deterministic = calculateDeterministicForecast(inputs);
  const currentAge = getCurrentAge(inputs);
  const years = Math.max(1, Math.ceil(inputs.targetRetirementAge - currentAge));
  const targetYen = deterministic.targetPortfolioYen;
  const annualMean = inputs.expectedAnnualReturn;
  const annualStdDev = Math.max(0, Math.min(inputs.returnVolatility, 0.4));
  const paths: number[][] = [];
  const fatfireAges: number[] = [];
  const maxDrawdowns: number[] = [];
  let reserveBreaches = 0;

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const path: number[] = [inputs.currentPortfolioYen];
    let balance = inputs.currentPortfolioYen;
    let reachedAge: number | null = null;
    let breachedReserve = false;

    for (let year = 1; year <= years; year += 1) {
      const annualReturn = Math.max(-0.75, annualMean + randomNormal() * annualStdDev);
      balance = Math.max(0, balance * (1 + annualReturn) + inputs.monthlyContributionYen * 12);
      path.push(Math.round(balance));
      if (balance < inputs.reserveThresholdYen) breachedReserve = true;
      if (reachedAge === null && balance >= targetYen) reachedAge = currentAge + year;
    }

    if (breachedReserve) reserveBreaches += 1;
    if (reachedAge !== null) fatfireAges.push(reachedAge);
    maxDrawdowns.push(calculateMaxDrawdown(path));
    paths.push(path);
  }

  const percentileFan = Array.from({ length: years + 1 }, (_, year) => {
    const balances = paths.map((path) => path[year]).sort((a, b) => a - b);
    return {
      year,
      p10: Math.round(percentile(balances, 0.1)),
      p25: Math.round(percentile(balances, 0.25)),
      p50: Math.round(percentile(balances, 0.5)),
      p75: Math.round(percentile(balances, 0.75)),
      p90: Math.round(percentile(balances, 0.9)),
    };
  });

  const sortedAges = [...fatfireAges].sort((a, b) => a - b);

  return {
    simulations,
    successProbability: fatfireAges.length / simulations,
    medianFatfireAge: sortedAges.length ? percentile(sortedAges, 0.5) : null,
    p10FatfireAge: sortedAges.length ? percentile(sortedAges, 0.1) : null,
    p90FatfireAge: sortedAges.length ? percentile(sortedAges, 0.9) : null,
    percentileFan,
    maxDrawdowns,
    reserveBreachProbability: reserveBreaches / simulations,
    paths,
  };
}

export function analyzeDrawdowns(maxDrawdowns: number[]): {
  maxDrawdown: number;
  medianDrawdown: number;
  p90WorstDrawdown: number;
} {
  const sorted = [...maxDrawdowns].sort((a, b) => a - b);
  return {
    maxDrawdown: sorted.at(-1) ?? 0,
    medianDrawdown: percentile(sorted, 0.5),
    p90WorstDrawdown: percentile(sorted, 0.9),
  };
}

export function simulateWithdrawalSurvival(
  inputs: ForecastInputs,
  retirementPortfolioYen: Yen,
  simulations = 1000,
): WithdrawalSurvivalResult {
  const years = Math.max(1, inputs.retirementEndAge - inputs.targetRetirementAge);
  const endingBalances: number[] = [];
  const depletionYears: number[] = [];
  let survived = 0;

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let balance = retirementPortfolioYen;
    let depletedAt: number | null = null;

    for (let year = 1; year <= years; year += 1) {
        const annualReturn = Math.max(-0.75, inputs.expectedAnnualReturn + randomNormal() * inputs.returnVolatility);
        balance = Math.max(0, balance * (1 + annualReturn) - inputs.targetAnnualRetirementSpendYen * (1 + inputs.inflationRate) ** (year - 1));
      if (balance <= 0 && depletedAt === null) depletedAt = year;
    }

    if (depletedAt === null) survived += 1;
    else depletionYears.push(depletedAt);
    endingBalances.push(Math.max(0, Math.round(balance)));
  }

  const sortedEndings = endingBalances.sort((a, b) => a - b);
  const sortedDepletions = depletionYears.sort((a, b) => a - b);

  return {
    survivalProbability: survived / simulations,
    medianEndingPortfolioYen: Math.round(percentile(sortedEndings, 0.5)),
    likelyDepletionYear: sortedDepletions.length ? Math.round(percentile(sortedDepletions, 0.5)) : null,
    saferAnnualWithdrawalFor90Yen: Math.round(retirementPortfolioYen * Math.max(0.02, inputs.safeWithdrawalRate * 0.85)),
  };
}
