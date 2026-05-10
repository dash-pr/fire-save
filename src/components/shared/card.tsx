import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm", className)}>
      {(title || eyebrow || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>}
            {title && <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "green" | "amber" | "blue" }) {
  const tones = {
    neutral: "from-slate-950 to-slate-800 text-white",
    green: "from-[#4CAF82] to-emerald-600 text-white",
    amber: "from-[#F5A623] to-orange-500 text-slate-950",
    blue: "from-[#4A7CFF] to-indigo-600 text-white",
  };

  return (
    <div className={cn("rounded-3xl bg-gradient-to-br p-5 shadow-sm", tones[tone])}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-sm opacity-80">{detail}</p>
    </div>
  );
}
