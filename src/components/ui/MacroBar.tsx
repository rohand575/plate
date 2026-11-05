import { motion } from 'motion/react';
import { fmtInt } from '../../lib/format';

interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  color: string;
  delay?: number;
}

export function MacroBar({ label, value, target, color, delay = 0 }: MacroBarProps) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: color }} />
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      </div>
      <div className="mt-1.5 text-[15px] tabular-nums tracking-[-0.01em]">
        <span className="font-semibold text-ink">{fmtInt(value)}</span>
        <span className="text-ink-3"> / {fmtInt(target)} g</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 70, damping: 18, delay }}
        />
      </div>
    </div>
  );
}
