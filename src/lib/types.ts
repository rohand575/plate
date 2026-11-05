/** Local calendar day, `YYYY-MM-DD`. */
export type DateKey = string;

export type Sex = 'male' | 'female' | 'unspecified';
export type WorkType = 'sitting' | 'mixed' | 'standing' | 'physical';
export type Workouts = 'none' | 'some' | 'regular' | 'daily';
export type Walking = 'light' | 'moderate' | 'high';
export type Pace = 'maintain' | 'slow' | 'standard' | 'fast';
export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type EntrySource = 'manual' | 'text' | 'voice' | 'photo';

export interface Profile {
  birthDate: DateKey;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number | null;
  work: WorkType;
  workouts: Workouts;
  walking: Walking;
  pace: Pace;
}

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem extends Nutrients {
  name: string;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
}

export interface Entry {
  id: string;
  date: DateKey;
  meal: Meal;
  title: string;
  source: EntrySource;
  items: FoodItem[];
  totals: Nutrients;
  transcript: string | null;
  /** Client time in ms; used for ordering within a day. */
  loggedAt: number;
}

export type NewEntry = Omit<Entry, 'id'>;

/** A food item as estimated by the AI, before the person confirms it. */
export interface AnalyzedItem extends FoodItem {
  quantity: number;
  unit: string;
  /** What the AI guessed, e.g. "Assumed 2 eggs". */
  assumption: string | null;
}

export interface MealAnalysis {
  title: string;
  items: AnalyzedItem[];
  confidence: 'high' | 'medium' | 'low';
  note: string | null;
}

export type AnalyzeInput =
  | { kind: 'text'; text: string }
  | { kind: 'audio'; audio: Blob }
  | { kind: 'photo'; image: Blob; note: string | null };

export interface AnalyzeResult {
  /** What was heard (voice) or typed (text); null for photos. */
  transcript: string | null;
  analysis: MealAnalysis;
  usage: { used: number; limit: number } | null;
}
