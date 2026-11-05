import { type HTMLMotionProps, motion } from 'motion/react';
import { cx } from '../../lib/format';
import { spring } from '../../lib/motion';

type Variant = 'primary' | 'secondary' | 'plain' | 'danger';
type Size = 'lg' | 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white disabled:bg-fill disabled:text-ink-3',
  secondary: 'bg-fill-2 text-ink disabled:text-ink-3',
  plain: 'text-ink',
  danger: 'text-danger',
};

const SIZES: Record<Size, string> = {
  lg: 'h-14 w-full px-6 text-[17px]',
  md: 'h-11 px-5 text-[15px]',
  sm: 'h-9 px-4 text-[14px]',
};

type ButtonProps = HTMLMotionProps<'button'> & { variant?: Variant; size?: Size };

export function Button({ variant = 'primary', size = 'lg', className, disabled, ...rest }: ButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={spring}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-colors duration-200',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}

type IconButtonProps = HTMLMotionProps<'button'> & { label: string; tone?: 'glass' | 'fill' | 'plain' };

const TONES = {
  glass: 'bg-white/80 shadow-card backdrop-blur-xl',
  fill: 'bg-fill-2',
  plain: '',
};

export function IconButton({ label, tone = 'fill', className, ...rest }: IconButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      transition={spring}
      className={cx(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink disabled:opacity-30',
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
