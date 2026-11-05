import { Camera, Keyboard, Mic, Trash, Type } from 'lucide-react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import type { ReactNode } from 'react';
import { Card } from '../../components/ui/controls';
import { timeLabel } from '../../lib/dates';
import { fmtInt } from '../../lib/format';
import { MEALS } from '../../lib/meals';
import { spring } from '../../lib/motion';
import type { Entry, EntrySource } from '../../lib/types';

const SOURCE_ICON: Record<EntrySource, ReactNode> = {
  manual: <Keyboard size={16} />,
  text: <Type size={16} />,
  voice: <Mic size={16} />,
  photo: <Camera size={16} />,
};

const REVEAL = 88;

function subtitle(entry: Entry): string {
  const parts = [timeLabel(entry.loggedAt)];
  if (entry.items.length > 1) {
    parts.push(entry.items.map((i) => i.name).join(', '));
  } else {
    const { protein, carbs, fat } = entry.totals;
    if (protein || carbs || fat) parts.push(`P ${fmtInt(protein)} · C ${fmtInt(carbs)} · F ${fmtInt(fat)} g`);
  }
  return parts.join(' · ');
}

function EntryRow({ entry, onDelete }: { entry: Entry; onDelete: () => void }) {
  const x = useMotionValue(0);
  const actionOpacity = useTransform(x, [-REVEAL, -24, 0], [1, 0.6, 0]);
  const settle = (to: number) => animate(x, to, spring);

  return (
    <motion.li
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={spring}
      className="group relative overflow-hidden"
    >
      <motion.button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onDelete}
        style={{ opacity: actionOpacity }}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-danger text-[15px] font-semibold text-white"
      >
        Delete
      </motion.button>
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragEnd={(_, info) => settle(info.offset.x < -44 || info.velocity.x < -400 ? -REVEAL : 0)}
        className="relative flex items-center gap-3 bg-surface px-4 py-3.5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill-2 text-ink-2">
          {SOURCE_ICON[entry.source]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium tracking-[-0.01em]">{entry.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-ink-2">{subtitle(entry)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[16px] font-semibold tabular-nums tracking-[-0.01em]">{fmtInt(entry.totals.kcal)}</p>
          <p className="text-[12px] text-ink-3">kcal</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${entry.title}`}
          className="hidden size-8 shrink-0 items-center justify-center rounded-full text-ink-3 opacity-0 transition hover:bg-fill-2 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 lg:flex"
        >
          <Trash size={16} />
        </button>
      </motion.div>
    </motion.li>
  );
}

function EmptyDay({ isToday }: { isToday: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[24px] border-[1.5px] border-dashed border-ink-3/35 px-6 py-8 text-center"
    >
      <p className="text-[17px] font-semibold tracking-[-0.01em]">
        {isToday ? 'Nothing logged yet' : 'Nothing logged this day'}
      </p>
      <p className="mx-auto mt-1.5 max-w-[300px] text-balance text-[15px] leading-snug text-ink-2">
        Tell Plate what you ate — like “two rotis with dal and a bowl of rice”.
      </p>
    </motion.div>
  );
}

export function MealList({
  entries,
  isToday,
  onDelete,
}: {
  entries: Entry[] | null;
  isToday: boolean;
  onDelete: (entry: Entry) => void;
}) {
  if (entries === null) return null;
  if (entries.length === 0) return <EmptyDay isToday={isToday} />;

  return (
    <div className="space-y-6">
      <AnimatePresence initial={false}>
        {MEALS.map((meal) => {
          const list = entries.filter((e) => e.meal === meal.value);
          if (list.length === 0) return null;
          const kcal = list.reduce((sum, e) => sum + e.totals.kcal, 0);
          return (
            <motion.section
              key={meal.value}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={spring}
            >
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{meal.label}</h2>
                <span className="text-[15px] tabular-nums text-ink-2">{fmtInt(kcal)} kcal</span>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-hairline">
                  <AnimatePresence initial={false}>
                    {list.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} onDelete={() => onDelete(entry)} />
                    ))}
                  </AnimatePresence>
                </ul>
              </Card>
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
