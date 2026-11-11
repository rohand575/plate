import { Check, Plus, Search, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { useMealBook } from '../../app/mealBook';
import { useFlash } from '../../hooks/useFlash';
import { shortDay, todayKey } from '../../lib/dates';
import { cx, fmtInt } from '../../lib/format';
import { mealLabel } from '../../lib/meals';
import { spring } from '../../lib/motion';
import { matchMeals, mealKey, unstarred } from '../../lib/presets';
import type { MealPreset } from '../../lib/types';

/** The foods in a meal, or its macros when it's a single food. */
export function mealDetail(meal: MealPreset): string {
  if (meal.items.length > 1) return meal.items.map((i) => i.name).join(', ');
  const { protein, carbs, fat } = meal.totals;
  return protein || carbs || fat ? `P ${fmtInt(protein)} · C ${fmtInt(carbs)} · F ${fmtInt(fat)} g` : mealLabel(meal.meal);
}

/** Logs a meal in one tap; shows a tick for a moment afterwards. */
export function AddButton({ label, added, onClick, className }: { label: string; added: boolean; onClick: () => void; className?: string }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      transition={spring}
      className={cx(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-200',
        added ? 'bg-brand' : 'bg-ink',
        className,
      )}
    >
      <motion.span key={added ? 'added' : 'add'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
        {added ? <Check size={17} strokeWidth={3} /> : <Plus size={18} strokeWidth={2.6} />}
      </motion.span>
    </motion.button>
  );
}

export function FavouriteStar({ on, size = 19 }: { on: boolean; size?: number }) {
  return <Star size={size} className={on ? 'fill-[#ff9f0a] text-[#ff9f0a]' : 'text-ink-3'} />;
}

interface MealRowProps {
  meal: MealPreset;
  detail: string;
  added: boolean;
  onOpen: () => void;
  onAdd: () => void;
  /** Shows a star that saves or removes the meal as a favourite. */
  favourite?: { on: boolean; toggle: () => void };
}

export function MealRow({ meal, detail, added, onOpen, onAdd, favourite }: MealRowProps) {
  return (
    <li className="flex items-center gap-1">
      {favourite && (
        <button
          type="button"
          onClick={favourite.toggle}
          aria-pressed={favourite.on}
          aria-label={favourite.on ? `Remove ${meal.title} from favourites` : `Save ${meal.title} to favourites`}
          className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors active:bg-fill-2"
        >
          <FavouriteStar on={favourite.on} />
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Check ${meal.title} before adding`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] py-3 pr-1 text-left transition-colors active:bg-fill-2/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium tracking-[-0.01em]">{meal.title}</span>
          <span className="mt-0.5 block truncate text-[13px] text-ink-2">{detail}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[16px] font-semibold tabular-nums tracking-[-0.01em]">{fmtInt(meal.totals.kcal)}</span>
          <span className="block text-[12px] text-ink-3">kcal</span>
        </span>
      </button>
      <AddButton label={`Add ${meal.title}`} added={added} onClick={onAdd} className="ml-1.5" />
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="px-0.5 text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

/** Recent meals beyond this many are only found by searching. */
const RECENT_SHOWN = 30;

/** Favourite and recent meals: tap + to log one as it was, or tap it to adjust it first. */
export function MealsStage({ onOpen, onDescribe }: { onOpen: (meal: MealPreset) => void; onDescribe: (text: string) => void }) {
  const book = useMealBook();
  const [search, setSearch] = useState('');
  const [added, flash] = useFlash();
  const today = todayKey();

  const searching = search.trim() !== '';
  const others = unstarred(book.recents, book.favourites);
  const favourites = searching ? matchMeals(book.favourites, search) : book.favourites;
  const recents = searching ? matchMeals(others, search) : others.slice(0, RECENT_SHOWN);
  const total = book.favourites.length + others.length;

  const row = (meal: MealPreset, key: string, detail: string) => (
    <MealRow
      key={key}
      meal={meal}
      detail={detail}
      added={added === mealKey(meal.title)}
      onOpen={() => onOpen(meal)}
      onAdd={() => {
        book.quickAdd(meal);
        flash(mealKey(meal.title));
      }}
      favourite={{ on: book.isFavourite(meal.title), toggle: () => book.toggleFavourite(meal) }}
    />
  );

  if (total === 0) {
    return (
      <div className="px-5 pb-5 text-center">
        <p className="pt-4 text-[17px] font-semibold tracking-[-0.01em]">No meals yet</p>
        <p className="mx-auto mt-1.5 max-w-[300px] text-balance text-[15px] leading-snug text-ink-2">
          Meals you log show up here, so next time you can add them in one tap without waiting for the AI.
        </p>
        <button type="button" onClick={() => onDescribe('')} className="mt-4 w-full py-2.5 text-[15px] font-medium text-ink-2">
          Describe a meal
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pb-5">
      {total > 5 && (
        <label className="flex h-11 items-center gap-2.5 rounded-[14px] bg-fill-2 px-3.5 text-ink-3 outline-2 -outline-offset-2 outline-transparent transition-[outline-color] focus-within:outline-ink">
          <Search size={17} className="shrink-0" />
          <span className="sr-only">Search your meals</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your meals"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
      )}

      {(!searching || favourites.length > 0) && (
        <Section title="Favourites">
          {favourites.length > 0 ? (
            <ul className="divide-y divide-hairline">{favourites.map((f) => row(f, f.id, mealDetail(f)))}</ul>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-[14px] text-ink-2">
              Tap <FavouriteStar on={false} size={15} /> next to a meal to keep it here.
            </p>
          )}
        </Section>
      )}

      {recents.length > 0 && (
        <Section title="Recent">
          <ul className="divide-y divide-hairline">
            {recents.map((r) => row(r, mealKey(r.title), `${shortDay(r.lastDate, today)} · ${mealDetail(r)}`))}
          </ul>
        </Section>
      )}

      {searching && favourites.length === 0 && recents.length === 0 && (
        <p className="mt-5 text-center text-[15px] text-ink-2">No meals match “{search.trim()}”.</p>
      )}

      <button type="button" onClick={() => onDescribe(search.trim())} className="mt-3 w-full py-2.5 text-[15px] font-medium text-ink-2">
        {searching ? `Estimate “${search.trim()}” with AI instead` : 'Something new? Describe it'}
      </button>
    </div>
  );
}
