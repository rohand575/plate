import { useEffect, useState } from 'react';
import { todayKey } from '../lib/dates';
import type { DateKey } from '../lib/types';

/** Today's date key, kept current if the app stays open past midnight. */
export function useToday(): DateKey {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const update = () => setToday(todayKey());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
