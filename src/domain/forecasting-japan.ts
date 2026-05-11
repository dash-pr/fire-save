import type { ForecastInputs, Yen } from "./types";

export type JapanScenarioKey = "bear" | "base" | "bull" | "custom";
export type TaxWrapperMode = "split" | "nisa" | "ideco" | "taxable";
export type JapanLifeEventType = "incomeChange" | "recurringExpense" | "windfall" | "expense";

export type JapanLifeEvent = {
  id: string;
  age: number;
  type: JapanLifeEventType;
  amountYen: Yen;
  label: string;
  endAge?: number;
  lifestyleReductionRate?: number;
};

export type JapanProjectionRow = {
  age: number;
  year: number;
  netMonthlyIncomeYen: Yen;
  residenceTaxYen: Yen;
  totalMonthlyExpensesYen: Yen;
  investableMonthlyYen: Yen;
  iDeCoYen: Yen;
  nisaYen: Yen;
  taxableYen: Yen;
  totalPortfolioYen: Yen;
  displayedPortfolioYen: Yen;
  mortgageBalanceYen: Yen;
  netWorthYen: Yen;
  leanTargetYen: Yen;
  regularTargetYen: Yen;
  fatTargetYen: Yen;
  postTaxFatTargetYen: Yen;
  iDeCoContributionYen: Yen;
  nisaContributionYen: Yen;
  taxableContributionYen: Yen;
  nisaLifetimeUsedYen: Yen;
  iDeCoTaxSavingYen: Yen;
  homeLoanDeductionYen: Yen;
  withdrawalYen: Yen;
  pensionOffsetYen: Yen;
  fireCrossed: boolean;
  inBridge: boolean;
  phaseLabel?: string;
};

export type JapanProjectionResult = {
  scenario: JapanScenarioKey;
  rows: JapanProjectionRow[];
  projectedFireAge: number | null;
  coastFireNumberYen: Yen;
  coastFireAge: number | null;
  yearsToCoastFire: number | null;
  preTaxFatFireNumberYen: Yen;
  postTaxFatFireNumberYen: Yen;
  depletionAge: number | null;
  survivesTo90: boolean;
  survivesTo100: boolean;
  nisaCapAge: number | null;
  breakEvenDrawdownRecoveryYears: number | null;
  gapMonthlyYen: Yen;
  suggestions: GapSuggestion[];
};

export type JapanMonteCarloResult = {
  simulations: number;
  fanChart: Array<{ age: number; p10: Yen; p25: Yen; p50: Yen; p75: Yen; p90: Yen }>;
  fireAgeHistogram: Array<{ age: number; count: number }>;
  drawdownHistogram: Array<{ bucket: string; count: number }>;
  probabilityByAge: { by55: number; by60: number; by65: number };
  survival: { to90: number; to100: number; p10DepletionAge: number | null; medianDepletionAge: number | null };
};

export type GapSuggestion = {
  key: string;
  label: string;
  cutMonthlyYen: Yen;
  percentCut: number;
  tier: "painless" | "consider" | "major";
  yearsSaved: number;
};

const CAPITAL_GAINS_TAX_RATE = 0.20315;
const NISA_LIFETIME_LIMIT_YEN = 18_000_000;
const NISA_ANNUAL_LIMIT_YEN = 3_600_000;
const START_YEAR = 2026;

const expenseCategories = [
  { key: "phoneInternetMonthlyYen", label: "Phone/Internet", tier: "painless" as const, maxCut: 0.3, fallback: 12_500 },
  { key: "transportMonthlyYen", label: "Transport", tier: "painless" as const, maxCut: 0.4, fallback: 12_000 },
  { key: "groceriesMonthlyYen", label: "Groceries", tier: "painless" as const, maxCut: 0.3, fallback: 35_000 },
  { key: "personalCareMonthlyYen", label: "Personal care", tier: "consider" as const, maxCut: 0.5, fallback: 20_000 },
  { key: "fineDiningMonthlyYen", label: "Fine dining", tier: "consider" as const, maxCut: 0.75, fallback: 20_000 },
  { key: "drinkingMonthlyYen", label: "Drinking/bars", tier: "consider" as const, maxCut: 1, fallback: 35_000 },
  { key: "travelAnnualYen", label: "Annual travel", tier: "major" as const, maxCut: 0.5, fallback: 1_170_000, annual: true },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function yen(value: number): Yen {
  return Math.max(0, Math.round(value));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function randomNormal() {
  const u1 = Math.max(Number.EPSILON, Math.random());
  const u2 = Math.max(Number.EPSILON, Math.random());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function iDeCoMarginalRate(netMonthlyYen: Yen): number {
  if (netMonthlyYen <= 720_000) return 0.3042;
  if (netMonthlyYen <= 920_000) return 0.3348;
  return 0.4369;
}

export function computeJapanResidenceTax(netMonthlyYen: Yen): Yen {
  const lo = { net: 650_000, tax: 46_000 };
  const hi = { net: 995_000, tax: 100_583 };
  const t = clamp((netMonthlyYen - lo.net) / (hi.net - lo.net), 0, 1);
  return Math.round(lo.tax + t * (hi.tax - lo.tax));
}

export function calculateJapanMortgagePayment(principalYen: Yen, annualRate: number, years: number): Yen {
  const months = years * 12;
  const monthlyRate = annualRate / 12;
  if (months <= 0) return 0;
  if (monthlyRate === 0) return Math.round(principalYen / months);
  return Math.round((principalYen * monthlyRate) / (1 - (1 + monthlyRate) ** -months));
}

function scenarioReturn(inputs: ForecastInputs, scenario: JapanScenarioKey) {
  if (scenario === "bull") return inputs.bullRealReturn ?? 0.07;
  if (scenario === "bear") return inputs.bearRealReturn ?? 0.02;
  if (scenario === "custom") return inputs.customRealReturn ?? inputs.expectedAnnualReturn;
  return inputs.baseRealReturn ?? inputs.expectedAnnualReturn;
}

function annualSpend(inputs: ForecastInputs, kind: "lean" | "regular" | "fat") {
  if (kind === "lean") return inputs.leanAnnualSpendYen ?? Math.round(inputs.targetAnnualRetirementSpendYen * 0.65);
  if (kind === "regular") return inputs.regularAnnualSpendYen ?? Math.round(inputs.targetAnnualRetirementSpendYen * 0.82);
  return inputs.fatAnnualSpendYen ?? inputs.targetAnnualRetirementSpendYen;
}

function activePhase(inputs: ForecastInputs, age: number) {
  if (!inputs.spendingPhasesEnabled || age < inputs.targetRetirementAge) return undefined;
  if (age < (inputs.slowGoStartAge ?? 65)) return { label: "Go-Go", multiplier: inputs.goGoSpendingMultiplier ?? 1.2 };
  if (age < (inputs.noGoStartAge ?? 75)) return { label: "Slow-Go", multiplier: inputs.slowGoSpendingMultiplier ?? 0.85 };
  return { label: "No-Go", multiplier: inputs.noGoSpendingMultiplier ?? 0.65 };
}

function monthlyExpenseValue(inputs: ForecastInputs, key: string, fallback: number, annual?: boolean) {
  const value = (inputs as unknown as Record<string, number | undefined>)[key] ?? fallback;
  return annual ? value / 12 : value;
}

function buildGapSuggestions(inputs: ForecastInputs, gapMonthlyYen: Yen): GapSuggestion[] {
  if (gapMonthlyYen <= 0) return [];
  return expenseCategories
    .flatMap((category) => Array.from(new Set([0.2, Math.min(0.5, category.maxCut), category.maxCut])).map((percentCut) => ({ category, percentCut })))
    .map(({ category, percentCut }) => ({ category, percentCut, cutMonthlyYen: Math.round(monthlyExpenseValue(inputs, category.key, category.fallback, category.annual) * percentCut) }))
    .filter((item) => item.cutMonthlyYen >= 1_000)
    .map(({ category, percentCut, cutMonthlyYen }) => ({
      key: `${category.key}-${percentCut}`,
      label: category.label,
      cutMonthlyYen,
      percentCut,
      tier: category.tier,
      yearsSaved: Math.round((cutMonthlyYen / Math.max(1, gapMonthlyYen)) * 10) / 10,
    }))
    .sort((a, b) => b.yearsSaved - a.yearsSaved)
    .slice(0, 8);
}

export function runJapanFireProjection(inputs: ForecastInputs, scenario: JapanScenarioKey = inputs.activeScenario ?? "base", returnOverrides?: number[]): JapanProjectionResult {
  const startAge = inputs.currentAge ?? 30;
  const endAge = Math.max(inputs.retirementEndAge, inputs.targetRetirementAge, 100);
  const inflation = inputs.inflationRate;
  const realReturn = scenarioReturn(inputs, scenario);
  const taxableCapitalGainsTaxRate = inputs.taxableCapitalGainsTaxRate ?? CAPITAL_GAINS_TAX_RATE;
  const taxWrapperMode: TaxWrapperMode = inputs.taxWrapperMode ?? "split";
  const nisaAnnualLimitYen = inputs.nisaAnnualLimitYen ?? NISA_ANNUAL_LIMIT_YEN;
  const nisaLifetimeLimitYen = inputs.nisaLifetimeLimitYen ?? NISA_LIFETIME_LIMIT_YEN;
  const swrBufferRate = inputs.swrBufferRate ?? 0.15;
  // FIRE target now includes a flat estimate of post-retirement residence tax (~5%
  // of FAT spend), matching the reference's `totalExpenses + residenceTax` formula.
  // Reference: simulation.js:298-301.
  const retirementResidenceTaxRate = inputs.retirementResidenceTaxRate ?? 0.05;
  const leanWithTax = annualSpend(inputs, "lean") * (1 + retirementResidenceTaxRate);
  const regularWithTax = annualSpend(inputs, "regular") * (1 + retirementResidenceTaxRate);
  const fatWithTax = annualSpend(inputs, "fat") * (1 + retirementResidenceTaxRate);
  const leanTargetYen = Math.round(leanWithTax / Math.max(0.001, inputs.safeWithdrawalRate));
  const regularTargetYen = Math.round((regularWithTax / Math.max(0.001, inputs.safeWithdrawalRate)) * (1 + swrBufferRate));
  const preTaxFatFireNumberYen = Math.round((fatWithTax / Math.max(0.001, inputs.safeWithdrawalRate)) * (1 + swrBufferRate));
  const postTaxFatFireNumberYen = Math.round(preTaxFatFireNumberYen / (1 - taxableCapitalGainsTaxRate));
  const yearsToTarget = Math.max(1, inputs.targetRetirementAge - startAge);
  const coastFireNumberYen = Math.round(preTaxFatFireNumberYen / Math.pow(1 + Math.max(0.001, realReturn), yearsToTarget));
  const userShare = 1 - (inputs.partnerHousingShareRate ?? 0.3333);
  const includeMortgage = inputs.includeMortgage ?? true;
  const propertyPurchaseAge = inputs.propertyPurchaseAge ?? 40;
  const propertyValueYen = inputs.propertyValueYen ?? 100_000_000;
  const mortgageTermYears = inputs.mortgageTermYears ?? 35;
  const baseMortgageRate = inputs.mortgageInterestRate ?? 0.015;
  // Scenario-specific mortgage rate paths (reference: Bear +0.3%/y cap 4%,
  // Base +0.15%/y cap 3%, Bull flat cap 1.5%). Falls back to the single-path
  // inputs for the currently unsupplied scenario.
  const scenarioMortgageDefaults: Record<JapanScenarioKey, { annualIncrease: number; cap: number }> = {
    bear: { annualIncrease: 0.003, cap: 0.04 },
    base: { annualIncrease: 0.0015, cap: 0.03 },
    bull: { annualIncrease: 0, cap: 0.015 },
    custom: { annualIncrease: inputs.mortgageRateAnnualIncrease ?? 0.0015, cap: inputs.mortgageRateCap ?? 0.03 },
  };
  const scenarioOverride = inputs.scenarioMortgageRateGrowth?.[scenario];
  const mortgageRateAnnualIncrease = scenarioOverride?.annualIncrease
    ?? scenarioMortgageDefaults[scenario].annualIncrease;
  const mortgageRateCap = scenarioOverride?.cap ?? scenarioMortgageDefaults[scenario].cap;
  const lifeEvents = inputs.lifeEvents ?? [];

  let iDeCo = inputs.currentIDeCoYen ?? 0;
  let nisa = inputs.currentNisaYen ?? 0;
  let taxable = Math.max(0, inputs.currentPortfolioYen - iDeCo - nisa);
  let nisaLifetimeUsed = Math.min(nisaLifetimeLimitYen, inputs.nisaLifetimeUsedYen ?? nisa);
  let mortgageBalance = 0;
  let mortgagePaymentMonthly = 0;
  let currentMortgageRate = baseMortgageRate;
  let fireCrossed = false;
  let projectedFireAge: number | null = null;
  let depletionAge: number | null = null;
  let nisaCapAge: number | null = null;
  let coastFireAge: number | null = iDeCo + nisa + taxable >= coastFireNumberYen ? startAge : null;
  const rows: JapanProjectionRow[] = [];

  for (let age = startAge; age <= endAge; age += 1) {
    const yearsPassed = age - startAge;
    const deflator = Math.pow(1 + inflation, yearsPassed);
    const annualReturn = returnOverrides?.[yearsPassed] ?? realReturn;
    const growthSteps = Math.floor(yearsPassed / Math.max(1, inputs.incomeGrowthIntervalYears ?? 2));
    let netMonthlyIncomeYen = Math.min(inputs.netSalaryCapYen ?? 995_000, (inputs.initialNetMonthlyYen ?? 650_000) * Math.pow(1 + (inputs.incomeGrowthRate ?? 0.04), growthSteps));
    for (const event of lifeEvents) if (event.type === "incomeChange" && age >= event.age && (!event.endAge || age < event.endAge)) netMonthlyIncomeYen += event.amountYen;
    const inBridge = Boolean(inputs.bridgePhaseEnabled && age >= (inputs.bridgeStartAge ?? 50) && age < (inputs.bridgeEndAge ?? 56));
    if (inBridge) netMonthlyIncomeYen = inputs.bridgeMonthlyIncomeYen ?? 200_000;
    netMonthlyIncomeYen = yen(netMonthlyIncomeYen);
    const residenceTaxYen = inBridge ? 0 : computeJapanResidenceTax(netMonthlyIncomeYen);

    if (includeMortgage && age === propertyPurchaseAge) {
      mortgageBalance = propertyValueYen;
      mortgagePaymentMonthly = calculateJapanMortgagePayment(propertyValueYen, currentMortgageRate, mortgageTermYears);
    }
    if (includeMortgage && age > propertyPurchaseAge && age < propertyPurchaseAge + mortgageTermYears) {
      const yearsSincePurchase = age - propertyPurchaseAge;
      currentMortgageRate = Math.min(mortgageRateCap, baseMortgageRate + mortgageRateAnnualIncrease * yearsSincePurchase);
      if (yearsSincePurchase % 5 === 0) mortgagePaymentMonthly = calculateJapanMortgagePayment(mortgageBalance, currentMortgageRate, Math.max(1, mortgageTermYears - yearsSincePurchase));
    }
    const isOwner = includeMortgage && age >= propertyPurchaseAge;
    const mortgagePaidOff = !includeMortgage || age >= propertyPurchaseAge + mortgageTermYears;
    if (mortgagePaidOff) {
      mortgageBalance = 0;
      mortgagePaymentMonthly = 0;
    }

    let lifestyleReduction = 0;
    let recurringExpenses = 0;
    for (const event of lifeEvents) if (event.type === "recurringExpense" && age >= event.age && (!event.endAge || age < event.endAge)) {
      recurringExpenses += event.amountYen;
      lifestyleReduction += event.lifestyleReductionRate ?? 0;
    }
    const lifestyleMultiplier = Math.max(0.2, 1 - lifestyleReduction);
    const housingYen = isOwner ? (mortgagePaymentMonthly / deflator) * userShare : (inputs.rentMonthlyYen ?? 110_000) * userShare;
    const totalMonthlyExpensesYen = yen(
      housingYen + ((inputs.utilitiesMonthlyYen ?? 10_000) * userShare) + (inputs.phoneInternetMonthlyYen ?? 12_500) +
      (isOwner ? inputs.condoManagementFeeMonthlyYen ?? 30_000 : 0) + (isOwner ? (inputs.propertyTaxAnnualYen ?? 200_000) / 12 : 0) +
      (inputs.groceriesMonthlyYen ?? 35_000) + (inputs.transportMonthlyYen ?? 12_000) +
      ((inputs.personalCareMonthlyYen ?? 20_000) + (inputs.fineDiningMonthlyYen ?? 20_000) + (inputs.drinkingMonthlyYen ?? 35_000)) * lifestyleMultiplier +
      (inputs.travelAnnualYen ?? 1_170_000) / 12 + recurringExpenses,
    );
    const homeLoanDeductionYen = isOwner && age <= propertyPurchaseAge + 12 ? Math.round(17_500 / deflator) : 0;
    const investableMonthlyYen = yen(netMonthlyIncomeYen - residenceTaxYen - totalMonthlyExpensesYen + homeLoanDeductionYen);
    const desiredContributionYen = yen(inputs.monthlyContributionYen * Math.pow(1 + (inputs.annualContributionIncreaseRate ?? 0), yearsPassed));
    const contributionYen = fireCrossed ? 0 : Math.min(desiredContributionYen, investableMonthlyYen);
    let iDeCoContributionYen = 0;
    let nisaContributionYen = 0;
    let taxableContributionYen = 0;

    if (!fireCrossed && contributionYen > 0) {
      let annualContribution = contributionYen * 12;
      // DC-plan members have a lower iDeCo cap (¥12k/mo) than standard employees (¥23k/mo).
      // Reference: simulation.js:248, constants.js:108.
      const idecoMonthlyCap = inputs.idecoPlanType === "dc"
        ? 12_000
        : (inputs.idecoMonthlyContributionYen ?? 23_000);
      if (taxWrapperMode === "split" || taxWrapperMode === "ideco") {
        iDeCoContributionYen = taxWrapperMode === "ideco" ? annualContribution : Math.min(annualContribution, idecoMonthlyCap * 12);
        annualContribution -= iDeCoContributionYen;
      }
      if (taxWrapperMode === "split" || taxWrapperMode === "nisa") {
        const nisaAvailable = Math.max(0, nisaLifetimeLimitYen - nisaLifetimeUsed);
        nisaContributionYen = Math.min(annualContribution, nisaAnnualLimitYen, nisaAvailable);
        annualContribution -= nisaContributionYen;
        nisaLifetimeUsed += nisaContributionYen;
        if (nisaAvailable <= nisaContributionYen && nisaCapAge === null) nisaCapAge = age;
      }
      taxableContributionYen = Math.max(0, annualContribution);
    }

    const phase = activePhase(inputs, age);
    let actualWithdrawalYen = 0;
    let pensionOffsetAppliedYen = 0;
    if (age >= inputs.targetRetirementAge) {
      // Nenkin (Japanese public pension) reduces the required private-portfolio
      // withdrawal from age 65 onward, extending portfolio life.
      const pensionOffsetYen = inputs.includePension && age >= 65
        ? ((inputs.pensionMonthlyYen ?? 175_000) * 12) / deflator
        : 0;
      pensionOffsetAppliedYen = pensionOffsetYen;
      const grossWithdrawalYen = (totalMonthlyExpensesYen + residenceTaxYen) * 12 * (phase?.multiplier ?? 1);
      let withdrawalYen = Math.max(0, grossWithdrawalYen - pensionOffsetYen);
      actualWithdrawalYen = withdrawalYen;
      const fromTaxable = Math.min(taxable, withdrawalYen);
      taxable -= fromTaxable;
      withdrawalYen -= fromTaxable;
      const fromNisa = Math.min(nisa, withdrawalYen);
      nisa -= fromNisa;
      withdrawalYen -= fromNisa;
      if (age >= 60) iDeCo = Math.max(0, iDeCo - withdrawalYen);
    }

    iDeCo = Math.max(0, iDeCo * (1 + annualReturn) + iDeCoContributionYen);
    nisa = Math.max(0, nisa * (1 + annualReturn) + nisaContributionYen);
    taxable = Math.max(0, taxable * (1 + annualReturn * (1 - taxableCapitalGainsTaxRate)) + taxableContributionYen);

    for (const event of lifeEvents) if (event.age === age) {
      if (event.type === "windfall") taxable += event.amountYen;
      if (event.type === "expense") taxable = Math.max(0, taxable - event.amountYen);
    }

    if (includeMortgage && isOwner && !mortgagePaidOff && mortgagePaymentMonthly > 0) {
      for (let month = 0; month < 12; month += 1) {
        const interest = mortgageBalance * (currentMortgageRate / 12);
        mortgageBalance = Math.max(0, mortgageBalance - Math.max(0, mortgagePaymentMonthly - interest));
      }
    }

    const totalPortfolioYen = yen(iDeCo + nisa + taxable);
    if (!fireCrossed && totalPortfolioYen >= preTaxFatFireNumberYen) {
      fireCrossed = true;
      projectedFireAge = age;
    }
    if (coastFireAge === null && totalPortfolioYen >= coastFireNumberYen) coastFireAge = age;
    if (age >= inputs.targetRetirementAge && depletionAge === null && totalPortfolioYen <= 0) depletionAge = age;
    const displayMultiplier = inputs.showNominal ? deflator : 1;
    rows.push({
      age,
      year: START_YEAR + yearsPassed,
      netMonthlyIncomeYen,
      residenceTaxYen,
      totalMonthlyExpensesYen,
      investableMonthlyYen,
      iDeCoYen: yen(iDeCo),
      nisaYen: yen(nisa),
      taxableYen: yen(taxable),
      totalPortfolioYen,
      displayedPortfolioYen: yen(totalPortfolioYen * displayMultiplier),
      mortgageBalanceYen: yen(mortgageBalance / deflator),
      netWorthYen: yen(totalPortfolioYen - mortgageBalance / deflator),
      leanTargetYen: yen(leanTargetYen * displayMultiplier),
      regularTargetYen: yen(regularTargetYen * displayMultiplier),
      fatTargetYen: yen(preTaxFatFireNumberYen * displayMultiplier),
      postTaxFatTargetYen: yen(postTaxFatFireNumberYen * displayMultiplier),
      iDeCoContributionYen: Math.round(iDeCoContributionYen / 12),
      nisaContributionYen: Math.round(nisaContributionYen / 12),
      taxableContributionYen: Math.round(taxableContributionYen / 12),
      nisaLifetimeUsedYen: yen(nisaLifetimeUsed),
      iDeCoTaxSavingYen: Math.round(
        (inputs.idecoPlanType === "dc" ? 12_000 : (inputs.idecoMonthlyContributionYen ?? 23_000)) *
        12 *
        iDeCoMarginalRate(netMonthlyIncomeYen),
      ),
      homeLoanDeductionYen,
      withdrawalYen: yen(actualWithdrawalYen),
      pensionOffsetYen: yen(pensionOffsetAppliedYen),
      fireCrossed,
      inBridge,
      phaseLabel: phase?.label,
    });
  }

  const row90 = rows.find((row) => row.age === 90);
  const row100 = rows.find((row) => row.age === 100);
  const endRow = rows.at(-1)!;
  const gapMonthlyYen = endRow.totalPortfolioYen >= endRow.fatTargetYen ? 0 : Math.round((endRow.fatTargetYen - endRow.totalPortfolioYen) / Math.max(1, (endRow.age - startAge) * 12 * 8));
  const drawdownLossYen = Math.round(inputs.currentPortfolioYen * 0.2);
  const annualContributionYen = Math.max(1, inputs.monthlyContributionYen * 12);
  const breakEvenDrawdownRecoveryYears = drawdownLossYen > 0 ? Math.round((drawdownLossYen / annualContributionYen) * 10) / 10 : null;
  return {
    scenario,
    rows,
    projectedFireAge,
    coastFireNumberYen,
    coastFireAge,
    yearsToCoastFire: coastFireAge === null ? null : Math.max(0, coastFireAge - startAge),
    preTaxFatFireNumberYen,
    postTaxFatFireNumberYen,
    depletionAge,
    survivesTo90: (row90?.totalPortfolioYen ?? 0) > 0,
    survivesTo100: (row100?.totalPortfolioYen ?? 0) > 0,
    nisaCapAge,
    breakEvenDrawdownRecoveryYears,
    gapMonthlyYen,
    suggestions: buildGapSuggestions(inputs, gapMonthlyYen),
  };
}

export function runJapanFireMonteCarlo(inputs: ForecastInputs, scenario: JapanScenarioKey = inputs.activeScenario ?? "base", simulations = 1000): JapanMonteCarloResult {
  const years = Math.max(inputs.retirementEndAge, 100) - (inputs.currentAge ?? 30) + 1;
  const realReturn = scenarioReturn(inputs, scenario);
  const paths: number[][] = [];
  const fireAges: Array<number | null> = [];
  const depletionAges: Array<number | null> = [];
  const drawdowns: number[] = [];
  for (let index = 0; index < simulations; index += 1) {
    const returns = Array.from({ length: years }, () => realReturn + randomNormal() * (inputs.returnVolatility || 0.08));
    const projection = runJapanFireProjection(inputs, scenario, returns);
    const values = projection.rows.map((row) => row.totalPortfolioYen);
    let peak = values[0] ?? 0;
    let worstDrawdown = 0;
    for (const value of values) {
      peak = Math.max(peak, value);
      if (peak > 0) worstDrawdown = Math.max(worstDrawdown, (peak - value) / peak);
    }
    paths.push(values);
    fireAges.push(projection.projectedFireAge);
    depletionAges.push(projection.depletionAge);
    drawdowns.push(worstDrawdown);
  }
  const base = runJapanFireProjection(inputs, scenario);
  const fanChart = base.rows.map((row, rowIndex) => {
    const values = paths.map((path) => path[rowIndex] ?? 0).sort((a, b) => a - b);
    return { age: row.age, p10: Math.round(percentile(values, 0.1)), p25: Math.round(percentile(values, 0.25)), p50: Math.round(percentile(values, 0.5)), p75: Math.round(percentile(values, 0.75)), p90: Math.round(percentile(values, 0.9)) };
  });
  const fireAgeMap = new Map<number, number>();
  fireAges.forEach((age) => { if (age) fireAgeMap.set(age, (fireAgeMap.get(age) ?? 0) + 1); });
  const drawdownBuckets = Array.from({ length: 10 }, (_, index) => ({ min: index * 0.05, max: (index + 1) * 0.05, count: 0 }));
  drawdowns.forEach((drawdown) => { drawdownBuckets[Math.min(drawdownBuckets.length - 1, Math.floor(drawdown / 0.05))].count += 1; });
  const sortedDepletionAges = depletionAges.map((age) => age ?? 101).sort((a, b) => a - b);
  const probabilityByAge = (age: number) => fireAges.filter((fireAge) => fireAge !== null && fireAge <= age).length / simulations;
  return {
    simulations,
    fanChart,
    fireAgeHistogram: Array.from(fireAgeMap.entries()).map(([age, count]) => ({ age, count })).sort((a, b) => a.age - b.age),
    drawdownHistogram: drawdownBuckets.map((bucket) => ({ bucket: `${Math.round(bucket.min * 100)}-${Math.round(bucket.max * 100)}%`, count: bucket.count })),
    probabilityByAge: { by55: probabilityByAge(55), by60: probabilityByAge(60), by65: probabilityByAge(65) },
    survival: {
      to90: depletionAges.filter((age) => age === null || age > 90).length / simulations,
      to100: depletionAges.filter((age) => age === null || age > 100).length / simulations,
      p10DepletionAge: Math.round(percentile(sortedDepletionAges, 0.1)) || null,
      medianDepletionAge: Math.round(percentile(sortedDepletionAges, 0.5)) || null,
    },
  };
}

export const japanFireDefaults: Partial<ForecastInputs> = {
  initialNetMonthlyYen: 650_000,
  incomeGrowthRate: 0.04,
  incomeGrowthIntervalYears: 2,
  netSalaryCapYen: 995_000,
  annualContributionIncreaseRate: 0,
  leanAnnualSpendYen: 3_900_000,
  regularAnnualSpendYen: 4_900_000,
  fatAnnualSpendYen: 6_000_000,
  swrBufferRate: 0.15,
  idecoMonthlyContributionYen: 23_000,
  nisaAnnualLimitYen: NISA_ANNUAL_LIMIT_YEN,
  nisaLifetimeLimitYen: NISA_LIFETIME_LIMIT_YEN,
  taxableCapitalGainsTaxRate: CAPITAL_GAINS_TAX_RATE,
  taxWrapperMode: "split",
  showNominal: false,
  bullRealReturn: 0.07,
  baseRealReturn: 0.05,
  bearRealReturn: 0.02,
  activeScenario: "base",
  includePension: false,
  pensionMonthlyYen: 175_000,
  includeMortgage: true,
  propertyPurchaseAge: 40,
  propertyValueYen: 100_000_000,
  mortgageInterestRate: 0.015,
  mortgageTermYears: 35,
  mortgageRateAnnualIncrease: 0.0015,
  mortgageRateCap: 0.03,
  partnerHousingShareRate: 0.3333,
  rentMonthlyYen: 110_000,
  utilitiesMonthlyYen: 10_000,
  phoneInternetMonthlyYen: 12_500,
  condoManagementFeeMonthlyYen: 30_000,
  propertyTaxAnnualYen: 200_000,
  groceriesMonthlyYen: 35_000,
  transportMonthlyYen: 12_000,
  personalCareMonthlyYen: 20_000,
  fineDiningMonthlyYen: 20_000,
  drinkingMonthlyYen: 35_000,
  travelAnnualYen: 1_170_000,
  bridgePhaseEnabled: false,
  bridgeStartAge: 50,
  bridgeEndAge: 56,
  bridgeMonthlyIncomeYen: 200_000,
  spendingPhasesEnabled: true,
  goGoSpendingMultiplier: 1.2,
  slowGoSpendingMultiplier: 0.85,
  noGoSpendingMultiplier: 0.65,
  slowGoStartAge: 65,
  noGoStartAge: 75,
};
