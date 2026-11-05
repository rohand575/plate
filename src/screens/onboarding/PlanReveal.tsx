import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Card } from '../../components/ui/controls';
import { NumberRoll } from '../../components/ui/NumberRoll';
import { Ring } from '../../components/ui/Ring';
import { monthYear } from '../../lib/dates';
import { fmt1, fmtInt } from '../../lib/format';
import type { Plan } from '../../lib/nutrition';
import type { Profile } from '../../lib/types';

function FadeUp({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 text-center">
      <p className="text-[19px] font-semibold tabular-nums tracking-[-0.02em]">{value}</p>
      <p className="mt-0.5 text-[12px] font-medium text-ink-2">{label}</p>
    </div>
  );
}

function MacroTarget({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="rounded-[16px] bg-fill-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: color }} />
        <span className="text-[12px] font-semibold text-ink-2">{label}</span>
      </div>
      <p className="mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.01em]">
        {fmtInt(grams)}
        <span className="text-[13px] font-medium text-ink-2"> g</span>
      </p>
    </div>
  );
}

export function PlanReveal({ profile, plan }: { profile: Profile; plan: Plan }) {
  const sentence =
    plan.deficit > 0
      ? `Eat around this to lose about ${fmt1(plan.weeklyChangeKg)} kg a week.`
      : 'Eat around this to keep your weight steady.';

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <Ring progress={1} size={208} stroke={20} delay={0.1}>
          <NumberRoll value={plan.calories} delay={0.2} className="text-[48px] font-bold tracking-[-0.035em]" />
          <span className="mt-2 text-[14px] font-medium text-ink-2">kcal a day</span>
        </Ring>
        <FadeUp delay={0.35}>
          <h1 className="mt-7 text-[30px] font-bold tracking-[-0.03em]">Your daily target</h1>
          <p className="mx-auto mt-2 max-w-[320px] text-balance text-[16px] text-ink-2">{sentence}</p>
        </FadeUp>
      </div>

      <FadeUp delay={0.5}>
        <Card className="mt-7 grid grid-cols-3 divide-x divide-hairline py-4">
          <Stat label="Maintenance" value={fmtInt(plan.maintenance)} />
          <Stat label="Deficit" value={plan.deficit > 0 ? `−${fmtInt(plan.deficit)}` : '0'} />
          <Stat label="At rest" value={fmtInt(plan.bmr)} />
        </Card>
      </FadeUp>

      <FadeUp delay={0.62}>
        <Card className="mt-3 p-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-[15px] text-ink-2">Activity level</span>
            <span className="text-[15px] font-semibold">{plan.activityLabel}</span>
          </div>
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            <MacroTarget label="Protein" grams={plan.protein} color="var(--color-protein)" />
            <MacroTarget label="Carbs" grams={plan.carbs} color="var(--color-carbs)" />
            <MacroTarget label="Fat" grams={plan.fat} color="var(--color-fat)" />
          </div>
        </Card>
      </FadeUp>

      <FadeUp delay={0.74}>
        {plan.goalDate && profile.goalWeightKg != null && (
          <p className="mt-5 px-1 text-[15px] leading-snug">
            At this pace you could reach <span className="font-semibold">{fmt1(profile.goalWeightKg)} kg</span> around{' '}
            <span className="font-semibold">{monthYear(plan.goalDate)}</span>.
          </p>
        )}
        {plan.limitNote && <p className="mt-3 px-1 text-[14px] leading-snug text-ink-2">{plan.limitNote}</p>}
        <p className="mt-5 px-1 text-[13px] leading-snug text-ink-3">
          Estimates based on the Mifflin-St Jeor equation. As you log food and weight, Plate learns your real
          maintenance and suggests adjustments.
        </p>
      </FadeUp>
    </div>
  );
}
