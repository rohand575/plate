import type { GheeUse, Kitchen, Milk, OilUse, Size } from './types';

interface Option<T extends string> {
  value: T;
  label: string;
  hint: string;
}

export const ROTI_OPTIONS: Option<Size>[] = [
  { value: 'small', label: 'Small', hint: 'Thin and small, about 80 kcal each' },
  { value: 'medium', label: 'Medium', hint: 'A typical home roti, about 105 kcal each' },
  { value: 'large', label: 'Large', hint: 'Big or thick, about 150 kcal each' },
];

export const KATORI_OPTIONS: Option<Size>[] = [
  { value: 'small', label: 'Small', hint: 'About 100 ml' },
  { value: 'medium', label: 'Medium', hint: 'About 150 ml' },
  { value: 'large', label: 'Large', hint: 'About 250 ml' },
];

export const OIL_OPTIONS: Option<OilUse>[] = [
  { value: 'light', label: 'Light', hint: 'About 1 tsp per serving of sabzi or dal' },
  { value: 'medium', label: 'Moderate', hint: 'About 2 tsp per serving of sabzi or dal' },
  { value: 'heavy', label: 'Generous', hint: '1 tbsp or more per serving of sabzi or dal' },
];

export const GHEE_OPTIONS: Option<GheeUse>[] = [
  { value: 'rarely', label: 'Rarely', hint: 'Plain rotis, rice and dal' },
  { value: 'sometimes', label: 'Sometimes', hint: 'A little ghee now and then' },
  { value: 'usually', label: 'Usually', hint: 'About 1 tsp on rotis, rice or dal' },
];

export const MILK_OPTIONS: Option<Milk>[] = [
  { value: 'full', label: 'Full-cream', hint: 'For chai, coffee and dahi' },
  { value: 'toned', label: 'Toned', hint: 'For chai, coffee and dahi' },
  { value: 'skimmed', label: 'Skimmed', hint: 'For chai, coffee and dahi' },
];

/** What the AI assumes for anyone who hasn't described their kitchen. */
export const DEFAULT_KITCHEN: Kitchen = { roti: 'medium', katori: 'medium', oil: 'medium', ghee: 'sometimes', milk: 'toned', note: '' };

/** "Medium rotis · 150 ml katori · moderate oil" */
export function kitchenSummary(k: Kitchen): string {
  const label = <T extends string>(options: Option<T>[], value: T) => options.find((o) => o.value === value)!.label;
  return [
    `${label(ROTI_OPTIONS, k.roti)} rotis`,
    `${KATORI_OPTIONS.find((o) => o.value === k.katori)!.hint.replace('About ', '')} katori`,
    `${label(OIL_OPTIONS, k.oil).toLowerCase()} oil`,
  ].join(' · ');
}
