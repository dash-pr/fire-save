import { prisma } from "@/lib/prisma";
import { createOpenAIClient, INSIGHTS_MODEL } from "@/lib/openai";
import { getCategoryDisplayName } from "@/lib/categories";
import { moneyForwardMemo, normalizeMoneyForwardText, parseMoneyForwardCsv, type MoneyForwardCsvRecord } from "@/lib/moneyforward";
import type { Account, Category, IncomeEntry, Transaction } from "@/domain/types";

export const dynamic = "force-dynamic";

const LOCAL_USER_ID = "local-user";

type ImportMode = "preview" | "import";

type ImportBody = {
  csvText?: string;
  mode?: ImportMode;
};

type ImportSummary = {
  parsedRows: number;
  importableTransactions: number;
  importedTransactions: number;
  duplicateTransactions: number;
  importableIncomeEntries: number;
  importedIncomeEntries: number;
  duplicateIncomeEntries: number;
  createdAccounts: number;
  createdCategories: number;
  transferRows: number;
  aiCategorizedRows: number;
};

function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateToDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function serializeTransaction(transaction: {
  id: string;
  accountId: string;
  categoryId: string | null;
  date: Date;
  payee: string;
  memo: string | null;
  amountYen: number;
  type: "debit" | "credit";
  source: Transaction["source"];
}): Transaction {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId ?? undefined,
    date: dateToDay(transaction.date),
    payee: transaction.payee,
    memo: transaction.memo ?? undefined,
    amountYen: transaction.amountYen,
    type: transaction.type,
    source: transaction.source,
  };
}

function serializeIncomeEntry(entry: { id: string; month: string; sourceName: string; amountYen: number; createdAt: Date }): IncomeEntry {
  return {
    id: entry.id,
    month: entry.month,
    sourceName: entry.sourceName,
    amountYen: entry.amountYen,
    createdAt: entry.createdAt.toISOString(),
  };
}

function serializeAccount(account: { id: string; name: string; type: Account["type"]; balanceYen: number; creditLimit: number | null; isArchived: boolean }): Account {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balanceYen: account.balanceYen,
    creditLimit: account.creditLimit ?? undefined,
    isArchived: account.isArchived,
  };
}

function serializeCategory(category: { id: string; groupId: string; name: string; source: Category["source"]; isArchived: boolean }): Category {
  return {
    id: category.id,
    groupId: category.groupId,
    name: category.name,
    source: category.source,
    isArchived: category.isArchived,
  };
}

function inferAccountType(accountName: string): Account["type"] {
  return /カード|card|jcb|saison|セゾン|楽天/i.test(accountName) ? "credit" : "checking";
}

function accountAliases(accountName: string): string[] {
  const normalized = normalizeMoneyForwardText(accountName);
  const aliases = new Set([normalized]);
  if (normalized.includes("yucho") || normalized.includes("ゆうちょ")) {
    aliases.add("yucho");
    aliases.add("ゆうちょ");
  }
  if (normalized.includes("jcb")) aliases.add("jcb");
  if (normalized.includes("セゾン") || normalized.includes("saison")) aliases.add("saison");
  if (normalized.includes("楽天")) aliases.add("rakuten");
  if (normalized.includes("三井住友") || normalized.includes("vpass") || normalized.includes("smbc")) aliases.add("smbc");
  if (normalized.includes("ソニー")) aliases.add("sony");
  if (normalized.includes("メルペイ") || normalized.includes("メルカリ") || normalized.includes("mercari")) {
    aliases.add("mercari");
    aliases.add("メルカリ");
  }
  return [...aliases];
}

function findMatchingAccount(accounts: Account[], accountName: string): Account | undefined {
  const aliases = accountAliases(accountName);
  return accounts.find((account) => {
    const normalized = normalizeMoneyForwardText(account.name);
    return aliases.some((alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized));
  });
}

function transactionExactKey(args: { date: string; accountId: string; type: string; amountYen: number; payee: string }): string {
  return [args.date, args.accountId, args.type, args.amountYen, normalizeMoneyForwardText(args.payee)].join("|");
}

function transactionLooseKey(args: { date: string; accountId: string; type: string; amountYen: number }): string {
  return [args.date, args.accountId, args.type, args.amountYen].join("|");
}

function incomeKey(entry: { month: string; sourceName: string; amountYen: number }): string {
  return [entry.month, normalizeMoneyForwardText(entry.sourceName), entry.amountYen].join("|");
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function takeDuplicate(map: Map<string, number>, key: string): boolean {
  const count = map.get(key) ?? 0;
  if (count <= 0) return false;
  map.set(key, count - 1);
  return true;
}

function matchesMerchantRule(payee: string, rule: { pattern: string; fuzzyMatch: boolean }): boolean {
  const merchant = normalizeMoneyForwardText(payee);
  const pattern = normalizeMoneyForwardText(rule.pattern);
  return rule.fuzzyMatch ? merchant.includes(pattern) : merchant === pattern;
}

function chooseCategory(args: {
  record: MoneyForwardCsvRecord;
  categories: Category[];
  merchantRules: { pattern: string; categoryId: string; fuzzyMatch: boolean }[];
  pastCategoryByMerchant: Map<string, string>;
  categoryByName: Map<string, Category>;
  aiCategoryByRecordId: Map<string, string>;
}): Category | undefined {
  const rule = args.merchantRules.find((item) => matchesMerchantRule(args.record.payee, item));
  if (rule) return args.categories.find((category) => category.id === rule.categoryId);

  const pastCategoryId = args.pastCategoryByMerchant.get(normalizeMoneyForwardText(args.record.payee));
  if (pastCategoryId) return args.categories.find((category) => category.id === pastCategoryId);

  const aiCategoryId = args.aiCategoryByRecordId.get(args.record.moneyForwardId);
  if (aiCategoryId) return args.categories.find((category) => category.id === aiCategoryId);

  return args.categoryByName.get(normalizeMoneyForwardText(args.record.minorCategory))
    ?? args.categoryByName.get(normalizeMoneyForwardText(args.record.majorCategory))
    ?? args.categoryByName.get(normalizeMoneyForwardText(getCategoryDisplayName(args.record.majorCategory)));
}

async function suggestCategoriesWithAI(records: MoneyForwardCsvRecord[], categories: Category[]): Promise<Map<string, string>> {
  if (!process.env.OPENAI_API_KEY || records.length === 0) return new Map();
  try {
    const client = createOpenAIClient();
    const categoryOptions = categories.map((category) => ({ id: category.id, name: category.name, displayName: getCategoryDisplayName(category.name) }));
    const rows = records.slice(0, 80).map((record) => ({ id: record.moneyForwardId, payee: record.payee, majorCategory: record.majorCategory, minorCategory: record.minorCategory, note: record.note }));
    const response = await client.chat.completions.create({
      model: INSIGHTS_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON only as {\"matches\":[{\"id\":string,\"categoryId\":string}]}. Choose only categoryId values from the provided category list. Categorize Japanese MoneyForward personal finance rows conservatively." },
        { role: "user", content: JSON.stringify({ categories: categoryOptions, rows }) },
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message.content ?? "{}") as { matches?: { id?: string; categoryId?: string }[] };
    const allowed = new Set(categories.map((category) => category.id));
    return new Map((parsed.matches ?? []).filter((item) => item.id && item.categoryId && allowed.has(item.categoryId)).map((item) => [item.id as string, item.categoryId as string]));
  } catch (error) {
    console.warn("MoneyForward AI categorization skipped.", error);
    return new Map();
  }
}

async function getOrCreateMoneyForwardGroup(dryRun: boolean): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.categoryGroup.findFirst({ where: { localUserId: LOCAL_USER_ID, name: "MoneyForward" } });
  if (existing) return { id: existing.id, created: false };
  if (dryRun) return { id: "preview-moneyforward-group", created: true };
  const group = await prisma.categoryGroup.create({ data: { localUserId: LOCAL_USER_ID, name: "MoneyForward", sortOrder: 90 } });
  return { id: group.id, created: true };
}

export async function POST(request: Request) {
  const body = (await request.json()) as ImportBody;
  if (!body.csvText?.trim()) return Response.json({ error: "csvText is required." }, { status: 400 });
  const mode: ImportMode = body.mode === "import" ? "import" : "preview";
  const dryRun = mode !== "import";

  const parseResult = parseMoneyForwardCsv(body.csvText);
  if (parseResult.records.length === 0) return Response.json({ error: parseResult.errors[0] ?? "No valid MoneyForward rows found.", errors: parseResult.errors }, { status: 400 });

  const [dbAccounts, dbCategories, categoryGroups, merchantRules, dbTransactions, dbIncomeEntries] = await Promise.all([
    prisma.account.findMany({ where: { localUserId: LOCAL_USER_ID } }),
    prisma.category.findMany({ where: { localUserId: LOCAL_USER_ID, isArchived: false } }),
    prisma.categoryGroup.findMany({ where: { localUserId: LOCAL_USER_ID } }),
    prisma.merchantRule.findMany({ where: { localUserId: LOCAL_USER_ID } }),
    prisma.transaction.findMany({ where: { localUserId: LOCAL_USER_ID } }),
    prisma.incomeEntry.findMany({ where: { localUserId: LOCAL_USER_ID } }),
  ]);

  const accounts: Account[] = dbAccounts.map(serializeAccount);
  const categories: Category[] = dbCategories.map(serializeCategory);
  const categoryByName = new Map(categories.flatMap((category) => [
    [normalizeMoneyForwardText(category.name), category] as const,
    [normalizeMoneyForwardText(getCategoryDisplayName(category.name)), category] as const,
  ]));
  const moneyForwardGroup = categoryGroups.find((group) => group.name === "MoneyForward") ? { id: categoryGroups.find((group) => group.name === "MoneyForward")!.id, created: false } : await getOrCreateMoneyForwardGroup(dryRun);
  const createdAccounts: Account[] = [];
  const createdCategories: Category[] = [];
  const importedTransactions: Transaction[] = [];
  const importedIncomeEntries: IncomeEntry[] = [];
  const errors = [...parseResult.errors];

  const exactDuplicates = new Map<string, number>();
  const looseStatementDuplicates = new Map<string, number>();
  const moneyForwardIds = new Set<string>();
  const incomeDuplicates = new Map<string, number>();
  const seenCsvTransactionKeys = new Set<string>();
  const seenCsvIncomeKeys = new Set<string>();

  dbTransactions.forEach((transaction) => {
    const date = dateToDay(transaction.date);
    increment(exactDuplicates, transactionExactKey({ date, accountId: transaction.accountId, type: transaction.type, amountYen: transaction.amountYen, payee: transaction.payee }));
    if (transaction.source.startsWith("pdf_")) {
      increment(looseStatementDuplicates, transactionLooseKey({ date, accountId: transaction.accountId, type: transaction.type, amountYen: transaction.amountYen }));
    }
    const match = transaction.memo?.match(/MoneyForward ID: ([^|]+)/);
    if (match?.[1]) moneyForwardIds.add(match[1].trim());
  });

  dbIncomeEntries.forEach((entry) => increment(incomeDuplicates, incomeKey(entry)));

  const pastCategoryCounts = new Map<string, Map<string, number>>();
  dbTransactions.forEach((transaction) => {
    if (!transaction.categoryId) return;
    const key = normalizeMoneyForwardText(transaction.payee);
    const counts = pastCategoryCounts.get(key) ?? new Map<string, number>();
    increment(counts, transaction.categoryId);
    pastCategoryCounts.set(key, counts);
  });
  const pastCategoryByMerchant = new Map([...pastCategoryCounts.entries()].map(([merchant, counts]) => [merchant, [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]]));

  const aiCandidates = parseResult.records.filter((record) => !record.isIncome && record.majorCategory === "未分類");
  const aiCategoryByRecordId = await suggestCategoriesWithAI(aiCandidates, categories);

  const getOrCreateAccount = async (accountName: string): Promise<Account> => {
    const existing = findMatchingAccount(accounts, accountName);
    if (existing) return existing;
    if (dryRun) {
      const account: Account = { id: `preview-account-${createdAccounts.length + 1}`, name: accountName, type: inferAccountType(accountName), balanceYen: 0 };
      accounts.push(account);
      createdAccounts.push(account);
      return account;
    }
    const account = await prisma.account.create({ data: { localUserId: LOCAL_USER_ID, name: accountName, type: inferAccountType(accountName), balanceYen: 0 } });
    const serialized = serializeAccount(account);
    accounts.push(serialized);
    createdAccounts.push(serialized);
    return serialized;
  };

  const getOrCreateCategory = async (record: MoneyForwardCsvRecord): Promise<Category | undefined> => {
    if (record.isIncome) return undefined;
    const existing = chooseCategory({ record, categories, merchantRules, pastCategoryByMerchant, categoryByName, aiCategoryByRecordId });
    if (existing) return existing;

    const name = record.majorCategory || record.minorCategory || "未分類";
    const normalized = normalizeMoneyForwardText(name);
    if (categoryByName.has(normalized)) return categoryByName.get(normalized);

    if (dryRun) {
      const category: Category = { id: `preview-category-${createdCategories.length + 1}`, groupId: moneyForwardGroup.id, name, source: "custom", isArchived: false };
      categories.push(category);
      categoryByName.set(normalized, category);
      categoryByName.set(normalizeMoneyForwardText(getCategoryDisplayName(name)), category);
      createdCategories.push(category);
      return category;
    }

    const category = await prisma.category.create({ data: { localUserId: LOCAL_USER_ID, groupId: moneyForwardGroup.id, name, source: "custom" } });
    const serialized = serializeCategory(category);
    categories.push(serialized);
    categoryByName.set(normalized, serialized);
    categoryByName.set(normalizeMoneyForwardText(getCategoryDisplayName(name)), serialized);
    createdCategories.push(serialized);
    return serialized;
  };

  let duplicateTransactions = 0;
  let importableTransactions = 0;
  let duplicateIncomeEntries = 0;
  let importableIncomeEntries = 0;

  for (const record of parseResult.records) {
    if (record.isIncome) {
      const sourceName = record.payee;
      const key = incomeKey({ month: record.month, sourceName, amountYen: record.amountYen });
      const csvKey = record.moneyForwardId ? `mf:${record.moneyForwardId}` : key;
      if (seenCsvIncomeKeys.has(csvKey) || seenCsvIncomeKeys.has(key) || takeDuplicate(incomeDuplicates, key)) {
        duplicateIncomeEntries += 1;
        continue;
      }
      seenCsvIncomeKeys.add(csvKey);
      seenCsvIncomeKeys.add(key);
      importableIncomeEntries += 1;
      if (!dryRun) {
        const entry = await prisma.incomeEntry.create({ data: { localUserId: LOCAL_USER_ID, month: record.month, sourceName, amountYen: record.amountYen } });
        importedIncomeEntries.push(serializeIncomeEntry(entry));
      }
      continue;
    }

    const account = await getOrCreateAccount(record.accountName);
    const category = await getOrCreateCategory(record);
    const memo = moneyForwardMemo(record) || null;
    const exactKey = transactionExactKey({ date: record.date, accountId: account.id, type: record.type, amountYen: record.amountYen, payee: record.payee });
    const looseKey = transactionLooseKey({ date: record.date, accountId: account.id, type: record.type, amountYen: record.amountYen });
    const csvKey = record.moneyForwardId ? `mf:${record.moneyForwardId}` : exactKey;

    if (seenCsvTransactionKeys.has(csvKey) || seenCsvTransactionKeys.has(exactKey) || (record.moneyForwardId && moneyForwardIds.has(record.moneyForwardId)) || takeDuplicate(exactDuplicates, exactKey) || takeDuplicate(looseStatementDuplicates, looseKey)) {
      duplicateTransactions += 1;
      continue;
    }

    seenCsvTransactionKeys.add(csvKey);
    seenCsvTransactionKeys.add(exactKey);
    importableTransactions += 1;

    if (!dryRun) {
      try {
        const transaction = await prisma.transaction.create({
          data: {
            localUserId: LOCAL_USER_ID,
            accountId: account.id,
            categoryId: category?.id,
            date: dateToDbDate(record.date),
            payee: record.payee,
            memo,
            amountYen: record.amountYen,
            type: record.type,
            source: "csv",
          },
        });
        importedTransactions.push(serializeTransaction(transaction));
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
        if (code === "P2002") duplicateTransactions += 1;
        else throw error;
      }
    }
  }

  const summary: ImportSummary = {
    parsedRows: parseResult.records.length,
    importableTransactions,
    importedTransactions: importedTransactions.length,
    duplicateTransactions,
    importableIncomeEntries,
    importedIncomeEntries: importedIncomeEntries.length,
    duplicateIncomeEntries,
    createdAccounts: createdAccounts.length,
    createdCategories: createdCategories.length + (moneyForwardGroup.created ? 1 : 0),
    transferRows: parseResult.records.filter((record) => record.isTransfer).length,
    aiCategorizedRows: aiCategoryByRecordId.size,
  };

  return Response.json({
    mode,
    summary,
    errors,
    transactions: importedTransactions,
    incomeEntries: importedIncomeEntries,
    accounts: dryRun ? createdAccounts : createdAccounts,
    categories: dryRun ? createdCategories : createdCategories,
  });
}
