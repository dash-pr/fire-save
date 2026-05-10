import type { Account, CreditDebt, Investment, Yen } from "./types";

export function calculateNetWorth(args: {
  accounts: Account[];
  investments: Investment[];
  debts: CreditDebt[];
}): { assetsYen: Yen; liabilitiesYen: Yen; netWorthYen: Yen } {
  const accountAssets = args.accounts
    .filter((account) => account.type !== "credit")
    .reduce((total, account) => total + account.balanceYen, 0);
  const creditLiabilities = args.accounts
    .filter((account) => account.type === "credit")
    .reduce((total, account) => total + Math.abs(account.balanceYen), 0);
  const investmentAssets = args.investments.reduce((total, investment) => total + investment.currentBalanceYen, 0);
  const debtLiabilities = args.debts
    .filter((debt) => !debt.isPaid)
    .reduce((total, debt) => total + Math.max(debt.currentBalanceYen, 0), 0);

  const assetsYen = accountAssets + investmentAssets;
  const liabilitiesYen = creditLiabilities + debtLiabilities;
  return { assetsYen, liabilitiesYen, netWorthYen: assetsYen - liabilitiesYen };
}

export function calculateEmergencyFundMonths(liquidSavingsYen: Yen, averageMonthlyExpensesYen: Yen): number {
  if (averageMonthlyExpensesYen <= 0) return 0;
  return liquidSavingsYen / averageMonthlyExpensesYen;
}

export function calculateWeightedReturn(investments: Investment[]): number {
  const total = investments.reduce((sum, investment) => sum + investment.currentBalanceYen, 0);
  if (total <= 0) return 0;
  return investments.reduce(
    (sum, investment) => sum + investment.expectedAnnualReturn * (investment.currentBalanceYen / total),
    0,
  );
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateHealthScore(args: {
  savingsRate: number;
  emergencyFundMonths: number;
  debtServiceRatio: number;
  monthlyCashFlowYen: Yen;
  monthlyInvestmentContributionYen: Yen;
  monthlyIncomeYen: Yen;
}): {
  score: number;
  components: Array<{ label: string; score: number; explanation: string }>;
} {
  const savingsScore = clampScore((args.savingsRate / 0.3) * 100);
  const emergencyScore = clampScore((args.emergencyFundMonths / 6) * 100);
  const debtScore = clampScore(100 - (args.debtServiceRatio / 0.5) * 100);
  const cashFlowScore = clampScore(args.monthlyCashFlowYen <= 0 ? 0 : 100);
  const investmentScore = clampScore(
    args.monthlyIncomeYen <= 0 ? 0 : (args.monthlyInvestmentContributionYen / (args.monthlyIncomeYen * 0.2)) * 100,
  );

  const weighted =
    savingsScore * 0.3 + emergencyScore * 0.2 + debtScore * 0.2 + cashFlowScore * 0.15 + investmentScore * 0.15;

  return {
    score: clampScore(weighted),
    components: [
      { label: "Savings rate", score: savingsScore, explanation: "Rewards keeping a high share of monthly income." },
      { label: "Emergency fund", score: emergencyScore, explanation: "Targets six months of liquid reserves." },
      { label: "Debt load", score: debtScore, explanation: "Penalizes high monthly debt obligations." },
      { label: "Monthly cash flow", score: cashFlowScore, explanation: "Checks whether the current month is cash-flow positive." },
      { label: "Investment contributions", score: investmentScore, explanation: "Rewards consistent investing toward FATFire." },
    ],
  };
}
