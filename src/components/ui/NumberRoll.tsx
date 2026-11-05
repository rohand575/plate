import { motion } from 'motion/react';
import { cx, fmtInt } from '../../lib/format';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const roll = { type: 'spring', stiffness: 140, damping: 22, mass: 0.9 } as const;

function Digit({ value, delay }: { value: number; delay: number }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none">
      <span className="invisible">0</span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={{ y: '0%' }}
        animate={{ y: `${-value * 10}%` }}
        transition={{ ...roll, delay }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1em] leading-none">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/** Odometer-style number: each digit rolls to its new value. */
export function NumberRoll({ value, className, delay = 0 }: { value: number; className?: string; delay?: number }) {
  const text = fmtInt(value);
  const chars = text.split('');
  return (
    <span className={cx('inline-flex tabular-nums leading-none', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex">
        {chars.map((ch, i) => {
          // Key from the right so existing digits keep their place when the number grows.
          const key = chars.length - i;
          return /\d/.test(ch) ? (
            <Digit key={key} value={Number(ch)} delay={delay + key * 0.03} />
          ) : (
            <span key={`s${key}`} className="leading-none">
              {ch}
            </span>
          );
        })}
      </span>
    </span>
  );
}
