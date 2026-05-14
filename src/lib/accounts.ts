export type AccountDisplay = { primary: string; secondary: string | null };

const ACCOUNT_TRANSLATIONS: Record<string, AccountDisplay> = {
  "三井住友カード": { primary: "SMBC Card", secondary: "三井住友カード" },
  "三井住友カード SMBC": { primary: "SMBC Card", secondary: "三井住友カード" },
  "三井住友カード (SMBC Owners Gold Visa NL)": { primary: "SMBC Owners Gold Visa", secondary: "三井住友カード" },
  "JCBプラチナ": { primary: "JCB Platinum", secondary: "JCBプラチナ" },
  "セゾンゴールド・アメックス": { primary: "Saison Gold Amex", secondary: "セゾンゴールド・アメックス" },
  "Paidy あと払い (Amazon)": { primary: "Paidy Installments · Amazon", secondary: "Paidy あと払い" },
  "Paidy Apple専用 あと払い": { primary: "Paidy · Apple 36-month", secondary: "Paidy Apple専用 あと払い" },
  "Paidy Amazon 分割あと払い (consolidated)": { primary: "Paidy Amazon Installments", secondary: "Paidy 分割あと払い" },
  "PayPayカード": { primary: "PayPay Card", secondary: null },
  "メルカリカード": { primary: "Mercari Card", secondary: "メルカリカード" },
  "楽天カード": { primary: "Rakuten Card", secondary: "楽天カード" },
  "ゆうちょ銀行": { primary: "Japan Post Bank", secondary: "ゆうちょ銀行" },
  "ソニー銀行": { primary: "Sony Bank", secondary: "ソニー銀行" },
};

export function getAccountDisplayNames(accountName: string): AccountDisplay {
  if (accountName in ACCOUNT_TRANSLATIONS) {
    return ACCOUNT_TRANSLATIONS[accountName];
  }
  return { primary: accountName, secondary: null };
}
