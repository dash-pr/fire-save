"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, CreditCard, Home as HomeIcon, CheckCircle2 } from "lucide-react";
import { FieldError, Label, PrimaryButton, inputClass } from "@/components/auth/auth-card";
import { completeOnboarding, type OnboardingPayload } from "./actions";

const TOTAL_STEPS = 4;

type FormState = {
  fullName: string;
  currentAge: string;
  targetRetirementAge: string;
  monthlyIncomeYen: string;
  currentSavingsYen: string;
  currentInvestmentsYen: string;
  targetAnnualSpendYen: string;
  monthlyInvestmentYen: string;
  selection: Set<"mortgage" | "credit" | "none">;
  monthlyHousingYen: string;
  creditDebtBalanceYen: string;
};

const initialState: FormState = {
  fullName: "",
  currentAge: "",
  targetRetirementAge: "",
  monthlyIncomeYen: "",
  currentSavingsYen: "",
  currentInvestmentsYen: "",
  targetAnnualSpendYen: "",
  monthlyInvestmentYen: "",
  selection: new Set(),
  monthlyHousingYen: "",
  creditDebtBalanceYen: "",
};

function parseYen(value: string): number {
  const cleaned = value.replace(/[^0-9]/g, "");
  return cleaned ? Number.parseInt(cleaned, 10) : 0;
}

function formatYen(value: number): string {
  if (!value) return "";
  return `¥${value.toLocaleString("en-US")}`;
}

function CurrencyInput({
  id,
  value,
  onChange,
  className,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const numeric = parseYen(value);
  return (
    <input
      id={id}
      inputMode="numeric"
      value={numeric ? formatYen(numeric) : value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder ?? "¥0"}
      className={className ?? inputClass(false)}
    />
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentAge = Number.parseInt(form.currentAge, 10);
  const targetAge = Number.parseInt(form.targetRetirementAge, 10);
  const yearsToFire = Number.isFinite(currentAge) && Number.isFinite(targetAge) ? targetAge - currentAge : null;

  const savings = parseYen(form.currentSavingsYen);
  const investments = parseYen(form.currentInvestmentsYen);
  const netWorthSoFar = savings + investments;

  const targetSpend = parseYen(form.targetAnnualSpendYen);
  const targetPortfolio = targetSpend > 0 ? Math.round(targetSpend / 0.035) : 0;

  const step1Valid =
    form.fullName.trim().length > 0 &&
    Number.isFinite(currentAge) && currentAge >= 18 && currentAge <= 70 &&
    Number.isFinite(targetAge) && targetAge > currentAge && targetAge <= 80;

  const step2Valid = parseYen(form.monthlyIncomeYen) > 0;
  const step3Valid = true; // target spend and monthly invest are optional-ish; continue always enabled
  const step4Valid = true;

  const canContinue = useMemo(() => {
    if (step === 1) return step1Valid;
    if (step === 2) return step2Valid;
    if (step === 3) return step3Valid;
    return step4Valid;
  }, [step, step1Valid, step2Valid, step3Valid, step4Valid]);

  const toggleSelection = (key: "mortgage" | "credit" | "none") => {
    setForm((previous) => {
      const next = new Set(previous.selection);
      if (key === "none") {
        if (next.has("none")) next.delete("none");
        else {
          next.clear();
          next.add("none");
        }
      } else {
        next.delete("none");
        if (next.has(key)) next.delete(key);
        else next.add(key);
      }
      return { ...previous, selection: next };
    });
  };

  const handleFinish = () => {
    setSubmitError(null);
    const payload: OnboardingPayload = {
      fullName: form.fullName.trim(),
      currentAge,
      targetRetirementAge: targetAge,
      monthlyIncomeYen: parseYen(form.monthlyIncomeYen),
      currentSavingsYen: savings,
      currentInvestmentsYen: investments,
      targetAnnualSpendYen: targetSpend,
      monthlyInvestmentYen: parseYen(form.monthlyInvestmentYen),
      hasMortgage: form.selection.has("mortgage"),
      hasCreditDebt: form.selection.has("credit"),
      monthlyHousingYen: form.selection.has("mortgage") ? parseYen(form.monthlyHousingYen) : null,
      creditDebtBalanceYen: form.selection.has("credit") ? parseYen(form.creditDebtBalanceYen) : null,
    };

    startTransition(async () => {
      try {
        await completeOnboarding(payload);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            "stashy:welcome",
            JSON.stringify({ name: payload.fullName, at: Date.now() }),
          );
        }
        router.push("/app/budget");
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Could not complete setup.");
      }
    });
  };

  const handleContinue = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else handleFinish();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F4F0] text-slate-900">
      <header className="flex items-start justify-between px-8 pt-8">
        <div>
          <Link href="/" className="text-lg font-medium tracking-wide text-[#1C1F3A]">
            Stashy
          </Link>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="mt-3 flex items-center gap-1 text-xs font-medium text-[#6B7280] transition hover:text-slate-900"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
        </div>
        <div className="w-full max-w-[240px]">
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <div
                key={index}
                className={`h-1 rounded-full transition ${index < step ? "bg-[#4A7CFF]" : "bg-[#E5E7EB]"}`}
              />
            ))}
          </div>
          <p className="mt-2 text-right text-xs text-[#6B7280]">
            Step {step} of {TOTAL_STEPS}
          </p>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-96px)] items-center justify-center px-6">
        <div className="w-full max-w-[480px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {step === 1 && (
                <Step1
                  form={form}
                  setForm={setForm}
                  yearsToFire={yearsToFire}
                />
              )}
              {step === 2 && (
                <Step2
                  form={form}
                  setForm={setForm}
                  netWorth={netWorthSoFar}
                />
              )}
              {step === 3 && (
                <Step3
                  form={form}
                  setForm={setForm}
                  targetPortfolio={targetPortfolio}
                />
              )}
              {step === 4 && (
                <Step4 form={form} setForm={setForm} toggleSelection={toggleSelection} />
              )}
            </motion.div>
          </AnimatePresence>

          <FieldError message={submitError} />
          <PrimaryButton
            type="button"
            loading={pending}
            disabled={!canContinue}
            onClick={handleContinue}
          >
            {step === TOTAL_STEPS ? "Finish setup" : "Continue"}
          </PrimaryButton>
          {step === TOTAL_STEPS && !pending && (
            <button
              type="button"
              onClick={() => {
                setForm((previous) => ({
                  ...previous,
                  selection: new Set(["none"]),
                  monthlyHousingYen: "",
                  creditDebtBalanceYen: "",
                }));
                handleFinish();
              }}
              className="mt-3 block w-full text-center text-xs font-medium text-[#6B7280] hover:text-slate-900"
            >
              Skip for now, I&apos;ll add this later
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function Step1({
  form,
  setForm,
  yearsToFire,
}: {
  form: FormState;
  setForm: (updater: (previous: FormState) => FormState) => void;
  yearsToFire: number | null;
}) {
  return (
    <section>
      <h1 className="text-[26px] font-medium tracking-tight">Let&apos;s start with the basics.</h1>
      <p className="mt-2 text-sm text-[#6B7280]">We&apos;ll use this to calculate your FATFire timeline.</p>
      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">Your name</Label>
          <input
            id="name"
            value={form.fullName}
            onChange={(event) => setForm((previous) => ({ ...previous, fullName: event.target.value }))}
            className={inputClass(false)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="age">Your current age</Label>
            <input
              id="age"
              inputMode="numeric"
              value={form.currentAge}
              onChange={(event) => setForm((previous) => ({ ...previous, currentAge: event.target.value.replace(/[^0-9]/g, "") }))}
              className={inputClass(false)}
              maxLength={3}
            />
          </div>
          <div>
            <Label htmlFor="target-age">Target retirement age</Label>
            <input
              id="target-age"
              inputMode="numeric"
              value={form.targetRetirementAge}
              onChange={(event) => setForm((previous) => ({ ...previous, targetRetirementAge: event.target.value.replace(/[^0-9]/g, "") }))}
              className={inputClass(false)}
              maxLength={3}
            />
          </div>
        </div>
      </div>
      {yearsToFire !== null && yearsToFire > 0 && (
        <p className="mt-4 text-sm italic text-[#6B7280]">
          That&apos;s {yearsToFire} years to reach FATFire. Let&apos;s make it happen.
        </p>
      )}
    </section>
  );
}

function Step2({
  form,
  setForm,
  netWorth,
}: {
  form: FormState;
  setForm: (updater: (previous: FormState) => FormState) => void;
  netWorth: number;
}) {
  return (
    <section>
      <h1 className="text-[26px] font-medium tracking-tight">Tell us about your income and savings.</h1>
      <p className="mt-2 text-sm text-[#6B7280]">Rough numbers are fine — you can update these anytime.</p>
      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="income">Monthly take-home income</Label>
          <CurrencyInput id="income" value={form.monthlyIncomeYen} onChange={(raw) => setForm((previous) => ({ ...previous, monthlyIncomeYen: raw }))} />
        </div>
        <div>
          <Label htmlFor="savings">Current total savings</Label>
          <CurrencyInput id="savings" value={form.currentSavingsYen} onChange={(raw) => setForm((previous) => ({ ...previous, currentSavingsYen: raw }))} />
        </div>
        <div>
          <Label htmlFor="investments">Current investment balance</Label>
          <CurrencyInput id="investments" value={form.currentInvestmentsYen} onChange={(raw) => setForm((previous) => ({ ...previous, currentInvestmentsYen: raw }))} placeholder="NISA, iDeCo, brokerage combined" />
          <p className="mt-1 text-xs text-[#6B7280]">NISA, iDeCo, brokerage combined</p>
        </div>
      </div>
      {netWorth > 0 && (
        <p className="mt-4 text-sm text-[#6B7280]">
          Your net worth so far: <span className="font-medium tabular-nums text-slate-900">{formatYen(netWorth)}</span>
        </p>
      )}
    </section>
  );
}

function Step3({
  form,
  setForm,
  targetPortfolio,
}: {
  form: FormState;
  setForm: (updater: (previous: FormState) => FormState) => void;
  targetPortfolio: number;
}) {
  const presets: Array<{ amount: number; label: string }> = [
    { amount: 4_000_000, label: "Comfortable" },
    { amount: 6_000_000, label: "FATFire" },
    { amount: 8_000_000, label: "FAT FATFire" },
    { amount: 12_000_000, label: "Luxury" },
  ];
  return (
    <section>
      <h1 className="text-[26px] font-medium tracking-tight">What does FATFire look like for you?</h1>
      <p className="mt-2 text-sm text-[#6B7280]">How much do you want to spend per year in retirement?</p>
      <div className="mt-6">
        <Label htmlFor="target-spend">Target annual retirement spend</Label>
        <CurrencyInput
          id="target-spend"
          value={form.targetAnnualSpendYen}
          onChange={(raw) => setForm((previous) => ({ ...previous, targetAnnualSpendYen: raw }))}
          className="h-14 w-full rounded-lg border border-[#E5E7EB] px-4 text-2xl font-medium tabular-nums text-slate-900 outline-none transition focus:border-[#4A7CFF] focus:ring-2 focus:ring-[#4A7CFF]/20"
        />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.amount}
              type="button"
              onClick={() => setForm((previous) => ({ ...previous, targetAnnualSpendYen: String(preset.amount) }))}
              className="flex flex-col items-center gap-0.5 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-xs font-medium text-slate-900 transition hover:border-[#4A7CFF] hover:text-[#4A7CFF]"
            >
              <span className="tabular-nums">¥{(preset.amount / 1_000_000).toFixed(0)}M</span>
              <span className="text-[10px] font-normal text-[#6B7280]">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
      {targetPortfolio > 0 && (
        <p className="mt-4 text-sm text-[#6B7280]">
          Your FATFire target portfolio:{" "}
          <span className="font-medium tabular-nums text-slate-900">{formatYen(targetPortfolio)}</span>
        </p>
      )}
      <div className="mt-6">
        <Label htmlFor="monthly-invest">Monthly investment contribution</Label>
        <CurrencyInput id="monthly-invest" value={form.monthlyInvestmentYen} onChange={(raw) => setForm((previous) => ({ ...previous, monthlyInvestmentYen: raw }))} />
        <p className="mt-1 text-xs text-[#6B7280]">How much can you invest each month?</p>
      </div>
    </section>
  );
}

function Step4({
  form,
  setForm,
  toggleSelection,
}: {
  form: FormState;
  setForm: (updater: (previous: FormState) => FormState) => void;
  toggleSelection: (key: "mortgage" | "credit" | "none") => void;
}) {
  const selected = (key: "mortgage" | "credit" | "none") => form.selection.has(key);
  return (
    <section>
      <h1 className="text-[26px] font-medium tracking-tight">Any significant debt?</h1>
      <p className="mt-2 text-sm text-[#6B7280]">This helps Stashy give you an accurate starting picture.</p>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <SelectCard icon={<HomeIcon className="h-5 w-5" />} label="Mortgage / Rent" active={selected("mortgage")} onClick={() => toggleSelection("mortgage")} />
        <SelectCard icon={<CreditCard className="h-5 w-5" />} label="Credit card debt" active={selected("credit")} onClick={() => toggleSelection("credit")} />
        <SelectCard icon={<CheckCircle2 className="h-5 w-5" />} label="No significant debt" active={selected("none")} onClick={() => toggleSelection("none")} />
      </div>
      {selected("mortgage") && (
        <div className="mt-5">
          <Label htmlFor="housing">Monthly housing cost</Label>
          <CurrencyInput id="housing" value={form.monthlyHousingYen} onChange={(raw) => setForm((previous) => ({ ...previous, monthlyHousingYen: raw }))} />
        </div>
      )}
      {selected("credit") && (
        <div className="mt-5">
          <Label htmlFor="cc-balance">Total credit card balance</Label>
          <CurrencyInput id="cc-balance" value={form.creditDebtBalanceYen} onChange={(raw) => setForm((previous) => ({ ...previous, creditDebtBalanceYen: raw }))} />
        </div>
      )}
    </section>
  );
}

function SelectCard({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-center text-xs font-medium transition ${
        active
          ? "border-[#4A7CFF] bg-[#4A7CFF]/5 text-[#4A7CFF]"
          : "border-[#E5E7EB] bg-white text-slate-900 hover:border-[#C7CBD6]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
