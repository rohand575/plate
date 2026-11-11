import { useCallback, useEffect, useRef, useState } from 'react';

/** A key that stays set for a moment after `flash(key)`, e.g. to tick the button just tapped. */
export function useFlash(ms = 1400): [string | null, (key: string) => void] {
  const [key, setKey] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = useCallback(
    (next: string) => {
      window.clearTimeout(timer.current);
      setKey(next);
      timer.current = window.setTimeout(() => setKey(null), ms);
    },
    [ms],
  );

  return [key, flash];
}
