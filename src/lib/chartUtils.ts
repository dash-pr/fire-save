import { formatJPY } from "./format";

export const CHART_MIN_VALUE = 100;

export function sortChartDataDescending<T extends { value: number }>(data: T[]): T[] {
  return [...data].sort((a, b) => b.value - a.value);
}

export function filterLegendItems<T extends { value: number }>(items: T[]): T[] {
  return items.filter((item) => item.value >= CHART_MIN_VALUE);
}

export function suppressSmallValues(value: number): string {
  if (Math.abs(value) < CHART_MIN_VALUE) return "";
  return formatJPY(value);
}

export type ChartTooltipPayloadItem = {
  value?: number | string;
  name?: string | number;
  dataKey?: string | number;
  color?: string;
  payload?: unknown;
};

export function filterTooltipPayload<T extends ChartTooltipPayloadItem>(payload: T[]): T[] {
  return payload.filter((p) => {
    const numeric = typeof p.value === "number" ? p.value : Number(p.value ?? 0);
    return Math.abs(numeric) >= CHART_MIN_VALUE;
  });
}
