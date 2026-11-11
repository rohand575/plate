import type { DateKey } from './types';

export function toKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

/** A well-formed day that isn't in the future. */
export const isLoggableDay = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= todayKey();

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: DateKey): DateKey {
  const d = fromKey(key);
  const offset = (d.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function weekDays(key: DateKey): DateKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function ageOn(birthDate: DateKey, on: Date): number {
  const b = fromKey(birthDate);
  let age = on.getFullYear() - b.getFullYear();
  const beforeBirthday =
    on.getMonth() < b.getMonth() || (on.getMonth() === b.getMonth() && on.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function yearsAgo(years: number, from = new Date()): DateKey {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() - years);
  return toKey(d);
}

export function dayTitle(key: DateKey, today: DateKey = todayKey()): string {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'long' });
}

/** "Today", "Yesterday", a weekday within the last week, otherwise e.g. "3 Oct". */
export function shortDay(key: DateKey, today: DateKey = todayKey()): string {
  if (key >= addDays(today, -6)) return dayTitle(key, today);
  return fromKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const longDate = (key: DateKey) =>
  fromKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const weekdayLetter = (key: DateKey) =>
  fromKey(key).toLocaleDateString(undefined, { weekday: 'narrow' });

export const monthYear = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export const timeLabel = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
