import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";

export const metadata = {
  title: "Stashy — Your path to FATFire, clearly mapped.",
  description:
    "Track your money, eliminate your debt, and project exactly when you can stop working — built for Japan.",
};

export default function LandingPage() {
  return (
    <main className="bg-white text-slate-900">
      <LandingNav />
      <Hero />
      <Features />
      <HowItWorks />
      <CtaFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#1C1F3A] pt-20 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-12 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1 text-xs font-medium tracking-wide text-white/90">
          Built for FATFire in Japan 🇯🇵
        </span>
        <h1 className="mt-7 max-w-3xl text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
          Know exactly
          <br />
          when you&apos;re <span className="text-[#4A7CFF]">free</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
          Stashy tracks your spending, models your NISA and iDeCo, and runs thousands of retirement simulations so you
          always know where you stand.
        </p>
        <div className="mt-9 flex items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-6 text-sm font-medium text-[#1C1F3A] transition hover:bg-white/90"
          >
            Start for free
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/30 px-6 text-sm font-medium text-white transition hover:bg-white/5"
          >
            See how it works
          </Link>
        </div>
        <p className="mt-6 text-xs text-white/50">
          No credit card required · Works with Japanese bank accounts · Runs on your data, not ours.
        </p>

        <BrowserMockup />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#1C1F3A]" />
    </section>
  );
}

function BrowserMockup() {
  return (
    <div
      className="mt-16 w-full max-w-5xl"
      style={{ transform: "perspective(1200px) rotateX(8deg)", transformStyle: "preserve-3d" }}
    >
      <div className="overflow-hidden rounded-t-2xl border border-white/10 bg-[#0F1126] shadow-[0_40px_80px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2 border-b border-white/5 bg-[#0B0D1F] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          <div className="ml-3 flex h-6 flex-1 items-center justify-center rounded-md bg-white/5 text-[10px] text-white/50">
            stashy.app/budget
          </div>
        </div>
        <BudgetMockup />
      </div>
    </div>
  );
}

function BudgetMockup() {
  return (
    <div className="flex bg-[#F5F4F0] text-slate-900">
      <div className="hidden w-44 shrink-0 bg-[#1C1F3A] px-3 py-4 text-white md:block">
        <div className="mb-5 flex items-center gap-2 px-2">
          <div className="h-6 w-6 rounded-md bg-white/10" />
          <span className="text-xs font-medium tracking-wide">Stashy</span>
        </div>
        <div className="space-y-1">
          {["Home", "Budget", "Transactions", "Debt", "Goals", "Investments", "Forecast", "Reports"].map((item, index) => (
            <div
              key={item}
              className={`flex h-7 items-center rounded-md px-2 text-[11px] ${
                index === 1 ? "bg-white/10 text-white" : "text-white/55"
              }`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-5 text-left">
        <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">May 2026</p>
        <h3 className="mt-1 text-lg font-medium tracking-tight">Monthly Budget</h3>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Ready to assign", value: "¥184,000", tone: "text-[#16A34A]" },
            { label: "Income", value: "¥820,000", tone: "text-slate-900" },
            { label: "Assigned", value: "¥636,000", tone: "text-slate-900" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
              <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">{stat.label}</p>
              <p className={`mt-0.5 text-sm font-medium tabular-nums ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
          {[
            ["Fixed costs", "¥250,000", "¥250,000", "¥0", true],
            ["Rent", "¥180,000", "¥180,000", "¥0", false],
            ["Utilities", "¥30,000", "¥28,400", "¥1,600", false],
            ["Investments", "¥220,000", "¥220,000", "¥0", true],
            ["NISA Tsumitate", "¥100,000", "¥100,000", "¥0", false],
            ["iDeCo", "¥23,000", "¥23,000", "¥0", false],
          ].map(([name, assigned, activity, available, isHeader]) => (
            <div
              key={name as string}
              className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 border-t border-[#F0EFEB] px-3 py-2 first:border-t-0 ${
                isHeader ? "bg-[#FAFAF8] text-[10px] font-medium uppercase tracking-[0.06em] text-[#6B7280]" : "text-[11px]"
              }`}
            >
              <span>{name}</span>
              <span className="w-16 text-right tabular-nums">{assigned}</span>
              <span className="w-16 text-right tabular-nums text-[#6B7280]">{activity}</span>
              <span className="w-12 text-right tabular-nums">{available}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-medium tracking-tight md:text-4xl">
          Everything you need, nothing you don&apos;t.
        </h2>
        <div className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          <FeatureColumn
            icon={
              <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none" stroke="#4A7CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="20" cy="20" r="14" />
                <path d="M20 6 V20 L32 14" />
                <path d="M20 20 L8 26" />
              </svg>
            }
            title="Budget with intention"
            body="Assign every yen a job before the month begins. See exactly how much is left to invest after your fixed costs and goals are covered."
          />
          <FeatureColumn
            icon={
              <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none" stroke="#4A7CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 32 L14 22 L20 26 L34 10" />
                <path d="M26 10 H34 V18" />
              </svg>
            }
            title="Model your FATFire"
            body="Run Bear, Base, and Bull scenarios with 500 Monte Carlo simulations. See your probability of retiring early under realistic Japanese market conditions."
          />
          <FeatureColumn
            icon={
              <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none" stroke="#4A7CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 14 H34" />
                <path d="M9 14 V10 Q9 6 14 6 H26 Q31 6 31 10 V14" />
                <path d="M10 14 V34" />
                <path d="M30 14 V34" />
                <path d="M14 20 H26" />
              </svg>
            }
            title="Japan-first by design"
            body="Built around NISA, iDeCo, and ribo-barai debt. Knows the 5-year mortgage rule. Understands how Japanese tax wrappers compound over time."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureColumn({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      {icon}
      <h3 className="mt-5 text-lg font-medium text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{body}</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Set up your accounts.",
      body: "Add your savings, credit cards, and investment accounts. Takes two minutes.",
    },
    {
      n: "02",
      title: "Assign your money.",
      body: "Enter your income, assign it to categories, and see what is left to invest.",
    },
    {
      n: "03",
      title: "See your FIRE date.",
      body: "The forecast engine calculates your FATFire date based on real data, not assumptions.",
    },
  ];
  return (
    <section id="how-it-works" className="bg-[#F5F4F0] px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-medium tracking-tight md:text-4xl">Up and running in minutes.</h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <div key={step.n}>
              <p className="text-5xl font-light tabular-nums text-[#C7CBD6] md:text-6xl">{step.n}</p>
              <h3 className="mt-5 text-lg font-medium text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaFooter() {
  return (
    <section className="bg-[#1C1F3A] px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-medium tracking-tight md:text-4xl">Your financial independence starts now.</h2>
        <Link
          href="/signup"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-[#4A7CFF] px-6 text-sm font-medium text-white transition hover:bg-[#3A68E5]"
        >
          Create your free account
        </Link>
        <p className="mt-6 text-sm text-white/60">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-white hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
