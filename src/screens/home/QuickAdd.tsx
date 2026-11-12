import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import { useMealBook } from '../../app/mealBook';
import { Card } from '../../components/ui/controls';
import { useFlash } from '../../hooks/useFlash';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { fmtInt } from '../../lib/format';
import { mealForTime } from '../../lib/meals';
import { iosEase } from '../../lib/motion';
import { mealKey, quickPicks } from '../../lib/presets';
import type { MealPreset } from '../../lib/types';
import { AddButton, FavouriteStar, MealRow, mealDetail } from '../capture/MealsStage';

/** How many meals Quick add offers; the rest are under "See all". */
const SHOWN = 5;

const REVEAL = { closed: { height: 0, opacity: 0 }, open: { height: 'auto', opacity: 1 } };

interface PicksProps {
  picks: MealPreset[];
  added: string | null;
  onOpen: (meal: MealPreset) => void;
  onAdd: (meal: MealPreset) => void;
}

/** Five cards don't fit evenly beside the summary, so wide screens get a list like "Saved for later". */
function PickList({ picks, added, onOpen, onAdd }: PicksProps) {
  const book = useMealBook();
  return (
    <Card className="mt-2 px-4">
      <ul className="divide-y divide-hairline">
        {picks.map((meal) => (
          <MealRow
            key={mealKey(meal.title)}
            meal={meal}
            detail={mealDetail(meal)}
            added={added === mealKey(meal.title)}
            onOpen={() => onOpen(meal)}
            onAdd={() => onAdd(meal)}
            favourite={{ on: book.isFavourite(meal.title), toggle: () => book.toggleFavourite(meal) }}
          />
        ))}
      </ul>
    </Card>
  );
}

/** Swipeable cards on phones, running edge to edge. */
function PickStrip({ picks, added, onOpen, onAdd }: PicksProps) {
  const book = useMealBook();
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-4 pt-2">
      {picks.map((meal) => {
        const key = mealKey(meal.title);
        return (
          <li key={key} className="relative w-[148px] shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onOpen(meal)}
              aria-label={`Check ${meal.title} before adding`}
              className="flex h-full min-h-[112px] w-full flex-col rounded-[20px] bg-surface p-3.5 text-left shadow-card transition-colors active:bg-fill-2"
            >
              <span className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em]">
                {book.isFavourite(meal.title) && (
                  <span className="mr-1 inline-block align-[-1px]">
                    <FavouriteStar on size={13} />
                  </span>
                )}
                {meal.title}
              </span>
              <span className="mt-auto pt-2 text-[17px] font-semibold tabular-nums tracking-[-0.01em]">
                {fmtInt(meal.totals.kcal)}
                <span className="ml-0.5 text-[12px] font-medium text-ink-3">kcal</span>
              </span>
            </button>
            <AddButton label={`Add ${meal.title}`} added={added === key} onClick={() => onAdd(meal)} className="absolute bottom-3 right-3" />
          </li>
        );
      })}
    </ul>
  );
}

/** Favourite and frequent meals for one-tap logging, without asking the AI again. Starts closed. */
export function QuickAdd({ onOpen, onSeeAll }: { onOpen: (meal: MealPreset) => void; onSeeAll: () => void }) {
  const book = useMealBook();
  const desktop = useIsDesktop();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const [added, flash] = useFlash();
  const picks = useMemo(() => quickPicks(book.favourites, book.recents, mealForTime(), SHOWN), [book.favourites, book.recents]);

  if (picks.length === 0) return null;

  const props: PicksProps = {
    picks,
    added,
    onOpen,
    onAdd(meal) {
      book.quickAdd(meal);
      flash(mealKey(meal.title));
    },
  };

  return (
    <section>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={listId}
            className="-ml-1 flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2"
          >
            Quick add
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease: iosEase }} className="text-ink-3">
              <ChevronDown size={20} strokeWidth={2.4} />
            </motion.span>
            {!open && (
              <span className="text-[15px] font-medium tracking-normal text-ink-3">
                {picks.length} {picks.length === 1 ? 'meal' : 'meals'}
              </span>
            )}
          </button>
        </h2>
        <button type="button" onClick={onSeeAll} className="py-1 text-[15px] font-medium text-brand-ink">
          See all
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="picks"
            id={listId}
            variants={REVEAL}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ duration: 0.3, ease: iosEase }}
            // Clipped only while it slides, so card shadows and the edge-to-edge strip show once it's open.
            onAnimationStart={() => setSettled(false)}
            onAnimationComplete={(name) => setSettled(name === 'open')}
            className={settled ? undefined : 'overflow-hidden'}
          >
            {desktop ? <PickList {...props} /> : <PickStrip {...props} />}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
