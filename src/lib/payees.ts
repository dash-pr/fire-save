import { getMerchantContextTag } from "./merchants";

/**
 * Translate a Japanese bank/MoneyForward payee string into a display label that an English-only
 * reader can scan. Returns { primary, original }; if no rule matched, primary === original so the
 * caller can render the original verbatim.
 *
 * Order matters: more specific rules first (e.g. SMBC quo card before generic SMBC).
 */
const PAYEE_RULES: Array<{ pattern: RegExp; label: string }> = [
  // Card settlements
  { pattern: /^自払\s*JCB/i,                     label: "JCB Card payment" },
  { pattern: /^自払\s*セゾン/i,                  label: "Saison Card payment" },
  { pattern: /^自払\s*三井住友カード/i,         label: "SMBC Card payment" },
  { pattern: /^自払\s*ミツイスミトモc.*クオ/i, label: "SMBC quo-card payment" },
  { pattern: /^自払\s*PAYPAY/i,                  label: "PayPay Card payment" },
  { pattern: /^自払\s*ラクテン/i,                label: "Rakuten Card payment" },
  { pattern: /^自払\s*DF\.?ペイデイ/i,           label: "Paidy auto-debit" },
  { pattern: /^自払/i,                            label: "Card auto-debit" },

  // Transfers / wire payments
  { pattern: /^振込手数料/i,                     label: "Bank transfer fee" },
  { pattern: /^振込\s*ワイズ/i,                  label: "Wise outbound transfer" },
  { pattern: /^振込\s*カ\)?トラストアドバイザ/i, label: "Trust Advisors (rent transfer)" },
  { pattern: /^振込\s*ピ-?エムシ-?/i,            label: "PMC freelance income" },
  { pattern: /^振込\s*オザワ/i,                  label: "Inbound transfer · Ozawa" },
  { pattern: /^振込\s*タジマ/i,                  label: "Inbound transfer · Tajima" },
  { pattern: /^振込\s*アンズロヴイチ/i,         label: "Inbound transfer · Anzulovich" },
  { pattern: /^送金\s*RIESER/i,                  label: "Wire transfer · Rieser" },

  // Salary
  { pattern: /^給与\s*ロバートウォルターズ/i,   label: "Salary · Robert Walters" },
  { pattern: /^給与/i,                            label: "Salary" },

  // Recurring fixtures
  { pattern: /^家賃\s*カ\)?トラストアドバイザ/i, label: "Rent · Trust Advisors" },
  { pattern: /^家賃/i,                            label: "Rent" },
  { pattern: /^クオカード購入/i,                 label: "QUO card purchase" },
  { pattern: /^チャージ\(?入金\)?/i,             label: "Wallet top-up" },
  { pattern: /^メルペイ\(?清算・返済\)?/i,      label: "Merpay wallet settlement" },
  { pattern: /^メルペイ$/i,                       label: "Merpay wallet top-up" },
  { pattern: /^Paidy\s*あと払い\s*\(Amazon\)/i,  label: "Paidy · Amazon installment" },

  // VISA / point-of-sale prefixes that the user often wants flattened
  { pattern: /^VISA国内利用\s*VS\s*/i,           label: "VISA domestic" },
  { pattern: /^VISA海外利用\s+/i,                label: "VISA international" },

  // Misc
  { pattern: /^料\s*金$/i,                        label: "Bank fee" },
  { pattern: /^水道料金/i,                        label: "Water utility" },
  { pattern: /^電気代/i,                          label: "Electricity bill" },
];

export type PayeeDisplay = {
  /** Translated label if a rule matched, otherwise the original. */
  primary: string;
  /** The raw payee string for tooltip / fallback display. */
  original: string;
};

export function getPayeeDisplayName(payee: string): PayeeDisplay {
  const trimmed = payee.trim();
  for (const { pattern, label } of PAYEE_RULES) {
    if (pattern.test(trimmed)) {
      // For VISA-prefixed rows, append the merchant tail so we don't lose the actual store name.
      if (/^VISA/i.test(trimmed) && trimmed.length > 12) {
        const tail = trimmed.replace(/^VISA国内利用\s*VS\s*/i, "").replace(/^VISA海外利用\s+/i, "").trim();
        if (tail) return { primary: `${label} · ${tail}`, original: trimmed };
      }
      return { primary: label, original: trimmed };
    }
  }
  // If no rule matched but the merchants context tag exists, surface the merchant name verbatim.
  if (getMerchantContextTag(trimmed)) return { primary: trimmed, original: trimmed };
  return { primary: trimmed, original: trimmed };
}

export function isCardSettlementPayee(payee: string): boolean {
  const trimmed = payee.trim();
  return /^自払/i.test(trimmed) || /^メルペイ$/i.test(trimmed) || /^チャージ\(?入金\)?/i.test(trimmed);
}
