// Pure helpers for the browse and plan screens (Home, HomeRest, WeekPlan, Why, Plan).
// No React and no navigation here, so every rule is easy to test.
//
// The saved plan has no start date. Onboarding builds day 0 as the day the plan was made
// (D19) and rolls seven days from there, so the start date is read from `plan.updatedAt`.
// After day 6 the week repeats from its first day until the plan is rebuilt.

import type { DayKind } from '../../../ui';
import type { PlanDayRow, PlanRow, Profile, SessionLog } from '../../../db/repositories';
import {
  addDays,
  diffDays,
  formatDate,
  indexCatalogue,
  isLapsed,
  localDateKey,
  parseDate,
  restrictionsFor,
  skippedMoves,
  type Catalogue,
  type PlanStep,
  type SessionPlan,
} from '../../../engine';

export const DOT = '·';
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const weekdayIndex = (date: string): number => new Date(parseDate(date)).getUTCDay();
export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Local calendar date of an epoch time as 'YYYY-MM-DD'. */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return formatDate(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export interface PlanClock {
  /** Today as 'YYYY-MM-DD'. */
  today: string;
  /** Plan day (0 to 6) that is today. */
  dayIndex: number;
  /** Date of plan day 0 in the week being shown. */
  cycleStart: string;
  /** Dates of plan days 0 to 6 in the week being shown. */
  dates: string[];
  /** Whole days since the plan was made (0 on day one). */
  offset: number;
}

export function planClock(planMadeAt: number, now: number): PlanClock {
  const start = localDate(planMadeAt);
  const today = localDate(now);
  const offset = Math.max(0, diffDays(start, today));
  const cycleStart = addDays(start, Math.floor(offset / 7) * 7);
  return {
    today,
    dayIndex: offset % 7,
    cycleStart,
    dates: Array.from({ length: 7 }, (_, i) => addDays(cycleStart, i)),
    offset,
  };
}

export function parseSession(row: Pick<PlanDayRow, 'sessionJson'> | undefined | null): SessionPlan | null {
  if (!row?.sessionJson) return null;
  try {
    const s = JSON.parse(row.sessionJson) as SessionPlan;
    return Array.isArray(s?.steps) ? s : null;
  } catch {
    return null;
  }
}

export const planDayKey = (week: number, dayIndex: number): string => `${week}-${dayIndex}`;
export function parsePlanDayKey(key: string | undefined): { week: number; dayIndex: number } | null {
  const m = /^(\d+)-(\d+)$/.exec(key ?? '');
  return m ? { week: Number(m[1]), dayIndex: Number(m[2]) } : null;
}

export const workSteps = (s: SessionPlan | null): PlanStep[] => (s ? s.steps.filter((x) => x.phase === 'work') : []);

/** Seconds a step takes: transition, then work and rest for every set (the engine's D1 arithmetic). */
export const stepSeconds = (s: PlanStep): number => s.transitionS + s.sets * s.workS + s.sets * s.restS;

export function phaseMinutes(s: SessionPlan | null): { warm: number; work: number; cool: number; total: number } {
  if (!s) return { warm: 2, work: 11, cool: 2, total: 15 };
  const sum = (p: PlanStep['phase']) => s.steps.filter((x) => x.phase === p).reduce((a, x) => a + stepSeconds(x), 0);
  const warm = Math.max(1, Math.round(sum('warmup') / 60));
  const cool = Math.max(1, Math.round(sum('cooldown') / 60));
  const total = Math.max(warm + cool + 1, Math.round(s.budgetS / 60));
  return { warm, work: total - warm - cool, cool, total };
}

export const isKneeFriendly = (s: SessionPlan | null): boolean => !!s?.restrictions?.painAreas?.includes('knees');
export const styleLabel = (style: string | null | undefined): string => cap(style ?? 'normal');

/** "Normal . 5 moves . no equipment . knee-friendly" */
export function sessionMeta(s: SessionPlan | null, style: string | null): string {
  const n = workSteps(s).length;
  const parts = [styleLabel(style ?? s?.style), `${n} ${n === 1 ? 'move' : 'moves'}`, 'no equipment'];
  if (isKneeFriendly(s)) parts.push('knee-friendly');
  return parts.join(` ${DOT} `);
}

export function dayIcon(row: Pick<PlanDayRow, 'kind' | 'style'> | undefined): string {
  if (!row) return 'bedtime';
  if (row.kind === 'walk') return 'directions_walk';
  if (row.kind === 'stretch') return 'spa';
  if (row.kind === 'rest') return 'bedtime';
  if (row.style === 'yoga') return 'self_improvement';
  if (row.style === 'dance') return 'music_note';
  return 'sports_gymnastics';
}

export function dayKindFor(row: PlanDayRow | undefined, opts: { today: boolean; done: boolean }): DayKind {
  if (opts.today) return 'today';
  if (opts.done) return 'done';
  if (!row || row.kind === 'rest') return 'rest';
  if (row.kind === 'walk' || row.kind === 'stretch') return 'active-rest';
  return row.style === 'yoga' ? 'yoga' : 'planned';
}

/** Short title for a row in lists: "Easy walk", "Gentle stretch", "Rest day" or the session title. */
export function dayTitle(row: PlanDayRow | undefined): string {
  if (!row) return 'Rest day';
  if (row.kind === 'rest') return 'Rest day';
  return row.title || (row.kind === 'walk' ? 'Easy walk' : row.kind === 'stretch' ? 'Gentle stretch' : 'Session');
}

export function daySub(row: PlanDayRow | undefined, isToday: boolean, stepGoal: number): string {
  if (!row || row.kind === 'rest') return 'Rest well';
  const s = parseSession(row);
  const prefix = isToday ? `Today ${DOT} ` : '';
  if (row.kind === 'walk') return `${prefix}Aim for ${formatCount(stepGoal)} steps`;
  if (row.kind === 'stretch') return `${prefix}Optional`;
  const n = workSteps(s).length;
  const unit = row.style === 'yoga' ? 'poses' : 'moves';
  return `${prefix}${styleLabel(row.style)} ${DOT} ${n} ${unit}`;
}

export function formatCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Dates of finished sessions (status 'complete'), 'YYYY-MM-DD'. */
export function completedDates(logs: readonly SessionLog[], tz: number): Set<string> {
  return new Set(logs.filter((l) => l.status === 'complete').map((l) => localDateKey(l.completedAt, tz)));
}

/** True after 7 or more days without a finished session (D14). Never true before the first one. */
export function isComeback(logs: readonly SessionLog[], today: string, tz: number): boolean {
  const dates = [...completedDates(logs, tz)].sort();
  const last = dates[dates.length - 1] ?? null;
  return isLapsed(last, today);
}

/** Number of workout days in the week, and the minutes they add up to. */
export function weekSummary(rows: readonly PlanDayRow[]): { workouts: number; minutes: number; mix: string } {
  const w = rows.filter((r) => r.kind === 'workout');
  const counts = new Map<string, number>();
  let minutes = 0;
  for (const r of w) {
    const label = styleLabel(r.style);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    minutes += phaseMinutes(parseSession(r)).total;
  }
  const mix = [...counts].map(([k, v]) => `${v} ${k}`).join(', ');
  return { workouts: w.length, minutes, mix };
}

// ---- Why ----

export interface AnswerRowData {
  key: 'focus' | 'days' | 'experience' | 'style';
  icon: string;
  label: string;
  value: string;
  to: 'Goals' | 'About' | 'Mix';
}

const EXPERIENCE_VALUE: Record<PlanRow['experience'], string> = {
  new: 'New to this: a gentle start',
  on_and_off: 'On and off: a gentle start',
  regular: 'Regular: a steady start',
};

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function answerRows(plan: PlanRow): AnswerRowData[] {
  const focus =
    plan.goal === 'body_part' && plan.bodyParts.length
      ? cap(listJoin(plan.bodyParts))
      : plan.goal === 'gentler'
        ? 'A gentler start'
        : 'Stay fit, whole body';
  const styleCounts = (plan.styles.length ? plan.styles : ['normal']).map((s) => {
    const n = plan.mix[s as keyof PlanRow['mix']];
    return n ? `${n} ${cap(s)}` : cap(s);
  });
  return [
    { key: 'focus', icon: 'gps_fixed', label: 'Focus', value: focus, to: 'Goals' },
    { key: 'days', icon: 'event', label: 'Days', value: `${plan.daysPerWeek} days a week, 15 minutes`, to: 'About' },
    { key: 'experience', icon: 'trending_up', label: 'Experience', value: EXPERIENCE_VALUE[plan.experience], to: 'About' },
    { key: 'style', icon: 'tune', label: 'Style', value: styleCounts.join(', '), to: 'Mix' },
  ];
}

export interface SkippedMove {
  exerciseId: string;
  name: string;
  reason: string;
}

const REASON_SENTENCE: Record<string, string> = {
  knees: 'You said your knees hurt.',
  back: 'You said your back hurts.',
  shoulders: 'You said your shoulders hurt.',
  wrists: 'You said your wrists hurt.',
  other: 'You told us something hurts.',
  heart_bp: 'Your heart or blood pressure answer rules it out.',
  pregnancy: 'Your pregnancy or postpartum answer rules it out.',
  recent_surgery: 'Your recent surgery answer rules it out.',
  gentler: 'It is too intense for the gentler plan.',
};
export const reasonSentence = (reason: string): string => REASON_SENTENCE[reason] ?? 'It does not fit your answers.';

/** Moves left out for this user. Recomputed from the saved answers when the fresh plan is gone. */
export function skippedFor(
  profile: Pick<Profile, 'painAreas' | 'healthFlags'> | null,
  plan: Pick<PlanRow, 'styles'>,
  catalogue: Catalogue,
): SkippedMove[] {
  if (!profile) return [];
  try {
    const restrictions = restrictionsFor({ painAreas: profile.painAreas as never, healthFlags: profile.healthFlags });
    return skippedMoves(indexCatalogue(catalogue), restrictions, plan.styles.length ? plan.styles : ['normal']).map((s) => ({ ...s }));
  } catch {
    return [];
  }
}

// ---- Ready-made plans on Home (ids are the content pack's plan ids; titles and meta match it) ----

export interface ReadyMade {
  id: string;
  title: string;
  meta: string;
  icon: string;
}
export const READY_MADE: readonly ReadyMade[] = [
  { id: 'full_body_starter', title: 'Full body starter', meta: `15 min ${DOT} Easy`, icon: 'accessibility_new' },
  { id: 'core_glutes_15', title: 'Core and glutes 15', meta: `15 min ${DOT} Easy`, icon: 'sports_gymnastics' },
  { id: 'cardio_burst', title: 'Cardio burst', meta: `15 min ${DOT} Medium`, icon: 'bolt' },
  { id: 'yoga_flow_15', title: 'Yoga flow 15', meta: `15 min ${DOT} Medium`, icon: 'self_improvement' },
  { id: 'dance_cardio_15', title: 'Dance cardio 15', meta: `15 min ${DOT} Easy`, icon: 'music_note' },
  { id: 'gentle_morning', title: 'Gentle morning', meta: `15 min ${DOT} Easy`, icon: 'wb_twilight' },
  { id: 'desk_reset', title: 'Desk reset', meta: `4 min ${DOT} Quiet ${DOT} Easy`, icon: 'chair' },
];

export interface BodyPartTile {
  id: string;
  label: string;
}
export const BODY_PART_TILES: readonly BodyPartTile[] = [
  { id: 'arms', label: 'Arms' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'core', label: 'Core' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'legs', label: 'Legs' },
  { id: 'full', label: 'Full body' },
  { id: 'stretch', label: 'Stretch' },
];
