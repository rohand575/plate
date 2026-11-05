import { type FormEvent, type InputHTMLAttributes, useId, useState } from 'react';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/controls';
import { parseNumber } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { MEALS, mealForTime, mealLabel } from '../../lib/meals';
import type { DateKey, Meal } from '../../lib/types';

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

/** Manual entry for when the calories are already known. */
export function AddFoodForm({ date, onDone }: { date: DateKey; onDone: () => void }) {
  const { backend, user } = useSession();
  const toast = useToast();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [meal, setMeal] = useState<Meal>(() => mealForTime());

  const kcalValue = parseNumber(kcal);
  const valid = name.trim() !== '' && kcalValue != null && kcalValue > 0 && kcalValue < 10_000;
  const numeric = (set: (v: string) => void) => (e: { target: { value: string } }) => set(e.target.value.replace(/[^0-9.,]/g, ''));

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const title = name.trim();
    const totals = { kcal: Math.round(kcalValue), protein: grams(protein), carbs: grams(carbs), fat: grams(fat) };
    backend.data
      .addEntry(user.uid, {
        date,
        meal,
        title,
        source: 'manual',
        items: [{ name: title, quantity: null, unit: null, grams: null, ...totals }],
        totals,
        transcript: null,
        loggedAt: Date.now(),
      })
      .catch(() => toast({ message: 'Couldn’t save that. Check your connection.' }));
    haptic([8, 40, 8]);
    toast({ message: `Added to ${mealLabel(meal)}` });
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
      <div className="pt-3">
        <Button type="submit" disabled={!valid}>
          Add
        </Button>
      </div>
    </form>
  );
}
