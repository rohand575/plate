import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useId } from 'react';
import { cx } from '../../lib/format';
import { spring } from '../../lib/motion';

interface Option<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[14px] bg-fill p-[3px]">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative h-10 flex-1 rounded-[11px] text-[15px] font-medium transition-colors',
              selected ? 'text-ink' : 'text-ink-2',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg${id}`}
                className="absolute inset-0 rounded-[11px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.1),0_1px_1px_rgb(0_0_0/0.04)]"
                transition={spring}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function OptionCard({
  selected,
  onSelect,
  title,
  detail,
  icon,
  trailing,
  badge,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={spring}
      className={cx(
        'flex w-full items-center gap-3.5 rounded-[20px] bg-surface px-4 py-3.5 text-left shadow-card outline-2 -outline-offset-2 transition-[outline-color,opacity] duration-200',
        selected ? 'outline-ink' : 'outline-transparent',
        disabled && 'opacity-40',
      )}
    >
      {icon && (
        <span
          className={cx(
            'flex size-10 shrink-0 items-center justify-center rounded-[12px] transition-colors duration-200',
            selected ? 'bg-ink text-white' : 'bg-fill-2 text-ink',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[16px] font-semibold tracking-[-0.01em]">{title}</span>
          {badge && (
            <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-semibold text-brand-ink">
              {badge}
            </span>
          )}
        </span>
        {detail && <span className="mt-0.5 block text-[14px] text-ink-2">{detail}</span>}
      </span>
      {trailing}
      {!icon && !trailing && (
        <span
          className={cx(
            'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
            selected ? 'bg-ink text-white' : 'border-[1.5px] border-ink-3/60',
          )}
        >
          {selected && <Check size={14} strokeWidth={3} />}
        </span>
      )}
    </motion.button>
  );
}

export function NumberField({
  label,
  unit,
  value,
  onChange,
  placeholder,
  hint,
  error,
  autoFocus,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className={cx(
          'block cursor-text rounded-[20px] bg-surface px-4 pb-3 pt-3 shadow-card outline-2 -outline-offset-2 transition-[outline-color]',
          error ? 'outline-danger/70' : 'outline-transparent focus-within:outline-ink',
        )}
      >
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
            className="w-full min-w-0 bg-transparent text-[28px] font-semibold tabular-nums tracking-[-0.02em] outline-none placeholder:font-normal placeholder:text-ink-3"
          />
          <span className="text-[17px] font-medium text-ink-2">{unit}</span>
        </span>
      </label>
      {(error || hint) && (
        <p className={cx('mt-1.5 px-1 text-[13px]', error ? 'text-danger' : 'text-ink-2')}>{error ?? hint}</p>
      )}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-[24px] bg-surface shadow-card', className)}>{children}</div>;
}
