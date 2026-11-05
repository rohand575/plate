import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { IconButton } from '../../components/ui/Button';
import { Ring } from '../../components/ui/Ring';
import { addDays, fromKey, longDate, weekdayLetter } from '../../lib/dates';
import { cx } from '../../lib/format';
import { spring } from '../../lib/motion';
import type { DateKey } from '../../lib/types';

interface WeekStripProps {
  week: DateKey[];
  selected: DateKey;
  today: DateKey;
  kcalByDay: Record<DateKey, number>;
  target: number;
  onSelect: (day: DateKey) => void;
}

export function WeekStrip({ week, selected, today, kcalByDay, target, onSelect }: WeekStripProps) {
  const nextWeekDay = addDays(selected, 7);
  return (
    <div className="flex items-center rounded-[24px] bg-surface px-1 py-2 shadow-card">
      <IconButton label="Previous week" tone="plain" className="size-8 text-ink-2" onClick={() => onSelect(addDays(selected, -7))}>
        <ChevronLeft size={18} strokeWidth={2.4} />
      </IconButton>
      <div className="grid flex-1 grid-cols-7">
        {week.map((day) => {
          const future = day > today;
          const isSelected = day === selected;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              aria-label={longDate(day)}
              aria-pressed={isSelected}
              onClick={() => onSelect(day)}
              className="relative flex flex-col items-center gap-1 rounded-[16px] py-1.5 disabled:opacity-35"
            >
              {isSelected && (
                <motion.span layoutId="week-day-pill" className="absolute inset-0 rounded-[16px] bg-fill-2" transition={spring} />
              )}
              <span className={cx('relative text-[11px] font-semibold', day === today ? 'text-brand-ink' : 'text-ink-3')}>
                {weekdayLetter(day)}
              </span>
              <span className="relative">
                <Ring progress={future ? 0 : (kcalByDay[day] ?? 0) / target} size={28} stroke={4} />
              </span>
              <span className={cx('relative text-[12px] font-semibold tabular-nums', isSelected ? 'text-ink' : 'text-ink-2')}>
                {fromKey(day).getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <IconButton
        label="Next week"
        tone="plain"
        className="size-8 text-ink-2"
        disabled={week[6] >= today}
        onClick={() => onSelect(nextWeekDay > today ? today : nextWeekDay)}
      >
        <ChevronRight size={18} strokeWidth={2.4} />
      </IconButton>
    </div>
  );
}
