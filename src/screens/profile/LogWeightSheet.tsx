import { type FormEvent, useState } from 'react';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { NumberField } from '../../components/ui/controls';
import { Sheet } from '../../components/ui/Sheet';
import { todayKey } from '../../lib/dates';
import { fmtInt, parseNumber } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { computePlan } from '../../lib/nutrition';

function LogWeightForm({ onDone }: { onDone: () => void }) {
  const { backend, user, profile } = useSession();
  const toast = useToast();
  const [value, setValue] = useState(String(profile.weightKg));
  const kg = parseNumber(value);
  const valid = kg != null && kg >= 30 && kg <= 300;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const rounded = Math.round(kg * 10) / 10;
    backend.data.logWeight(user.uid, todayKey(), rounded).catch(() => toast({ message: 'Couldn’t save your weight.' }));
    haptic([8, 40, 8]);
    const target = computePlan({ ...profile, weightKg: rounded }).calories;
    toast({ message: `Weight saved · target ${fmtInt(target)} kcal` });
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4 px-5 pb-5 pt-2" noValidate>
      <NumberField
        label="Today’s weight"
        unit="kg"
        value={value}
        onChange={setValue}
        error={value !== '' && !valid ? 'Enter a weight between 30 and 300 kg' : null}
        hint="Your daily target updates automatically."
      />
      <Button type="submit" disabled={!valid}>
        Save
      </Button>
    </form>
  );
}

export function LogWeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <LogWeightForm onDone={onClose} />
    </Sheet>
  );
}
