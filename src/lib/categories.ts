export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  // Housing & utilities
  "住宅": "Housing",
  "光熱費": "Utilities",
  "水道・光熱費": "Utilities",

  // Food
  "食料品": "Groceries",
  "食費": "Food",
  "外食": "Dining Out",
  "外食・バー": "Bars & Dining",
  "カフェ": "Cafés",

  // Transport
  "交通費": "Transport",

  // Travel
  "旅行": "Travel",
  "旅行・宿泊": "Travel & Hotels",
  "宿泊": "Hotels",
  "旅行・スキー": "Ski & Travel",

  // Health
  "健康・医療": "Health & Medical",
  "健康・美容": "Health & Beauty",

  // Entertainment
  "映画・エンタメ": "Entertainment",
  "趣味・娯楽": "Hobbies",
  "趣味・スポーツ": "Sports & Hobbies",

  // Shopping
  "ショッピング": "Shopping",
  "日用品": "Household",

  // Communications & subscriptions
  "通信費": "Communications",
  "サブスクリプション": "Subscriptions",

  // Work & finance
  "事業経費": "Business Expenses",
  "ローン返済": "Loan Repayments",
  "税金": "Taxes",
  "収入": "Income",
  "送金": "Transfers",

  // Social
  "交際費": "Social & Gifts",

  // Misc
  "その他": "Other",
  "未分類": "Uncategorized",
  "特別な支出": "One-off Expenses",
  "現金・カード": "Cash & Card",
};

export function getCategoryDisplayName(japaneseName: string): string {
  return CATEGORY_TRANSLATIONS[japaneseName] ?? japaneseName;
}

export function hasCategoryTranslation(japaneseName: string): boolean {
  return japaneseName in CATEGORY_TRANSLATIONS;
}
