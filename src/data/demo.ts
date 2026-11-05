import type { AppUser, Entry, MealAnalysis, Profile } from '../lib/types';
import { type Backend, byLoggedAt } from './backend';

/** Local-only backend for `npm run demo`: simulated sign-in, data kept in localStorage. */

const KEYS = { session: 'plate.demo.session', profile: 'plate.demo.profile', entries: 'plate.demo.entries' };
const DEMO_USER: AppUser = { uid: 'demo', displayName: 'Demo User', email: 'demo@plate.app', photoURL: null };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode); the demo just won't persist.
  }
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  fn();
  return () => void listeners.delete(fn);
}

const later = <T,>(value: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(value), ms));

const DEMO_NOTE = 'Sample estimate — demo mode doesn’t call OpenAI.';

const SAMPLE_SPOKEN: MealAnalysis = {
  title: 'Egg bhurji with toast',
  confidence: 'high',
  note: DEMO_NOTE,
  items: [
    { name: 'Egg bhurji', quantity: 2, unit: 'egg', grams: 120, kcal: 175, protein: 13, carbs: 4, fat: 12, assumption: 'Includes onion and tomato.' },
    { name: 'Sunflower oil', quantity: 2, unit: 'tbsp', grams: 27, kcal: 240, protein: 0, carbs: 0, fat: 27, assumption: null },
    { name: 'Toast', quantity: 1, unit: 'slice', grams: 30, kcal: 80, protein: 3, carbs: 15, fat: 1, assumption: 'Assumed white bread, no butter.' },
  ],
};

const SAMPLE_PHOTO: MealAnalysis = {
  title: 'Dal, rice and rotis',
  confidence: 'medium',
  note: DEMO_NOTE,
  items: [
    { name: 'Toor dal', quantity: 1, unit: 'katori', grams: 150, kcal: 165, protein: 9, carbs: 22, fat: 5, assumption: 'Assumed 1 tsp ghee in the tadka.' },
    { name: 'Steamed rice', quantity: 1, unit: 'cup', grams: 150, kcal: 195, protein: 4, carbs: 43, fat: 0, assumption: null },
    { name: 'Roti', quantity: 2, unit: 'roti', grams: 70, kcal: 210, protein: 7, carbs: 40, fat: 2, assumption: 'Medium rotis without ghee.' },
  ],
};

export function createDemoBackend(): Backend {
  return {
    kind: 'demo',
    auth: {
      watch: (cb) => subscribe(() => cb(read<AppUser | null>(KEYS.session, null))),
      signInWithGoogle: async () => write(KEYS.session, await later(DEMO_USER)),
      signOut: async () => write(KEYS.session, null),
    },
    data: {
      watchProfile: (_uid, cb) => subscribe(() => cb(read<Profile | null>(KEYS.profile, null))),
      async saveProfile(_user, profile) {
        write(KEYS.profile, profile);
      },
      async logWeight(_uid, _date, kg) {
        const profile = read<Profile | null>(KEYS.profile, null);
        if (profile) write(KEYS.profile, { ...profile, weightKg: kg });
      },
      watchEntries: (_uid, from, to, cb) =>
        subscribe(() =>
          cb(read<Entry[]>(KEYS.entries, []).filter((e) => e.date >= from && e.date <= to).sort(byLoggedAt)),
        ),
      async addEntry(_uid, entry) {
        write(KEYS.entries, [...read<Entry[]>(KEYS.entries, []), { ...entry, id: crypto.randomUUID() }]);
      },
      async restoreEntry(_uid, entry) {
        write(KEYS.entries, [...read<Entry[]>(KEYS.entries, []), entry]);
      },
      async deleteEntry(_uid, id) {
        write(KEYS.entries, read<Entry[]>(KEYS.entries, []).filter((e) => e.id !== id));
      },
    },
    ai: {
      analyze: (input) =>
        later(
          {
            transcript:
              input.kind === 'text'
                ? input.text
                : input.kind === 'audio'
                  ? 'Egg bhurji with two eggs and two tablespoons of oil, and a slice of toast'
                  : null,
            analysis: input.kind === 'photo' ? SAMPLE_PHOTO : SAMPLE_SPOKEN,
            usage: null,
          },
          2200,
        ),
    },
  };
}
