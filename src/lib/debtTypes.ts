import type { CreditDebt } from "@/domain/types";

export type DebtTypeKey = CreditDebt["type"];

export const DEBT_TYPE_LABELS: Record<DebtTypeKey, { en: string; jp: string; description: string }> = {
  revolving: {
    en: "Revolving Credit",
    jp: "リボ払い",
    description: "Monthly minimum payment with interest on the balance",
  },
  installment: {
    en: "Installment",
    jp: "分割払い",
    description: "Fixed number of payments, often 0% interest",
  },
  lump_sum: {
    en: "Deferred Lump Sum",
    jp: "一括払い",
    description: "Single payment due on a future billing date",
  },
};

export function getDebtTypeLabel(type: DebtTypeKey) {
  return DEBT_TYPE_LABELS[type];
}
