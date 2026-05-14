/**
 * One-shot fix:
 *   - Detach the categoryId on every 自払/メルペイ/wallet-top-up settlement transaction so they
 *     don't pollute "Other" budget activity.
 *   - Delete the orphan "India Sept Trip" goal-category that exists without a SavingsGoal row.
 */
import { prisma } from "../lib/importHelpers";

const LOCAL_USER_ID = "local-user";
const SETTLEMENT_PAYEE = /^(自払|メルペイ$|チャージ\(?入金\)?)/;

async function main() {
  const settlements = await prisma.transaction.findMany({
    where: { localUserId: LOCAL_USER_ID, categoryId: { not: null } },
    select: { id: true, payee: true, categoryId: true },
  });
  let detached = 0;
  for (const t of settlements) {
    if (!SETTLEMENT_PAYEE.test(t.payee)) continue;
    await prisma.transaction.update({ where: { id: t.id }, data: { categoryId: null } });
    detached += 1;
  }
  console.log(`Detached categoryId on ${detached} settlement rows.`);

  const orphans = await prisma.category.findMany({
    where: { localUserId: LOCAL_USER_ID, groupId: "grp-goals", savingsGoal: null },
  });
  for (const cat of orphans) {
    await prisma.category.delete({ where: { id: cat.id } });
    console.log(`Deleted orphan grp-goals category: ${cat.name} (${cat.id}).`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
