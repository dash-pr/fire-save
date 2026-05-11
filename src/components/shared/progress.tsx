import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ProgressBar({
  value,
  className,
  tone,
  thick = false,
}: {
  value: number;
  className?: string;
  tone?: "auto" | "success" | "warning" | "primary";
  thick?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const resolved: "warning" | "primary" | "success" =
    tone === "success"
      ? "success"
      : tone === "warning"
      ? "warning"
      : tone === "primary"
      ? "primary"
      : clamped >= 90
      ? "success"
      : clamped >= 50
      ? "primary"
      : "warning";
  const color = {
    success: "#4CAF82",
    primary: "#4A7CFF",
    warning: "#F5A623",
  }[resolved];
  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-[#EEEDE9]",
        thick ? "h-3" : "h-1.5",
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width,background-color] duration-[400ms] ease-out"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "blue" | "slate";
  children: ReactNode;
}) {
  const tones = {
    green: "text-[#2F7A58] bg-[#E8F5EE]",
    amber: "text-[#8A5A10] bg-[#FBEFD9]",
    red: "text-[#A32D27] bg-[#FBE5E3]",
    blue: "text-[#2450B5] bg-[#E6EDFF]",
    slate: "text-[#4B5563] bg-[#EEEDE9]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
