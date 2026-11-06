import { type FormEvent, useId, useState } from 'react';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { Sheet } from '../../components/ui/Sheet';
import { todayKey } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { DEFAULT_KITCHEN, GHEE_OPTIONS, KATORI_OPTIONS, MILK_OPTIONS, OIL_OPTIONS, ROTI_OPTIONS } from '../../lib/kitchen';
import type { Kitchen } from '../../lib/types';
import { ChipGroup, FieldLabel, Hint } from '../onboarding/fields';

function Question<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <ChipGroup label={label} options={options} value={value} onChange={onChange} />
      <Hint>{options.find((o) => o.value === value)!.hint}</Hint>
    </div>
  );
}

function KitchenForm({ onDone }: { onDone: () => void }) {
  const { backend, user, profile } = useSession();
  const toast = useToast();
  const noteId = useId();
  const [kitchen, setKitchen] = useState<Kitchen>(() => profile.kitchen ?? DEFAULT_KITCHEN);
  const set = <K extends keyof Kitchen>(key: K) => (value: Kitchen[K]) => setKitchen((k) => ({ ...k, [key]: value }));

  function save(e: FormEvent) {
    e.preventDefault();
    const next = { ...kitchen, note: kitchen.note.trim() };
    backend.data
      .saveProfile(user, { ...profile, kitchen: next }, { today: todayKey(), logWeight: false })
      .catch(() => toast({ message: 'Couldn’t save your kitchen. Try again.' }));
    haptic([8, 40, 8]);
    toast({ message: 'Saved · new estimates will use it' });
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-6 px-5 pb-5 pt-1" noValidate>
      <p className="text-[15px] leading-snug text-ink-2">Plate uses these whenever a meal doesn’t say how much, so estimates match how you cook.</p>
      <Question label="Rotis" options={ROTI_OPTIONS} value={kitchen.roti} onChange={set('roti')} />
      <Question label="Katori (bowl)" options={KATORI_OPTIONS} value={kitchen.katori} onChange={set('katori')} />
      <Question label="Cooking oil" options={OIL_OPTIONS} value={kitchen.oil} onChange={set('oil')} />
      <Question label="Ghee on top" options={GHEE_OPTIONS} value={kitchen.ghee} onChange={set('ghee')} />
      <Question label="Milk" options={MILK_OPTIONS} value={kitchen.milk} onChange={set('milk')} />
      <div>
        <FieldLabel>Anything else?</FieldLabel>
        <label
          htmlFor={noteId}
          className="block rounded-[16px] bg-fill-2 px-4 py-3 outline-2 -outline-offset-2 outline-transparent transition-[outline-color] focus-within:outline-ink"
        >
          <span className="sr-only">Anything else about how you cook</span>
          <textarea
            id={noteId}
            rows={2}
            maxLength={300}
            value={kitchen.note}
            onChange={(e) => set('note')(e.target.value)}
            placeholder="e.g. 2 tsp sugar in chai, rotis made with multigrain atta"
            className="block w-full resize-none bg-transparent text-[16px] leading-snug outline-none placeholder:text-ink-3"
          />
        </label>
      </div>
      <Button type="submit">Save</Button>
    </form>
  );
}

/** How this household cooks: roti and katori sizes, oil, ghee and milk. */
export function KitchenSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Your kitchen">
      <KitchenForm onDone={onClose} />
    </Sheet>
  );
}
