import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  title,
  eyebrow,
  action,
  children,
  className,
  tone = "default",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "inset";
}) {
  return (
    <section
      className={cn(
        "rounded-2xl p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_1px_1px_rgba(17,24,39,0.03)]",
        tone === "inset" ? "bg-[#FAFAF8]" : "bg-white",
        className,
      )}
    >
      {(title || eyebrow || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-1 text-[15px] font-medium text-slate-900">
                {title}
              </h2>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "green" | "amber" | "blue" | "red";
}) {
  const accent = {
    neutral: "text-slate-900",
    green: "text-[#4CAF82]",
    amber: "text-[#F5A623]",
    blue: "text-[#4A7CFF]",
    red: "text-[#E5534B]",
  } as const;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_1px_1px_rgba(17,24,39,0.03)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6B7280]">
        {label}
      </p>
      <p className={cn("mt-3 text-2xl font-medium tabular-nums", accent[tone])}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">{detail}</p>
    </div>
  );
}
