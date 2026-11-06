// @ts-check
import { describe, expect, it } from 'vitest';
import { parseKitchen, sanitize } from './openai.js';

describe('parseKitchen', () => {
  it('ignores anything that is not an object', () => {
    expect(parseKitchen(undefined)).toBeNull();
    expect(parseKitchen('large')).toBeNull();
  });

  it('keeps known values and falls back to typical ones', () => {
    expect(parseKitchen({ roti: 'large', katori: 'huge', oil: 'heavy', ghee: { x: 1 }, note: '  2 tsp sugar in chai  ' })).toEqual({
      roti: 'large',
      katori: 'medium',
      oil: 'heavy',
      ghee: 'sometimes',
      milk: 'toned',
      note: '2 tsp sugar in chai',
    });
  });

  it('caps the free-text note', () => {
    expect(parseKitchen({ note: 'x'.repeat(500) })?.note).toHaveLength(300);
  });
});

describe('sanitize', () => {
  const item = { name: 'Roti', quantity: 2, unit: 'roti', grams: 70, kcal: 210, protein: 7, carbs: 40, fat: 2, assumption: null };

  it('keeps the tip for real meals only', () => {
    expect(sanitize({ title: 'Rotis', items: [item], confidence: 'high', note: null, tip: ' Skip the ghee: −45 kcal ' }).tip).toBe(
      'Skip the ghee: −45 kcal',
    );
    expect(sanitize({ title: '', items: [], confidence: 'low', note: 'Not food', tip: 'Eat less' }).tip).toBeNull();
    expect(sanitize({ title: 'Rotis', items: [item], confidence: 'high', note: null }).tip).toBeNull();
  });
});
