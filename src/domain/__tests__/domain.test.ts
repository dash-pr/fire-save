import { describe, expect, it, vi } from "vitest";
import { calculateAvailableYen, calculateReadyToAssignYen, calculateSavingsRate } from "../budget";
import { calculateBunkatsuRemaining, calculateRiboPayoff } from "../debt";
import {
  analyzeDrawdowns,
  calculateDeterministicForecast,
  calculateFatfireTargetYen,
  calculateMaxDrawdown,
  runMonteCarloSimulation,
  simulateWithdrawalSurvival,
} from "../forecast";
import { calculateJapanMortgagePayment, computeJapanResidenceTax, runJapanFireMonteCarlo, runJapanFireProjection } from "../forecasting-japan";
import { calculateHealthScore, calculateNetWorth } from "../finance";
import { forecastInputs } from "@/data/sample-data";

describe("budget logic", () => {
  it("calculates available as assigned minus debit activity", () => {
    expect(calculateAvailableYen(50_000, 42_000)).toBe(8_000);
    expect(calculateAvailableYen(20_000, 25_000)).toBe(-5_000);
  });

  it("calculates ready to assign from income minus assigned", () => {
    expect(
      calculateReadyToAssignYen(100_000, [
        { categoryId: "a", month: "2026-05", assignedYen: 25_000 },
        { categoryId: "b", month: "2026-05", assignedYen: 35_000 },
      ]),
    ).toBe(40_000);
  });

  it("calculates savings rate", () => {
    expect(calculateSavingsRate(500_000, 350_000)).toBeCloseTo(0.3);
  });
});

describe("net worth and health score", () => {
  it("calculates net worth from assets minus liabilities", () => {
    expect(
      calculateNetWorth({
        accounts: [
          { id: "checking", name: "Checking", type: "checking", balanceYen: 100_000 },
          { id: "card", name: "Card", type: "credit", balanceYen: -20_000 },
        ],
        investments: [{ id: "nisa", accountName: "NISA", assetType: "ETF", accountSubtype: "growth", currentBalanceYen: 300_000, monthlyContributionYen: 10_000 }],
        debts: [{ id: "debt", type: "revolving", cardName: "Card", currentBalanceYen: 50_000, monthlyPaymentYen: 10_000, annualInterestRate: 0.15 }],
      }).netWorthYen,
    ).toBe(330_000);
  });

  it("uses the required component weights for health score", () => {
    const score = calculateHealthScore({
      savingsRate: 0.3,
      emergencyFundMonths: 6,
      debtServiceRatio: 0,
      monthlyCashFlowYen: 1,
      monthlyInvestmentContributionYen: 20,
      monthlyIncomeYen: 100,
    });
    expect(score.score).toBe(100);
    expect(score.components).toHaveLength(5);
  });
});

describe("Japanese debt logic", () => {
  it("calculates ribo payoff with monthly interest", () => {
    const result = calculateRiboPayoff({ balanceYen: 300_000, monthlyPaymentYen: 15_000, annualInterestRate: 0.15, startDate: new Date("2026-05-01") });
    expect(result.monthsToPayoff).toBeGreaterThan(20);
    expect(result.totalInterestYen).toBeGreaterThan(0);
  });

  it("calculates bunkatsu remaining balance", () => {
    expect(calculateBunkatsuRemaining({ monthlyPaymentYen: 10_000, totalInstallments: 12, installmentsPaid: 4 }).remainingBalanceYen).toBe(80_000);
  });
});

describe("forecast and risk logic", () => {
  it("calculates FATFire target", () => {
    expect(calculateFatfireTargetYen(6_000_000, 0.04)).toBe(150_000_000);
  });

  it("builds deterministic forecast shape", () => {
    const forecast = calculateDeterministicForecast(forecastInputs);
    expect(forecast.targetPortfolioYen).toBe(150_000_000);
    expect(forecast.timeline.length).toBeGreaterThan(1);
    expect(forecast.requiredMonthlyContributionYen).toBeGreaterThan(0);
  });

  it("calculates max drawdown", () => {
    expect(calculateMaxDrawdown([100, 120, 90, 150])).toBeCloseTo(0.25);
  });

  it("returns Monte Carlo output shape and probability range", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = runMonteCarloSimulation({ ...forecastInputs, returnVolatility: 0 }, 10);
    expect(result.successProbability).toBeGreaterThanOrEqual(0);
    expect(result.successProbability).toBeLessThanOrEqual(1);
    expect(result.percentileFan.length).toBe(forecastInputs.targetRetirementAge - (forecastInputs.currentAge ?? 30) + 1);
    randomSpy.mockRestore();
  });

  it("summarizes drawdowns", () => {
    const result = analyzeDrawdowns([0.1, 0.2, 0.4]);
    expect(result.maxDrawdown).toBe(0.4);
    expect(result.p90WorstDrawdown).toBeGreaterThan(0.2);
  });

  it("calculates withdrawal survival probability", () => {
    const result = simulateWithdrawalSurvival({ ...forecastInputs, returnVolatility: 0 }, 200_000_000, 10);
    expect(result.survivalProbability).toBeGreaterThanOrEqual(0);
    expect(result.survivalProbability).toBeLessThanOrEqual(1);
  });

  it("calculates Japan FIRE projection with wrapper balances and targets", () => {
    const result = runJapanFireProjection({ ...forecastInputs, currentPortfolioYen: 40_000_000, monthlyContributionYen: 400_000, returnVolatility: 0 }, "base");
    expect(result.preTaxFatFireNumberYen).toBeGreaterThan(0);
    expect(result.postTaxFatFireNumberYen).toBeGreaterThan(result.preTaxFatFireNumberYen);
    expect(result.rows[0].nisaYen + result.rows[0].iDeCoYen + result.rows[0].taxableYen).toBeGreaterThan(0);
    expect(result.rows.some((row) => row.age === forecastInputs.targetRetirementAge)).toBe(true);
  });

  it("models Japan-specific tax and mortgage assumptions", () => {
    expect(computeJapanResidenceTax(650_000)).toBe(46_000);
    expect(computeJapanResidenceTax(995_000)).toBe(100_583);
    expect(calculateJapanMortgagePayment(100_000_000, 0.015, 35)).toBeGreaterThan(250_000);
  });

  it("returns Japan Monte Carlo fan chart and survival probabilities", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = runJapanFireMonteCarlo({ ...forecastInputs, returnVolatility: 0 }, "base", 10);
    expect(result.fanChart.length).toBeGreaterThan(0);
    expect(result.probabilityByAge.by60).toBeGreaterThanOrEqual(0);
    expect(result.probabilityByAge.by60).toBeLessThanOrEqual(1);
    expect(result.survival.to90).toBeGreaterThanOrEqual(0);
    expect(result.survival.to90).toBeLessThanOrEqual(1);
    randomSpy.mockRestore();
  });
});
