import type { AnalyzedItem, FoodItem } from './types';

const METRIC = new Set(['g', 'gm', 'gram', 'grams', 'kg', 'ml', 'l', 'litre', 'liter', 'oz']);
const NO_PLURAL = new Set([...METRIC, 'tbsp', 'tsp']);

const isMetric = (unit: string) => METRIC.has(unit.trim().toLowerCase());

/** "1 roti", "2 rotis", "1.5 katoris", "150 g". */
export function unitLabel(unit: string, quantity: number): string {
  const u = unit.trim();
  if (quantity === 1 || NO_PLURAL.has(u.toLowerCase())) return u;
  if (/(sh|ch|x|ss)$/i.test(u)) return `${u}es`;
  return /s$/i.test(u) ? u : `${u}s`;
}

/** Step for the − / + buttons: 10 g for weights and volumes, half a unit otherwise. */
export function stepFor(item: AnalyzedItem): number {
  if (!isMetric(item.unit)) return 0.5;
  return item.quantity >= 200 ? 25 : 10;
}

/** The item at a new quantity, with nutrients scaled in proportion. */
export function scaleItem(item: AnalyzedItem, quantity: number): FoodItem {
  const factor = item.quantity > 0 ? quantity / item.quantity : 1;
  const round = (n: number) => Math.round(n * factor);
  return {
    name: item.name,
    quantity,
    unit: item.unit,
    grams: item.grams == null ? null : round(item.grams),
    kcal: round(item.kcal),
    protein: round(item.protein),
    carbs: round(item.carbs),
    fat: round(item.fat),
  };
}
