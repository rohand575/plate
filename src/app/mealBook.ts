import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { haptic } from '../lib/haptics';
import { mealForTime, mealLabel } from '../lib/meals';
import { type RecentMeal, mealKey, recentMeals, toPreset } from '../lib/presets';
import type { DateKey, Entry, Favourite, MealPreset, NewEntry } from '../lib/types';
import { useSession } from './session';

/** Favourite and recent meals, which can be logged again without asking the AI. */
export interface MealBook {
  favourites: Favourite[];
  recents: RecentMeal[];
  isFavourite: (title: string) => boolean;
  /** Stars the meal, or unstars it when a favourite already has that name. */
  toggleFavourite: (meal: MealPreset) => void;
  /** Logs the meal as it is to the day on screen, under the meal for the time of day. */
  quickAdd: (meal: MealPreset) => void;
}

export const MealBookContext = createContext<MealBook | null>(null);

export function useMealBook(): MealBook {
  const book = useContext(MealBookContext);
  if (!book) throw new Error('useMealBook must be used inside the Today screen');
  return book;
}

/** How many of the latest entries recent meals are drawn from. */
const RECENT_ENTRIES = 100;

/** Keeps favourites and recent meals live; `date` is the day quick adds go to. */
export function useMealBookState(date: DateKey): MealBook {
  const { backend, user } = useSession();
  const toast = useToast();
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(
    () => backend.data.watchFavourites(user.uid, setFavourites, (e) => console.error('Couldn’t load favourites', e)),
    [backend, user.uid],
  );
  useEffect(
    () => backend.data.watchRecentEntries(user.uid, RECENT_ENTRIES, setEntries, (e) => console.error('Couldn’t load recent meals', e)),
    [backend, user.uid],
  );

  const recents = useMemo(() => recentMeals(entries), [entries]);

  return useMemo(() => {
    const byKey = new Map(favourites.map((f) => [mealKey(f.title), f]));
    const failed = (e: unknown) =>
      toast({
        message:
          (e as { code?: string }).code === 'permission-denied'
            ? 'Favourites aren’t set up yet — publish the latest Firestore rules (see README).'
            : 'Couldn’t update your favourites. Try again.',
      });
    const save = (favourite: Favourite) => void backend.data.saveFavourite(user.uid, favourite).catch(failed);

    return {
      favourites,
      recents,
      isFavourite: (title) => byKey.has(mealKey(title)),
      toggleFavourite(meal) {
        haptic(10);
        const existing = byKey.get(mealKey(meal.title));
        if (existing) {
          backend.data.deleteFavourite(user.uid, existing.id).catch(failed);
          toast({ message: `Removed ${existing.title} from favourites`, action: { label: 'Undo', onClick: () => save(existing) } });
        } else {
          save({ ...toPreset(meal), id: crypto.randomUUID(), savedAt: Date.now() });
          toast({ message: `Saved ${meal.title} to favourites` });
        }
      },
      quickAdd(meal) {
        const id = crypto.randomUUID();
        const entry: NewEntry = {
          ...toPreset(meal),
          date,
          meal: mealForTime(),
          transcript: null,
          loggedAt: Date.now(),
        };
        backend.data.addEntry(user.uid, entry, id).catch(() => toast({ message: 'Couldn’t save that. Check your connection.' }));
        haptic([10, 50, 10]);
        toast({
          message: `Added ${meal.title} to ${mealLabel(entry.meal)}`,
          action: { label: 'Undo', onClick: () => void backend.data.deleteEntry(user.uid, id) },
        });
      },
    };
  }, [backend, user.uid, toast, favourites, recents, date]);
}
