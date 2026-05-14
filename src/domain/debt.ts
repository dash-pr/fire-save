import type { CreditDebt, Yen } from "./types";

export type PayoffResult = {
  monthsToPayoff: number;
  totalInterestYen: Yen;
  payoffDate: string;
  finalPaymentYen: Yen;
};

export type InstallmentResult = {
  remainingInstallments: number;
  remainingBalanceYen: Yen;
  payoffDate: string;
};

function addMonthsIso(start: Date, months: number): string {
  const date = new Date(start);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function normalizeInterestRate(rate: number): number {
  return rate > 1 ? rate / 100 : rate;
}

export function calculateRiboPayoff(args: {
  balanceYen: Yen;
  monthlyPaymentYen: Yen;
  annualInterestRate: number;
  startDate?: Date;
  maxMonths?: number;
}): PayoffResult {
  const startDate = args.startDate ?? new Date();
  const maxMonths = args.maxMonths ?? 600;
  const monthlyRate = normalizeInterestRate(Math.max(args.annualInterestRate, 0)) / 12;
  let balance = Math.max(args.balanceYen, 0);
  let totalInterestYen = 0;
  let monthsToPayoff = 0;
  let finalPaymentYen = 0;

  if (balance === 0) {
    return { monthsToPayoff: 0, totalInterestYen: 0, payoffDate: addMonthsIso(startDate, 0), finalPaymentYen: 0 };
  }

  if (args.monthlyPaymentYen <= balance * monthlyRate) {
    return { monthsToPayoff: maxMonths, totalInterestYen: 0, payoffDate: addMonthsIso(startDate, maxMonths), finalPaymentYen: 0 };
  }

  while (balance > 0 && monthsToPayoff < maxMonths) {
    const interest = Math.round(balance * monthlyRate);
    const payment = Math.min(balance + interest, args.monthlyPaymentYen);
    balance = Math.max(0, balance + interest - payment);
    totalInterestYen += interest;
    monthsToPayoff += 1;
    finalPaymentYen = payment;
  }

  return {
    monthsToPayoff,
    totalInterestYen,
    payoffDate: addMonthsIso(startDate, monthsToPayoff),
    finalPaymentYen,
  };
}

export function calculateBunkatsuRemaining(args: {
  monthlyPaymentYen: Yen;
  totalInstallments: number;
  installmentsPaid: number;
  startDate?: Date;
}): InstallmentResult {
  const remainingInstallments = Math.max(args.totalInstallments - args.installmentsPaid, 0);
  return {
    remainingInstallments,
    remainingBalanceYen: remainingInstallments * args.monthlyPaymentYen,
    payoffDate: addMonthsIso(args.startDate ?? new Date(), remainingInstallments),
  };
}

export function calculateDebtSummary(debts: CreditDebt[]): {
  totalOutstandingYen: Yen;
  totalMonthlyObligationYen: Yen;
  activeDebtCount: number;
} {
  return debts.reduce(
    (summary, debt) => {
      if (debt.isPaid) return summary;
      return {
        totalOutstandingYen: summary.totalOutstandingYen + Math.max(debt.currentBalanceYen, 0),
        totalMonthlyObligationYen: summary.totalMonthlyObligationYen + Math.max(debt.monthlyPaymentYen, 0),
        activeDebtCount: summary.activeDebtCount + 1,
      };
    },
    { totalOutstandingYen: 0, totalMonthlyObligationYen: 0, activeDebtCount: 0 },
  );
}

export function simulateExtraPayment(debt: CreditDebt, extraPaymentYen: Yen): PayoffResult {
  return calculateRiboPayoff({
    balanceYen: debt.currentBalanceYen,
    monthlyPaymentYen: debt.monthlyPaymentYen + Math.max(extraPaymentYen, 0),
    annualInterestRate: debt.annualInterestRate,
  });
}
