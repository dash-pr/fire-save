/**
 * Backfill MoneyForward "自払" card-settlement debits onto Yucho.
 *
 * The original v2 import deliberately dropped these rows on the grounds that
 * they duplicate the per-charge rows on the credit card itself. That holds for
 * SMBC and Paidy (whose itemized charges came in via PDF imports) but not for
 * JCB / Saison / Rakuten / Mercari, where the card-itself ledger never made it
 * into the DB. Without these rows, the Card Payments view has no actual
 * settlement signal for those four cards.
 *
 * This script reads the MoneyForward CSV, finds every row whose payee starts
 * with 自払 + an account-name keyword, and inserts a Yucho debit transaction
 * if one doesn't already exist (matched by date + amount + payee). Idempotent.
 */
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "../lib/importHelpers";

const LOCAL_USER_ID = "local-user";
const CSV_PATH = path.resolve(__dirname, "..", "収入・支出詳細_2026.csv");
const YUCHO_PATTERN = /yucho|ゆうちょ|japan post/i;

function parseCsv(csv: string): Array<{ date: string; payee: string; amountYen: number; mfId: string }> {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/);
  if (lines.length < 2) return [];
  const out: Array<{ date: string; payee: string; amountYen: number; mfId: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols.length < 10) continue;
    const dateRaw = cols[1];
    const payee = cols[2];
    const amount = Number(cols[3]);
    const account = cols[4];
    const mfId = cols[9];
    if (!payee.startsWith("自払")) continue;
    if (account !== "Yucho") continue;
    if (!Number.isFinite(amount) || amount === 0) continue;
    const date = dateRaw.replace(/\//g, "-");
    out.push({ date, payee, amountYen: Math.abs(amount), mfId });
  }
  return out;
}

async function main() {
  const csv = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csv);
  console.log(`Parsed ${rows.length} 自払 rows from CSV.`);

  const yucho = (await prisma.account.findMany({ where: { localUserId: LOCAL_USER_ID } })).find((a) => YUCHO_PATTERN.test(a.name));
  if (!yucho) throw new Error("Yucho account not found.");

  const otherCategory = await prisma.category.findFirst({
    where: { localUserId: LOCAL_USER_ID, name: { in: ["その他", "Other"] } },
  });

  const existing = await prisma.transaction.findMany({
    where: { localUserId: LOCAL_USER_ID, accountId: yucho.id, payee: { startsWith: "自払" } },
    select: { date: true, amountYen: true, payee: true, memo: true },
  });
  const existingKeys = new Set(existing.map((t) => `${t.date.toISOString().slice(0, 10)}|${t.amountYen}|${t.payee}`));
  const existingMfIds = new Set(existing.flatMap((t) => {
    const match = t.memo?.match(/MoneyForward ID: ([^|\s]+)/);
    return match ? [match[1].trim()] : [];
  }));

  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    const key = `${row.date}|${row.amountYen}|${row.payee}`;
    if (existingKeys.has(key) || (row.mfId && existingMfIds.has(row.mfId))) {
      skipped += 1;
      continue;
    }
    try {
      await prisma.transaction.create({
        data: {
          localUserId: LOCAL_USER_ID,
          accountId: yucho.id,
          categoryId: otherCategory?.id ?? null,
          date: new Date(`${row.date}T00:00:00.000Z`),
          payee: row.payee,
          memo: row.mfId ? `MoneyForward ID: ${row.mfId}` : null,
          amountYen: row.amountYen,
          type: "debit",
          source: "csv",
        },
      });
      created += 1;
      console.log(`  + ${row.date}\t¥${row.amountYen.toLocaleString()}\t${row.payee}`);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
      if (code === "P2002") {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }
  console.log(`\nCreated ${created} transactions, skipped ${skipped} duplicates.`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
