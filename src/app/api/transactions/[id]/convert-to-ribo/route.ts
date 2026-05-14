import { prisma } from "@/lib/prisma";

const LOCAL_USER_ID = "local-user";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST: convert a card-side debit into ribo. Marks the transaction with convertedToRiboAt and
 * raises the card's revolving balance by the same amount, atomically. The transaction stays
 * visible in the ledger so the user has an audit trail.
 *
 * DELETE: undo the conversion. Reverses the balance bump and clears the timestamp.
 */
async function findRiboDebt(accountId: string) {
  return prisma.creditDebt.findFirst({
    where: { localUserId: LOCAL_USER_ID, accountId, type: "revolving", isPaid: false },
  });
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.findUnique({ where: { id, localUserId: LOCAL_USER_ID } });
      if (!txn) throw new Error("Transaction not found.");
      if (txn.type !== "debit") throw new Error("Only debit transactions can be converted to ribo.");
      if (txn.convertedToRiboAt) throw new Error("Already converted to ribo.");

      const debt = await findRiboDebt(txn.accountId);
      if (!debt) throw new Error("This card has no active revolving debt to absorb the charge.");

      const updated = await tx.transaction.update({
        where: { id },
        data: { convertedToRiboAt: new Date() },
      });
      const newBalance = await tx.creditDebt.update({
        where: { id: debt.id },
        data: { currentBalanceYen: { increment: txn.amountYen } },
      });
      return { transaction: updated, debt: newBalance };
    });

    return Response.json({
      transaction: {
        id: result.transaction.id,
        accountId: result.transaction.accountId,
        categoryId: result.transaction.categoryId ?? undefined,
        date: result.transaction.date.toISOString().slice(0, 10),
        payee: result.transaction.payee,
        memo: result.transaction.memo ?? undefined,
        amountYen: result.transaction.amountYen,
        type: result.transaction.type,
        source: result.transaction.source,
        convertedToRiboAt: result.transaction.convertedToRiboAt?.toISOString(),
      },
      debt: {
        id: result.debt.id,
        currentBalanceYen: result.debt.currentBalanceYen,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to convert to ribo." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.findUnique({ where: { id, localUserId: LOCAL_USER_ID } });
      if (!txn) throw new Error("Transaction not found.");
      if (!txn.convertedToRiboAt) throw new Error("This transaction was not converted to ribo.");

      const debt = await findRiboDebt(txn.accountId);
      const updated = await tx.transaction.update({
        where: { id },
        data: { convertedToRiboAt: null },
      });
      const debtRow = debt
        ? await tx.creditDebt.update({
            where: { id: debt.id },
            data: { currentBalanceYen: { decrement: txn.amountYen } },
          })
        : null;
      return { transaction: updated, debt: debtRow };
    });

    return Response.json({
      transaction: {
        id: result.transaction.id,
        convertedToRiboAt: undefined,
      },
      debt: result.debt ? { id: result.debt.id, currentBalanceYen: result.debt.currentBalanceYen } : null,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to revert ribo conversion." }, { status: 400 });
  }
}
