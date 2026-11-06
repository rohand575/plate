import { describe, expect, it } from 'vitest';
import { portionQuantity, scaleItem, stepFor, unitLabel } from './portions';
import type { AnalyzedItem } from './types';

const oil: AnalyzedItem = { name: 'Oil', quantity: 2, unit: 'tbsp', grams: 27, kcal: 240, protein: 0, carbs: 0, fat: 27, assumption: null };
const rice: AnalyzedItem = { name: 'Rice', quantity: 150, unit: 'g', grams: 150, kcal: 195, protein: 4, carbs: 43, fat: 0, assumption: null };

describe('scaleItem', () => {
  it('scales nutrients in proportion to quantity', () => {
    expect(scaleItem(oil, 1)).toMatchObject({ quantity: 1, kcal: 120, fat: 14, grams: 14 });
    expect(scaleItem(rice, 300)).toMatchObject({ kcal: 390, carbs: 86, grams: 300 });
  });
});

describe('portionQuantity', () => {
  it('keeps weights whole and counts to two decimals', () => {
    expect(portionQuantity(rice, 0.75)).toBe(113);
    expect(portionQuantity(oil, 0.75)).toBe(1.5);
    expect(portionQuantity({ ...oil, quantity: 1 }, 0.75)).toBe(0.75);
    expect(portionQuantity(oil, 1)).toBe(2);
  });
});

describe('stepFor', () => {
  it('uses half units for counts and 10 g for weights', () => {
    expect(stepFor(oil)).toBe(0.5);
    expect(stepFor(rice)).toBe(10);
    expect(stepFor({ ...rice, quantity: 250 })).toBe(25);
  });
});

describe('unitLabel', () => {
  it('pluralises natural units but not abbreviations', () => {
    expect(unitLabel('roti', 2)).toBe('rotis');
    expect(unitLabel('roti', 1)).toBe('roti');
    expect(unitLabel('glass', 2)).toBe('glasses');
    expect(unitLabel('tbsp', 2)).toBe('tbsp');
    expect(unitLabel('g', 150)).toBe('g');
    expect(unitLabel('katori', 1.5)).toBe('katoris');
  });
});
