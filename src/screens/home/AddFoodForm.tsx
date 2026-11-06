import { type FormEvent, type InputHTMLAttributes, useId, useState } from 'react';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { DayField, SegmentedControl } from '../../components/ui/controls';
import { isLoggableDay } from '../../lib/dates';
import { parseNumber } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { MEALS, mealForTime, mealLabel } from '../../lib/meals';
import type { DateKey, Entry, Meal, NewEntry } from '../../lib/types';

function Field({ label, unit, ...input }: { label: string; unit?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="block cursor-text rounded-[16px] bg-fill-2 px-4 pb-2.5 pt-2 outline-2 -outline-offset-2 outline-transparent transition-[outline-color] focus-within:outline-ink"
    >
      <span className="text-[12px] font-medium text-ink-2">{label}</span>
      <span className="flex items-baseline gap-1">
        <input
          id={id}
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-[17px] font-medium outline-none placeholder:font-normal placeholder:text-ink-3"
          {...input}
        />
        {unit && <span className="text-[15px] text-ink-2">{unit}</span>}
      </span>
    </label>
  );
}

const grams = (raw: string) => Math.max(0, Math.round(parseNumber(raw) ?? 0));
const initial = (n: number | undefined) => (n ? String(n) : '');

/** Manual entry for when the calories are already known; also edits a manual entry. */
export function AddFoodForm({
  date,
  entry,
  onDone,
  onDelete,
}: {
  date: DateKey;
  entry?: Entry;
  onDone: () => void;
  onDelete?: (entry: Entry) => void;
}) {
  const { backend, user } = useSession();
  const toast = useToast();
  const [name, setName] = useState(entry?.title ?? '');
  const [kcal, setKcal] = useState(initial(entry?.totals.kcal));
  const [protein, setProtein] = useState(initial(entry?.totals.protein));
  const [carbs, setCarbs] = useState(initial(entry?.totals.carbs));
  const [fat, setFat] = useState(initial(entry?.totals.fat));
  const [meal, setMeal] = useState<Meal>(() => entry?.meal ?? mealForTime());
  const [day, setDay] = useState<DateKey>(entry?.date ?? date);

  const kcalValue = parseNumber(kcal);
  const valid = name.trim() !== '' && kcalValue != null && kcalValue > 0 && kcalValue < 10_000;
  const numeric = (set: (v: string) => void) => (e: { target: { value: string } }) => set(e.target.value.replace(/[^0-9.,]/g, ''));

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const title = name.trim();
    const totals = { kcal: Math.round(kcalValue), protein: grams(protein), carbs: grams(carbs), fat: grams(fat) };
    const next: NewEntry = {
      date: entry ? (isLoggableDay(day) ? day : entry.date) : date,
      meal,
      title,
      source: 'manual',
      items: [{ name: title, quantity: null, unit: null, grams: null, ...totals }],
      totals,
      transcript: null,
      loggedAt: entry?.loggedAt ?? Date.now(),
    };
    const failed = () => toast({ message: 'Couldn’t save that. Check your connection.' });
    if (entry) backend.data.updateEntry(user.uid, entry.id, next).catch(failed);
    else backend.data.addEntry(user.uid, next).catch(failed);
    haptic([8, 40, 8]);
    toast({ message: entry ? `Updated ${title}` : `Added to ${mealLabel(meal)}` });
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-3 px-5 pb-5" noValidate>
      <Field label="Food" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Masala dosa" maxLength={80} />
      <Field label="Calories" unit="kcal" inputMode="numeric" value={kcal} onChange={numeric(setKcal)} placeholder="0" />
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Protein" unit="g" inputMode="decimal" value={protein} onChange={numeric(setProtein)} placeholder="—" />
        <Field label="Carbs" unit="g" inputMode="decimal" value={carbs} onChange={numeric(setCarbs)} placeholder="—" />
        <Field label="Fat" unit="g" inputMode="decimal" value={fat} onChange={numeric(setFat)} placeholder="—" />
      </div>
      <div className="pt-2">
        <SegmentedControl label="Meal" options={MEALS} value={meal} onChange={setMeal} />
      </div>
      {entry && <DayField value={day} onChange={setDay} />}
      <div className="pt-3">
        <Button type="submit" disabled={!valid}>
          {entry ? 'Save changes' : 'Add'}
        </Button>
        {entry && onDelete && (
          <Button variant="danger" className="mt-1" onClick={() => onDelete(entry)}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
