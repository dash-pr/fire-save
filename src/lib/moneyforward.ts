export type MoneyForwardCsvRecord = {
  calculationTarget: boolean;
  date: string;
  month: string;
  payee: string;
  signedAmountYen: number;
  amountYen: number;
  type: "debit" | "credit";
  accountName: string;
  majorCategory: string;
  minorCategory: string;
  note: string;
  isTransfer: boolean;
  moneyForwardId: string;
  isIncome: boolean;
};

export type MoneyForwardParseResult = {
  records: MoneyForwardCsvRecord[];
  errors: string[];
};

const requiredHeaders = ["計算対象", "日付", "内容", "金額（円）", "保有金融機関", "大項目", "中項目", "メモ", "振替", "ID"] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function parseDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseAmount(value: string): number | null {
  const normalized = value.replace(/[¥￥,\s]/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

export function normalizeMoneyForwardText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s\-‐‑‒–—―_.,/\\()（）\[\]【】「」『』・:：]/g, "")
    .trim();
}

export function parseMoneyForwardCsv(csvText: string): MoneyForwardParseResult {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const errors: string[] = [];
  if (rows.length === 0) return { records: [], errors: ["CSV file is empty."] };

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const missing = requiredHeaders.filter((header) => !headerIndex.has(header));
  if (missing.length > 0) {
    return { records: [], errors: [`Missing MoneyForward columns: ${missing.join(", ")}.`] };
  }

  const get = (row: string[], header: (typeof requiredHeaders)[number]) => row[headerIndex.get(header) ?? -1]?.trim() ?? "";
  const records: MoneyForwardCsvRecord[] = [];

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const date = parseDate(get(row, "日付"));
    const signedAmountYen = parseAmount(get(row, "金額（円）"));
    const payee = get(row, "内容");
    const accountName = get(row, "保有金融機関") || "MoneyForward";
    const majorCategory = get(row, "大項目") || "未分類";
    const minorCategory = get(row, "中項目");
    const note = get(row, "メモ");
    const moneyForwardId = get(row, "ID");

    if (!date) {
      errors.push(`Row ${rowNumber}: invalid date.`);
      return;
    }
    if (signedAmountYen === null) {
      errors.push(`Row ${rowNumber}: invalid amount.`);
      return;
    }
    if (!payee) {
      errors.push(`Row ${rowNumber}: missing payee/content.`);
      return;
    }

    records.push({
      calculationTarget: get(row, "計算対象") !== "0",
      date,
      month: date.slice(0, 7),
      payee,
      signedAmountYen,
      amountYen: Math.abs(signedAmountYen),
      type: signedAmountYen >= 0 ? "credit" : "debit",
      accountName,
      majorCategory,
      minorCategory,
      note,
      isTransfer: get(row, "振替") === "1",
      moneyForwardId,
      isIncome: majorCategory === "収入" && signedAmountYen > 0,
    });
  });

  return { records, errors };
}

export function moneyForwardMemo(record: MoneyForwardCsvRecord): string {
  const parts = [
    record.minorCategory ? `MF subcategory: ${record.minorCategory}` : null,
    record.note ? `Note: ${record.note}` : null,
    record.isTransfer ? "MoneyForward transfer" : null,
    !record.calculationTarget ? "MoneyForward calculation target: off" : null,
    record.moneyForwardId ? `MoneyForward ID: ${record.moneyForwardId}` : null,
  ];
  return parts.filter(Boolean).join(" | ");
}
