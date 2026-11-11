import { useMemo } from 'react';
import { useMealBook } from '../../app/mealBook';
import { useFlash } from '../../hooks/useFlash';
import { fmtInt } from '../../lib/format';
import { mealForTime } from '../../lib/meals';
import { mealKey, quickPicks } from '../../lib/presets';
import type { MealPreset } from '../../lib/types';
import { AddButton, FavouriteStar } from '../capture/MealsStage';

/** Favourite and frequent meals for one-tap logging, without asking the AI again. */
export function QuickAdd({ onOpen, onSeeAll }: { onOpen: (meal: MealPreset) => void; onSeeAll: () => void }) {
  const book = useMealBook();
  const [added, flash] = useFlash();
  const picks = useMemo(() => quickPicks(book.favourites, book.recents, mealForTime()), [book.favourites, book.recents]);

  if (picks.length === 0) return null;

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between px-1">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Quick add</h2>
        <button type="button" onClick={onSeeAll} className="py-1 text-[15px] font-medium text-brand-ink">
          See all
        </button>
      </div>
      {/* Swipeable on phones; two rows of four on wide screens, the rest under "See all". */}
      <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-4 pt-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0">
        {picks.map((meal) => {
          const key = mealKey(meal.title);
          return (
            <li key={key} className="relative w-[148px] shrink-0 snap-start lg:w-auto lg:nth-[n+9]:hidden">
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
              <AddButton
                label={`Add ${meal.title}`}
                added={added === key}
                onClick={() => {
                  book.quickAdd(meal);
                  flash(key);
                }}
                className="absolute bottom-3 right-3"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
