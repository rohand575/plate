import type { AnalyzeInput, AnalyzeResult, AppUser, DateKey, Entry, NewEntry, Profile } from '../lib/types';

export type Unsubscribe = () => void;

export interface AuthApi {
  watch(cb: (user: AppUser | null) => void): Unsubscribe;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export interface DataApi {
  /** Emits `null` when the user has not finished onboarding. */
  watchProfile(uid: string, cb: (profile: Profile | null) => void, onError: (e: Error) => void): Unsubscribe;
  /** Saves the profile; logs a weigh-in for `today` when `logWeight` is set. */
  saveProfile(user: AppUser, profile: Profile, opts: { today: DateKey; logWeight: boolean }): Promise<void>;
  logWeight(uid: string, date: DateKey, kg: number): Promise<void>;
  /** Entries with `from <= date <= to`, ordered by time logged. */
  watchEntries(uid: string, from: DateKey, to: DateKey, cb: (entries: Entry[]) => void, onError: (e: Error) => void): Unsubscribe;
  addEntry(uid: string, entry: NewEntry): Promise<void>;
  restoreEntry(uid: string, entry: Entry): Promise<void>;
  deleteEntry(uid: string, id: string): Promise<void>;
}

export interface AiApi {
  /** Turns a recording, description or photo into estimated food items. Throws AiError. */
  analyze(input: AnalyzeInput): Promise<AnalyzeResult>;
}

export interface Backend {
  kind: 'firebase' | 'demo';
  auth: AuthApi;
  data: DataApi;
  ai: AiApi;
}

export class ConfigError extends Error {}

/** An AI failure with a message that can be shown to the person as-is. */
export class AiError extends Error {}

export const byLoggedAt = (a: Entry, b: Entry) => a.loggedAt - b.loggedAt;
