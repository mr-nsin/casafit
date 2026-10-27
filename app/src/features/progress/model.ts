// Pure progress maths. Everything is derived from session_log, step_summary and the plan;
// nothing here is stored as truth.

import { activeSeconds, addDays, completedDaysFromLogs, computeStreak, localDateKey, parseDate, type SessionLogLite } from '../../engine';
import type { PlanDayRow, PlanRow, SessionLog, StepSummary } from '../../db/repositories';

/** Monday = 0 ... Sunday = 6. */
export const mondayIndex = (date: string): number => (new Date(parseDate(date)).getUTCDay() + 6) % 7;
export const startOfWeek = (date: string): string => addDays(date, -mondayIndex(date));
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const dayName = (i: number): (typeof DAYS)[number] => DAYS[i]!;

export const formatCount = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function toLite(logs: readonly SessionLog[], tz: number): SessionLogLite[] {
  return logs.map((l) => ({ date: localDateKey(l.completedAt, tz), kind: 'full' as const, status: l.status, durationS: l.durationS }));
}

/**
 * Planned training days. The plan stores weekdays, not dates, so the current week's pattern
 * (Mon = day 0) is repeated back to the first logged day. Days with a completed session are
 * always planned, so training on a rest day never breaks anything. Without a plan only
 * completed days count, and the streak is simply the run of those days.
 */
export function plannedDays(opts: { today: string; completed: readonly string[]; currentWeekDays: readonly PlanDayRow[]; firstLogDate: string | null }): string[] {
  const pattern = new Set(opts.currentWeekDays.filter((d) => d.kind === 'workout').map((d) => d.dayIndex));
  const out = new Set(opts.completed);
  if (pattern.size > 0 && opts.firstLogDate) {
    for (let d = opts.firstLogDate; d <= opts.today; d = addDays(d, 1)) if (pattern.has(mondayIndex(d))) out.add(d);
  }
  return [...out].sort();
}

export interface ProgressView {
  empty: boolean;
  streak: number;
  best: number;
  /** Monday to Sunday of this week. */
  weekDots: { label: string; done: boolean; planned: boolean; date: string }[];
  /** 28 cells, oldest first, 0..3. */
  heat: number[];
  heatSummary: string;
  sessions28: number;
  minutes28: number;
  /** Null when there are no step readings at all (steps off): the tile is hidden. */
  avgSteps: number | null;
}

export function computeProgress(opts: {
  today: string;
  tz: number;
  logs: readonly SessionLog[];
  microActiveS: number;
  steps: readonly StepSummary[];
  plan: PlanRow | null;
  currentWeekDays: readonly PlanDayRow[];
}): ProgressView {
  const { today } = opts;
  const lite = toLite(opts.logs, opts.tz);
  const completed = completedDaysFromLogs(lite);
  const firstLog = lite.length ? lite.map((l) => l.date).sort()[0]! : null;
  const planned = plannedDays({ today, completed, currentWeekDays: opts.currentWeekDays, firstLogDate: firstLog });
  const s = computeStreak({ plannedDays: planned, completedDays: completed, today });

  const monday = startOfWeek(today);
  const doneSet = new Set(completed);
  const plannedSet = new Set(planned);
  const weekDots = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { label: dayName(i), done: doneSet.has(date), planned: plannedSet.has(date), date };
  });

  const from = addDays(today, -27);
  const perDay = new Map<string, number>();
  let sessions28 = 0;
  for (const l of lite) {
    if (l.date < from || l.date > today) continue;
    perDay.set(l.date, (perDay.get(l.date) ?? 0) + 1);
    if (l.status === 'complete') sessions28 += 1;
  }
  const heat = Array.from({ length: 28 }, (_, i) => {
    const n = perDay.get(addDays(from, i)) ?? 0;
    return n === 0 ? 0 : n === 1 ? (doneSet.has(addDays(from, i)) ? 2 : 1) : 3;
  });
  const activeDays = heat.filter((h) => h > 0).length;

  const minutes28 = Math.round((activeSeconds(lite, from, today) + opts.microActiveS) / 60);
  const stepRows = opts.steps.filter((r) => r.onDate >= from && r.onDate <= today && r.steps > 0);
  const avgSteps = stepRows.length ? Math.round(stepRows.reduce((a, r) => a + r.steps, 0) / stepRows.length) : null;

  return {
    empty: opts.logs.length === 0 && opts.microActiveS === 0,
    streak: s.current,
    best: s.best,
    weekDots,
    heat,
    heatSummary: `${activeDays} active ${activeDays === 1 ? 'day' : 'days'} in the last 4 weeks, ${sessions28} full ${sessions28 === 1 ? 'session' : 'sessions'}.`,
    sessions28,
    minutes28,
    avgSteps,
  };
}

// ---- weekly recap -------------------------------------------------------------------------

export interface RecapView {
  weekNumber: number;
  isCurrentWeek: boolean;
  headline: string;
  body: string;
  workouts: number;
  activeMinutes: number;
  /** Null when steps are off or empty for the week. */
  stepsPerDay: number | null;
  /** Mon to Sun, null entries are hidden when steps are off. */
  stepBars: { values: number[]; labels: string[]; a11y: string[] } | null;
  insights: { icon: string; lead: string; text: string }[];
  /** True for a week with nothing logged; copy stays kind. */
  quiet: boolean;
}

/** On Sunday the recap covers this week; on any other day it covers the week that just ended. */
export function recapWeekStart(today: string): string {
  return mondayIndex(today) === 6 ? startOfWeek(today) : addDays(startOfWeek(today), -7);
}

export function computeRecap(opts: {
  today: string;
  tz: number;
  logs: readonly SessionLog[];
  steps: readonly StepSummary[];
  plan: PlanRow | null;
  currentWeekDays: readonly PlanDayRow[];
}): RecapView {
  const start = recapWeekStart(opts.today);
  const end = addDays(start, 6);
  const isCurrentWeek = start === startOfWeek(opts.today);
  const lite = toLite(opts.logs, opts.tz);
  const rawIn = opts.logs.filter((l) => {
    const d = localDateKey(l.completedAt, opts.tz);
    return d >= start && d <= end;
  });
  const workouts = rawIn.filter((l) => l.status === 'complete').length;
  const activeMinutes = Math.round(activeSeconds(lite, start, end) / 60);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDate = new Map(opts.steps.map((r) => [r.onDate, r.steps]));
  const values = dates.map((d) => byDate.get(d) ?? 0);
  const withSteps = values.filter((v) => v > 0);
  const stepsPerDay = withSteps.length ? Math.round(withSteps.reduce((a, v) => a + v, 0) / withSteps.length) : null;

  const planned = opts.plan?.daysPerWeek ?? 0;
  const quiet = rawIn.length === 0;
  const strong = planned > 0 ? workouts >= Math.ceil(planned * 0.75) : workouts >= 3;
  const weekNumber = Math.max(1, (opts.plan?.weekNumber ?? 1) - (isCurrentWeek ? 0 : 1));
  const headline = quiet ? 'A quiet week, and that is fine' : strong ? (weekNumber === 1 ? 'A strong first week' : 'A strong week') : 'You showed up';
  const restDayMoves =
    isCurrentWeek &&
    opts.currentWeekDays.some((d) => d.kind !== 'workout' && (byDate.get(addDays(start, d.dayIndex)) ?? 0) >= 3000);
  const body = quiet
    ? 'Rest is part of the plan. Your next session is whenever you are ready.'
    : `${strong ? 'You kept to your plan' : 'Every session counts'}${restDayMoves ? ' and moved on rest days too' : ''}.`;

  const insights: RecapView['insights'] = [];
  const aboutRight = rawIn.filter((l) => l.felt === 'about_right' || l.felt === 'easy').length;
  const hard = rawIn.filter((l) => l.felt === 'hard').length;
  if (aboutRight >= 2) {
    insights.push({ icon: 'trending_up', lead: 'Something got easier.', text: `You marked ${aboutRight} sessions as about right or easy, so next week adds a few reps.` });
  } else if (hard >= 2) {
    insights.push({ icon: 'trending_up', lead: 'Tough weeks happen.', text: `You found ${hard} sessions hard. Your plan can go gentler any time.` });
  }
  if (opts.plan) {
    insights.push({ icon: 'event', lead: 'Next week.', text: `${opts.plan.daysPerWeek} workouts planned.` });
  }

  return {
    weekNumber,
    isCurrentWeek,
    headline,
    body,
    workouts,
    activeMinutes,
    stepsPerDay,
    stepBars: stepsPerDay === null ? null : { values, labels: dates.map((_, i) => dayName(i).slice(0, 1)), a11y: dates.map((_, i) => `${dayName(i)} ${formatCount(values[i]!)} steps`) },
    insights,
    quiet,
  };
}
