/**
 * Backfill credit-card-side transactions from the MoneyForward CSV.
 *
 * The original v2 import used PDF statements as the primary card ledger and
 * only filled in CSV rows where they didn't overlap. PDFs covered through
 * mid-April for most cards but stopped there, so JCB/Saison/Rakuten/Mercari
 * have no late-April or May charges in the DB even though the CSV has them.
 * This script imports every CSV row on a credit-card account that doesn't
 * already exist (matched by date + amount + payee + accountId, with the
 * MoneyForward ID as a secondary key).
 *
 * Idempotent. Settlement-style payees (自払 …, メルペイ wallet, etc.) on
 * non-credit accounts are handled separately by backfill-card-settlements.ts.
 */
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "../lib/importHelpers";

const LOCAL_USER_ID = "local-user";
const CSV_PATH = path.resolve(__dirname, "..", "収入・支出詳細_2026.csv");

const ACCOUNT_NAME_MAP: Record<string, RegExp> = {
  JCB: /JCB/i,
  Saison: /セゾン|saison/i,
  // The CSV writes Saison rows under "セゾンカード" (Japanese), not "Saison" — handle both.
  セゾンカード: /セゾン|saison/i,
  楽天カード: /楽天/,
  メルペイ: /メルカリ|メルペイ/,
  PayPay: /PayPay/i,
  Paidy: /Paidy/i,
  三井住友: /三井住友|smbc/i,
  Yucho: /yucho|ゆうちょ/i,
  ソニー銀行: /ソニー|sony/i,
};

type Row = {
  date: string;
  payee: string;
  amountYen: number;
  accountKey: string;
  type: "debit" | "credit";
  category: string;
  subCategory: string;
  isTransfer: boolean;
  mfId: string;
};

function parseCsv(csv: string): Row[] {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/);
  if (lines.length < 2) return [];
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols.length < 10) continue;
    const dateRaw = cols[1];
    const payee = cols[2];
    const amount = Number(cols[3]);
    const account = cols[4];
    const cat = cols[5];
    const subcat = cols[6];
    const isTransfer = cols[8] === "1";
    const mfId = cols[9];
    if (!Number.isFinite(amount) || amount === 0) continue;
    const date = dateRaw.replace(/\//g, "-");
    out.push({
      date,
      payee,
      amountYen: Math.abs(amount),
      accountKey: account,
      type: amount > 0 ? "credit" : "debit",
      category: cat,
      subCategory: subcat,
      isTransfer,
      mfId,
    });
  }
  return out;
}

async function main() {
  const csv = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csv);
  console.log(`Parsed ${rows.length} CSV rows total.`);

  const accounts = await prisma.account.findMany({ where: { localUserId: LOCAL_USER_ID } });
  const otherCategory = await prisma.category.findFirst({
    where: { localUserId: LOCAL_USER_ID, name: { in: ["その他", "Other", "未分類", "Uncategorized"] } },
  });

  // Only target credit cards — settlements on Yucho/Sony are handled by the other script.
  const cardAccounts = accounts.filter((a) => a.type === "credit");

  // Build a quick existence index for transactions already in the DB.
  const existingTxns = await prisma.transaction.findMany({
    where: { localUserId: LOCAL_USER_ID, accountId: { in: cardAccounts.map((a) => a.id) } },
    select: { date: true, amountYen: true, payee: true, accountId: true, memo: true },
  });
  // Match by (account, date, amount) to absorb the case where the same charge has multiple
  // payee spellings across import sources (e.g. "東京ガス" vs "東京ガス ・1168-418-1016").
  const existingKeys = new Set(existingTxns.map((t) => `${t.accountId}|${t.date.toISOString().slice(0, 10)}|${t.amountYen}`));
  const existingMfIds = new Set(existingTxns.flatMap((t) => {
    const match = t.memo?.match(/MoneyForward ID: ([^|\s]+)/);
    return match ? [match[1].trim()] : [];
  }));

  let created = 0;
  let skipped = 0;
  let unmapped = 0;
  for (const row of rows) {
    const cardAccount = cardAccounts.find((a) => {
      const pattern = ACCOUNT_NAME_MAP[row.accountKey];
      if (!pattern) return false;
      return pattern.test(a.name);
    });
    if (!cardAccount) {
      unmapped += 1;
      continue;
    }
    // Skip transfers / 振替 rows; they're not real charges.
    if (row.isTransfer) { skipped += 1; continue; }

    const key = `${cardAccount.id}|${row.date}|${row.amountYen}`;
    if (existingKeys.has(key) || (row.mfId && existingMfIds.has(row.mfId))) {
      skipped += 1;
      continue;
    }
    try {
      await prisma.transaction.create({
        data: {
          localUserId: LOCAL_USER_ID,
          accountId: cardAccount.id,
          categoryId: otherCategory?.id ?? null,
          date: new Date(`${row.date}T00:00:00.000Z`),
          payee: row.payee,
          memo: row.mfId ? `MoneyForward ID: ${row.mfId}` : null,
          amountYen: row.amountYen,
          type: row.type,
          source: "csv",
        },
      });
      created += 1;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
      if (code === "P2002") {
        skipped += 1;
        continue;
      }
      console.warn(`  ⚠ ${row.date} ${cardAccount.name} ${row.payee}: ${(error as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`Created ${created} card transactions, skipped ${skipped} duplicates/transfers, ${unmapped} unmapped (non-card or unknown account).`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
