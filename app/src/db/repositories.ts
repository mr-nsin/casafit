/**
 * Repository interfaces and domain types. Screens, hooks and stores depend on
 * these, never on SQL, so tests can swap in any implementation.
 * Times are epoch milliseconds; dates are local 'YYYY-MM-DD'.
 */

export type Style = 'normal' | 'yoga' | 'dance';
export type Felt = 'easy' | 'about_right' | 'hard';
export type SessionStatus = 'complete' | 'unfinished';
export type Goal = 'stay_fit' | 'body_part' | 'gentler';
export type Experience = 'new' | 'on_and_off' | 'regular';
export type Sex = 'woman' | 'man' | 'other' | 'skip';
export type PainArea = 'knees' | 'back' | 'shoulders' | 'wrists';
export type HealthFlag = 'heart_bp' | 'pregnancy' | 'recent_surgery';
export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';

export interface Profile {
  name: string | null;
  birthYear: number | null;
  confirmed18: boolean;
  heightCm: number | null;
  weightKg: number | null;
  sex: Sex | null;
  painAreas: PainArea[];
  healthFlags: HealthFlag[];
  photoUri: string | null;
  stepGoal: number;
  locale: string;
  theme: 'system' | 'light' | 'dark';
  onboarded: boolean;
  updatedAt: number;
}
export interface ProfileRepo {
  get(): Promise<Profile | null>;
  save(patch: Partial<Omit<Profile, 'updatedAt'>>): Promise<Profile>;
  clear(): Promise<void>;
}

export interface PlanRow {
  goal: Goal;
  bodyParts: string[];
  styles: Style[];
  mix: Partial<Record<Style, number>>;
  daysPerWeek: number;
  experience: Experience;
  variant: 'standard' | 'gentler';
  weekNumber: number;
  engineVersion: string;
  updatedAt: number;
  syncedAt: number | null;
}
export interface PlanDayRow {
  planWeek: number;
  dayIndex: number;
  kind: 'workout' | 'walk' | 'stretch' | 'rest';
  style: Style | null;
  title: string;
  sessionJson: string | null;
  overridden: boolean;
  status: 'upcoming' | 'today' | 'done' | 'skipped';
}
export interface PlanRepo {
  get(): Promise<PlanRow | null>;
  save(p: Omit<PlanRow, 'updatedAt' | 'syncedAt'>): Promise<void>;
  markSynced(at: number): Promise<void>;
  days(week: number): Promise<PlanDayRow[]>;
  replaceDays(week: number, days: PlanDayRow[]): Promise<void>;
  setDayStatus(week: number, dayIndex: number, status: PlanDayRow['status']): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionLog {
  id: string;
  planWeek: number;
  planDay: number;
  style: Style;
  status: SessionStatus;
  durationS: number;
  movesDone: number;
  movesPlanned: number;
  felt: Felt | null;
  rungChanges: unknown[];
  feelSignals: unknown[];
  warmupSkipped: boolean;
  formChecks: number;
  quiet: boolean;
  completedAt: number;
  syncedAt: number | null;
}
export interface SessionLogRepo {
  /** Idempotent on id: a replay does not duplicate or overwrite. */
  insert(log: Omit<SessionLog, 'syncedAt'>): Promise<boolean>;
  list(opts?: { sinceMs?: number; status?: SessionStatus }): Promise<SessionLog[]>;
  unsynced(): Promise<SessionLog[]>;
  markSynced(ids: string[], at: number): Promise<void>;
}

export interface SessionSnapshot {
  planDayWeek: number | null;
  planDayIndex: number | null;
  startedAt: number;
  stateJson: string;
  snapshotAt: number;
  expiresAt: number;
}
export interface SessionSnapshotRepo {
  save(s: SessionSnapshot): Promise<void>;
  /** Returns null once expiresAt has passed (24 h resume window, D13). */
  load(now: number): Promise<SessionSnapshot | null>;
  clear(): Promise<void>;
}

export interface MicroSessionLog {
  id: string;
  planId: string;
  activeS: number;
  at: number;
}
export interface MicroSessionRepo {
  insert(m: MicroSessionLog): Promise<boolean>;
  totalActiveS(sinceMs: number): Promise<number>;
}

export interface FavouriteRepo {
  toggle(exerciseId: string, at: number): Promise<boolean>;
  all(): Promise<string[]>;
}

export interface WeeklyCheckin {
  weekStart: string;
  mood: 'tough' | 'good' | 'great' | null;
  weightKg: number | null;
  waistCm: number | null;
}
export interface WeeklyCheckinRepo {
  save(c: WeeklyCheckin): Promise<void>;
  get(weekStart: string): Promise<WeeklyCheckin | null>;
}

export interface FoodEntry {
  id: string;
  loggedOn: string;
  meal: Meal;
  foodId: string;
  unit: string;
  portions: number;
  snapshot: { kcal: number; proteinG: number; packVersion: number } | null;
  createdAt: number;
  syncedAt: number | null;
}
export interface FoodRepo {
  add(e: Omit<FoodEntry, 'syncedAt'>): Promise<boolean>;
  update(id: string, patch: { portions?: number; meal?: Meal }): Promise<void>;
  remove(id: string): Promise<void>;
  forDay(loggedOn: string): Promise<FoodEntry[]>;
  recentFoodIds(limit: number): Promise<string[]>;
  unsynced(): Promise<FoodEntry[]>;
  markSynced(ids: string[], at: number): Promise<void>;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: { foodId: string; unit: string; portions: number }[];
}
export interface NutritionProfile {
  diet: 'veg' | 'egg' | 'nonveg' | 'jain';
  allergies: string[];
  allergyOther: string | null;
  goal: 'maintain' | 'lose_gently' | 'gain';
  mealsPerDay: 3 | 4 | 5;
  targetKcal: number;
  targetProteinG: number;
  computedAt: number;
  inputsHash: string;
}
export interface MealPlanRow {
  id: string;
  active: boolean;
  profileHash: string;
  days: unknown;
  createdAt: number;
}
export interface NutritionRepo {
  getProfile(): Promise<NutritionProfile | null>;
  saveProfile(p: NutritionProfile): Promise<void>;
  activeMealPlan(): Promise<MealPlanRow | null>;
  /** Marks all others inactive. */
  saveMealPlan(p: Omit<MealPlanRow, 'active'>): Promise<void>;
  savedMeals(): Promise<SavedMeal[]>;
  saveMeal(m: SavedMeal): Promise<void>;
  removeSavedMeal(id: string): Promise<void>;
}

export interface StepSummary {
  onDate: string;
  steps: number;
  briskMinutes: number;
  source: 'pedometer' | 'health_connect' | 'healthkit';
  updatedAt: number;
  syncedAt: number | null;
}
export interface ReverseBout {
  id: string;
  startedAt: number;
  endedAt: number | null;
  steps: number;
  stoppedBy: 'user' | 'cap' | 'app' | null;
}
export interface StepRepo {
  /** Replaces the day and clears syncedAt so the new value is re-sent. */
  upsert(s: Omit<StepSummary, 'syncedAt'>): Promise<void>;
  range(fromDate: string, toDate: string): Promise<StepSummary[]>;
  unsynced(): Promise<StepSummary[]>;
  markSynced(dates: string[], at: number): Promise<void>;
  purge(): Promise<void>;
  startBout(b: { id: string; startedAt: number }): Promise<void>;
  endBout(id: string, endedAt: number, steps: number, stoppedBy: 'user' | 'cap' | 'app'): Promise<void>;
  boutsSince(sinceMs: number): Promise<ReverseBout[]>;
}

export type ConsentPurpose = 'health_answers' | 'steps' | 'camera' | 'analytics' | 'terms_privacy';
export interface ConsentRecord {
  id: string;
  purpose: ConsentPurpose;
  granted: boolean;
  noticeVersion: string;
  at: number;
  source: 'onboarding' | 'privacy_screen' | 'permission_primer';
}
export interface ConsentRepo {
  append(r: ConsentRecord): Promise<void>;
  history(purpose?: ConsentPurpose): Promise<ConsentRecord[]>;
  /** Latest record per purpose; latest wins. */
  latest(): Promise<Partial<Record<ConsentPurpose, ConsentRecord>>>;
  unsynced(): Promise<ConsentRecord[]>;
  markSynced(ids: string[], at: number): Promise<void>;
}

export type OnboardingDraft = {
  birthYear: number | null;
  confirmed18: boolean;
  goal: Goal | null;
  bodyParts: string[];
  styles: Style[];
  mix: Partial<Record<Style, number>>;
  heightCm: number | null;
  weightKg: number | null;
  sex: Sex | null;
  experience: Experience | null;
  daysPerWeek: 3 | 4 | 5 | 6 | 7;
  painAreas: PainArea[];
  healthFlags: HealthFlag[];
  /** Unticked by default (D2): null until the user acts on Health. */
  healthConsent: { granted: boolean; at: string } | null;
};
export interface OnboardingDraftRepo {
  load(): Promise<OnboardingDraft | null>;
  save(d: OnboardingDraft): Promise<void>;
  clear(): Promise<void>;
}

export interface FormCheckAttempt {
  id: string;
  idempotencyKey: string;
  exercise: string;
  state: 'armed' | 'counted' | 'spent' | 'spent_local' | 'cancelled' | 'refunded';
  startedAt: number;
  spentAt: number | null;
  wouldHaveBeenCharged: boolean;
}
export interface FormCheckRepo {
  create(a: FormCheckAttempt): Promise<void>;
  get(id: string): Promise<FormCheckAttempt | null>;
  setState(
    id: string,
    state: FormCheckAttempt['state'],
    extra?: { spentAt?: number; wouldHaveBeenCharged?: boolean },
  ): Promise<void>;
}

export interface CacheRepo {
  getEntitlements(): Promise<{ json: string; fetchedAt: number } | null>;
  setEntitlements(json: string, fetchedAt: number): Promise<void>;
  markRead(cardId: string, at: number): Promise<void>;
  readIds(): Promise<string[]>;
}

export interface PreferenceRepo {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  all(): Promise<Record<string, string>>;
}

export interface Repositories {
  profile: ProfileRepo;
  plan: PlanRepo;
  sessionLog: SessionLogRepo;
  snapshot: SessionSnapshotRepo;
  micro: MicroSessionRepo;
  favourites: FavouriteRepo;
  checkin: WeeklyCheckinRepo;
  food: FoodRepo;
  nutrition: NutritionRepo;
  steps: StepRepo;
  consent: ConsentRepo;
  onboardingDraft: OnboardingDraftRepo;
  formCheck: FormCheckRepo;
  cache: CacheRepo;
  prefs: PreferenceRepo;
  /** Deletes every personal row (account deletion, D20). Keeps schema. */
  wipeAll(): Promise<void>;
}
