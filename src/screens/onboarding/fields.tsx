import { motion } from 'motion/react';
import { type ReactNode, useId } from 'react';
import { cx } from '../../lib/format';
import { spring } from '../../lib/motion';

export function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-7">
      <h1 className="text-balance text-[30px] font-bold leading-[1.12] tracking-[-0.03em]">{title}</h1>
      <p className="mt-2.5 text-pretty text-[16px] leading-snug text-ink-2">{subtitle}</p>
    </div>
  );
}

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2', className)}>{children}</p>;
}

export function Hint({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' }) {
  return <p className={cx('mt-2 px-1 text-[13px] leading-snug', tone === 'error' ? 'text-danger' : 'text-ink-2')}>{children}</p>;
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.95 }}
            transition={spring}
            className={cx(
              'h-11 rounded-full px-5 text-[15px] font-medium transition-colors duration-200',
              selected ? 'bg-ink text-white' : 'bg-surface text-ink shadow-card',
            )}
          >
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  trailing,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: string;
  max: string;
  trailing?: ReactNode;
  error?: string | null;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className={cx(
          'block rounded-[20px] bg-surface px-4 py-3 shadow-card outline-2 -outline-offset-2 transition-[outline-color]',
          error ? 'outline-danger/70' : 'outline-transparent focus-within:outline-ink',
        )}
      >
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <span className="mt-0.5 flex items-center justify-between gap-3">
          <input
            id={id}
            type="date"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 min-w-0 flex-1 bg-transparent text-[22px] font-semibold tracking-[-0.02em] outline-none"
          />
          {trailing}
        </span>
      </label>
      {error && <Hint tone="error">{error}</Hint>}
    </div>
  );
}
