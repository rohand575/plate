import type { Entry, Meal, Nutrients } from './types';

export const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snacks' },
  { value: 'dinner', label: 'Dinner' },
];

export const mealLabel = (meal: Meal) => MEALS.find((m) => m.value === meal)!.label;

/** Best guess at which meal is being logged, from the local time of day. */
export function mealForTime(d: Date = new Date()): Meal {
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes >= 4 * 60 && minutes < 11 * 60) return 'breakfast';
  if (minutes >= 11 * 60 && minutes < 15 * 60 + 30) return 'lunch';
  if (minutes >= 18 * 60 + 30 || minutes < 60) return 'dinner';
  return 'snack';
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      carbs: acc.carbs + n.carbs,
      fat: acc.fat + n.fat,
    }),
    ZERO,
  );
}

export const entriesTotal = (entries: Entry[]) => sumNutrients(entries.map((e) => e.totals));
