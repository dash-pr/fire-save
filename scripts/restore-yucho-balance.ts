/**
 * Restore Yucho's balance to the ¥405,184 we agreed on. Sync-from-transactions
 * over-counts deductions (the card-settlement backfill landed) without the
 * matching Jan/Feb/Mar income deposits, so the derived balance is misleading.
 */
import { prisma } from "../lib/importHelpers";

const LOCAL_USER_ID = "local-user";
const YUCHO_PATTERN = /yucho|ゆうちょ|japan post/i;
const TARGET_BALANCE = 405_184;

async function main() {
  const yucho = (await prisma.account.findMany({ where: { localUserId: LOCAL_USER_ID } })).find((a) => YUCHO_PATTERN.test(a.name));
  if (!yucho) throw new Error("Yucho not found");
  await prisma.account.update({ where: { id: yucho.id }, data: { balanceYen: TARGET_BALANCE } });
  console.log(`Yucho balance reset to ¥${TARGET_BALANCE.toLocaleString()}.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
