import type { Sex } from './types';

/**
 * Daily calorie and protein targets (PRD section 11): Mifflin-St Jeor with an activity factor,
 * a calorie floor, a cap on weekly loss, and refusals for cases that need a person, not an app.
 * These numbers are starting values. A registered dietitian must confirm them before launch.
 */
export type NutritionGoal = 'maintain' | 'lose_gently' | 'gain';

export const CALORIE_FLOOR: Record<Sex, number> = { woman: 1200, man: 1500, other: 1500 };
export const MAX_LOSS_KG_PER_WEEK = 0.5;
/** Anything above this is declined, not clamped. */
export const DECLINE_LOSS_KG_PER_WEEK = 0.75;
export const DEFAULT_LOSS_KG_PER_WEEK = 0.4;
export const DEFAULT_GAIN_KG_PER_WEEK = 0.25;
export const MAX_GAIN_KG_PER_WEEK = 0.5;
export const KCAL_PER_KG = 7700;
export const MAX_DEFICIT_SHARE = 0.2;
/** A target this far under the floor means the request is declined instead of lifted to the floor. */
export const VERY_LOW_MARGIN_KCAL = 300;
export const MIN_BMI_FOR_LOSS = 18.5;

export interface NutritionInput {
  sex: Sex;
  age: number;
  heightCm: number | null;
  weightKg: number | null;
  /** Planned sessions a week. */
  workoutsPerWeek: number;
  goal: NutritionGoal;
  /** Requested weekly change in kg (positive number for loss or gain). */
  weeklyChangeKg?: number;
}

export type DeclineReason = 'under_18' | 'invalid_input' | 'low_bmi' | 'too_rapid' | 'very_low_target';

export type NutritionResult =
  | {
      status: 'ok';
      bmr: number;
      activityFactor: number;
      tdee: number;
      /** Daily calories, a multiple of 10, never under the floor. */
      kcal: number;
      proteinG: number;
      floorKcal: number;
      /** True when the target was lifted to the floor. */
      atFloor: boolean;
      /** Planned change from TDEE, after the floor. */
      adjustmentKcal: number;
      expectedWeeklyChangeKg: number;
    }
  | { status: 'needs_measures' }
  | { status: 'declined'; reason: DeclineReason };

export function ageFromBirthYear(birthYear: number, nowYear: number): number {
  return nowYear - birthYear;
}

export function bmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Mifflin-St Jeor. "Other" uses the midpoint of the two constants. */
export function bmr(sex: Sex, age: number, heightCm: number, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const c = sex === 'man' ? 5 : sex === 'woman' ? -161 : -78;
  return base + c;
}

/** 15-minute sessions are light work, so the factor stops at 1.5. */
export function activityFactor(workoutsPerWeek: number): number {
  const n = Math.max(0, workoutsPerWeek);
  if (n === 0) return 1.2;
  if (n <= 2) return 1.3;
  if (n <= 4) return 1.375;
  if (n <= 6) return 1.45;
  return 1.5;
}

const round10 = (n: number) => Math.round(n / 10) * 10;
const round5 = (n: number) => Math.round(n / 5) * 5;

export function computeNutritionTargets(input: NutritionInput): NutritionResult {
  const { sex, age, heightCm, weightKg } = input;
  if (!Number.isFinite(age) || age < 0 || age > 110) return { status: 'declined', reason: 'invalid_input' };
  if (age < 18) return { status: 'declined', reason: 'under_18' };
  if (heightCm == null || weightKg == null) return { status: 'needs_measures' };
  if (!(heightCm >= 100 && heightCm <= 250) || !(weightKg >= 30 && weightKg <= 300)) {
    return { status: 'declined', reason: 'invalid_input' };
  }

  const baseRate = bmr(sex, age, heightCm, weightKg);
  const factor = activityFactor(input.workoutsPerWeek);
  const tdee = baseRate * factor;
  const floor = CALORIE_FLOOR[sex];

  let adjustment = 0;
  if (input.goal === 'lose_gently') {
    if (bmi(heightCm, weightKg) < MIN_BMI_FOR_LOSS) return { status: 'declined', reason: 'low_bmi' };
    const requested = input.weeklyChangeKg ?? DEFAULT_LOSS_KG_PER_WEEK;
    if (!(requested > 0)) return { status: 'declined', reason: 'invalid_input' };
    if (requested > DECLINE_LOSS_KG_PER_WEEK) return { status: 'declined', reason: 'too_rapid' };
    const rate = Math.min(requested, MAX_LOSS_KG_PER_WEEK);
    const deficit = Math.min((rate * KCAL_PER_KG) / 7, MAX_DEFICIT_SHARE * tdee);
    adjustment = -deficit;
    if (tdee + adjustment < floor - VERY_LOW_MARGIN_KCAL) return { status: 'declined', reason: 'very_low_target' };
  } else if (input.goal === 'gain') {
    const requested = input.weeklyChangeKg ?? DEFAULT_GAIN_KG_PER_WEEK;
    if (!(requested > 0)) return { status: 'declined', reason: 'invalid_input' };
    adjustment = (Math.min(requested, MAX_GAIN_KG_PER_WEEK) * KCAL_PER_KG) / 7;
  }

  const raw = tdee + adjustment;
  const kcal = Math.max(floor, round10(raw));
  const atFloor = round10(raw) < floor;

  const perKg = input.goal === 'lose_gently' ? 1.2 : input.goal === 'gain' ? 1.4 : 1.0;
  const proteinCap = Math.min(2.0 * weightKg, (0.3 * kcal) / 4);
  const proteinG = Math.max(0, round5(Math.min(perKg * weightKg, proteinCap)));

  return {
    status: 'ok',
    bmr: Math.round(baseRate),
    activityFactor: factor,
    tdee: Math.round(tdee),
    kcal,
    proteinG,
    floorKcal: floor,
    atFloor,
    adjustmentKcal: kcal - Math.round(tdee),
    expectedWeeklyChangeKg: Math.round(((kcal - tdee) * 7 * 100) / KCAL_PER_KG) / 100,
  };
}

const MEAL_SHARES: Record<number, number[]> = {
  2: [0.45, 0.55],
  3: [0.3, 0.4, 0.3],
  4: [0.25, 0.35, 0.15, 0.25],
  5: [0.2, 0.3, 0.1, 0.25, 0.15],
  6: [0.18, 0.12, 0.28, 0.1, 0.22, 0.1],
};

/** Splits the daily calories over the meals so the parts add up exactly. Each part is a multiple of 10. */
export function splitMeals(kcal: number, meals: number): number[] {
  const n = Math.max(1, Math.min(6, Math.round(meals)));
  const shares = MEAL_SHARES[n] ?? [1];
  const parts = shares.map((s) => round10(kcal * s));
  const sum = parts.reduce((a, b) => a + b, 0);
  const last = parts.length - 1;
  parts[last] = (parts[last] as number) + (kcal - sum);
  return parts;
}

export type ProteinStatus = 'building' | 'on_track' | 'met';

/** Neutral progress words for the hide-calories view. Never negative, never "over". */
export function proteinStatus(eatenG: number, targetG: number): ProteinStatus {
  if (targetG <= 0) return 'met';
  const ratio = eatenG / targetG;
  if (ratio >= 1) return 'met';
  if (ratio >= 0.7) return 'on_track';
  return 'building';
}
