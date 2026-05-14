/**
 * The original import created two parallel sets of categories per card: a "X リボ弁済金" /
 * "Paidy あと払い" set tracking just the ribo principal, and a per-CreditDebt "X 返済" set that
 * came in later. Both surface in the Budget Debt-Payments group, double-counting every card.
 *
 * This script merges every RecurringExpense, Budget, and MerchantRule on the legacy categories
 * onto the matching CreditDebt-linked category, then archives the legacy row.
 *
 * Idempotent.
 */
import { prisma } from "../lib/importHelpers";

const LOCAL_USER_ID = "local-user";

const MERGES: Array<{ from: string; to: string }> = [
  { from: "JCB リボ弁済金",        to: "JCBプラチナ 返済" },
  { from: "SMBC リボ弁済金",       to: "三井住友カード SMBC 返済" },
  { from: "セゾン リボ弁済金",     to: "セゾンゴールド・アメックス 返済" },
  { from: "Paidy あと払い",        to: "Paidy Amazon 分割あと払い (consolidated) 返済" },
  { from: "Paidy Apple月払い",     to: "Paidy Apple専用 あと払い 返済" },
];

async function main() {
  for (const { from, to } of MERGES) {
    const fromCat = await prisma.category.findFirst({ where: { localUserId: LOCAL_USER_ID, name: from } });
    const toCat = await prisma.category.findFirst({ where: { localUserId: LOCAL_USER_ID, name: to } });
    if (!fromCat) continue;
    if (!toCat) {
      console.warn(`  ⚠ Missing target "${to}" — leaving "${from}" intact`);
      continue;
    }
    if (fromCat.id === toCat.id) continue;

    const txMoved = await prisma.transaction.updateMany({ where: { categoryId: fromCat.id }, data: { categoryId: toCat.id } });
    const recMoved = await prisma.recurringExpense.updateMany({ where: { categoryId: fromCat.id }, data: { categoryId: toCat.id } });
    const ruleMoved = await prisma.merchantRule.updateMany({ where: { categoryId: fromCat.id }, data: { categoryId: toCat.id, categoryName: toCat.name } });
    const budgetDeleted = await prisma.budget.deleteMany({ where: { categoryId: fromCat.id } });
    await prisma.category.update({ where: { id: fromCat.id }, data: { isArchived: true } });

    console.log(`  ${from} → ${to}: tx=${txMoved.count}, rec=${recMoved.count}, rules=${ruleMoved.count}, dropped budgets=${budgetDeleted.count}`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
