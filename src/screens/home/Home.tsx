import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../app/session';
import { useToast } from '../../components/Toast';
import { Avatar } from '../../components/ui/brand';
import { Button } from '../../components/ui/Button';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { useToday } from '../../hooks/useToday';
import { dayTitle, fromKey, longDate, weekDays } from '../../lib/dates';
import { haptic } from '../../lib/haptics';
import { entriesTotal } from '../../lib/meals';
import { iosEase } from '../../lib/motion';
import { computePlan } from '../../lib/nutrition';
import type { DateKey, Entry } from '../../lib/types';
import { CaptureSheet, type CaptureRequest } from '../capture/CaptureSheet';
import { ProfileScreen } from '../profile/ProfileScreen';
import { CaptureCard, CaptureDock, type CaptureActions } from './Capture';
import { MealList } from './MealList';
import { SummaryCard } from './SummaryCard';
import { WeekStrip } from './WeekStrip';

/** Live entries for a date range; `null` until the first snapshot arrives. */
function useEntries(from: DateKey, to: DateKey): Entry[] | null {
  const { backend, user } = useSession();
  const toast = useToast();
  const [state, setState] = useState<{ range: string; entries: Entry[] } | null>(null);
  const range = `${from}/${to}`;

  useEffect(
    () =>
      backend.data.watchEntries(
        user.uid,
        from,
        to,
        (entries) => setState({ range: `${from}/${to}`, entries }),
        (e) => {
          console.error(e);
          toast({ message: 'Couldn’t load your log.' });
        },
      ),
    [backend, user.uid, from, to, toast],
  );

  return state?.range === range ? state.entries : null;
}

function DayHeader({
  selected,
  today,
  onToday,
  onProfile,
}: {
  selected: DateKey;
  today: DateKey;
  onToday: () => void;
  onProfile: () => void;
}) {
  const { user } = useSession();
  const title = dayTitle(selected, today);
  const weekday = fromKey(selected).toLocaleDateString(undefined, { weekday: 'long' });
  const caption =
    title === weekday ? fromKey(selected).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : longDate(selected);

  return (
    <header className="flex items-end justify-between gap-4 pt-3">
      <div className="relative min-w-0">
        <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-2">{caption}</p>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h1
            key={selected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: iosEase }}
            className="text-[34px] font-bold leading-[1.15] tracking-[-0.03em]"
          >
            {title}
          </motion.h1>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2.5 pb-1">
        <AnimatePresence>
          {selected !== today && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <Button size="sm" variant="secondary" className="bg-surface shadow-card" onClick={onToday}>
                Today
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          onClick={onProfile}
          whileTap={{ scale: 0.92 }}
          aria-label="Profile and settings"
          className="rounded-full ring-2 ring-white shadow-card"
        >
          <Avatar name={user.displayName} photoURL={user.photoURL} size={38} />
        </motion.button>
      </div>
    </header>
  );
}

export function Home() {
  const { backend, user, profile } = useSession();
  const toast = useToast();
  const desktop = useIsDesktop();
  const today = useToday();
  const [selected, setSelected] = useState(today);
  const [profileOpen, setProfileOpen] = useState(false);
  const [capture, setCapture] = useState<CaptureRequest | null>(null);
  const captureId = useRef(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const takePhoto = useCallback(() => photoInput.current?.click(), []);

  // If the app stays open past midnight, follow "today" forward.
  const lastToday = useRef(today);
  useEffect(() => {
    setSelected((s) => (s === lastToday.current ? today : s));
    lastToday.current = today;
  }, [today]);

  // Age (and so the plan) can change with the date.
  const plan = useMemo(() => computePlan(profile, new Date()), [profile, today]);
  const week = useMemo(() => weekDays(selected), [selected]);
  const entries = useEntries(week[0], week[6]);
  const dayEntries = useMemo(() => entries?.filter((e) => e.date === selected) ?? null, [entries, selected]);
  const totals = entriesTotal(dayEntries ?? []);
  const kcalByDay = useMemo(() => {
    const map: Record<DateKey, number> = {};
    for (const e of entries ?? []) map[e.date] = (map[e.date] ?? 0) + e.totals.kcal;
    return map;
  }, [entries]);

  function remove(entry: Entry) {
    haptic(12);
    backend.data.deleteEntry(user.uid, entry.id).catch(() => toast({ message: 'Couldn’t delete that. Try again.' }));
    toast({
      message: `Removed ${entry.title}`,
      action: { label: 'Undo', onClick: () => void backend.data.restoreEntry(user.uid, entry) },
    });
  }

  const actions: CaptureActions = {
    onSpeak: () => setCapture({ id: ++captureId.current, mode: 'voice' }),
    onPhoto: takePhoto,
    onType: () => setCapture({ id: ++captureId.current, mode: 'text' }),
  };

  const weekStrip = (
    <WeekStrip week={week} selected={selected} today={today} kcalByDay={kcalByDay} target={plan.calories} onSelect={setSelected} />
  );

  return (
    <>
      <div className="mx-auto w-full max-w-[600px] px-4 pb-[calc(env(safe-area-inset-bottom)+132px)] pt-[max(env(safe-area-inset-top),8px)] lg:max-w-[1120px] lg:px-8 lg:pb-16 lg:pt-10">
        <DayHeader selected={selected} today={today} onToday={() => setSelected(today)} onProfile={() => setProfileOpen(true)} />

        <div className="mt-5 space-y-4 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-4 lg:sticky lg:top-8">
            {!desktop && weekStrip}
            <SummaryCard plan={plan} totals={totals} />
            <CaptureCard {...actions} />
          </div>
          <div className="space-y-6 pt-2 lg:pt-0">
            {desktop && weekStrip}
            <MealList entries={dayEntries} isToday={selected === today} onDelete={remove} />
          </div>
        </div>
      </div>

      <CaptureDock {...actions} />
      {/* Without `capture`, Android offers both the camera and the gallery. */}
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) setCapture({ id: ++captureId.current, mode: 'photo', file });
        }}
      />
      <CaptureSheet request={capture} date={selected} onClose={() => setCapture(null)} onRetakePhoto={takePhoto} />
      <AnimatePresence>{profileOpen && <ProfileScreen key="profile" onClose={() => setProfileOpen(false)} />}</AnimatePresence>
    </>
  );
}
