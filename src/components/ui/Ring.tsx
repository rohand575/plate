import { motion } from 'motion/react';
import { type ReactNode, useId } from 'react';

const GOOD = ['#34C759', '#00B4A6'];
const OVER = ['#FFB340', '#FF5E3A'];

interface RingProps {
  /** Fraction of the target reached; values above 1 switch to the "over" colors. */
  progress: number;
  size: number;
  stroke: number;
  delay?: number;
  children?: ReactNode;
}

export function Ring({ progress, size, stroke, delay = 0, children }: RingProps) {
  const gradientId = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const over = progress > 1;
  const shown = Math.max(0, Math.min(progress, 1));
  const [from, to] = over ? OVER : GOOD;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} className="stroke-fill" />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: shown, opacity: shown > 0 ? 1 : 0 }}
          transition={{
            pathLength: { type: 'spring', stiffness: 50, damping: 16, delay },
            opacity: { duration: 0.2, delay },
          }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}
