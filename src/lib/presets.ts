import type { DateKey, Entry, Favourite, Meal, MealPreset } from './types';

/** Recent meals and favourites are told apart by name, ignoring case and spacing. */
export const mealKey = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

/** A meal from the log, with the amounts it was last logged with. */
export interface RecentMeal extends MealPreset {
  lastDate: DateKey;
  lastLoggedAt: number;
  /** How many of the recent entries were this meal. */
  times: number;
}

/** Just the parts of a meal needed to log it again. */
export function toPreset({ title, items, totals, source, meal }: MealPreset): MealPreset {
  return { title, items, totals, source, meal };
}

/** Each distinct meal in `entries`, most recently logged first. */
export function recentMeals(entries: Entry[]): RecentMeal[] {
  const byKey = new Map<string, RecentMeal>();
  for (const entry of [...entries].sort((a, b) => b.loggedAt - a.loggedAt)) {
    const key = mealKey(entry.title);
    const seen = byKey.get(key);
    if (seen) seen.times += 1;
    else byKey.set(key, { ...toPreset(entry), lastDate: entry.date, lastLoggedAt: entry.loggedAt, times: 1 });
  }
  return [...byKey.values()];
}

/** Recent meals that aren't favourites. */
export function unstarred(recents: RecentMeal[], favourites: Favourite[]): RecentMeal[] {
  const starred = new Set(favourites.map((f) => mealKey(f.title)));
  return recents.filter((r) => !starred.has(mealKey(r.title)));
}

const FILLER = new Set(['and', 'with', 'the', 'some', 'plus', 'had', 'ate']);

/** Lower case and singular, without numbers or filler like "and" and "with". */
function searchWords(search: string): string[] {
  return search
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !FILLER.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/** Meals whose name or foods mention every word of the search; none for an empty search. */
export function matchMeals<T extends MealPreset>(meals: T[], search: string): T[] {
  const words = searchWords(search);
  if (words.length === 0) return [];
  return meals.filter((meal) => {
    const text = [meal.title, ...meal.items.map((i) => i.name)].join(' ').toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/**
 * Meals offered for one-tap logging on Today: favourites first, then other recent meals,
 * each led by the ones last had at this time of day.
 */
export function quickPicks(favourites: Favourite[], recents: RecentMeal[], meal: Meal, max: number): MealPreset[] {
  const recent = new Map(recents.map((r) => [mealKey(r.title), r]));
  const usual = (p: MealPreset) => ((recent.get(mealKey(p.title))?.meal ?? p.meal) === meal ? 0 : 1);
  const lastUsed = (f: Favourite) => recent.get(mealKey(f.title))?.lastLoggedAt ?? f.savedAt;
  const favs = [...favourites].sort((a, b) => usual(a) - usual(b) || lastUsed(b) - lastUsed(a));
  const others = unstarred(recents, favourites).sort(
    (a, b) => usual(a) - usual(b) || b.times - a.times || b.lastLoggedAt - a.lastLoggedAt,
  );
  return [...favs, ...others].slice(0, max);
}
