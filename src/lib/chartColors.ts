export const CATEGORY_COLORS = [
  "#4A7CFF",
  "#E5534B",
  "#F5A623",
  "#4CAF82",
  "#9B59B6",
  "#E67E22",
  "#1ABC9C",
  "#E91E8C",
  "#607D8B",
  "#795548",
  "#00BCD4",
  "#8BC34A",
];

export function getCategoryColor(categoryName: string, index?: number): string {
  if (index !== undefined) return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}
