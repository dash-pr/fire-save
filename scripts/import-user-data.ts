import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const LOCAL_USER_ID = "local-user";
const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/fire_save?schema=public";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type JsonAccount = {
  id: string;
  name: string;
  type: string;
  balance: number;
  notes?: string;
};

type JsonIncomeEntry = {
  month: string;
  entries: Array<{ sourceName: string; amount: number }>;
};

type JsonRecurringExpense = {
  name: string;
  amount: number;
  categoryName: string;
  billingDay: number;
  notes?: string;
};

type JsonDebt = {
  id: string;
  accountId?: string;
  cardName: string;
  debtType: string;
  outstandingBalance: number;
  monthlyPayment?: number;
  annualInterestRate?: number;
  monthlyInterestRate?: number;
  paymentDueDay?: number;
  description?: string;
  totalInstallments?: number;
  installmentsPaid?: number;
  isActive?: boolean;
  paymentSchedule?: Array<{ month: string; amount: number }>;
};

type JsonTransaction = {
  date: string;
  merchant: string;
  amount: number;
  type: string;
  accountId?: string;
  categoryName?: string;
  source?: string;
  memo?: string;
};

type JsonMerchantRule = {
  pattern: string;
  categoryName: string;
  fuzzyMatch?: boolean;
};

type ImportData = {
  accounts: JsonAccount[];
  incomeEntries: JsonIncomeEntry[];
  recurringExpenses: JsonRecurringExpense[];
  creditDebts: JsonDebt[];
  transactions: JsonTransaction[];
  merchantRules: JsonMerchantRule[];
  paidySchedule?: {
    schedule?: Array<{ month: string; total: number; apple: number; amazon: number }>;
  };
  schemaAdditionsRequired?: string[];
};

type CategoryRecord = { id: string; name: string; groupId: string };

const defaultCategoryNames = [
  "住宅",
  "通信費",
  "光熱費",
  "食料品",
  "外食",
  "食費",
  "交通費",
  "旅行・宿泊",
  "旅行・スキー",
  "健康・医療",
  "映画・エンタメ",
  "趣味・スポーツ",
  "ショッピング",
  "サブスクリプション",
  "事業経費",
  "ローン返済",
  "送金",
  "交際費",
  "日用品",
  "収入",
  "カフェ",
  "その他",
  "未分類",
];

const categoryGroups = [
  { id: "grp-fixed", name: "Fixed Bills", sortOrder: 0 },
  { id: "grp-debt", name: "Debt Payments", sortOrder: 1 },
  { id: "grp-everyday", name: "Everyday Spending", sortOrder: 2 },
  { id: "grp-income", name: "Income", sortOrder: 3 },
  { id: "grp-transfers", name: "Transfers", sortOrder: 4 },
  { id: "grp-goals", name: "Savings Goals", sortOrder: 5 },
  { id: "grp-investments", name: "Investments", sortOrder: 6 },
  { id: "grp-other", name: "Other", sortOrder: 7 },
];

const categoryGroupByName: Record<string, string> = {
  住宅: "Fixed Bills",
  通信費: "Fixed Bills",
  光熱費: "Fixed Bills",
  事業経費: "Fixed Bills",
  ローン返済: "Debt Payments",
  収入: "Income",
  送金: "Transfers",
  食料品: "Everyday Spending",
  外食: "Everyday Spending",
  "外食・バー": "Everyday Spending",
  食費: "Everyday Spending",
  交通費: "Everyday Spending",
  "旅行・宿泊": "Everyday Spending",
  "旅行・スキー": "Everyday Spending",
  旅行: "Everyday Spending",
  健康・医療: "Everyday Spending",
  健康・美容: "Everyday Spending",
  "映画・エンタメ": "Everyday Spending",
  趣味・スポーツ: "Everyday Spending",
  ショッピング: "Everyday Spending",
  サブスクリプション: "Everyday Spending",
  交際費: "Everyday Spending",
  日用品: "Everyday Spending",
  カフェ: "Everyday Spending",
  宿泊: "Everyday Spending",
  税金: "Fixed Bills",
  その他: "Other",
  未分類: "Other",
};

const validTransactionSources = new Set(["manual", "OCR", "CSV", "csv", "pdf_smbc", "pdf_jcb", "pdf_saison", "pdf_paidy", "recurring"]);
const validAccountTypes = new Set(["checking", "savings", "credit", "brokerage"]);
const validDebtTypes = new Set(["revolving", "installment", "lump_sum"]);
const validTransactionTypes = new Set(["debit", "credit"]);

const categoryCache = new Map<string, CategoryRecord>();
const groupIdByName = new Map<string, string>();
const accountIdMap = new Map<string, string>();
let unresolvedCategoryCount = 0;

async function loadImportData(): Promise<ImportData> {
  const filePath = path.join(process.cwd(), "stashy_import.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as ImportData;
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeInterestRate(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const safe = Math.max(0, Number(value));
  return safe > 1 ? safe / 100 : safe;
}

function categoryGroupNameFor(categoryName: string): string {
  return categoryGroupByName[categoryName] ?? "Other";
}

function accountTypeFor(value: string): "checking" | "savings" | "credit" | "brokerage" {
  if (validAccountTypes.has(value)) return value as "checking" | "savings" | "credit" | "brokerage";
  console.warn(`  ⚠ Unknown account type '${value}', defaulting to checking.`);
  return "checking";
}

function debtTypeFor(value: string): "revolving" | "installment" | "lump_sum" {
  if (validDebtTypes.has(value)) return value as "revolving" | "installment" | "lump_sum";
  console.warn(`  ⚠ Unknown debt type '${value}', defaulting to revolving.`);
  return "revolving";
}

function transactionTypeFor(value: string): "debit" | "credit" {
  if (validTransactionTypes.has(value)) return value as "debit" | "credit";
  console.warn(`  ⚠ Unknown transaction type '${value}', defaulting to debit.`);
  return "debit";
}

function transactionSourceFor(value: string | undefined): "manual" | "OCR" | "CSV" | "csv" | "pdf_smbc" | "pdf_jcb" | "pdf_saison" | "pdf_paidy" | "recurring" {
  if (value && validTransactionSources.has(value)) {
    return value as "manual" | "OCR" | "CSV" | "csv" | "pdf_smbc" | "pdf_jcb" | "pdf_saison" | "pdf_paidy" | "recurring";
  }
  console.warn(`  ⚠ Unknown transaction source '${value ?? "missing"}', mapped to manual.`);
  return "manual";
}

function inferRecurringAccountJsonId(expense: JsonRecurringExpense): string | undefined {
  const text = `${expense.name} ${expense.notes ?? ""}`.toLowerCase();
  if (text.includes("smbc") || text.includes("三井住友")) return "acc_smbc";
  if (text.includes("jcb")) return "acc_jcb";
  if (text.includes("セゾン") || text.includes("saison")) return "acc_saison";
  if (text.includes("paidy") && text.includes("apple")) return "acc_paidy_apple";
  if (text.includes("paidy")) return "acc_paidy_amazon";
  if (text.includes("楽天")) return "acc_rakuten";
  if (text.includes("sony") || text.includes("ソニー")) return "acc_sony";
  return "acc_yucho";
}

async function ensureCategoryGroups() {
  console.log("1/7 categories seed check: ensuring category groups and defaults...");
  for (const group of categoryGroups) {
    const saved = await prisma.categoryGroup.upsert({
      where: { localUserId_name: { localUserId: LOCAL_USER_ID, name: group.name } },
      update: { sortOrder: group.sortOrder },
      create: { id: group.id, localUserId: LOCAL_USER_ID, name: group.name, sortOrder: group.sortOrder },
    });
    groupIdByName.set(saved.name, saved.id);
  }
}

async function hydrateCategoryCache() {
  const categories = await prisma.category.findMany({ where: { localUserId: LOCAL_USER_ID } });
  categoryCache.clear();
  for (const category of categories) {
    categoryCache.set(category.name, { id: category.id, name: category.name, groupId: category.groupId });
  }
}

async function getOrCreateCategory(name: string, options: { warnIfMissing?: boolean; groupName?: string; source?: "default" | "custom" | "system" } = {}): Promise<CategoryRecord> {
  const cached = categoryCache.get(name);
  if (cached) return cached;

  if (options.warnIfMissing) {
    unresolvedCategoryCount += 1;
    console.warn(`  ⚠ Category '${name}' did not exist; creating it.`);
  }

  const groupName = options.groupName ?? categoryGroupNameFor(name);
  const groupId = groupIdByName.get(groupName) ?? groupIdByName.get("Other");
  if (!groupId) throw new Error(`Category group '${groupName}' was not initialized.`);

  const created = await prisma.category.upsert({
    where: { localUserId_name: { localUserId: LOCAL_USER_ID, name } },
    update: { groupId, isArchived: false },
    create: {
      localUserId: LOCAL_USER_ID,
      groupId,
      name,
      source: options.source ?? "custom",
      sortOrder: categoryCache.size,
    },
  });
  const record = { id: created.id, name: created.name, groupId: created.groupId };
  categoryCache.set(name, record);
  return record;
}

async function ensureDefaultCategories() {
  const created: string[] = [];
  await hydrateCategoryCache();
  for (const name of defaultCategoryNames) {
    const existed = categoryCache.has(name);
    await getOrCreateCategory(name, { source: "default" });
    if (!existed) created.push(name);
  }
  console.log(created.length > 0 ? `  Created default categories: ${created.join(", ")}` : "  All default categories already existed.");
}

async function importAccounts(accounts: JsonAccount[]) {
  console.log("2/7 accounts: importing accounts...");
  for (const account of accounts) {
    const saved = await prisma.account.upsert({
      where: { localUserId_name: { localUserId: LOCAL_USER_ID, name: account.name } },
      update: {
        type: accountTypeFor(account.type),
        balanceYen: Math.round(account.balance),
        notes: account.notes ?? null,
        isArchived: false,
      },
      create: {
        localUserId: LOCAL_USER_ID,
        name: account.name,
        type: accountTypeFor(account.type),
        balanceYen: Math.round(account.balance),
        notes: account.notes,
      },
    });
    accountIdMap.set(account.id, saved.id);
  }
  console.log(`  Imported ${accounts.length} source accounts.`);
}

async function importIncomeEntries(months: JsonIncomeEntry[]) {
  console.log("3/7 income entries: importing monthly income sources...");
  let imported = 0;
  for (const month of months) {
    for (const entry of month.entries) {
      await prisma.incomeEntry.upsert({
        where: {
          localUserId_month_sourceName_amountYen: {
            localUserId: LOCAL_USER_ID,
            month: month.month,
            sourceName: entry.sourceName,
            amountYen: Math.round(entry.amount),
          },
        },
        update: {},
        create: {
          localUserId: LOCAL_USER_ID,
          month: month.month,
          sourceName: entry.sourceName,
          amountYen: Math.round(entry.amount),
        },
      });
      imported += 1;
    }
  }
  console.log(`  Processed ${imported} income entries.`);
}

async function importRecurringExpenses(expenses: JsonRecurringExpense[]) {
  console.log("4/7 recurring expenses: importing fixed expenses...");
  let imported = 0;
  for (const expense of expenses) {
    const inferredJsonAccountId = inferRecurringAccountJsonId(expense);
    const accountId = inferredJsonAccountId ? accountIdMap.get(inferredJsonAccountId) : undefined;
    if (!accountId) {
      console.warn(`  ⚠ Skipping recurring expense '${expense.name}' because account '${inferredJsonAccountId ?? "unknown"}' could not be resolved.`);
      continue;
    }
    const categoryName = expense.categoryName === "ローン返済" ? expense.name : expense.categoryName;
    const category = await getOrCreateCategory(categoryName, {
      groupName: expense.categoryName === "ローン返済" ? "Debt Payments" : undefined,
      source: expense.categoryName === "ローン返済" ? "system" : "default",
    });

    await prisma.recurringExpense.upsert({
      where: { localUserId_payee: { localUserId: LOCAL_USER_ID, payee: expense.name } },
      update: {
        accountId,
        categoryId: category.id,
        amountYen: Math.round(expense.amount),
        dayOfMonth: expense.billingDay,
        notes: expense.notes ?? null,
        isActive: true,
      },
      create: {
        localUserId: LOCAL_USER_ID,
        accountId,
        categoryId: category.id,
        payee: expense.name,
        amountYen: Math.round(expense.amount),
        dayOfMonth: expense.billingDay,
        notes: expense.notes,
      },
    });
    imported += 1;
  }
  console.log(`  Processed ${imported} recurring expenses.`);
}

function normalizeDebt(raw: JsonDebt): JsonDebt {
  if (raw.id === "debt_paidy_apple" || raw.cardName.includes("Apple専用")) {
    return {
      ...raw,
      totalInstallments: 36,
      installmentsPaid: 16,
      monthlyPayment: 314_600,
      outstandingBalance: 5_978_400,
      annualInterestRate: 0,
      monthlyInterestRate: 0,
    };
  }
  if (raw.id === "debt_paidy_amazon_consolidated" && raw.monthlyPayment === undefined) {
    return { ...raw, monthlyPayment: raw.paymentSchedule?.[0]?.amount ?? 0 };
  }
  return raw;
}

async function importCreditDebts(debts: JsonDebt[]) {
  console.log("5/7 credit debts: importing debt payoff records...");
  let imported = 0;
  for (const rawDebt of debts) {
    const debt = normalizeDebt(rawDebt);
    const accountId = debt.accountId ? accountIdMap.get(debt.accountId) : undefined;
    if (debt.accountId && !accountId) {
      console.warn(`  ⚠ Debt '${debt.cardName}' references unresolved account '${debt.accountId}'.`);
    }
    const debtType = debtTypeFor(debt.debtType);
    const description = debt.description ?? "";
    const categoryName = debt.cardName.includes("Paidy") ? "Paidy あと払い" : `${debt.cardName} 返済`;
    const category = await getOrCreateCategory(categoryName, { groupName: "Debt Payments", source: "system" });
    const annualInterestRate = normalizeInterestRate(debt.annualInterestRate);
    const monthlyInterestRate = normalizeInterestRate(debt.monthlyInterestRate ?? (debt.annualInterestRate ?? 0) / 12);

    const saved = await prisma.creditDebt.upsert({
      where: {
        localUserId_cardName_type_description: {
          localUserId: LOCAL_USER_ID,
          cardName: debt.cardName,
          type: debtType,
          description,
        },
      },
      update: {
        accountId,
        categoryId: category.id,
        currentBalanceYen: Math.round(debt.outstandingBalance),
        monthlyPaymentYen: Math.round(debt.monthlyPayment ?? 0),
        annualInterestRate,
        monthlyInterestRate,
        paymentDueDay: debt.paymentDueDay ?? 1,
        totalInstallments: debt.totalInstallments ?? null,
        installmentsPaid: debt.installmentsPaid ?? null,
        isPaid: debt.isActive === false,
      },
      create: {
        localUserId: LOCAL_USER_ID,
        accountId,
        categoryId: category.id,
        type: debtType,
        cardName: debt.cardName,
        description,
        currentBalanceYen: Math.round(debt.outstandingBalance),
        monthlyPaymentYen: Math.round(debt.monthlyPayment ?? 0),
        annualInterestRate,
        monthlyInterestRate,
        paymentDueDay: debt.paymentDueDay ?? 1,
        totalInstallments: debt.totalInstallments,
        installmentsPaid: debt.installmentsPaid,
        isPaid: debt.isActive === false,
      },
    });
    console.log(`  ${saved.cardName}: outstanding ¥${saved.currentBalanceYen.toLocaleString("ja-JP")}`);
    imported += 1;
  }
  console.log(`  Processed ${imported} credit debts.`);
}

async function importTransactions(transactions: JsonTransaction[]) {
  console.log("6/7 transactions: importing transaction ledger...");
  let imported = 0;
  let skipped = 0;
  for (const transaction of transactions) {
    if (transaction.amount === 0) {
      skipped += 1;
      console.warn(`  ⚠ Skipping zero amount transaction '${transaction.merchant}' on ${transaction.date}.`);
      continue;
    }
    const accountId = transaction.accountId ? accountIdMap.get(transaction.accountId) : undefined;
    if (!accountId) {
      skipped += 1;
      console.warn(`  ⚠ Skipping transaction '${transaction.merchant}' on ${transaction.date}; unresolved account '${transaction.accountId ?? "missing"}'.`);
      continue;
    }
    const category = transaction.categoryName
      ? await getOrCreateCategory(transaction.categoryName, { warnIfMissing: true })
      : await getOrCreateCategory("未分類", { warnIfMissing: true });
    const payee = transaction.merchant.trim();
    const amountYen = Math.round(transaction.amount);
    const date = toDate(transaction.date);

    await prisma.transaction.upsert({
      where: {
        localUserId_date_payee_amountYen_accountId: {
          localUserId: LOCAL_USER_ID,
          date,
          payee,
          amountYen,
          accountId,
        },
      },
      update: {
        categoryId: category.id,
        memo: transaction.memo ?? null,
        type: transactionTypeFor(transaction.type),
        source: transactionSourceFor(transaction.source),
      },
      create: {
        localUserId: LOCAL_USER_ID,
        accountId,
        categoryId: category.id,
        date,
        payee,
        memo: transaction.memo,
        amountYen,
        type: transactionTypeFor(transaction.type),
        source: transactionSourceFor(transaction.source),
      },
    });
    imported += 1;
  }
  console.log(`  Transactions imported/updated: ${imported}; skipped: ${skipped}; unresolved categories created: ${unresolvedCategoryCount}.`);
}

async function importMerchantRules(rules: JsonMerchantRule[]) {
  console.log("7/7 merchant rules: importing categorization rules...");
  let imported = 0;
  let skipped = 0;
  for (const rule of rules) {
    const category = categoryCache.get(rule.categoryName) ?? await prisma.category.findUnique({
      where: { localUserId_name: { localUserId: LOCAL_USER_ID, name: rule.categoryName } },
      select: { id: true, name: true, groupId: true },
    });
    if (!category) {
      skipped += 1;
      console.warn(`  ⚠ Skipping merchant rule '${rule.pattern}' because category '${rule.categoryName}' does not exist.`);
      continue;
    }
    await prisma.merchantRule.upsert({
      where: { localUserId_pattern: { localUserId: LOCAL_USER_ID, pattern: rule.pattern } },
      update: {
        categoryName: rule.categoryName,
        categoryId: category.id,
        fuzzyMatch: rule.fuzzyMatch ?? true,
      },
      create: {
        localUserId: LOCAL_USER_ID,
        pattern: rule.pattern,
        categoryName: rule.categoryName,
        categoryId: category.id,
        fuzzyMatch: rule.fuzzyMatch ?? true,
      },
    });
    imported += 1;
  }
  console.log(`  Merchant rules imported/updated: ${imported}; skipped: ${skipped}.`);
}

async function upsertBudgetAssignment(month: string, categoryId: string, assignedYen: number) {
  await prisma.budget.upsert({
    where: { categoryId_month: { categoryId, month: toDate(`${month}-01`) } },
    update: { assignedYen: Math.round(assignedYen) },
    create: {
      localUserId: LOCAL_USER_ID,
      categoryId,
      month: toDate(`${month}-01`),
      assignedYen: Math.round(assignedYen),
    },
  });
}

async function upsertDebtPaymentBudgets(data: ImportData) {
  console.log("Budget support: auto-populating imported debt payment budget rows...");
  const budgetRows = [
    { name: "SMBC リボ弁済金", amount: 62_548 },
    { name: "JCB リボ弁済金", amount: 57_177 },
    { name: "セゾン リボ弁済金", amount: 60_000 },
    { name: "Paidy あと払い", amount: 30_494 },
  ];
  for (const row of budgetRows) {
    const category = await getOrCreateCategory(row.name, { groupName: "Debt Payments", source: "system" });
    await upsertBudgetAssignment("2026-04", category.id, row.amount);
  }

  const mayPaidy = data.paidySchedule?.schedule?.find((item) => item.month === "2026-05")?.total;
  if (mayPaidy) {
    const category = await getOrCreateCategory("Paidy あと払い", { groupName: "Debt Payments", source: "system" });
    await upsertBudgetAssignment("2026-05", category.id, mayPaidy);
  }
  console.log("  Debt payment budget rows are ready for April 2026.");
}

async function printVerification() {
  console.log("\nVerification checks:");
  const [
    accountsCount,
    transactions,
    debts,
    paidyInstallments,
    incomeEntries,
    recurringCount,
    paidyApple,
  ] = await Promise.all([
    prisma.account.count({ where: { localUserId: LOCAL_USER_ID } }),
    prisma.transaction.findMany({ where: { localUserId: LOCAL_USER_ID }, select: { date: true } }),
    prisma.creditDebt.findMany({ where: { localUserId: LOCAL_USER_ID }, select: { cardName: true, type: true, currentBalanceYen: true, monthlyPaymentYen: true } }),
    prisma.creditDebt.findMany({
      where: { localUserId: LOCAL_USER_ID, type: "installment", cardName: { contains: "Paidy" } },
      select: { monthlyPaymentYen: true },
    }),
    prisma.incomeEntry.findMany({ where: { localUserId: LOCAL_USER_ID }, select: { month: true, amountYen: true } }),
    prisma.recurringExpense.count({ where: { localUserId: LOCAL_USER_ID } }),
    prisma.creditDebt.findFirst({
      where: { localUserId: LOCAL_USER_ID, cardName: { contains: "Apple" } },
      select: { cardName: true, currentBalanceYen: true, monthlyPaymentYen: true, totalInstallments: true, installmentsPaid: true },
    }),
  ]);

  const transactionsPerMonth = new Map<string, number>();
  for (const transaction of transactions) {
    const month = transaction.date.toISOString().slice(0, 7);
    transactionsPerMonth.set(month, (transactionsPerMonth.get(month) ?? 0) + 1);
  }

  const incomePerMonth = new Map<string, { count: number; total: number }>();
  for (const entry of incomeEntries) {
    const previous = incomePerMonth.get(entry.month) ?? { count: 0, total: 0 };
    incomePerMonth.set(entry.month, { count: previous.count + 1, total: previous.total + entry.amountYen });
  }

  const totalDebtOutstanding = debts.reduce((total, debt) => total + debt.currentBalanceYen, 0);
  const paidyMonthlyObligation = paidyInstallments.reduce((total, debt) => total + debt.monthlyPaymentYen, 0);
  const riboTotalOutstanding = debts
    .filter((debt) => debt.type === "revolving" && /SMBC|三井|JCB|セゾン|Saison/i.test(debt.cardName))
    .reduce((total, debt) => total + debt.currentBalanceYen, 0);

  console.log(`  Total accounts: ${accountsCount}`);
  console.log(`  Total transactions: ${transactions.length}`);
  console.log("  Transactions per month:");
  [...transactionsPerMonth.entries()].sort().forEach(([month, count]) => console.log(`    ${month}: ${count}`));
  console.log(`  Total credit debt outstanding: ¥${totalDebtOutstanding.toLocaleString("ja-JP")}`);
  console.log(`  Total Paidy installment monthly obligation: ¥${paidyMonthlyObligation.toLocaleString("ja-JP")}`);
  console.log(`  Ribo total outstanding (SMBC + JCB + Saison): ¥${riboTotalOutstanding.toLocaleString("ja-JP")}`);
  console.log("  Income entries per month:");
  [...incomePerMonth.entries()].sort().forEach(([month, value]) => console.log(`    ${month}: ${value.count} entries, ¥${value.total.toLocaleString("ja-JP")}`));
  console.log(`  Recurring expenses count: ${recurringCount}`);
  if (paidyApple) {
    console.log(`  Paidy Apple verification: ${paidyApple.cardName}, monthly ¥${paidyApple.monthlyPaymentYen.toLocaleString("ja-JP")}, outstanding ¥${paidyApple.currentBalanceYen.toLocaleString("ja-JP")}, ${paidyApple.installmentsPaid}/${paidyApple.totalInstallments} paid.`);
  }
}

async function main() {
  const data = await loadImportData();
  console.log("Starting Stashy real user data import...");
  console.log(`Schema requirements in source: ${(data.schemaAdditionsRequired ?? []).length}`);

  await ensureCategoryGroups();
  await ensureDefaultCategories();
  await importAccounts(data.accounts ?? []);
  await importIncomeEntries(data.incomeEntries ?? []);
  await importRecurringExpenses(data.recurringExpenses ?? []);
  await importCreditDebts(data.creditDebts ?? []);
  await importTransactions(data.transactions ?? []);
  await importMerchantRules(data.merchantRules ?? []);
  await upsertDebtPaymentBudgets(data);
  await printVerification();
  console.log("\nImport complete. Re-running this script is safe and will update existing rows instead of duplicating them.");
}

main()
  .catch((error) => {
    console.error("Import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
