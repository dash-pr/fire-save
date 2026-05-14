import { prisma } from "@/lib/prisma";

import type { CreditDebt, DebtType } from "@/domain/types";

type RouteContext = { params: Promise<{ id: string }> };
type DebtBody = Partial<CreditDebt> & { month?: string };

const debtTypes = new Set<DebtType>(["revolving", "installment", "lump_sum"]);

function parseDueDay(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("paymentDueDay must be an integer from 1 to 31.");
  return day;
}

function parseDebtBody(body: DebtBody) {
  if (body.type !== undefined && !debtTypes.has(body.type)) throw new Error("Invalid debt type.");
  const paymentDueDay = parseDueDay(body.paymentDueDay);
  const cycleStartDay = parseDueDay(body.cycleStartDay);
  const cycleEndDay = parseDueDay(body.cycleEndDay);
  return {
    accountId: body.accountId || null,
    categoryId: body.categoryId || null,
    type: body.type,
    cardName: body.cardName?.trim() || undefined,
    description: body.description?.trim() || null,
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
    expectedBillingDate: body.expectedBillingDate ? new Date(`${body.expectedBillingDate}T00:00:00`) : null,
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

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const debt = await prisma.creditDebt.findUnique({ where: { id } });
  if (!debt) return Response.json({ error: "Debt not found." }, { status: 404 });
  return Response.json({ debt: serializeDebt(debt) });
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as DebtBody;
    const debt = await prisma.creditDebt.update({ where: { id }, data: parseDebtBody(body) });
    return Response.json({ debt: serializeDebt(debt) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid debt payload." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? undefined;

  const result = await prisma.$transaction(async (tx) => {
    const debt = await tx.creditDebt.findUnique({ where: { id }, select: { categoryId: true } });
    if (!debt) return { movedTransactions: 0, removedCategoryId: null as string | null };

    let movedTransactions = 0;
    if (debt.categoryId && month) {
      const start = new Date(`${month}-01T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const update = await tx.transaction.updateMany({ where: { categoryId: debt.categoryId, date: { gte: start, lt: end } }, data: { categoryId: null } });
      movedTransactions = update.count;
    }

    await tx.creditDebt.delete({ where: { id } });
    if (debt.categoryId) {
      await tx.budget.deleteMany({ where: { categoryId: debt.categoryId } });
      await tx.category.delete({ where: { id: debt.categoryId } }).catch(async () => {
        await tx.category.update({ where: { id: debt.categoryId! }, data: { isArchived: true } });
      });
    }

    return { movedTransactions, removedCategoryId: debt.categoryId };
  });

  return Response.json({ deleted: true, ...result });
}
