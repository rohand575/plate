import { type FormEvent, useMemo, useState } from 'react';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/ui/Button';
import { NumberField } from '../../components/ui/controls';
import { Sheet } from '../../components/ui/Sheet';
import { todayKey } from '../../lib/dates';
import { fmtInt } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { ADULT_AGE, CUSTOM_TARGET_RANGE, computePlan } from '../../lib/nutrition';

function TargetForm({ onDone }: { onDone: () => void }) {
  const { backend, user, profile } = useSession();
  const toast = useToast();
  const plan = useMemo(() => computePlan(profile), [profile]);
  const [value, setValue] = useState(String(plan.calories));

  // Under-18s keep at least their calculated target, which is maintenance.
  const min = plan.age < ADULT_AGE ? plan.calculatedCalories : CUSTOM_TARGET_RANGE.min;
  // Whole kcal, so a "," or "." can only be a thousands separator: "2,000" and "2.000" are both 2000.
  const kcal = /\d/.test(value) ? Number(value.replace(/\D/g, '')) : null;
  const valid = kcal != null && kcal >= min && kcal <= CUSTOM_TARGET_RANGE.max;
  const preview = valid ? computePlan({ ...profile, customCalories: kcal }) : null;

  function save(customCalories: number | null) {
    // Null (not a missing field) so the saved target is cleared rather than merged back in.
    backend.data
      .saveProfile(user, { ...profile, customCalories }, { today: todayKey(), logWeight: false })
      .catch(() => toast({ message: 'Couldn’t save your target. Try again.' }));
    haptic([8, 40, 8]);
    toast({
      message:
        customCalories == null
          ? `Back to the calculated ${fmtInt(plan.calculatedCalories)} kcal a day`
          : `Daily target set to ${fmtInt(customCalories)} kcal`,
    });
    onDone();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    // Entering the calculated number follows the calculation again, so it keeps updating with weigh-ins.
    save(kcal === plan.calculatedCalories ? null : kcal);
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-5 pb-5 pt-1" noValidate>
      <p className="text-[15px] leading-snug text-ink-2">
        Plate worked out <span className="font-semibold text-ink">{fmtInt(plan.calculatedCalories)} kcal</span> a day from
        your body, activity and goal. Set your own number if you’d rather aim for something else.
      </p>
      <NumberField
        label="Daily target"
        unit="kcal"
        value={value}
        onChange={setValue}
        error={value !== '' && !valid ? `Enter between ${fmtInt(min)} and ${fmtInt(CUSTOM_TARGET_RANGE.max)} kcal` : null}
        hint={preview ? `Protein ${preview.protein} g · Carbs ${preview.carbs} g · Fat ${preview.fat} g` : undefined}
      />
      {preview?.limitNote && <p className="-mt-2 px-1 text-[13px] font-medium text-[#a65300]">{preview.limitNote}</p>}
      <Button type="submit" disabled={!valid}>
        Save
      </Button>
      {plan.isCustom && (
        <Button variant="plain" className="-mt-2" onClick={() => save(null)}>
          Use the calculated {fmtInt(plan.calculatedCalories)} kcal
        </Button>
      )}
    </form>
  );
}

/** Lets the person replace the calculated daily calorie target with their own. */
export function TargetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Daily target">
      <TargetForm onDone={onClose} />
    </Sheet>
  );
}
