"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { Card, MetricCard } from "@/components/shared/card";
import {
  japanFireDefaults,
  runJapanFireProjection,
  type JapanMonteCarloResult,
  type JapanProjectionResult,
  type JapanScenarioKey,
} from "@/domain/forecasting-japan";
import { defaultHypotheticalForecastInputs } from "@/domain/forecasting";
import type { ForecastInputs } from "@/domain/types";
import { formatJPY, formatPercent } from "@/lib/format";

type ForecastTabKey = "projection" | "cashflow" | "allocation" | "phases" | "scenarios" | "probability";

const TAB_KEYS: ForecastTabKey[] = ["projection", "cashflow", "allocation", "phases", "scenarios", "probability"];
const TAB_LABELS: Record<ForecastTabKey, string> = {
  projection: "Projection",
  cashflow: "Cash flow",
  allocation: "Allocation",
  phases: "Spending phases",
  scenarios: "Scenarios",
  probability: "Probability",
};

const compactCurrency = (value: number) => `¥${Math.round(value / 1_000_000)}M`;
const axisTick = { fill: "#6B7280", fontSize: 11 };
const tooltipStyle = { backgroundColor: "white", border: "1px solid #F0EFEB", borderRadius: 8, fontSize: 12 } as const;

export function ForecastPage({
  inputs,
  assumptions,
  setAssumption,
}: {
  inputs: ForecastInputs;
  assumptions: ForecastInputs;
  setAssumption: (field: keyof ForecastInputs, value: string | number | boolean | undefined) => void;
}) {
  const [activeTab, setActiveTab] = useTabState();
  const [zoomTo90, setZoomTo90] = useState(false);

  const mergedInputs = useMemo(
    () => ({
      ...japanFireDefaults,
      ...inputs,
      ...assumptions,
      currentAge: assumptions.currentAge ?? inputs.currentAge ?? 30,
    }) as ForecastInputs,
    [assumptions, inputs],
  );
  const scenario: JapanScenarioKey = mergedInputs.activeScenario ?? "base";
  const projection = useMemo(() => runJapanFireProjection(mergedInputs, scenario), [mergedInputs, scenario]);
  const baseProjection = useMemo(() => runJapanFireProjection(mergedInputs, "base"), [mergedInputs]);
  const bullProjection = useMemo(() => runJapanFireProjection(mergedInputs, "bull"), [mergedInputs]);
  const bearProjection = useMemo(() => runJapanFireProjection(mergedInputs, "bear"), [mergedInputs]);

  const resetDefaults = () =>
    Object.entries({ ...defaultHypotheticalForecastInputs, ...japanFireDefaults }).forEach(([key, value]) =>
      setAssumption(key as keyof ForecastInputs, value as string | number | boolean | undefined),
    );

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <AssumptionsPanel inputs={mergedInputs} setAssumption={setAssumption} onReset={resetDefaults} />

      <div className="min-w-0 space-y-4">
        <NoticeBanner>
          Hypothetical projection — adjust inputs to model your optimal path. This screen is fully separate from Budget
          and Investment data.
        </NoticeBanner>

        <TabBar active={activeTab} onChange={setActiveTab} />

        {activeTab === "projection" && (
          <TabProjection
            inputs={mergedInputs}
            projection={projection}
            base={baseProjection}
            bull={bullProjection}
            bear={bearProjection}
            zoomTo90={zoomTo90}
            setZoomTo90={setZoomTo90}
          />
        )}
        {activeTab === "cashflow" && <TabCashFlow inputs={mergedInputs} projection={projection} />}
        {activeTab === "allocation" && <TabAllocation projection={projection} />}
        {activeTab === "phases" && <TabPhases inputs={mergedInputs} projection={projection} />}
        {activeTab === "scenarios" && (
          <TabScenarios inputs={mergedInputs} setAssumption={setAssumption} base={baseProjection} bull={bullProjection} bear={bearProjection} />
        )}
        {activeTab === "probability" && <TabProbability inputs={mergedInputs} scenario={scenario} />}
      </div>
    </div>
  );
}

// ---------- Tab bar + URL sync ----------

function useTabState(): [ForecastTabKey, (tab: ForecastTabKey) => void] {
  const [tab, setTabInternal] = useState<ForecastTabKey>(() => {
    if (typeof window === "undefined") return "projection";
    const param = new URLSearchParams(window.location.search).get("forecastTab");
    return TAB_KEYS.includes(param as ForecastTabKey) ? (param as ForecastTabKey) : "projection";
  });
  const setTab = (next: ForecastTabKey) => {
    setTabInternal(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("forecastTab", next);
    window.history.replaceState(null, "", url.toString());
  };
  useEffect(() => {
    const onPop = () => {
      const param = new URLSearchParams(window.location.search).get("forecastTab");
      if (TAB_KEYS.includes(param as ForecastTabKey)) setTabInternal(param as ForecastTabKey);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return [tab, setTab];
}

function TabBar({ active, onChange }: { active: ForecastTabKey; onChange: (tab: ForecastTabKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#F0EFEB]">
      {TAB_KEYS.map((key) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`relative px-3 py-2 text-sm transition ${
              isActive ? "text-slate-900" : "text-[#6B7280] hover:text-slate-900"
            }`}
          >
            {TAB_LABELS[key]}
            {isActive && (
              <span className="absolute inset-x-2 bottom-[-1px] h-[2px] rounded-t bg-[#4A7CFF]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Hero KPI row (context-aware) ----------

function TopKpis({ projection, scenario, extras = [] }: { projection: JapanProjectionResult; scenario: JapanScenarioKey; extras?: ReactNode[] }) {
  return (
    <section className="grid gap-4 xl:grid-cols-4">
      <MetricCard
        label="FATFire number"
        value={formatJPY(projection.preTaxFatFireNumberYen)}
        detail="FAT spend (incl. residence tax) ÷ SWR × buffer"
      />
      <MetricCard
        label="Projected FATFire age"
        value={projection.projectedFireAge ? `Age ${projection.projectedFireAge}` : "Not reached"}
        detail={`${scenario.toUpperCase()} scenario`}
        tone={projection.projectedFireAge ? "green" : "amber"}
      />
      <MetricCard
        label="Coast FIRE"
        value={formatJPY(projection.coastFireNumberYen)}
        detail={projection.yearsToCoastFire === null ? "Not reached" : `Reach in ${projection.yearsToCoastFire} years`}
      />
      <MetricCard
        label="Depletion age"
        value={projection.depletionAge ? `Age ${projection.depletionAge}` : "Not depleted"}
        detail="Base deterministic drawdown"
      />
      {extras}
    </section>
  );
}

// ---------- Projection tab ----------

function TabProjection({
  inputs,
  projection,
  base,
  bull,
  bear,
  zoomTo90,
  setZoomTo90,
}: {
  inputs: ForecastInputs;
  projection: JapanProjectionResult;
  base: JapanProjectionResult;
  bull: JapanProjectionResult;
  bear: JapanProjectionResult;
  zoomTo90: boolean;
  setZoomTo90: (zoom: boolean) => void;
}) {
  const scenario = inputs.activeScenario ?? "base";
  const mergedRows = useMemo(
    () =>
      base.rows.map((row, i) => ({
        age: row.age,
        basePortfolioYen: row.displayedPortfolioYen,
        bullPortfolioYen: bull.rows[i]?.displayedPortfolioYen ?? 0,
        bearPortfolioYen: bear.rows[i]?.displayedPortfolioYen ?? 0,
        fatTargetYen: row.fatTargetYen,
      })),
    [base.rows, bull.rows, bear.rows],
  );
  const maxAge = zoomTo90 ? 90 : inputs.targetRetirementAge;
  const filtered = mergedRows.filter((row) => row.age <= maxAge);
  const propertyAge = inputs.propertyPurchaseAge ?? 40;
  const mortgagePayoffAge = propertyAge + (inputs.mortgageTermYears ?? 35);
  const lifeEvents = inputs.lifeEvents ?? [];

  return (
    <div className="space-y-4">
      <TopKpis projection={projection} scenario={scenario} />

      <Card
        title="Portfolio vs target"
        eyebrow={inputs.showNominal ? "Nominal yen" : "Real 2026 yen"}
        action={
          <div className="flex items-center gap-1">
            <ZoomPill active={!zoomTo90} onClick={() => setZoomTo90(false)} label="To retirement" />
            <ZoomPill active={zoomTo90} onClick={() => setZoomTo90(true)} label="To age 90" />
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6B7280]">
          <LegendSwatch color="#4A7CFF" label="Base" />
          <LegendSwatch color="#4CAF82" label="Bull" />
          <LegendSwatch color="#E5534B" label="Bear" />
          <LegendSwatch color="#1C1F3A" label="FATFire target" dashed />
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filtered}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
              <XAxis dataKey="age" tick={axisTick} label={{ value: "Age", position: "insideBottom", offset: -4, fill: "#6B7280", fontSize: 11 }} />
              <YAxis tickFormatter={compactCurrency} width={56} tick={axisTick} />
              <Tooltip formatter={(value) => formatJPY(Number(value))} labelFormatter={(value) => `Age ${value}`} contentStyle={tooltipStyle} />

              {inputs.includeMortgage !== false && (
                <>
                  <ReferenceLine x={propertyAge} stroke="#BFA770" strokeDasharray="3 3" label={{ value: "Buy", position: "top", fill: "#BFA770", fontSize: 11 }} />
                  {mortgagePayoffAge <= maxAge && (
                    <ReferenceLine x={mortgagePayoffAge} stroke="#BFA770" strokeDasharray="3 3" label={{ value: "Mortgage off", position: "top", fill: "#BFA770", fontSize: 11 }} />
                  )}
                </>
              )}
              <ReferenceLine x={inputs.targetRetirementAge} stroke="#F5A623" strokeDasharray="4 4" label={{ value: "Retire", position: "top", fill: "#F5A623", fontSize: 11 }} />
              {inputs.includePension && 65 <= maxAge && (
                <ReferenceLine x={65} stroke="#4CAF82" strokeDasharray="3 3" label={{ value: "Nenkin", position: "top", fill: "#4CAF82", fontSize: 11 }} />
              )}
              {lifeEvents.map((event) => (
                <ReferenceLine key={event.id} x={event.age} stroke="#9B7EB5" strokeDasharray="2 4" label={{ value: event.label, position: "insideTopRight", fill: "#9B7EB5", fontSize: 10 }} />
              ))}

              <Line type="monotone" dataKey="fatTargetYen" name="FATFire target" stroke="#1C1F3A" strokeDasharray="6 4" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="basePortfolioYen" name="Base" stroke="#4A7CFF" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="bullPortfolioYen" name="Bull" stroke="#4CAF82" strokeWidth={1.8} dot={false} />
              <Line type="monotone" dataKey="bearPortfolioYen" name="Bear" stroke="#E5534B" strokeWidth={1.8} dot={false} />

              {base.projectedFireAge && base.projectedFireAge <= maxAge && (
                <ReferenceDot x={base.projectedFireAge} y={base.rows.find((r) => r.age === base.projectedFireAge)?.displayedPortfolioYen ?? 0} r={5} fill="#4A7CFF" stroke="white" strokeWidth={2} />
              )}
              {bull.projectedFireAge && bull.projectedFireAge <= maxAge && (
                <ReferenceDot x={bull.projectedFireAge} y={bull.rows.find((r) => r.age === bull.projectedFireAge)?.displayedPortfolioYen ?? 0} r={4} fill="#4CAF82" stroke="white" strokeWidth={2} />
              )}
              {bear.projectedFireAge && bear.projectedFireAge <= maxAge && (
                <ReferenceDot x={bear.projectedFireAge} y={bear.rows.find((r) => r.age === bear.projectedFireAge)?.displayedPortfolioYen ?? 0} r={4} fill="#E5534B" stroke="white" strokeWidth={2} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ProgressTrackerPanel inputs={inputs} projection={projection} />
        <GapAnalysisPanel projection={projection} />
      </div>
    </div>
  );
}

function ZoomPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
        active ? "bg-slate-900 text-white" : "bg-[#FAFAF8] text-[#6B7280] hover:bg-[#EEEDE9]"
      }`}
    >
      {label}
    </button>
  );
}

function LegendSwatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-[2px] w-5"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          backgroundImage: dashed ? `linear-gradient(to right, ${color} 0 50%, transparent 50% 100%)` : undefined,
          backgroundSize: dashed ? "6px 2px" : undefined,
        }}
      />
      {label}
    </span>
  );
}

function ProgressTrackerPanel({ inputs, projection }: { inputs: ForecastInputs; projection: JapanProjectionResult }) {
  const currentAge = inputs.currentAge ?? 30;
  const [actualAge, setActualAge] = useState<number>(currentAge);
  const [actualPortfolio, setActualPortfolio] = useState<number>(inputs.currentPortfolioYen ?? 0);
  const targetRow = projection.rows.find((r) => r.age === actualAge) ?? projection.rows[0];
  const projectedAtAge = targetRow?.totalPortfolioYen ?? 0;
  const deltaYen = actualPortfolio - projectedAtAge;
  const pctOfFat = projection.preTaxFatFireNumberYen > 0
    ? Math.min(100, (actualPortfolio / projection.preTaxFatFireNumberYen) * 100)
    : 0;
  const yearsAheadOrBehind = useMemo(() => {
    if (projectedAtAge <= 0) return 0;
    let bestAge = actualAge;
    let bestDelta = Math.abs(projectedAtAge - actualPortfolio);
    for (const row of projection.rows) {
      const d = Math.abs(row.totalPortfolioYen - actualPortfolio);
      if (d < bestDelta) {
        bestDelta = d;
        bestAge = row.age;
      }
    }
    return actualAge - bestAge;
  }, [projection.rows, actualAge, actualPortfolio, projectedAtAge]);
  return (
    <Card title="Progress tracker" eyebrow="Where am I vs base?">
      <div className="grid gap-3 md:grid-cols-2">
        <LabeledNumber label="Actual age" value={actualAge} onChange={setActualAge} />
        <LabeledCurrency label="Actual portfolio" value={actualPortfolio} onChange={setActualPortfolio} />
      </div>
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-baseline justify-between">
          <span className="text-[#6B7280]">% of FATFire target</span>
          <span className="text-base font-medium tabular-nums text-slate-900">{pctOfFat.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#EEEDE9]">
          <div className="h-full rounded-full bg-[#4A7CFF] transition-[width] duration-300" style={{ width: `${pctOfFat}%` }} />
        </div>
        <div className="flex items-baseline justify-between border-t border-[#F0EFEB] pt-2">
          <span className="text-[#6B7280]">Δ vs base projection at this age</span>
          <span className={`tabular-nums ${deltaYen >= 0 ? "text-[#2F7A58]" : "text-[#E5534B]"}`}>
            {deltaYen >= 0 ? "+" : "−"}
            {formatJPY(Math.abs(deltaYen))}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[#6B7280]">Years ahead/behind</span>
          <span className={`tabular-nums ${yearsAheadOrBehind >= 0 ? "text-[#2F7A58]" : "text-[#E5534B]"}`}>
            {yearsAheadOrBehind > 0 ? `${yearsAheadOrBehind} years ahead` : yearsAheadOrBehind < 0 ? `${Math.abs(yearsAheadOrBehind)} years behind` : "On track"}
          </span>
        </div>
      </div>
    </Card>
  );
}

function GapAnalysisPanel({ projection }: { projection: JapanProjectionResult }) {
  if (projection.suggestions.length === 0) {
    return (
      <Card title="Gap analysis" eyebrow="Expense cut suggestions">
        <p className="text-xs text-[#6B7280]">No gap detected — base projection reaches the target on time.</p>
      </Card>
    );
  }
  return (
    <Card title="Gap analysis" eyebrow={`Shortfall ${formatJPY(projection.gapMonthlyYen)}/mo`}>
      <ul className="space-y-2 text-xs">
        {projection.suggestions.slice(0, 6).map((s) => (
          <li key={s.key} className="flex items-baseline justify-between border-b border-[#F0EFEB] py-1.5 last:border-0">
            <span className="min-w-0 flex-1 text-slate-900">{s.label}</span>
            <span className="tabular-nums text-[#6B7280]">
              cut {Math.round(s.percentCut * 100)}% → free <span className="text-slate-900">{formatJPY(s.cutMonthlyYen)}</span>/mo
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-[#6B7280]">
        Simplified gap engine. Fuller 11-category tier-ranked cut analysis with per-cut resimulation is deferred.
      </p>
    </Card>
  );
}

// ---------- Cash flow tab ----------

function TabCashFlow({ inputs, projection }: { inputs: ForecastInputs; projection: JapanProjectionResult }) {
  const rows = projection.rows.filter((row) => row.age <= inputs.targetRetirementAge);
  const currentRow = projection.rows[0];
  const targetRow = projection.rows.find((r) => r.age === inputs.targetRetirementAge) ?? rows[rows.length - 1];
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard label="Current net income" value={formatJPY(currentRow.netMonthlyIncomeYen)} detail="Per month, post-withholding" />
        <MetricCard label="Residence tax" value={formatJPY(currentRow.residenceTaxYen)} detail="Per month, interpolated" />
        <MetricCard label="Monthly expenses" value={formatJPY(currentRow.totalMonthlyExpensesYen)} detail="All categories" />
        <MetricCard label="Investable surplus" value={formatJPY(currentRow.investableMonthlyYen)} detail="Per month today" tone="green" />
      </section>

      <Card title="Income vs expenses" eyebrow="Through retirement">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6B7280]">
          <LegendSwatch color="#4A7CFF" label="Net income" />
          <LegendSwatch color="#E5534B" label="Expenses" />
          <LegendSwatch color="#4CAF82" label="Investable surplus" />
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
              <XAxis dataKey="age" tick={axisTick} />
              <YAxis tickFormatter={compactCurrency} width={56} tick={axisTick} />
              <Tooltip formatter={(value) => formatJPY(Number(value))} labelFormatter={(value) => `Age ${value}`} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="investableMonthlyYen" name="Investable surplus" stroke="none" fill="#4CAF82" fillOpacity={0.25} />
              <Line type="monotone" dataKey="netMonthlyIncomeYen" name="Net income" stroke="#4A7CFF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="totalMonthlyExpensesYen" name="Expenses" stroke="#E5534B" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <SalaryRoiPanel inputs={inputs} baselineFireAge={projection.projectedFireAge} />

      <Card title="Japan tax context" eyebrow="Estimates">
        <div className="grid gap-3 md:grid-cols-3 text-xs">
          <KeyValue label="iDeCo tax saving (annual)" value={formatJPY(targetRow.iDeCoTaxSavingYen)} hint="Based on marginal rate at target age" />
          <KeyValue label="Home loan deduction" value={formatJPY(targetRow.homeLoanDeductionYen)} hint="¥17,500/mo for 13 years post-purchase" />
          <KeyValue label="Pension offset from 65" value={formatJPY((inputs.pensionMonthlyYen ?? 175_000))} hint={inputs.includePension ? "Nenkin toggle is on" : "Nenkin toggle is off"} />
        </div>
      </Card>
    </div>
  );
}

function SalaryRoiPanel({ inputs, baselineFireAge }: { inputs: ForecastInputs; baselineFireAge: number | null }) {
  const [raiseMonthly, setRaiseMonthly] = useState(50_000);
  const combinedTaxDrag = 0.43;
  const raiseResult = useMemo(() => {
    const netRaise = Math.max(0, raiseMonthly * (1 - combinedTaxDrag));
    const withRaise = runJapanFireProjection(
      { ...inputs, initialNetMonthlyYen: (inputs.initialNetMonthlyYen ?? 650_000) + netRaise },
      inputs.activeScenario ?? "base",
    );
    return { netRaise, withRaiseFireAge: withRaise.projectedFireAge };
  }, [inputs, raiseMonthly]);
  const yearsSaved = baselineFireAge && raiseResult.withRaiseFireAge
    ? baselineFireAge - raiseResult.withRaiseFireAge
    : null;
  return (
    <Card title="Salary ROI" eyebrow="How much faster does a raise get me to FIRE?">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <SliderRow
          label="Gross raise per month"
          min={0}
          max={300_000}
          step={10_000}
          value={raiseMonthly}
          onChange={setRaiseMonthly}
          format={formatJPY}
        />
        <div className="text-right text-sm">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Years saved</p>
          <p className={`tabular-nums text-2xl font-medium ${yearsSaved && yearsSaved > 0 ? "text-[#2F7A58]" : "text-slate-900"}`}>
            {yearsSaved === null ? "—" : yearsSaved > 0 ? `-${yearsSaved}` : "0"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#6B7280]">
        Net raise after ~{Math.round(combinedTaxDrag * 100)}% combined tax drag: <span className="tabular-nums text-slate-700">{formatJPY(raiseResult.netRaise)}</span>/mo.
        {raiseResult.withRaiseFireAge ? ` New FIRE age: ${raiseResult.withRaiseFireAge}.` : " FIRE still not reached with raise."}
      </p>
    </Card>
  );
}

// ---------- Allocation tab ----------

function TabAllocation({ projection }: { projection: JapanProjectionResult }) {
  const annual = projection.rows.map((r) => ({
    age: r.age,
    iDeCo: r.iDeCoContributionYen * 12,
    nisa: r.nisaContributionYen * 12,
    taxable: r.taxableContributionYen * 12,
    iDeCoTaxSaving: r.iDeCoTaxSavingYen,
  }));
  return (
    <div className="space-y-4">
      <Card title="Cumulative wrapper balances" eyebrow="iDeCo / NISA / Taxable over time">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projection.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
              <XAxis dataKey="age" tick={axisTick} />
              <YAxis tickFormatter={compactCurrency} width={56} tick={axisTick} />
              <Tooltip formatter={(value) => formatJPY(Number(value))} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="iDeCoYen" name="iDeCo" stackId="portfolio" stroke="none" fill="#9B7EB5" fillOpacity={0.7} />
              <Area type="monotone" dataKey="nisaYen" name="NISA" stackId="portfolio" stroke="none" fill="#4A7CFF" fillOpacity={0.7} />
              <Area type="monotone" dataKey="taxableYen" name="Taxable" stackId="portfolio" stroke="none" fill="#4CAF82" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Annual contribution waterfall" eyebrow="iDeCo → NISA → Taxable">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={annual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
              <XAxis dataKey="age" tick={axisTick} />
              <YAxis tickFormatter={compactCurrency} width={56} tick={axisTick} />
              <Tooltip formatter={(value) => formatJPY(Number(value))} contentStyle={tooltipStyle} />
              <Bar dataKey="iDeCo" name="iDeCo" stackId="contrib" fill="#9B7EB5" />
              <Bar dataKey="nisa" name="NISA" stackId="contrib" fill="#4A7CFF" />
              <Bar dataKey="taxable" name="Taxable" stackId="contrib" fill="#4CAF82" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Annual iDeCo tax saving" eyebrow="Deduction benefit by year">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={annual.filter((r) => r.iDeCoTaxSaving > 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
              <XAxis dataKey="age" tick={axisTick} />
              <YAxis tickFormatter={compactCurrency} width={56} tick={axisTick} />
              <Tooltip formatter={(value) => formatJPY(Number(value))} contentStyle={tooltipStyle} />
              <Bar dataKey="iDeCoTaxSaving" name="iDeCo tax saving" fill="#4CAF82" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#6B7280]">
          NISA cap age: {projection.nisaCapAge ? `Age ${projection.nisaCapAge}` : "Not reached"}. After the ¥18M lifetime cap, surplus flows to taxable.
        </p>
      </Card>
    </div>
  );
}

// ---------- Phases tab ----------

function TabPhases({ inputs, projection }: { inputs: ForecastInputs; projection: JapanProjectionResult }) {
  const phased = projection.rows.filter((r) => r.age >= inputs.targetRetirementAge);
  const flatMultiplier = 1;
  const flatWithdrawal = phased.map((r) => ({
    age: r.age,
    phased: r.withdrawalYen,
    flat: Math.max(0, (r.totalMonthlyExpensesYen + r.residenceTaxYen) * 12 * flatMultiplier - r.pensionOffsetYen),
  }));
  return (
    <div className="space-y-4">
      <Card title="Spending phases" eyebrow="Retirement drawdown shape">
        <div className="grid gap-3 md:grid-cols-3">
          <PhaseCard label="Go-Go" ages={`${inputs.targetRetirementAge}–${inputs.slowGoStartAge ?? 65}`} multiplier={inputs.goGoSpendingMultiplier ?? 1.2} tone="#4CAF82" />
          <PhaseCard label="Slow-Go" ages={`${inputs.slowGoStartAge ?? 65}–${inputs.noGoStartAge ?? 75}`} multiplier={inputs.slowGoSpendingMultiplier ?? 0.85} tone="#4A7CFF" />
          <PhaseCard label="No-Go" ages={`${inputs.noGoStartAge ?? 75}+`} multiplier={inputs.noGoSpendingMultiplier ?? 0.65} tone="#6B7280" />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[#6B7280]">
          Defaults from the reference implementation. Max-sustainable Go-Go multiplier via binary search and full phase editor (longevity table 90/95/100) are deferred — documented in <span className="font-mono text-[10px]">FORECAST_AUDIT.md</span>.
        </p>
      </Card>

      <Card title="Phased vs flat withdrawal" eyebrow="Annual ¥ after nenkin offset">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#6B7280]">
          <LegendSwatch color="#4A7CFF" label="Phased (Go-Go / Slow-Go / No-Go)" />
          <LegendSwatch color="#9B7EB5" label="Flat withdrawal" dashed />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={flatWithdrawal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
              <XAxis dataKey="age" tick={axisTick} />
              <YAxis tickFormatter={compactCurrency} width={56} tick={axisTick} />
              <Tooltip formatter={(value) => formatJPY(Number(value))} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="phased" name="Phased" stroke="#4A7CFF" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="flat" name="Flat" stroke="#9B7EB5" strokeWidth={1.8} strokeDasharray="5 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function PhaseCard({ label, ages, multiplier, tone }: { label: string; ages: string; multiplier: number; tone: string }) {
  return (
    <div className="rounded-lg bg-[#FAFAF8] p-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</p>
      </div>
      <p className="mt-1 text-sm text-slate-900">Ages {ages}</p>
      <p className="mt-2 text-xs tabular-nums text-[#6B7280]">×{multiplier.toFixed(2)} of base spending</p>
    </div>
  );
}

// ---------- Scenarios tab ----------

function TabScenarios({
  inputs,
  setAssumption,
  base,
  bull,
  bear,
}: {
  inputs: ForecastInputs;
  setAssumption: (field: keyof ForecastInputs, value: string | number | boolean | undefined) => void;
  base: JapanProjectionResult;
  bull: JapanProjectionResult;
  bear: JapanProjectionResult;
}) {
  const sensitivity = useMemo(() => {
    const rateOptions = [0.01, 0.015, 0.02, 0.025];
    return rateOptions.map((rate) => {
      const rows = (["bear", "base", "bull"] as JapanScenarioKey[]).map((s) => {
        const override = { annualIncrease: 0, cap: rate };
        const result = runJapanFireProjection(
          {
            ...inputs,
            scenarioMortgageRateGrowth: {
              ...(inputs.scenarioMortgageRateGrowth ?? {}),
              [s]: override,
            },
          },
          s,
        );
        return { scenario: s, fireAge: result.projectedFireAge };
      });
      return { rate, rows };
    });
  }, [inputs]);
  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-4">
        <ScenarioCard label="Bear" result={bear} tone="#E5534B" />
        <ScenarioCard label="Base" result={base} tone="#4A7CFF" />
        <ScenarioCard label="Bull" result={bull} tone="#4CAF82" />
        <Card title="Custom" eyebrow="Edit below">
          <div className="space-y-2">
            <LabeledPercent
              label="Custom real return"
              value={inputs.customRealReturn ?? inputs.baseRealReturn ?? 0.05}
              onChange={(v) => setAssumption("customRealReturn", v)}
            />
            <TextInputCompact
              label="Label"
              value={inputs.customScenarioLabel ?? "Custom"}
              onChange={(v) => setAssumption("customScenarioLabel", v)}
            />
            <button
              type="button"
              onClick={() => setAssumption("activeScenario", "custom")}
              className="mt-1 w-full rounded-md bg-[#4A7CFF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3F6DE8]"
            >
              Apply custom scenario
            </button>
          </div>
        </Card>
      </section>

      <Card title="Mortgage rate sensitivity" eyebrow="Fixed cap per scenario">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F0EFEB]">
              <th className="pb-2 pr-4 text-left text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Rate cap</th>
              <th className="pb-2 pr-4 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Bear</th>
              <th className="pb-2 pr-4 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Base</th>
              <th className="pb-2 pr-4 text-right text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Bull</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.map(({ rate, rows }) => (
              <tr key={rate} className="border-b border-[#F0EFEB]">
                <td className="py-2 pr-4 text-sm tabular-nums text-slate-900">{(rate * 100).toFixed(1)}%</td>
                {rows.map((row) => (
                  <td key={row.scenario} className="py-2 pr-4 text-right text-sm tabular-nums text-[#6B7280]">
                    {row.fireAge ? `Age ${row.fireAge}` : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] leading-relaxed text-[#6B7280]">
          FIRE age under each rate cap, holding all other inputs constant. A lower cap in Bear means you&apos;re assuming rates don&apos;t spike.
        </p>
      </Card>
    </div>
  );
}

function ScenarioCard({ label, result, tone }: { label: string; result: JapanProjectionResult; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</p>
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">FATFire age</p>
      <p className="mt-1 text-2xl font-medium tabular-nums text-slate-900">
        {result.projectedFireAge ? `${result.projectedFireAge}` : "—"}
      </p>
      <div className="mt-3 space-y-1 text-[11px] tabular-nums text-[#6B7280]">
        <div className="flex justify-between"><span>Target</span><span>{formatJPY(result.preTaxFatFireNumberYen)}</span></div>
        <div className="flex justify-between"><span>Coast age</span><span>{result.coastFireAge ?? "—"}</span></div>
        <div className="flex justify-between"><span>Depletion</span><span>{result.depletionAge ?? "Not depleted"}</span></div>
      </div>
    </div>
  );
}

// ---------- Probability tab ----------

function TabProbability({ inputs, scenario }: { inputs: ForecastInputs; scenario: JapanScenarioKey }) {
  const [result, setResult] = useState<JapanMonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulations, setSimulations] = useState(500);
  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/forecast/monte-carlo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, scenario, simulations }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as JapanMonteCarloResult;
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  };
  return (
    <div className="space-y-4">
      <Card title="Monte Carlo" eyebrow="Probability analysis">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Scenario</p>
            <p className="mt-1 text-sm text-slate-900">{scenario.toUpperCase()}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Simulations</p>
            <select
              value={simulations}
              onChange={(event) => setSimulations(Number(event.target.value))}
              className="rounded-md border border-[#E8E7E3] bg-white px-2 py-1 text-sm outline-none focus:border-[#4A7CFF]"
            >
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={2000}>2000</option>
            </select>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-lg bg-[#4A7CFF] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#3F6DE8] disabled:opacity-60"
          >
            {running ? "Running…" : "Run Monte Carlo"}
          </button>
        </div>
        {error && <p className="mt-3 rounded-md bg-[#FBE5E3] px-3 py-2 text-xs text-[#A32D27]">Failed: {error}</p>}
        {!result && !running && !error && (
          <p className="mt-3 text-xs text-[#6B7280]">Click Run Monte Carlo to compute probability of FIRE and survival. Executes server-side.</p>
        )}
        {running && <p className="mt-3 text-xs text-[#6B7280]">Simulating {simulations} paths on the server…</p>}
      </Card>

      {result && (
        <>
          <section className="grid gap-4 md:grid-cols-5">
            <MetricCard label="P(FIRE by 55)" value={formatPercent(result.probabilityByAge.by55)} detail="Monte Carlo" />
            <MetricCard label="P(FIRE by 60)" value={formatPercent(result.probabilityByAge.by60)} detail="Monte Carlo" tone={result.probabilityByAge.by60 > 0.85 ? "green" : result.probabilityByAge.by60 >= 0.7 ? "amber" : "red"} />
            <MetricCard label="P(FIRE by 65)" value={formatPercent(result.probabilityByAge.by65)} detail="Monte Carlo" />
            <MetricCard label="Survive to 90" value={formatPercent(result.survival.to90)} detail="Portfolio > 0" tone={result.survival.to90 > 0.9 ? "green" : "amber"} />
            <MetricCard label="Median FIRE age" value={result.fireAgeHistogram.length > 0 ? `Age ${result.fireAgeHistogram[Math.floor(result.fireAgeHistogram.length / 2)].age}` : "—"} detail={`From ${result.simulations} paths`} />
          </section>

          <Card title="Fan chart" eyebrow={`${result.simulations} simulations`}>
            <div className="mb-3 flex items-center gap-4 text-[11px] text-[#6B7280]">
              <LegendSwatch color="rgba(74,124,255,0.15)" label="p10 / p90" />
              <LegendSwatch color="rgba(74,124,255,0.3)" label="p25 / p75" />
              <LegendSwatch color="#4A7CFF" label="p50 median" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.fanChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
                  <XAxis dataKey="age" tick={axisTick} />
                  <YAxis tickFormatter={compactCurrency} width={56} tick={axisTick} />
                  <Tooltip formatter={(value) => formatJPY(Number(value))} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="p90" stroke="none" fill="#4A7CFF" fillOpacity={0.08} />
                  <Area type="monotone" dataKey="p75" stroke="none" fill="#4A7CFF" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="p25" stroke="none" fill="#4A7CFF" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="p10" stroke="none" fill="#4A7CFF" fillOpacity={0.08} />
                  <Line type="monotone" dataKey="p50" stroke="#4A7CFF" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="FIRE age distribution" eyebrow="Histogram">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.fireAgeHistogram}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEB" vertical={false} />
                  <XAxis dataKey="age" tick={axisTick} />
                  <YAxis tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#4A7CFF" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------- Assumptions panel ----------

type GroupKey = "you" | "income" | "property" | "retirement" | "returns" | "bridge" | "events" | "expenses";
const DEFAULT_COLLAPSED: Record<GroupKey, boolean> = {
  you: false,
  income: false,
  property: true,
  retirement: false,
  returns: false,
  bridge: true,
  events: true,
  expenses: true,
};

function AssumptionsPanel({
  inputs,
  setAssumption,
  onReset,
}: {
  inputs: ForecastInputs;
  setAssumption: (field: keyof ForecastInputs, value: string | number | boolean | undefined) => void;
  onReset: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>(() => {
    if (typeof window === "undefined") return DEFAULT_COLLAPSED;
    try {
      const raw = localStorage.getItem("forecast-panel-collapsed");
      return raw ? { ...DEFAULT_COLLAPSED, ...JSON.parse(raw) } : DEFAULT_COLLAPSED;
    } catch {
      return DEFAULT_COLLAPSED;
    }
  });
  const toggle = (key: GroupKey) => {
    const next = { ...collapsed, [key]: !collapsed[key] };
    setCollapsed(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("forecast-panel-collapsed", JSON.stringify(next));
    }
  };
  return (
    <aside className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)] scroll-soft">
      <div className="mb-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">Assumptions</p>
        <h2 className="mt-1 text-[15px] font-medium text-slate-900">Japan FIRE inputs</h2>
      </div>

      <Group label="You" open={!collapsed.you} onToggle={() => toggle("you")}>
        <LabeledNumber label="Current age" value={inputs.currentAge ?? 30} onChange={(v) => setAssumption("currentAge", v)} />
        <LabeledNumber label="Target retirement age" value={inputs.targetRetirementAge} onChange={(v) => setAssumption("targetRetirementAge", v)} />
        <LabeledNumber label="Target depletion age" value={inputs.retirementEndAge ?? 90} onChange={(v) => setAssumption("retirementEndAge", v)} />
      </Group>

      <Group label="Income" open={!collapsed.income} onToggle={() => toggle("income")}>
        <LabeledCurrency label="Current net monthly salary" value={inputs.initialNetMonthlyYen ?? 650_000} onChange={(v) => setAssumption("initialNetMonthlyYen", v)} />
        <LabeledPercent label="Salary growth rate" value={inputs.incomeGrowthRate ?? 0.04} onChange={(v) => setAssumption("incomeGrowthRate", v)} />
        <LabeledNumber label="Growth step (years)" value={inputs.incomeGrowthIntervalYears ?? 2} onChange={(v) => setAssumption("incomeGrowthIntervalYears", v)} />
        <LabeledCurrency label="Net salary cap" value={inputs.netSalaryCapYen ?? 995_000} onChange={(v) => setAssumption("netSalaryCapYen", v)} />
        <SelectRow
          label="iDeCo plan"
          value={inputs.idecoPlanType ?? "full"}
          onChange={(v) => setAssumption("idecoPlanType", v)}
          options={[
            { value: "full", label: "Full ¥23,000/mo" },
            { value: "dc", label: "DC pension ¥12,000/mo" },
          ]}
        />
        <LabeledCurrency label="Monthly investment contribution" value={inputs.monthlyContributionYen ?? 0} onChange={(v) => setAssumption("monthlyContributionYen", v)} />
      </Group>

      <Group label="Property" open={!collapsed.property} onToggle={() => toggle("property")}>
        <ToggleInput label="Include mortgage" checked={inputs.includeMortgage ?? true} onChange={(v) => setAssumption("includeMortgage", v)} />
        <LabeledNumber label="Property purchase age" value={inputs.propertyPurchaseAge ?? 40} onChange={(v) => setAssumption("propertyPurchaseAge", v)} />
        <LabeledCurrency label="Property value" value={inputs.propertyValueYen ?? 100_000_000} onChange={(v) => setAssumption("propertyValueYen", v)} />
        <LabeledPercent label="Partner housing share" value={inputs.partnerHousingShareRate ?? 0.3333} onChange={(v) => setAssumption("partnerHousingShareRate", v)} />
      </Group>

      <Group label="Retirement" open={!collapsed.retirement} onToggle={() => toggle("retirement")}>
        <LabeledCurrency label="FAT annual spend" value={inputs.fatAnnualSpendYen ?? inputs.targetAnnualRetirementSpendYen ?? 6_000_000} onChange={(v) => { setAssumption("fatAnnualSpendYen", v); setAssumption("targetAnnualRetirementSpendYen", v); }} />
        <LabeledPercent label="Safe withdrawal rate" value={inputs.safeWithdrawalRate ?? 0.035} onChange={(v) => setAssumption("safeWithdrawalRate", v)} />
        <LabeledPercent label="SWR buffer" value={inputs.swrBufferRate ?? 0.15} onChange={(v) => setAssumption("swrBufferRate", v)} />
        <ToggleInput label="Include nenkin from age 65" checked={inputs.includePension ?? false} onChange={(v) => setAssumption("includePension", v)} />
      </Group>

      <Group label="Returns" open={!collapsed.returns} onToggle={() => toggle("returns")}>
        <LabeledPercent label="Bear real return" value={inputs.bearRealReturn ?? 0.02} onChange={(v) => setAssumption("bearRealReturn", v)} />
        <LabeledPercent label="Base real return" value={inputs.baseRealReturn ?? 0.05} onChange={(v) => { setAssumption("baseRealReturn", v); setAssumption("expectedAnnualReturn", v); }} />
        <LabeledPercent label="Bull real return" value={inputs.bullRealReturn ?? 0.07} onChange={(v) => setAssumption("bullRealReturn", v)} />
        <LabeledPercent label="Inflation rate" value={inputs.inflationRate ?? 0.02} onChange={(v) => setAssumption("inflationRate", v)} />
        <SelectRow
          label="Active scenario"
          value={inputs.activeScenario ?? "base"}
          onChange={(v) => setAssumption("activeScenario", v)}
          options={[
            { value: "bear", label: "Bear" },
            { value: "base", label: "Base" },
            { value: "bull", label: "Bull" },
            { value: "custom", label: "Custom" },
          ]}
        />
        <ToggleInput label="Show nominal ¥" checked={inputs.showNominal ?? false} onChange={(v) => setAssumption("showNominal", v)} />
      </Group>

      <Group label="Bridge phase" open={!collapsed.bridge} onToggle={() => toggle("bridge")}>
        <ToggleInput label="Enable bridge phase" checked={inputs.bridgePhaseEnabled ?? false} onChange={(v) => setAssumption("bridgePhaseEnabled", v)} />
        <LabeledNumber label="Bridge start age" value={inputs.bridgeStartAge ?? 50} onChange={(v) => setAssumption("bridgeStartAge", v)} />
        <LabeledNumber label="Bridge end age" value={inputs.bridgeEndAge ?? 56} onChange={(v) => setAssumption("bridgeEndAge", v)} />
        <LabeledCurrency label="Bridge monthly net income" value={inputs.bridgeMonthlyIncomeYen ?? 200_000} onChange={(v) => setAssumption("bridgeMonthlyIncomeYen", v)} />
      </Group>

      <Group label="Life events" open={!collapsed.events} onToggle={() => toggle("events")}>
        <p className="text-[11px] leading-relaxed text-[#6B7280]">
          The engine already accepts <span className="font-mono text-[10px]">lifeEvents[]</span> and renders them as reference lines on the Projection chart. The full add/edit UI with presets is deferred — documented in <span className="font-mono text-[10px]">FORECAST_AUDIT.md</span>.
        </p>
      </Group>

      <Group label="Expenses" open={!collapsed.expenses} onToggle={() => toggle("expenses")}>
        <LabeledCurrency label="Rent (pre-purchase)" value={inputs.rentMonthlyYen ?? 110_000} onChange={(v) => setAssumption("rentMonthlyYen", v)} />
        <LabeledCurrency label="Utilities" value={inputs.utilitiesMonthlyYen ?? 10_000} onChange={(v) => setAssumption("utilitiesMonthlyYen", v)} />
        <LabeledCurrency label="Phone / Internet" value={inputs.phoneInternetMonthlyYen ?? 12_500} onChange={(v) => setAssumption("phoneInternetMonthlyYen", v)} />
        <LabeledCurrency label="Groceries" value={inputs.groceriesMonthlyYen ?? 35_000} onChange={(v) => setAssumption("groceriesMonthlyYen", v)} />
        <LabeledCurrency label="Transport" value={inputs.transportMonthlyYen ?? 12_000} onChange={(v) => setAssumption("transportMonthlyYen", v)} />
        <LabeledCurrency label="Personal care" value={inputs.personalCareMonthlyYen ?? 20_000} onChange={(v) => setAssumption("personalCareMonthlyYen", v)} />
        <LabeledCurrency label="Fine dining" value={inputs.fineDiningMonthlyYen ?? 20_000} onChange={(v) => setAssumption("fineDiningMonthlyYen", v)} />
        <LabeledCurrency label="Drinking" value={inputs.drinkingMonthlyYen ?? 35_000} onChange={(v) => setAssumption("drinkingMonthlyYen", v)} />
        <LabeledCurrency label="Annual travel total" value={inputs.travelAnnualYen ?? 1_170_000} onChange={(v) => setAssumption("travelAnnualYen", v)} />
        <LabeledCurrency label="Post-purchase condo fee (mo)" value={inputs.condoManagementFeeMonthlyYen ?? 30_000} onChange={(v) => setAssumption("condoManagementFeeMonthlyYen", v)} />
        <LabeledCurrency label="Annual property tax" value={inputs.propertyTaxAnnualYen ?? 200_000} onChange={(v) => setAssumption("propertyTaxAnnualYen", v)} />
      </Group>

      <button
        type="button"
        onClick={onReset}
        className="mt-3 w-full rounded-lg bg-[#FAFAF8] px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#EEEDE9]"
      >
        Reset to defaults
      </button>
    </aside>
  );
}

function Group({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="border-b border-[#F0EFEB] py-3 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-[#6B7280] transition ${open ? "" : "-rotate-90"}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ---------- Shared input primitives (forecast-local) ----------

function LabeledNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="hide-spin w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-[#4A7CFF]"
      />
    </label>
  );
}

function LabeledCurrency({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={formatJPY(value)}
        onChange={(event) => onChange(Number(event.target.value.replace(/[^\d-]/g, "")) || 0)}
        className="w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-[#4A7CFF]"
      />
    </label>
  );
}

function LabeledPercent({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>
      <div className="relative">
        <input
          type="number"
          step="0.1"
          value={Math.round(value * 1000) / 10}
          onChange={(event) => onChange((Number(event.target.value) || 0) / 100)}
          className="hide-spin w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 pr-7 text-right text-sm tabular-nums outline-none focus:border-[#4A7CFF]"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">%</span>
      </div>
    </label>
  );
}

function ToggleInput({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-1.5 text-xs text-slate-700 hover:bg-[#FAFAF8]">
      <span className="min-w-0 flex-1 leading-relaxed">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-3.5 w-3.5 shrink-0 accent-[#4A7CFF]" />
    </label>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#4A7CFF]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInputCompact({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-[#E8E7E3] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#4A7CFF]"
      />
    </label>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</span>
        <span className="text-sm tabular-nums text-slate-900">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#4A7CFF]"
      />
    </div>
  );
}

function KeyValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-[#FAFAF8] p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</p>
      <p className="mt-1 text-sm tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{hint}</p>}
    </div>
  );
}

function NoticeBanner({ children }: { children: ReactNode }) {
  return <div className="rounded-lg bg-[#E6EDFF] px-4 py-2.5 text-sm leading-relaxed text-[#2450B5]">{children}</div>;
}
