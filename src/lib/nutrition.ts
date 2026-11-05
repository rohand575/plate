import { ageOn } from './dates';
import { fmtInt } from './format';
import type { Pace, Profile, Sex, Walking, Workouts, WorkType } from './types';

/** Energy in 1 kg of body fat. */
export const KCAL_PER_KG = 7700;
export const MIN_AGE = 16;
export const ADULT_AGE = 18;

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'unspecified', label: 'Prefer not to say' },
];

export const WORK_OPTIONS: { value: WorkType; label: string; detail: string; factor: number }[] = [
  { value: 'sitting', label: 'Mostly sitting', detail: 'Desk job, studying, driving', factor: 1.2 },
  { value: 'mixed', label: 'On my feet sometimes', detail: 'Teaching, errands, housework', factor: 1.3 },
  { value: 'standing', label: 'On my feet most of the day', detail: 'Retail, nursing, waiting tables', factor: 1.4 },
  { value: 'physical', label: 'Physically demanding', detail: 'Construction, farming, warehouse', factor: 1.55 },
];

export const WORKOUT_OPTIONS: { value: Workouts; label: string; bonus: number }[] = [
  { value: 'none', label: '0', bonus: 0 },
  { value: 'some', label: '1–2', bonus: 0.075 },
  { value: 'regular', label: '3–4', bonus: 0.15 },
  { value: 'daily', label: '5+', bonus: 0.225 },
];

export const WALKING_OPTIONS: { value: Walking; label: string; detail: string; bonus: number }[] = [
  { value: 'light', label: 'A little', detail: 'Under 5,000 steps a day', bonus: 0 },
  { value: 'moderate', label: 'A fair bit', detail: '5,000 – 10,000 steps a day', bonus: 0.075 },
  { value: 'high', label: 'A lot', detail: 'Over 10,000 steps a day', bonus: 0.15 },
];

export const PACE_OPTIONS: { value: Pace; label: string; detail: string; kgPerWeek: number }[] = [
  { value: 'maintain', label: 'Maintain', detail: 'Keep my current weight', kgPerWeek: 0 },
  { value: 'slow', label: 'Lose slowly', detail: '0.25 kg a week', kgPerWeek: 0.25 },
  { value: 'standard', label: 'Lose steadily', detail: '0.5 kg a week', kgPerWeek: 0.5 },
  { value: 'fast', label: 'Lose faster', detail: '0.75 kg a week', kgPerWeek: 0.75 },
];
export const RECOMMENDED_PACE: Pace = 'standard';

// Mifflin-St Jeor sex constant; "unspecified" uses the midpoint.
const SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161, unspecified: -78 };
const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200, unspecified: 1350 };
const MAX_DEFICIT_SHARE = 0.25;
const PROTEIN_G_PER_KG = 1.6;
const FAT_SHARE = 0.27;

export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANT[sex];
}

export function activityFactor(work: WorkType, workouts: Workouts, walking: Walking): number {
  const f =
    WORK_OPTIONS.find((o) => o.value === work)!.factor +
    WORKOUT_OPTIONS.find((o) => o.value === workouts)!.bonus +
    WALKING_OPTIONS.find((o) => o.value === walking)!.bonus;
  return Math.min(1.9, Math.max(1.2, Math.round(f * 1000) / 1000));
}

export function activityLabel(factor: number): string {
  if (factor < 1.3) return 'Sedentary';
  if (factor < 1.45) return 'Lightly active';
  if (factor < 1.6) return 'Moderately active';
  if (factor < 1.75) return 'Very active';
  return 'Extremely active';
}

export interface Plan {
  age: number;
  bmi: number;
  bmr: number;
  activityFactor: number;
  activityLabel: string;
  maintenance: number;
  deficit: number;
  calories: number;
  /** Explains why the deficit is smaller than the chosen pace, if it is. */
  limitNote: string | null;
  protein: number;
  carbs: number;
  fat: number;
  weeklyChangeKg: number;
  goalDate: Date | null;
}

const round10 = (n: number) => Math.round(n / 10) * 10;

export function computePlan(p: Profile, now: Date = new Date()): Plan {
  const age = ageOn(p.birthDate, now);
  const heightM = p.heightCm / 100;
  const rawBmr = bmr(p.weightKg, p.heightCm, age, p.sex);
  const factor = activityFactor(p.work, p.workouts, p.walking);
  const rawMaintenance = rawBmr * factor;

  const pace = PACE_OPTIONS.find((o) => o.value === p.pace)!;
  const requested = (pace.kgPerWeek * KCAL_PER_KG) / 7;
  const byShare = rawMaintenance * MAX_DEFICIT_SHARE;
  const byFloor = Math.max(0, rawMaintenance - CALORIE_FLOOR[p.sex]);

  let deficit = requested;
  let limitNote: string | null = null;
  if (age < ADULT_AGE && requested > 0) {
    deficit = 0;
    limitNote = 'Weight-loss targets are for adults, so this plan maintains your weight.';
  } else if (requested > Math.min(byShare, byFloor)) {
    if (byFloor <= byShare) {
      deficit = byFloor;
      limitNote = `Kept at a safe minimum of ${fmtInt(CALORIE_FLOOR[p.sex])} kcal a day.`;
    } else {
      deficit = byShare;
      limitNote = 'Capped at 25% below maintenance to protect muscle and energy.';
    }
  }

  const maintenance = round10(rawMaintenance);
  const calories = round10(rawMaintenance - deficit);

  // Protein scales with body weight, capped at the weight for BMI 30 so it stays realistic.
  const proteinWeight = Math.min(p.weightKg, 30 * heightM * heightM);
  const protein = Math.round(PROTEIN_G_PER_KG * proteinWeight);
  const fat = Math.round((calories * FAT_SHARE) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  const weeklyChangeKg = Math.round(((deficit * 7) / KCAL_PER_KG) * 100) / 100;
  let goalDate: Date | null = null;
  if (p.goalWeightKg != null && p.goalWeightKg < p.weightKg && weeklyChangeKg > 0) {
    const weeks = (p.weightKg - p.goalWeightKg) / weeklyChangeKg;
    goalDate = new Date(now.getTime() + weeks * 7 * 86_400_000);
  }

  return {
    age,
    bmi: Math.round((p.weightKg / (heightM * heightM)) * 10) / 10,
    bmr: Math.round(rawBmr),
    activityFactor: factor,
    activityLabel: activityLabel(factor),
    maintenance,
    deficit: maintenance - calories,
    calories,
    limitNote,
    protein,
    carbs,
    fat,
    weeklyChangeKg,
    goalDate,
  };
}
