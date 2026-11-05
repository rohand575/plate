import { Card } from '../../components/ui/controls';
import { MacroBar } from '../../components/ui/MacroBar';
import { NumberRoll } from '../../components/ui/NumberRoll';
import { Ring } from '../../components/ui/Ring';
import { cx } from '../../lib/format';
import type { Plan } from '../../lib/nutrition';
import type { Nutrients } from '../../lib/types';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <NumberRoll value={value} className="text-[20px] font-semibold tracking-[-0.02em]" />
      <p className="mt-1 text-[13px] font-medium text-ink-2">{label}</p>
    </div>
  );
}

export function SummaryCard({ plan, totals }: { plan: Plan; totals: Nutrients }) {
  const remaining = Math.round(plan.calories - totals.kcal);
  const over = remaining < 0;
  return (
    <Card className="px-5 pb-6 pt-6">
      <div className="flex flex-col items-center">
        <Ring progress={totals.kcal / plan.calories} size={224} stroke={22}>
          <NumberRoll value={Math.abs(remaining)} className="text-[46px] font-bold tracking-[-0.035em]" />
          <span className={cx('mt-2 text-[14px] font-medium', over ? 'text-[#e8590c]' : 'text-ink-2')}>
            {over ? 'kcal over' : 'kcal left'}
          </span>
        </Ring>
        <div className="mt-6 grid w-full grid-cols-2 divide-x divide-hairline">
          <Stat label="Eaten" value={Math.round(totals.kcal)} />
          <Stat label="Target" value={plan.calories} />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-hairline pt-5">
        <MacroBar label="Protein" value={totals.protein} target={plan.protein} color="var(--color-protein)" />
        <MacroBar label="Carbs" value={totals.carbs} target={plan.carbs} color="var(--color-carbs)" delay={0.05} />
        <MacroBar label="Fat" value={totals.fat} target={plan.fat} color="var(--color-fat)" delay={0.1} />
      </div>
    </Card>
  );
}
