import type { Account, CreditDebt, Transaction, Yen } from "./types";

/**
 * Maps the raw debit-payee strings that show up on a Yucho/Sony bank statement to the credit-card
 * Account whose monthly balance was settled. The patterns are conservative on purpose — there are
 * many one-off bank-utility rows (振込手数料, 料 金, 振込 ワイズ, etc.) that aren't card settlements
 * and should never get attributed to a card.
 *
 * Some payees clear multiple cards at once. For example "自払 DF.ペイデイ" is a single bank debit
 * that covers both Paidy Apple (¥8,739/mo) AND Paidy Amazon installments — we need to split that
 * one transaction across both cards. `splitGroupKey` identifies a group whose pattern matches go
 * to *all* cards in the group, in proportion to the cards' monthly debt schedules.
 */
type CardPaymentRule =
  | { pattern: RegExp; mode: "single"; cardKey: string }
  | { pattern: RegExp; mode: "split"; splitGroupKey: "paidy" };

const CARD_PAYMENT_PATTERNS: CardPaymentRule[] = [
  { pattern: /paypay/i,                                          mode: "single", cardKey: "PayPay" },
  { pattern: /スミトモc.*クオ|スミトモc\(クオ/i,                mode: "single", cardKey: "三井住友" },
  // Paidy auto-debit clears both Apple and Amazon Paidy in one bank line.
  { pattern: /df\.ペイデイ|df\.peidei/i,                          mode: "split",  splitGroupKey: "paidy" },
  { pattern: /paidy.*apple|apple.*paidy/i,                        mode: "single", cardKey: "Apple" },
  { pattern: /paidy/i,                                            mode: "single", cardKey: "Paidy" },
  { pattern: /jcb/i,                                              mode: "single", cardKey: "JCB" },
  { pattern: /セゾン|saison|amex|アメックス/i,                   mode: "single", cardKey: "セゾン" },
  // メルペイ on a non-credit account is a wallet top-up that funds the Mercari Card.
  { pattern: /メルカリ|mercari|メルペイ|merpay/i,                mode: "single", cardKey: "メルカリ" },
  { pattern: /楽天|ラクテン/i,                                    mode: "single", cardKey: "楽天" },
  { pattern: /ミツイスミトモ|smbc|三井住友/i,                    mode: "single", cardKey: "三井住友" },
];

const SPLIT_GROUP_NAME_KEYS: Record<"paidy", string[]> = {
  paidy: ["Apple", "Amazon", "Paidy"],
};

function findRuleForPayee(payee: string): CardPaymentRule | null {
  const normalized = payee.replace(/\s+/g, "");
  return CARD_PAYMENT_PATTERNS.find((r) => r.pattern.test(normalized)) ?? null;
}

function findCardByKey(cards: Account[], key: string): Account | null {
  return cards.find((c) => c.name.toLowerCase().includes(key.toLowerCase())) ?? null;
}

export function matchSettlementToCard(payee: string, cards: Account[]): Account | null {
  const rule = findRuleForPayee(payee);
  if (!rule) return null;
  if (rule.mode === "single") return findCardByKey(cards, rule.cardKey);
  // For split rules with no debt context we just return the first matching card; the proper
  // split happens in extractCardSettlements where the per-card debt schedule is available.
  for (const key of SPLIT_GROUP_NAME_KEYS[rule.splitGroupKey]) {
    const card = findCardByKey(cards, key);
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
  /** True when this row was synthesized from splitting a multi-card settlement. */
  isSplit: boolean;
};

/**
 * Walk every debit transaction on non-credit accounts and attribute it to a credit card if the
 * payee looks like a card settlement. For split-group rules (Paidy Apple + Amazon under one
 * bank line) the single transaction is fanned out into one CardSettlement per card, weighted
 * by the cards' monthly debt schedules. The synthesized rows share the source transactionId.
 */
export function extractCardSettlements(args: {
  transactions: Transaction[];
  accounts: Account[];
  debts: CreditDebt[];
}): CardSettlement[] {
  const cards = args.accounts.filter((a) => a.type === "credit" && !a.isArchived);
  const fundingAccountIds = new Set(args.accounts.filter((a) => a.type !== "credit").map((a) => a.id));
  const monthlyByCardId = new Map<string, number>();
  for (const card of cards) {
    const cardDebts = args.debts.filter((d) => !d.isPaid && (d.accountId === card.id || d.cardName === card.name));
    monthlyByCardId.set(card.id, cardDebts.reduce((s, d) => s + d.monthlyPaymentYen, 0));
  }
  const settlements: CardSettlement[] = [];
  for (const transaction of args.transactions) {
    if (transaction.type !== "debit") continue;
    if (!fundingAccountIds.has(transaction.accountId)) continue;
    const rule = findRuleForPayee(transaction.payee);
    if (!rule) continue;
    if (rule.mode === "single") {
      const card = findCardByKey(cards, rule.cardKey);
      if (!card) continue;
      settlements.push({
        card,
        amountYen: transaction.amountYen,
        date: transaction.date,
        payee: transaction.payee,
        transactionId: transaction.id,
        isSplit: false,
      });
      continue;
    }

    // split mode — find every card whose name matches one of the split group keys and weight by
    // monthly schedule. If only one card matches (or all weights are zero) fall back to the first.
    const groupKeys = SPLIT_GROUP_NAME_KEYS[rule.splitGroupKey];
    const matches = cards.filter((card) => groupKeys.some((k) => card.name.toLowerCase().includes(k.toLowerCase())));
    if (matches.length === 0) continue;
    const weights = matches.map((card) => monthlyByCardId.get(card.id) ?? 0);
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (matches.length === 1 || totalWeight === 0) {
      settlements.push({
        card: matches[0],
        amountYen: transaction.amountYen,
        date: transaction.date,
        payee: transaction.payee,
        transactionId: transaction.id,
        isSplit: matches.length > 1,
      });
      continue;
    }
    // Distribute proportionally; absorb rounding into the largest share.
    let allocated = 0;
    const shares = matches.map((card, index) => {
      const isLast = index === matches.length - 1;
      const share = isLast ? transaction.amountYen - allocated : Math.round((weights[index] / totalWeight) * transaction.amountYen);
      allocated += share;
      return { card, share };
    });
    for (const { card, share } of shares) {
      if (share === 0) continue;
      settlements.push({
        card,
        amountYen: share,
        date: transaction.date,
        payee: transaction.payee,
        transactionId: transaction.id,
        isSplit: true,
      });
    }
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

/**
 * Format a Date in local time as YYYY-MM-DD. Avoids the off-by-one shift that toISOString()
 * causes for any timezone east of UTC: a Date constructed via `new Date(2026, 4, 10)` is May 10
 * 00:00 local, which serializes to "2026-05-09" in UTC. The Transaction.date strings stored in
 * the DB are local-day strings (no time component), so the cycle window has to compare in local.
 */
/**
 * Construct a local-time Date and clamp the day to the last valid day of the target month so
 * "Feb 30" doesn't overflow into March 2. `cycleStartDay = 31` on a February cycle becomes
 * Feb 28/29; on April it becomes April 30. Mirrors how cards actually close their cycles.
 */
function makeDateClamped(year: number, month: number, day: number): Date {
  // new Date(year, month + 1, 0) returns the last day of `month`.
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Compute the next billing cycle for a card given its scheduled debt rows. Honours per-debt
 * cycleStartDay/cycleEndDay when present; otherwise falls back to a ~26-day window ending a week
 * before the due date. Local time only — see toLocalIsoDate for why.
 */
export function getCardCycleWindow(args: { debts: CreditDebt[]; today?: Date }): { start: Date; end: Date; due: Date } {
  const today = args.today ?? new Date();
  const dueDay = (args.debts.find((d) => d.paymentDueDay)?.paymentDueDay) ?? 27;
  const cycleStartDay = args.debts.find((d) => d.cycleStartDay !== undefined && d.cycleStartDay !== null)?.cycleStartDay;
  const cycleEndDay = args.debts.find((d) => d.cycleEndDay !== undefined && d.cycleEndDay !== null)?.cycleEndDay;

  const due = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (endOfDay(due).getTime() < today.getTime()) due.setMonth(due.getMonth() + 1);

  // Prefer the per-card window (e.g. Saison 11→10, SMBC 1→last day of prev month). The cycle
  // closes inside the *prior* calendar month relative to the due date. Use makeDateClamped()
  // instead of letting `new Date(year, month, day)` overflow — overflow turns "April 31" into
  // May 1 and collapses the whole window to a single day.
  let start: Date;
  let end: Date;
  if (cycleStartDay !== undefined && cycleEndDay !== undefined) {
    const tentativeEnd = makeDateClamped(due.getFullYear(), due.getMonth(), cycleEndDay);
    end = tentativeEnd.getTime() >= due.getTime()
      ? makeDateClamped(due.getFullYear(), due.getMonth() - 1, cycleEndDay)
      : tentativeEnd;
    const sameMonthStart = makeDateClamped(end.getFullYear(), end.getMonth(), cycleStartDay);
    start = sameMonthStart.getTime() <= end.getTime()
      ? sameMonthStart
      : makeDateClamped(end.getFullYear(), end.getMonth() - 1, cycleStartDay);
  } else {
    end = new Date(due);
    end.setDate(end.getDate() - 7);
    start = new Date(end);
    start.setDate(start.getDate() - 25);
  }
  return { start, end, due };
}

export function buildCardCycleBreakdown(args: {
  card: Account;
  debts: CreditDebt[];
  transactions: Transaction[];
  today?: Date;
}): CardCycleBreakdown {
  const today = args.today ?? new Date();
  const cardDebts = args.debts.filter((d) => !d.isPaid && (d.accountId === args.card.id || d.cardName === args.card.name));
  const { start: cycleStart, end: cycleEnd, due } = getCardCycleWindow({ debts: cardDebts, today });
  const daysUntilDue = Math.max(0, Math.ceil((due.getTime() - today.getTime()) / 86_400_000));

  const cycleStartIso = toLocalIsoDate(cycleStart);
  const cycleEndIso = toLocalIsoDate(cycleEnd);
  // Charges that have been "converted to ribo" no longer count toward this cycle — their amount
  // moved into the card's revolving balance, which is reflected via riboPrincipal.
  const cycleCharges = args.transactions
    .filter((t) => t.accountId === args.card.id)
    .filter((t) => t.type === "debit")
    .filter((t) => t.source !== "recurring")
    .filter((t) => !t.convertedToRiboAt)
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
    dueDate: toLocalIsoDate(due),
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
