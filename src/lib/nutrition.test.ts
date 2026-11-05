import { describe, expect, it } from 'vitest';
import { ageOn } from './dates';
import { activityFactor, computePlan } from './nutrition';
import type { Profile } from './types';

const NOW = new Date(2026, 10, 5);

const base: Profile = {
  birthDate: '1996-01-15', // 30 on NOW
  sex: 'male',
  heightCm: 180,
  weightKg: 90,
  goalWeightKg: null,
  work: 'sitting',
  workouts: 'none',
  walking: 'light',
  pace: 'standard',
};

describe('computePlan', () => {
  it('computes maintenance and a 0.5 kg/week target for a sedentary adult', () => {
    const plan = computePlan(base, NOW);
    expect(plan.age).toBe(30);
    expect(plan.bmr).toBe(1880); // 900 + 1125 - 150 + 5
    expect(plan.activityFactor).toBe(1.2);
    expect(plan.activityLabel).toBe('Sedentary');
    expect(plan.maintenance).toBe(2260);
    expect(plan.calories).toBe(1710);
    expect(plan.deficit).toBe(550);
    expect(plan.limitNote).toBeNull();
    expect(plan.protein).toBe(144);
    expect(plan.fat).toBe(51);
    expect(plan.calories - (plan.protein * 4 + plan.fat * 9 + plan.carbs * 4)).toBeLessThan(10);
    expect(plan.bmi).toBe(27.8);
  });

  it('maintain pace targets maintenance', () => {
    const plan = computePlan({ ...base, pace: 'maintain' }, NOW);
    expect(plan.calories).toBe(plan.maintenance);
    expect(plan.deficit).toBe(0);
    expect(plan.goalDate).toBeNull();
  });

  it('never goes below the calorie floor', () => {
    const plan = computePlan(
      { ...base, sex: 'female', birthDate: '1976-01-01', heightCm: 160, weightKg: 60, pace: 'fast' },
      NOW,
    );
    expect(plan.calories).toBe(1200);
    expect(plan.limitNote).toMatch(/safe minimum/);
  });

  it('caps the deficit at 25% of maintenance', () => {
    const plan = computePlan(
      { ...base, sex: 'female', birthDate: '2000-01-01', heightCm: 165, weightKg: 70, pace: 'fast' },
      NOW,
    );
    // maintenance ≈ 1758, 25% ≈ 440 < 825 requested, floor allows 558
    expect(plan.deficit).toBeLessThanOrEqual(Math.round(plan.maintenance * 0.25) + 10);
    expect(plan.limitNote).toMatch(/25%/);
  });

  it('does not set a deficit for under-18s', () => {
    const plan = computePlan({ ...base, birthDate: '2010-01-01' }, NOW);
    expect(plan.deficit).toBe(0);
    expect(plan.limitNote).toMatch(/adults/);
  });

  it('projects a goal date from the weekly change', () => {
    const plan = computePlan({ ...base, goalWeightKg: 80 }, NOW);
    expect(plan.weeklyChangeKg).toBe(0.5);
    const days = (plan.goalDate!.getTime() - NOW.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(130);
    expect(days).toBeLessThan(145);
  });

  it('caps protein for very high body weight', () => {
    const plan = computePlan({ ...base, weightKg: 150 }, NOW);
    expect(plan.protein).toBe(Math.round(1.6 * 30 * 1.8 * 1.8));
  });
});

describe('activityFactor', () => {
  it('combines work, workouts and walking within 1.2–1.9', () => {
    expect(activityFactor('sitting', 'regular', 'moderate')).toBe(1.425);
    expect(activityFactor('physical', 'daily', 'high')).toBe(1.9);
  });
});

describe('ageOn', () => {
  it('counts birthdays correctly', () => {
    expect(ageOn('1996-11-05', NOW)).toBe(30);
    expect(ageOn('1996-11-06', NOW)).toBe(29);
  });
});
