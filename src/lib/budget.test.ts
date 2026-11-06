import { describe, expect, it } from 'vitest';
import { type Share, fittingShare, mealImpact } from './budget';

describe('mealImpact', () => {
  it('shows what is left when the meal fits', () => {
    const { after, bar } = mealImpact(1200, 600, 2000);
    expect(after).toBe(200);
    expect(bar).toEqual({ eaten: 0.6, within: 0.3, over: 0, target: 1 });
  });

  it('splits the part of the meal that goes over the target', () => {
    const { after, bar } = mealImpact(1800, 500, 2000);
    expect(after).toBe(-300);
    expect(bar.within).toBeCloseTo(200 / 2300);
    expect(bar.over).toBeCloseTo(300 / 2300);
    expect(bar.target).toBeCloseTo(2000 / 2300);
  });

  it('counts the whole meal as over when the target is already reached', () => {
    const { bar } = mealImpact(2100, 400, 2000);
    expect(bar.within).toBe(0);
    expect(bar.over).toBeCloseTo(400 / 2500);
  });
});

describe('fittingShare', () => {
  const meal = (kcal: number) => (share: Share) => kcal * share;

  it('suggests nothing when the whole meal fits or nothing is left', () => {
    expect(fittingShare(800, meal(600))).toBeNull();
    expect(fittingShare(0, meal(600))).toBeNull();
  });

  it('suggests the largest share that fits', () => {
    expect(fittingShare(500, meal(600))).toBe(0.75);
    expect(fittingShare(320, meal(600))).toBe(0.5);
  });

  it('says when even half is too much', () => {
    expect(fittingShare(200, meal(600))).toBe('none');
  });
});
