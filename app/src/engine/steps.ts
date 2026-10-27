import type { HealthFlag } from './types';

/** PRD section 12. */
export const BRISK_STEPS_PER_MINUTE = 100;
/** The design shows 12 / 20. The PRD gives no number, so this is a default to confirm. */
export const BRISK_GOAL_MINUTES = 20;
export const DEFAULT_STEP_GOAL = 7000;
/** PRD section 23: users 60 and over start at 6,000. */
export const STEP_GOAL_60_PLUS = 6000;
export const STEP_RAMP = 1000;
export const MIN_STEP_GOAL = 2000;
export const REVERSE_DAILY_CAP_S = 15 * 60;
/** Bout length the timer aims for (the design shows 10:00; the safety card says 5 to 10). */
export const REVERSE_BOUT_TARGET_S = 10 * 60;
export const REVERSE_MAX_AGE = 59;

const MINUTE_MS = 60_000;

/** Steps counted in one minute that starts at `startMs`. */
export interface MinuteBucket {
  startMs: number;
  steps: number;
}

export interface TimeSpan {
  startMs: number;
  endMs: number;
}

/**
 * Brisk minutes: minutes with at least 100 steps. Buckets that fall in the same clock minute
 * are added together. A minute that overlaps a declared reverse-walk bout is never brisk
 * (reverse walking is excluded from the brisk count).
 */
export function briskMinutes(
  buckets: readonly MinuteBucket[],
  reverseBouts: readonly TimeSpan[] = [],
  threshold = BRISK_STEPS_PER_MINUTE,
): number {
  const perMinute = new Map<number, number>();
  for (const b of buckets) {
    if (!Number.isFinite(b.startMs) || !Number.isFinite(b.steps) || b.steps < 0) continue;
    const minute = Math.floor(b.startMs / MINUTE_MS);
    perMinute.set(minute, (perMinute.get(minute) ?? 0) + b.steps);
  }
  let count = 0;
  for (const [minute, steps] of perMinute) {
    if (steps < threshold) continue;
    const start = minute * MINUTE_MS;
    const end = start + MINUTE_MS;
    if (reverseBouts.some((bout) => bout.startMs < end && bout.endMs > start)) continue;
    count += 1;
  }
  return count;
}

export function stepGoalTarget(age: number | null | undefined): number {
  return age != null && age >= 60 ? STEP_GOAL_60_PLUS : DEFAULT_STEP_GOAL;
}

/**
 * Default goal 7,000. For a low starting level the goal is the user's own 7-day average plus
 * about 1,000, until it reaches the target. With no history the target is used.
 */
export function stepGoal(opts: { sevenDayAverage?: number | null; age?: number | null } = {}): number {
  const target = stepGoalTarget(opts.age);
  const avg = opts.sevenDayAverage;
  if (avg == null || !Number.isFinite(avg)) return target;
  if (avg >= target - STEP_RAMP) return target;
  const stepped = Math.round(Math.max(0, avg) / 100) * 100 + STEP_RAMP;
  return Math.min(target, Math.max(MIN_STEP_GOAL, stepped));
}

export function stepsToGo(steps: number, goal: number): number {
  return Math.max(0, goal - Math.max(0, steps));
}

export type ReverseBlock = 'health_flag' | 'age' | 'balance' | 'daily_cap';

export type ReverseEligibility =
  | { allowed: true; remainingS: number; boutTargetS: number }
  | { allowed: false; reason: ReverseBlock };

/**
 * Reverse walking is opt-in and never offered with a health flag, a balance concern, or at 60
 * and over. It is capped at 15 minutes a day; once the cap is used up, no further bout starts.
 */
export function reverseWalkEligibility(opts: {
  healthFlags: readonly HealthFlag[];
  age?: number | null;
  balanceConcern?: boolean;
  /** Seconds of reverse walking already done today (local day). */
  usedTodayS: number;
}): ReverseEligibility {
  if (opts.healthFlags.length > 0) return { allowed: false, reason: 'health_flag' };
  if (opts.balanceConcern) return { allowed: false, reason: 'balance' };
  if (opts.age != null && opts.age > REVERSE_MAX_AGE) return { allowed: false, reason: 'age' };
  const remaining = Math.max(0, REVERSE_DAILY_CAP_S - Math.max(0, opts.usedTodayS));
  if (remaining === 0) return { allowed: false, reason: 'daily_cap' };
  return { allowed: true, remainingS: remaining, boutTargetS: Math.min(REVERSE_BOUT_TARGET_S, remaining) };
}

/** State of a running bout. Elapsed time counts against today's 15 minutes immediately. */
export function reverseBoutState(opts: { usedBeforeS: number; elapsedS: number }): {
  usedTodayS: number;
  remainingTodayS: number;
  autoStop: boolean;
} {
  const used = Math.min(REVERSE_DAILY_CAP_S, Math.max(0, opts.usedBeforeS) + Math.max(0, opts.elapsedS));
  return {
    usedTodayS: used,
    remainingTodayS: REVERSE_DAILY_CAP_S - used,
    autoStop: used >= REVERSE_DAILY_CAP_S,
  };
}

/** Seconds of a finished or running bout that count toward the daily cap, clipped to the cap. */
export function boutSecondsCounted(opts: { usedBeforeS: number; boutS: number }): number {
  return Math.max(0, Math.min(opts.boutS, REVERSE_DAILY_CAP_S - Math.max(0, opts.usedBeforeS)));
}
