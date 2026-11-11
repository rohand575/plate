import { describe, expect, it } from 'vitest';
import { matchMeals, quickPicks, recentMeals } from './presets';
import type { Entry, Favourite, FoodItem, Meal } from './types';

const item = (name: string, kcal: number): FoodItem => ({ name, quantity: 1, unit: 'serving', grams: null, kcal, protein: 0, carbs: 0, fat: 0 });

let nextId = 0;
function entry(title: string, kcal: number, loggedAt: number, meal: Meal = 'lunch', date = '2026-11-10'): Entry {
  return {
    id: String(++nextId),
    date,
    meal,
    title,
    source: 'text',
    items: [item(title, kcal)],
    totals: { kcal, protein: 0, carbs: 0, fat: 0 },
    transcript: null,
    loggedAt,
  };
}

function favourite(title: string, savedAt: number, meal: Meal = 'lunch'): Favourite {
  const { items, totals, source } = entry(title, 100, savedAt);
  return { id: `f-${title}`, title, items, totals, source, meal, savedAt };
}

describe('recentMeals', () => {
  it('merges meals with the same name and keeps the latest amounts', () => {
    const recents = recentMeals([entry('Poha', 250, 1), entry('Dal rice', 500, 2), entry(' poha ', 300, 3, 'breakfast', '2026-11-11')]);
    expect(recents.map((r) => r.title)).toEqual([' poha ', 'Dal rice']);
    expect(recents[0]).toMatchObject({ totals: { kcal: 300 }, meal: 'breakfast', lastDate: '2026-11-11', lastLoggedAt: 3, times: 2 });
    expect(recents[1].times).toBe(1);
  });

  it('keeps only what is needed to log the meal again', () => {
    const [recent] = recentMeals([entry('Chai', 90, 1)]);
    expect(recent).not.toHaveProperty('id');
    expect(recent).not.toHaveProperty('transcript');
  });
});

describe('matchMeals', () => {
  const meals = recentMeals([entry('Dal, rice and rotis', 600, 1), entry('Poha with peanuts', 280, 2), entry('Masala chai', 90, 3)]);

  it('needs every word, in the name or the foods', () => {
    expect(matchMeals(meals, 'POHA').map((m) => m.title)).toEqual(['Poha with peanuts']);
    expect(matchMeals(meals, 'poha chai')).toEqual([]);
  });

  it('ignores amounts, filler words and plurals', () => {
    expect(matchMeals(meals, '2 rotis and dal').map((m) => m.title)).toEqual(['Dal, rice and rotis']);
    expect(matchMeals(meals, 'chais').map((m) => m.title)).toEqual(['Masala chai']);
  });

  it('finds nothing for an empty search', () => {
    expect(matchMeals(meals, '  2 ')).toEqual([]);
  });
});

describe('quickPicks', () => {
  it('puts favourites first, then frequent recent meals, leading with this time of day', () => {
    const recents = recentMeals([
      entry('Biryani', 700, 1, 'dinner'),
      entry('Biryani', 700, 2, 'dinner'),
      entry('Sandwich', 350, 3, 'lunch'),
      entry('Poha', 250, 4, 'breakfast'),
      entry('Dal rice', 500, 5, 'lunch'),
    ]);
    const favourites = [favourite('Poha', 10, 'breakfast'), favourite('Salad', 20, 'lunch')];
    expect(quickPicks(favourites, recents, 'lunch').map((p) => p.title)).toEqual(['Salad', 'Poha', 'Dal rice', 'Sandwich', 'Biryani']);
    // Neither favourite is a dinner, so the one saved or eaten most recently leads.
    expect(quickPicks(favourites, recents, 'dinner', 3).map((p) => p.title)).toEqual(['Salad', 'Poha', 'Biryani']);
  });
});
