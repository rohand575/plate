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

  describe('basis', () => {
    const meal = (/** @type {object} */ extra) => ({ title: 'Ready meal', items: [item], confidence: 'high', note: null, tip: null, ...extra });
    const searched = ['https://www.qualityfoodsonline.com/products/ashoka', 'https://fddb.info/db/de/lebensmittel/x'];

    it('keeps label readings', () => {
      expect(sanitize(meal({ basis: 'label', source_url: 'https://example.com' }))).toMatchObject({ basis: 'label', sourceUrl: null });
    });

    it('only claims a web source when a search actually ran', () => {
      expect(sanitize(meal({ basis: 'web', source_url: 'https://fddb.info/a' }))).toMatchObject({ basis: 'estimate', sourceUrl: null });
      expect(sanitize(meal({ basis: 'web', source_url: 'https://fddb.info/a' }), searched)).toMatchObject({
        basis: 'web',
        sourceUrl: 'https://fddb.info/a',
      });
    });

    it('drops links to sites the search never returned, and non-web links', () => {
      expect(sanitize(meal({ basis: 'web', source_url: 'https://made-up.example/x' }), searched)).toMatchObject({ basis: 'web', sourceUrl: null });
      expect(sanitize(meal({ basis: 'web', source_url: 'javascript:alert(1)' }), searched).sourceUrl).toBeNull();
      expect(sanitize(meal({ basis: 'web', source_url: 'https://qualityfoodsonline.com/p' }), searched).sourceUrl).toBe(
        'https://qualityfoodsonline.com/p',
      );
    });

    it('treats anything else as an estimate', () => {
      expect(sanitize(meal({ basis: 'guess' }))).toMatchObject({ basis: 'estimate', sourceUrl: null });
    });
  });
});
