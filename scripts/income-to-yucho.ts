/**
 * Reassign every credit (income) transaction to the Yucho/Japan Post Bank account.
 * Idempotent: skips rows that already point at Yucho.
 */
import { prisma } from "../lib/importHelpers";

const LOCAL_USER_ID = "local-user";
const YUCHO_PATTERN = /yucho|ゆうちょ|japan post/i;

async function main() {
  const accounts = await prisma.account.findMany({ where: { localUserId: LOCAL_USER_ID } });
  const yucho = accounts.find((a) => YUCHO_PATTERN.test(a.name));
  if (!yucho) {
    console.error("Yucho account not found. Existing accounts:");
    accounts.forEach((a) => console.error(`  ${a.id}\t${a.type}\t${a.name}`));
    process.exit(1);
  }
  console.log(`Yucho account: ${yucho.name} (${yucho.id})`);

  const credits = await prisma.transaction.findMany({
    where: { localUserId: LOCAL_USER_ID, type: "credit" },
    include: { account: { select: { name: true } } },
  });
  console.log(`Found ${credits.length} credit transactions across ${new Set(credits.map((c) => c.accountId)).size} accounts.`);

  const toMove = credits.filter((c) => c.accountId !== yucho.id);
  console.log(`${toMove.length} need to move.`);

  let updated = 0;
  for (const tx of toMove) {
    try {
      await prisma.transaction.update({ where: { id: tx.id }, data: { accountId: yucho.id } });
      updated += 1;
    } catch (error) {
      // Unique constraint on (localUserId, date, payee, amountYen, accountId) may collide if a
      // credit row already exists at Yucho for the same merchant/amount/date.
      console.warn(`  Skipped ${tx.id} (${tx.date.toISOString().slice(0, 10)} ${tx.account?.name} ¥${tx.amountYen} "${tx.payee}"): ${(error as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`Moved ${updated} credit transactions to Yucho.`);

  // Income entries are not tied to an account in the schema, so nothing to update there.
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
