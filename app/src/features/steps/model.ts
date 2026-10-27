// Pure helpers for the steps screens.

import { addDays, parseDate, REVERSE_BOUT_TARGET_S, reverseWalkEligibility, stepGoal, type ReverseEligibility } from '../../engine';
import type { Profile, ReverseBout, StepSummary } from '../../db/repositories';
import { dayRange } from '../../services/step-counter';

/** 12,345 style grouping (the design shows "4,820"). Not locale dependent so Hermes and Jest agree. */
export function formatCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const weekdayShort = (date: string): (typeof DAY_NAMES)[number] => DAY_NAMES[new Date(parseDate(date)).getUTCDay()]!;

/** Seven dates ending today, oldest first (rolling week as in the design). */
export const rollingWeek = (today: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

export interface WeekView {
  dates: string[];
  values: number[];
  labels: string[];
  a11yLabels: string[];
}

export function buildWeek(today: string, rows: readonly StepSummary[]): WeekView {
  const byDate = new Map(rows.map((r) => [r.onDate, r.steps]));
  const dates = rollingWeek(today);
  const values = dates.map((d) => byDate.get(d) ?? 0);
  return {
    dates,
    values,
    // Weekday initials repeat (T, T, S, S), so screen readers get the full name from a11yLabels.
    labels: dates.map((d, i) => (i === 6 ? 'Today' : weekdayShort(d).slice(0, 1))),
    a11yLabels: dates.map((d, i) => `${i === 6 ? 'Today' : weekdayShort(d)} ${formatCount(values[i]!)} steps`),
  };
}

/** Personal goal: the user's own recent average plus a little, up to the 7,000 target. */
export function goalFor(today: string, rows: readonly StepSummary[], birthYear: number | null, nowYear: number): number {
  const prior = rows.filter((r) => r.onDate < today && r.steps > 0);
  const avg = prior.length ? prior.reduce((a, r) => a + r.steps, 0) / prior.length : null;
  return stepGoal({ sevenDayAverage: avg, age: birthYear ? nowYear - birthYear : null });
}

export function reverseEligibilityFor(profile: Profile | null, usedTodayS: number, nowYear: number): ReverseEligibility {
  return reverseWalkEligibility({
    healthFlags: profile?.healthFlags ?? [],
    age: profile?.birthYear ? nowYear - profile.birthYear : null,
    usedTodayS,
  });
}

/** Reverse walking is hidden entirely (not just disabled) unless the only blocker is the daily cap. */
export const reverseHidden = (e: ReverseEligibility): boolean => !e.allowed && e.reason !== 'daily_cap';

/**
 * Seconds of reverse walking already used on a local day. A bout that was never closed
 * (app killed) counts for at most one bout target, so a crash cannot lock the user out.
 */
export function usedSeconds(bouts: readonly ReverseBout[], date: string, now: number, tz: number, excludeId?: string): number {
  const { startMs, endMs } = dayRange(date, tz);
  let total = 0;
  for (const b of bouts) {
    if (b.id === excludeId || b.startedAt < startMs || b.startedAt >= endMs) continue;
    const end = b.endedAt ?? Math.min(now, b.startedAt + REVERSE_BOUT_TARGET_S * 1000);
    total += Math.max(0, Math.min(end, b.startedAt + REVERSE_BOUT_TARGET_S * 1000 * 2) - b.startedAt) / 1000;
  }
  return Math.round(total);
}
