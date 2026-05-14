import type { Investment, InvestmentAccountSubtype, Yen } from "./types";

export const NISA_LIFETIME_LIMIT_YEN = 18_000_000;
export const NISA_GROWTH_ANNUAL_LIMIT_YEN = 2_400_000;
export const NISA_TSUMITATE_ANNUAL_LIMIT_YEN = 1_200_000;
export const NISA_COMBINED_ANNUAL_LIMIT_YEN = 3_600_000;

export function isNisaSubtype(subtype: InvestmentAccountSubtype): boolean {
  return subtype === "growth" || subtype === "tsumitate";
}

export function calculateLifetimeNisaUsage(investments: Investment[]): Yen {
  return investments
    .filter((investment) => isNisaSubtype(investment.accountSubtype))
    .reduce((total, investment) => total + investment.currentBalanceYen, 0);
}

export function calculateInvestmentGain(investment: Investment): { gainYen: Yen | null; returnRate: number | null } {
  const initial = investment.initialInvestedAmount;
  if (!initial || initial <= 0) return { gainYen: null, returnRate: null };
  const gainYen = investment.currentBalanceYen - initial;
  return { gainYen, returnRate: gainYen / initial };
}

export function formatInvestmentSubtype(subtype: InvestmentAccountSubtype): string {
  const labels: Record<InvestmentAccountSubtype, string> = {
    growth: "NISA Growth",
    tsumitate: "NISA Tsumitate",
    ideco: "iDeCo",
    taxable: "Taxable",
  };
  return labels[subtype];
}
