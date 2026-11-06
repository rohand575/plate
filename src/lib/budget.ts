/** Shares of a meal offered on the review screen, largest first. */
export const SHARES = [
  { value: 1, label: 'All' },
  { value: 0.75, label: '¾' },
  { value: 0.5, label: '½' },
] as const;

export type Share = (typeof SHARES)[number]['value'];

export interface Impact {
  /** kcal left after this meal; negative when it goes over the target. */
  after: number;
  /** Bar segments as fractions of the bar: eaten so far, this meal within target, this meal over target. */
  bar: { eaten: number; within: number; over: number; target: number };
}

/** What eating `meal` kcal does to a day where `eaten` of `target` kcal are already logged. */
export function mealImpact(eaten: number, meal: number, target: number): Impact {
  const total = eaten + meal;
  const scale = Math.max(target, total, 1);
  const within = Math.max(0, Math.min(meal, target - eaten));
  return {
    after: Math.round(target - total),
    bar: { eaten: eaten / scale, within: within / scale, over: (meal - within) / scale, target: target / scale },
  };
}

/**
 * The largest share smaller than the whole meal that still fits in what's left of the target:
 * `null` when the whole meal fits or nothing is left, `'none'` when even the smallest share is too much.
 */
export function fittingShare(left: number, kcalFor: (share: Share) => number): Share | 'none' | null {
  if (left <= 0 || kcalFor(1) <= left) return null;
  return SHARES.find((s) => s.value < 1 && kcalFor(s.value) <= left)?.value ?? 'none';
}
