import { prisma } from "@/lib/prisma";

import type { CreditDebt, DebtType } from "@/domain/types";

type DebtBody = Partial<CreditDebt>;

const debtTypes = new Set<DebtType>(["revolving", "installment", "lump_sum"]);

function parseDueDay(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("paymentDueDay must be an integer from 1 to 31.");
  return day;
}

function parseDebtBody(body: DebtBody, requireAll = false) {
  if (requireAll && (!body.cardName?.trim() || !body.type || !debtTypes.has(body.type))) {
    throw new Error("cardName and valid type are required.");
  }
  if (body.type !== undefined && !debtTypes.has(body.type)) throw new Error("Invalid debt type.");
  const paymentDueDay = parseDueDay(body.paymentDueDay);
  const cycleStartDay = parseDueDay(body.cycleStartDay);
  const cycleEndDay = parseDueDay(body.cycleEndDay);
  return {
    accountId: body.accountId || undefined,
    categoryId: body.categoryId || undefined,
    type: body.type,
    cardName: body.cardName?.trim() || undefined,
    description: body.description?.trim() || undefined,
    currentBalanceYen: body.currentBalanceYen === undefined ? undefined : Math.max(0, Math.round(body.currentBalanceYen)),
    originalAmountYen: body.originalAmountYen === undefined ? undefined : Math.max(0, Math.round(body.originalAmountYen)),
    monthlyPaymentYen: body.monthlyPaymentYen === undefined ? undefined : Math.max(0, Math.round(body.monthlyPaymentYen)),
    paymentDueDay,
    cycleStartDay,
    cycleEndDay,
    annualInterestRate: body.annualInterestRate === undefined ? undefined : Math.max(0, body.annualInterestRate),
    monthlyInterestRate: body.monthlyInterestRate === undefined ? undefined : Math.max(0, body.monthlyInterestRate),
    totalInstallments: body.totalInstallments === undefined ? undefined : Math.max(0, Math.round(body.totalInstallments)),
    installmentsPaid: body.installmentsPaid === undefined ? undefined : Math.max(0, Math.round(body.installmentsPaid)),
    expectedBillingDate: body.expectedBillingDate ? new Date(`${body.expectedBillingDate}T00:00:00`) : undefined,
    isPaid: body.isPaid,
  };
}

function serializeDebt(debt: {
  id: string;
  accountId: string | null;
  type: DebtType;
  cardName: string;
  description: string | null;
  currentBalanceYen: number;
  originalAmountYen: number | null;
  monthlyPaymentYen: number;
  paymentDueDay: number | null;
  cycleStartDay: number | null;
  cycleEndDay: number | null;
  annualInterestRate: number;
  monthlyInterestRate: number;
  totalInstallments: number | null;
  installmentsPaid: number | null;
  expectedBillingDate: Date | null;
  isPaid: boolean;
  categoryId: string | null;
}) {
  return {
    id: debt.id,
    accountId: debt.accountId ?? undefined,
    type: debt.type,
    cardName: debt.cardName,
    description: debt.description ?? undefined,
    currentBalanceYen: debt.currentBalanceYen,
    originalAmountYen: debt.originalAmountYen ?? undefined,
    monthlyPaymentYen: debt.monthlyPaymentYen,
    paymentDueDay: debt.paymentDueDay ?? undefined,
    cycleStartDay: debt.cycleStartDay ?? undefined,
    cycleEndDay: debt.cycleEndDay ?? undefined,
    annualInterestRate: debt.annualInterestRate,
    monthlyInterestRate: debt.monthlyInterestRate,
    totalInstallments: debt.totalInstallments ?? undefined,
    installmentsPaid: debt.installmentsPaid ?? undefined,
    expectedBillingDate: debt.expectedBillingDate?.toISOString().slice(0, 10),
    isPaid: debt.isPaid,
    categoryId: debt.categoryId ?? undefined,
  } satisfies CreditDebt;
}

export async function GET() {
  const debts = await prisma.creditDebt.findMany({ where: { localUserId: "local-user" }, orderBy: { createdAt: "asc" } });
  return Response.json({ debts: debts.map(serializeDebt) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DebtBody;
    const data = parseDebtBody(body, true);
    const debt = await prisma.creditDebt.create({
      data: {
        ...data,
        type: data.type!,
        cardName: data.cardName!,
        currentBalanceYen: data.currentBalanceYen ?? 0,
        monthlyPaymentYen: data.monthlyPaymentYen ?? 0,
        annualInterestRate: data.annualInterestRate ?? 0,
        monthlyInterestRate: data.monthlyInterestRate ?? (data.annualInterestRate ?? 0) / 12,
      },
    });
    return Response.json({ debt: serializeDebt(debt) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid debt payload." }, { status: 400 });
  }
}
