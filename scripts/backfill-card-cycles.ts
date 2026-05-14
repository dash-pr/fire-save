/**
 * Set the per-card billing cycle days on each CreditDebt that backs a known card.
 * cycleStartDay  = day-of-month the cycle opens (in the prior calendar month).
 * cycleEndDay    = day-of-month the cycle closes.
 *
 * Examples used:
 *   Saison: 11 → 10 (debited on the 4th of the next-next month)
 *   SMBC: 1 → 31 (full prior calendar month, debited on the 26th)
 *   JCB: 16 → 15 (debited on the 10th)
 *   Paidy / Paidy Apple: 1 → 31 (debited on the 27th)
 *   Mercari: not auto-debited; left null so the heuristic still kicks in for forward-looking views.
 */
import { prisma } from "../lib/importHelpers";

const LOCAL_USER_ID = "local-user";

const CYCLE_BY_PATTERN: Array<{ match: RegExp; start: number; end: number }> = [
  { match: /セゾン|saison/i,                start: 11, end: 10 },
  { match: /三井住友|smbc/i,                start: 1,  end: 31 },
  { match: /jcb/i,                          start: 16, end: 15 },
  { match: /paidy/i,                        start: 1,  end: 31 },
  { match: /paypay/i,                       start: 16, end: 15 }, // PayPay closes on the 15th, debited 27th
  { match: /楽天/,                          start: 1,  end: 31 }, // Rakuten closes end of month, debited 27th
];

async function main() {
  const debts = await prisma.creditDebt.findMany({ where: { localUserId: LOCAL_USER_ID } });
  let updated = 0;
  for (const debt of debts) {
    const rule = CYCLE_BY_PATTERN.find((r) => r.match.test(debt.cardName));
    if (!rule) continue;
    if (debt.cycleStartDay === rule.start && debt.cycleEndDay === rule.end) continue;
    await prisma.creditDebt.update({
      where: { id: debt.id },
      data: { cycleStartDay: rule.start, cycleEndDay: rule.end },
    });
    console.log(`  ${debt.cardName}: cycle ${rule.start} → ${rule.end}`);
    updated += 1;
  }
  console.log(`\nUpdated ${updated} debt records.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
