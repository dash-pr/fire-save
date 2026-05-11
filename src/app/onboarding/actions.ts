"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OnboardingPayload = {
  fullName: string;
  currentAge: number;
  targetRetirementAge: number;
  monthlyIncomeYen: number;
  currentSavingsYen: number;
  currentInvestmentsYen: number;
  targetAnnualSpendYen: number;
  monthlyInvestmentYen: number;
  hasMortgage: boolean;
  hasCreditDebt: boolean;
  monthlyHousingYen: number | null;
  creditDebtBalanceYen: number | null;
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function approximateDateOfBirth(currentAge: number): Date {
  const year = new Date().getFullYear() - currentAge;
  return new Date(Date.UTC(year, 0, 1));
}

export async function completeOnboarding(payload: OnboardingPayload) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const userId = user.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: payload.fullName, onboarding_complete: true })
    .eq("id", userId);

  if (profileError) {
    throw new Error(`Could not save profile: ${profileError.message}`);
  }

  await prisma.fatfireSettings.upsert({
    where: { id: userId },
    update: {
      localUserId: userId,
      currentAge: payload.currentAge,
      targetRetirementAge: payload.targetRetirementAge,
      currentLiquidSavingsYen: payload.currentSavingsYen,
      currentInvestmentsOverrideYen: payload.currentInvestmentsYen || null,
      monthlyInvestmentOverrideYen: payload.monthlyInvestmentYen || null,
      targetAnnualRetirementSpendYen: payload.targetAnnualSpendYen,
      dateOfBirth: approximateDateOfBirth(payload.currentAge),
    },
    create: {
      id: userId,
      localUserId: userId,
      currentAge: payload.currentAge,
      targetRetirementAge: payload.targetRetirementAge,
      currentLiquidSavingsYen: payload.currentSavingsYen,
      currentInvestmentsOverrideYen: payload.currentInvestmentsYen || null,
      monthlyInvestmentOverrideYen: payload.monthlyInvestmentYen || null,
      targetAnnualRetirementSpendYen: payload.targetAnnualSpendYen,
      dateOfBirth: approximateDateOfBirth(payload.currentAge),
    },
  });

  if (payload.monthlyIncomeYen > 0) {
    const month = currentMonth();
    const existing = await prisma.incomeEntry.findFirst({
      where: { localUserId: userId, month, sourceName: "Salary" },
    });
    if (!existing) {
      await prisma.incomeEntry.create({
        data: {
          localUserId: userId,
          month,
          sourceName: "Salary",
          amountYen: payload.monthlyIncomeYen,
        },
      });
    }
  }

  if (payload.currentInvestmentsYen > 0) {
    const exists = await prisma.investment.findFirst({
      where: { localUserId: userId, accountName: "NISA / iDeCo / Brokerage" },
    });
    if (!exists) {
      await prisma.investment.create({
        data: {
          localUserId: userId,
          accountName: "NISA / iDeCo / Brokerage",
          assetType: "other",
          accountSubtype: "taxable",
          currentBalanceYen: payload.currentInvestmentsYen,
          monthlyContributionYen: payload.monthlyInvestmentYen,
        },
      });
    }
  }

  if (payload.hasCreditDebt && payload.creditDebtBalanceYen && payload.creditDebtBalanceYen > 0) {
    const exists = await prisma.creditDebt.findFirst({
      where: { localUserId: userId, cardName: "Credit card" },
    });
    if (!exists) {
      await prisma.creditDebt.create({
        data: {
          localUserId: userId,
          type: "revolving",
          cardName: "Credit card",
          currentBalanceYen: payload.creditDebtBalanceYen,
          annualInterestRate: 0.15,
        },
      });
    }
  }
}
