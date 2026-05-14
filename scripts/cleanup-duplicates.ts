/**
 * One-shot cleanup for the duplicates introduced by the May reimport:
 *   1. Merge English-named category duplicates into their Japanese originals.
 *   2. Drop CSV transaction duplicates (same date + account + amount) keeping the
 *      earliest-created row, which is the one categorised by the merchant rule.
 *
 * Safe to re-run.
 */
import { prisma } from "../lib/importHelpers";
import { CATEGORY_TRANSLATIONS } from "../src/lib/categories";

const LOCAL_USER_ID = "local-user";

async function mergeDuplicateCategories() {
  const cats = await prisma.category.findMany({
    where: { localUserId: LOCAL_USER_ID, isArchived: false },
  });
  const byJapanese = new Map<string, typeof cats[number]>();
  cats.forEach((c) => {
    if (CATEGORY_TRANSLATIONS[c.name]) byJapanese.set(c.name, c);
  });

  const englishToJapanese = new Map<string, string>();
  cats.forEach((c) => {
    // Find the Japanese category whose translation equals this category's name.
    const japaneseEntry = Object.entries(CATEGORY_TRANSLATIONS).find(([, en]) => en === c.name);
    if (!japaneseEntry) return;
    const japanese = byJapanese.get(japaneseEntry[0]);
    if (!japanese || japanese.id === c.id) return;
    englishToJapanese.set(c.id, japanese.id);
  });

  console.log(`Merging ${englishToJapanese.size} duplicate categories...`);
  for (const [from, to] of englishToJapanese) {
    const moved = await prisma.transaction.updateMany({
      where: { localUserId: LOCAL_USER_ID, categoryId: from },
      data: { categoryId: to },
    });
    const budgets = await prisma.budget.deleteMany({ where: { localUserId: LOCAL_USER_ID, categoryId: from } });
    const recurring = await prisma.recurringExpense.updateMany({
      where: { localUserId: LOCAL_USER_ID, categoryId: from },
      data: { categoryId: to },
    });
    const rules = await prisma.merchantRule.deleteMany({ where: { localUserId: LOCAL_USER_ID, categoryId: from } });
    await prisma.category.delete({ where: { id: from } });
    console.log(`  ${from} → ${to}  (txns ${moved.count}, budgets ${budgets.count}, recurring ${recurring.count}, rules ${rules.count})`);
  }
}

async function dedupeCsvTransactions() {
  const groups = await prisma.$queryRaw<Array<{ date: Date; accountId: string; amountYen: number; count: bigint }>>`
    SELECT "date", "accountId", "amountYen", COUNT(*) AS count
    FROM "Transaction"
    WHERE "localUserId" = ${LOCAL_USER_ID}
    GROUP BY "date", "accountId", "amountYen"
    HAVING COUNT(*) > 1
    ORDER BY "date" ASC
  `;
  console.log(`\nFound ${groups.length} duplicate transaction groups`);

  let deleted = 0;
  for (const group of groups) {
    const rows = await prisma.transaction.findMany({
      where: {
        localUserId: LOCAL_USER_ID,
        date: group.date,
        accountId: group.accountId,
        amountYen: group.amountYen,
      },
      orderBy: { createdAt: "asc" },
      include: { account: { select: { name: true } } },
    });

    // Heuristic: prefer card settlement rows (自払 …) when they exist on a non-credit account —
    // those represent the bank debit and are what the Card Payments view depends on. Otherwise
    // keep the row whose payee doesn't look like a raw MoneyForward prefix.
    const isCardAccount = rows[0].account?.name && /(カード|Card|JCB|セゾン|楽天|Paidy|PayPay|メルカリ|三井住友|smbc)/i.test(rows[0].account.name);
    const SETTLEMENT = /^(自払|メルペイ$|チャージ\(?入金\)?)/;
    const RAW_PREFIXES = /^(VISA国内利用|VISA海外利用|自払|振込|家賃|料 金)/;
    let keeper = rows[0];
    if (!isCardAccount) {
      const settlement = rows.find((r) => SETTLEMENT.test(r.payee));
      if (settlement) keeper = settlement;
    }
    if (keeper === rows[0]) {
      const cleaner = rows.find((r) => !RAW_PREFIXES.test(r.payee));
      if (cleaner) keeper = cleaner;
    }

    for (const row of rows) {
      if (row.id === keeper.id) continue;
      await prisma.transaction.delete({ where: { id: row.id } });
      deleted += 1;
      console.log(
        `  ${row.date.toISOString().slice(0, 10)} ${row.account?.name} ¥${row.amountYen.toLocaleString("ja-JP")}  delete "${row.payee}"  keep "${keeper.payee}"`,
      );
    }
  }
  console.log(`Deleted ${deleted} duplicate transactions.`);
}

async function main() {
  await mergeDuplicateCategories();
  await dedupeCsvTransactions();
  await prisma.$disconnect();
  console.log("\nCleanup complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
