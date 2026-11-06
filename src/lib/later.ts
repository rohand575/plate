import { useCallback, useSyncExternalStore } from 'react';
import type { EntrySource, MealAnalysis } from './types';

/**
 * Estimates kept with "Decide later", so a meal checked before eating can be logged
 * afterwards without another AI call. They stay on this device and expire after 12 hours.
 */
export interface SavedCheck {
  id: string;
  savedAt: number;
  source: Exclude<EntrySource, 'manual'>;
  /** What was said or typed, or the note added to a photo. */
  transcript: string | null;
  /** Title and items at the portions chosen when it was saved. */
  analysis: MealAnalysis;
}

const TTL_MS = 12 * 60 * 60 * 1000;
const MAX = 10;
const storageKey = (uid: string) => `plate.later.${uid}`;

const memory = new Map<string, SavedCheck[]>();
const listeners = new Set<() => void>();
const fresh = (c: SavedCheck) => Date.now() - c.savedAt < TTL_MS;

function load(uid: string): SavedCheck[] {
  let list = memory.get(uid);
  if (!list) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(uid)) ?? '[]');
      list = Array.isArray(parsed) ? (parsed as SavedCheck[]).filter(fresh) : [];
    } catch {
      list = [];
    }
    memory.set(uid, list);
  }
  return list;
}

function store(uid: string, list: SavedCheck[]) {
  memory.set(uid, list);
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode): saved checks last until the app is closed.
  }
  listeners.forEach((l) => l());
}

/** Saves (or replaces) a check; `savedAt` is only passed when restoring one. */
export function saveCheck(uid: string, check: Omit<SavedCheck, 'savedAt'> & { savedAt?: number }) {
  const rest = load(uid).filter((c) => c.id !== check.id && fresh(c));
  const list = [{ ...check, savedAt: check.savedAt ?? Date.now() }, ...rest].sort((a, b) => b.savedAt - a.savedAt);
  store(uid, list.slice(0, MAX));
}

export function removeCheck(uid: string, id: string) {
  const list = load(uid);
  if (list.some((c) => c.id === id)) store(uid, list.filter((c) => c.id !== id));
}

/** Saved checks that haven't expired, newest first. */
export function useSavedChecks(uid: string): SavedCheck[] {
  const subscribe = useCallback((onChange: () => void) => {
    listeners.add(onChange);
    return () => void listeners.delete(onChange);
  }, []);
  return useSyncExternalStore(subscribe, () => load(uid)).filter(fresh);
}
