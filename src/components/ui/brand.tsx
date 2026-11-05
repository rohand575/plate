import { motion } from 'motion/react';
import { useState } from 'react';

/** The Plate mark: a three-quarter ring, drawn in on mount. */
export function LogoMark({ size = 64, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <defs>
        <linearGradient id="plate-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34C759" />
          <stop offset="1" stopColor="#00B4A6" />
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="176" fill="none" stroke="#E8E8ED" strokeWidth="72" />
      <motion.circle
        cx="256"
        cy="256"
        r="176"
        fill="none"
        stroke="url(#plate-logo)"
        strokeWidth="72"
        strokeLinecap="round"
        transform="rotate(-90 256 256)"
        initial={animate ? { pathLength: 0 } : false}
        animate={{ pathLength: 0.75 }}
        transition={{ type: 'spring', stiffness: 40, damping: 14, delay: 0.15 }}
      />
    </svg>
  );
}

export function Avatar({ name, photoURL, size = 36 }: { name: string | null; photoURL: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return photoURL && !failed ? (
    <img
      src={photoURL}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#d9dbe1] to-[#c4c7cf] font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

export function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
