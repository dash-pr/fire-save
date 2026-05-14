/**
 * Recompute the ゆうちょ銀行 Account.balanceYen from its transactions
 * (sum credits, subtract debits). The import set this column to 0 on purpose
 * because Yucho was meant to be the manual-entry account, but now that all
 * income credits route through it the balance should reflect cumulative flow.
 */
import { prisma } from "../lib/importHelpers";

const LOCAL_USER_ID = "local-user";
const YUCHO_PATTERN = /yucho|ゆうちょ|japan post/i;

async function main() {
  const yucho = (await prisma.account.findMany({ where: { localUserId: LOCAL_USER_ID } })).find((a) => YUCHO_PATTERN.test(a.name));
  if (!yucho) {
    console.error("Yucho account not found");
    process.exit(1);
  }
  const txs = await prisma.transaction.findMany({ where: { localUserId: LOCAL_USER_ID, accountId: yucho.id } });
  const credits = txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amountYen, 0);
  const debits = txs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amountYen, 0);
  const balance = credits - debits;
  console.log(`Yucho transactions: ${txs.length} (credits ¥${credits.toLocaleString("ja-JP")}, debits ¥${debits.toLocaleString("ja-JP")})`);
  console.log(`Setting ${yucho.name}.balanceYen = ¥${balance.toLocaleString("ja-JP")} (was ¥${yucho.balanceYen.toLocaleString("ja-JP")})`);
  await prisma.account.update({ where: { id: yucho.id }, data: { balanceYen: balance } });
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
