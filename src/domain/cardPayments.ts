import type { Account, CreditDebt, Transaction, Yen } from "./types";

/**
 * Maps the raw debit-payee strings that show up on a Yucho/Sony bank statement to the credit-card
 * Account whose monthly balance was settled. The patterns are conservative on purpose — there are
 * many one-off bank-utility rows (振込手数料, 料 金, 振込 ワイズ, etc.) that aren't card settlements
 * and should never get attributed to a card.
 *
 * Regex is matched against the literal payee string after a light normalization (lower-case, no
 * spaces). `cardKey` is the substring we then look for in the matching credit Account's name.
 */
const CARD_PAYMENT_PATTERNS: Array<{ pattern: RegExp; cardKey: string }> = [
  { pattern: /paypay/i,                                          cardKey: "PayPay" },
  // SMBC quo-card line is itemized separately on Yucho — keep this above the generic SMBC match.
  { pattern: /スミトモc.*クオ|スミトモc\(クオ/i,                cardKey: "三井住友" },
  { pattern: /df\.ペイデイ|df\.peidei|paidy.*apple|apple.*paidy/i, cardKey: "Apple" },
  { pattern: /paidy/i,                                            cardKey: "Paidy" },
  { pattern: /jcb/i,                                              cardKey: "JCB" },
  { pattern: /セゾン|saison|amex|アメックス/i,                   cardKey: "セゾン" },
  // メルペイ on a Sony Bank debit row is a wallet top-up that funds the Mercari Card; treat as
  // a Mercari Card settlement so the Card Payments view sees the real money outflow.
  { pattern: /メルカリ|mercari|メルペイ|merpay/i,                cardKey: "メルカリ" },
  // Cover both kanji and katakana spellings of Rakuten — MoneyForward exports use katakana.
  { pattern: /楽天|ラクテン/i,                                    cardKey: "楽天" },
  { pattern: /ミツイスミトモ|smbc|三井住友/i,                    cardKey: "三井住友" },
];

export function matchSettlementToCard(payee: string, cards: Account[]): Account | null {
  const normalized = payee.replace(/\s+/g, "");
  for (const { pattern, cardKey } of CARD_PAYMENT_PATTERNS) {
    if (!pattern.test(normalized)) continue;
    const card = cards.find((c) => c.name.toLowerCase().includes(cardKey.toLowerCase()));
    if (card) return card;
  }
  return null;
}

export type CardSettlement = {
  card: Account;
  amountYen: Yen;
  date: string;
  payee: string;
  transactionId: string;
};

/**
 * Walk every debit transaction on non-credit accounts and attribute it to a credit card if the
 * payee looks like a card settlement. Returns one settlement record per matched transaction so
 * callers can sum / group by month / drill in.
 */
export function extractCardSettlements(args: {
  transactions: Transaction[];
  accounts: Account[];
}): CardSettlement[] {
  const cards = args.accounts.filter((a) => a.type === "credit" && !a.isArchived);
  const fundingAccountIds = new Set(args.accounts.filter((a) => a.type !== "credit").map((a) => a.id));
  const settlements: CardSettlement[] = [];
  for (const transaction of args.transactions) {
    if (transaction.type !== "debit") continue;
    if (!fundingAccountIds.has(transaction.accountId)) continue;
    const card = matchSettlementToCard(transaction.payee, cards);
    if (!card) continue;
    settlements.push({
      card,
      amountYen: transaction.amountYen,
      date: transaction.date,
      payee: transaction.payee,
      transactionId: transaction.id,
    });
  }
  return settlements;
}

export type CardPaymentSummary = {
  card: Account;
  paidThisMonthYen: Yen;
  estimatedInterestYen: Yen;
  scheduledMonthlyYen: Yen;
  isActual: boolean;
  history: Array<{ month: string; amountYen: Yen }>;
};

export function summarizeCardPayments(args: {
  card: Account;
  debts: CreditDebt[];
  settlements: CardSettlement[];
  currentMonth: string;
  monthsBack: number;
}): CardPaymentSummary {
  const cardDebts = args.debts.filter((d) => !d.isPaid && (d.accountId === args.card.id || d.cardName === args.card.name));
  const monthly = cardDebts.reduce((total, d) => total + d.monthlyPaymentYen, 0);
  // Monthly interest is the annual rate / 12 applied to the *current* outstanding balance for
  // each revolving debt. Installments are 0% by definition in this app.
  const interest = cardDebts
    .filter((d) => d.type === "revolving")
    .reduce((total, d) => total + Math.round((d.annualInterestRate * d.currentBalanceYen) / 12), 0);

  const cardSettlements = args.settlements.filter((s) => s.card.id === args.card.id);
  const settlementsByMonth = new Map<string, number>();
  for (const s of cardSettlements) {
    const month = s.date.slice(0, 7);
    settlementsByMonth.set(month, (settlementsByMonth.get(month) ?? 0) + s.amountYen);
  }

  const history = Array.from({ length: args.monthsBack }, (_, index) => {
    const date = new Date(`${args.currentMonth}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - (args.monthsBack - 1 - index));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return { month, amountYen: settlementsByMonth.get(month) ?? 0 };
  });

  const paidThisMonthYen = settlementsByMonth.get(args.currentMonth) ?? 0;
  const isActual = paidThisMonthYen > 0;
  return {
    card: args.card,
    paidThisMonthYen: isActual ? paidThisMonthYen : monthly + interest,
    estimatedInterestYen: interest,
    scheduledMonthlyYen: monthly,
    isActual,
    history,
  };
}

/**
 * The full forward-looking picture for a card's next billing event: new charges in the current
 * cycle, scheduled ribo principal + interest for revolving debts, scheduled installment debits,
 * and the totals everyone wants to see.
 */
export type CardCycleBreakdown = {
  card: Account;
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
  daysUntilDue: number;
  newChargesYen: Yen;
  newCharges: Array<{ payee: string; amountYen: Yen; date: string }>;
  riboPrincipalYen: Yen;
  riboInterestYen: Yen;
  installmentYen: Yen;
  installmentRemaining: number;
  totalDueYen: Yen;
  type: "revolving" | "installment" | "lump_sum" | "paid";
};

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function buildCardCycleBreakdown(args: {
  card: Account;
  debts: CreditDebt[];
  transactions: Transaction[];
  today?: Date;
}): CardCycleBreakdown {
  const today = args.today ?? new Date();
  const cardDebts = args.debts.filter((d) => !d.isPaid && (d.accountId === args.card.id || d.cardName === args.card.name));
  const dueDay = (cardDebts.find((d) => d.paymentDueDay)?.paymentDueDay) ?? 27;

  const due = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (endOfDay(due).getTime() < today.getTime()) due.setMonth(due.getMonth() + 1);
  const cycleEnd = new Date(due);
  cycleEnd.setDate(cycleEnd.getDate() - 16);
  const cycleStart = new Date(cycleEnd);
  cycleStart.setDate(cycleStart.getDate() - 29);
  const daysUntilDue = Math.max(0, Math.ceil((due.getTime() - today.getTime()) / 86_400_000));

  const cycleStartIso = cycleStart.toISOString().slice(0, 10);
  const cycleEndIso = cycleEnd.toISOString().slice(0, 10);
  const cycleCharges = args.transactions
    .filter((t) => t.accountId === args.card.id)
    .filter((t) => t.type === "debit")
    .filter((t) => t.source !== "recurring")
    .filter((t) => t.date >= cycleStartIso && t.date <= cycleEndIso);

  const revolving = cardDebts.filter((d) => d.type === "revolving");
  const installments = cardDebts.filter((d) => d.type === "installment");

  const riboPrincipal = revolving.reduce((s, d) => s + d.monthlyPaymentYen, 0);
  const riboInterest = revolving.reduce((s, d) => s + Math.round((d.annualInterestRate * d.currentBalanceYen) / 12), 0);
  const installmentYen = installments.reduce((s, d) => s + d.monthlyPaymentYen, 0);
  const installmentRemaining = installments.reduce((s, d) => s + Math.max(0, (d.totalInstallments ?? 0) - (d.installmentsPaid ?? 0)), 0);
  const newChargesYen = cycleCharges.reduce((s, t) => s + t.amountYen, 0);

  const cardType: CardCycleBreakdown["type"] = revolving.length > 0
    ? "revolving"
    : installments.length > 0
      ? "installment"
      : args.card.balanceYen < 0
        ? "lump_sum"
        : "paid";

  return {
    card: args.card,
    cycleStart: cycleStartIso,
    cycleEnd: cycleEndIso,
    dueDate: due.toISOString().slice(0, 10),
    daysUntilDue,
    newChargesYen,
    newCharges: cycleCharges
      .map((t) => ({ payee: t.payee, amountYen: t.amountYen, date: t.date }))
      .sort((a, b) => b.amountYen - a.amountYen),
    riboPrincipalYen: riboPrincipal,
    riboInterestYen: riboInterest,
    installmentYen,
    installmentRemaining,
    totalDueYen: newChargesYen + riboPrincipal + riboInterest + installmentYen,
    type: cardType,
  };
}
