import { indexCatalogue, restrictionsFor, skippedMoves, type CatalogueIndex } from './catalogue';
import { addDays, diffDays } from './dates';
import { buildSession, ENGINE_VERSION, targetSlotCount } from './session';
import { reverseWalkEligibility } from './steps';
import {
  STYLES,
  type BodyPart,
  type Catalogue,
  type Experience,
  type Felt,
  type Focus,
  type Goal,
  type HealthFlag,
  type PainArea,
  type PlanVariant,
  type Restrictions,
  type Rung,
  type SessionPlan,
  type Style,
} from './types';

/** Days without a finished session after which the plan is rebuilt lighter (D14). */
export const LAPSED_AFTER_DAYS = 7;

export interface PlanInput {
  goal: Goal;
  /** Used when goal is 'body_part'. Up to 2. */
  bodyParts: readonly BodyPart[];
  /** One to three styles. */
  styles: readonly Style[];
  /** Days per style. Only used when it sums to daysPerWeek over the chosen styles. */
  mix?: Partial<Record<Style, number>>;
  /** 3 to 7. */
  daysPerWeek: number;
  /** Skipped on About: treated as 'new', the safest start. */
  experience: Experience | null;
  painAreas: readonly PainArea[];
  healthFlags: readonly HealthFlag[];
  /** First plan day: the day onboarding finished (D19). 'YYYY-MM-DD'. */
  startDate: string;
  weekNumber?: number;
  seed?: number;
  /** Last weeks' felt effort, oldest first. Drives the ladder level. */
  feltHistory?: readonly Felt[];
  /** Added to the ladder level (the comeback week uses -1). */
  levelOffset?: number;
  /** Intensity rung for work moves. */
  intensity?: Rung;
  /** Age in years, when known (reverse walking is off for 60 and over). */
  age?: number | null;
  /** Reverse walking stays off when the user reports a balance concern. */
  balanceConcern?: boolean;
}

export type RestSuggestion = 'walk' | 'stretch';

export interface PlanDay {
  dayIndex: number;
  /** 'YYYY-MM-DD', rolling from the start date. */
  date: string;
  kind: 'training' | 'rest';
  style: Style | null;
  focus: Focus | null;
  parts: BodyPart[];
  title: string;
  restSuggestion: RestSuggestion | null;
  session: SessionPlan | null;
}

export interface WhyFact {
  kind: 'focus' | 'days' | 'experience' | 'style' | 'skip' | 'gentler';
  text: string;
}

export interface Plan {
  variant: PlanVariant;
  weekNumber: number;
  startDate: string;
  days: PlanDay[];
  skipped: { exerciseId: string; name: string; reason: string }[];
  why: WhyFact[];
  /** What this plan allows. Gentler plans switch HIIT, jumping and reverse walking off. */
  guards: { hiit: boolean; jumping: boolean; reverseWalk: boolean };
  restrictions: Restrictions;
  engineVersion: string;
}

export const EXPERIENCE_LEVEL: Record<Experience, number> = { new: 0, on_and_off: 1, regular: 2 };

/** Ladder level to start from: experience, nudged by how the last sessions felt. */
export function ladderLevel(
  experience: Experience | null,
  feltHistory: readonly Felt[] = [],
  offset = 0,
): number {
  const base = EXPERIENCE_LEVEL[experience ?? 'new'];
  return Math.max(0, base + feltAdjustment(feltHistory) + offset);
}

/**
 * Looks at the last four sessions. Two or more "easy" and more easy than hard moves the
 * ladder up one rung; the mirror image moves it down. Anything else keeps the level.
 */
function feltAdjustment(history: readonly Felt[]): number {
  const recent = history.slice(-4);
  const easy = recent.filter((f) => f === 'easy').length;
  const hard = recent.filter((f) => f === 'hard').length;
  if (easy >= 2 && easy > hard) return 1;
  if (hard >= 2 && hard > easy) return -1;
  return 0;
}
export { feltAdjustment };

/** Days per style. Equal by default (extra days go to normal, then dance, then yoga). */
export function allocateStyles(
  styles: readonly Style[],
  days: number,
  mix?: Partial<Record<Style, number>>,
): Record<Style, number> {
  const chosen = STYLES.filter((s) => styles.includes(s));
  const out: Record<Style, number> = { normal: 0, dance: 0, yoga: 0 };
  if (chosen.length === 0) throw new Error('At least one style is needed.');
  if (mix) {
    let sum = 0;
    let valid = true;
    for (const s of STYLES) {
      const n = mix[s] ?? 0;
      if (!Number.isInteger(n) || n < 0 || (n > 0 && !chosen.includes(s))) valid = false;
      sum += n;
    }
    if (valid && sum === days) {
      for (const s of STYLES) out[s] = mix[s] ?? 0;
      return out;
    }
  }
  const base = Math.floor(days / chosen.length);
  let extra = days - base * chosen.length;
  for (const s of chosen) {
    out[s] = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
  }
  return out;
}

/** Spreads the sessions over the week, spaced as evenly as seven days allow. Day 0 is always a session. */
export function sessionDayOffsets(sessions: number): number[] {
  const n = Math.max(0, Math.min(7, sessions));
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(Math.floor((i * 7) / n));
  return out;
}

/** Orders styles over the sessions so the same style does not repeat back to back where it can be avoided. */
export function orderStyles(counts: Record<Style, number>): Style[] {
  const left = { ...counts };
  const out: Style[] = [];
  const total = STYLES.reduce((a, s) => a + left[s], 0);
  for (let i = 0; i < total; i += 1) {
    const prev = out[i - 1];
    let best: Style | null = null;
    for (const s of STYLES) {
      if (left[s] <= 0) continue;
      if (!best) {
        best = s;
        continue;
      }
      const sPrev = s === prev;
      const bPrev = best === prev;
      if (bPrev && !sPrev) best = s;
      else if (bPrev === sPrev && left[s] > left[best]) best = s;
    }
    if (!best) break;
    out.push(best);
    left[best] -= 1;
  }
  return out;
}

function targetIndexes(sessions: number): number[] {
  const count = Math.max(1, Math.min(sessions, Math.round(sessions * 0.6)));
  const order = [0, 2, 4, 6, 1, 3, 5].filter((i) => i < sessions);
  return order.slice(0, count);
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const REASON_TEXT: Record<string, string> = {
  knees: 'your knees',
  back: 'your back',
  shoulders: 'your shoulders',
  wrists: 'your wrists',
  other: 'what you told us',
  heart_bp: 'your heart or blood pressure answer',
  pregnancy: 'your pregnancy or postpartum answer',
  recent_surgery: 'your recent surgery',
  gentler: 'the gentler plan',
};

const EXPERIENCE_TEXT: Record<Experience, string> = {
  new: 'new to this',
  on_and_off: 'on and off',
  regular: 'regular',
};

/**
 * Builds week one (or any later week) from the answers, on the phone, with rules and no AI.
 * Same input and seed give the same plan.
 */
export function buildPlan(input: PlanInput, catalogue: Catalogue | CatalogueIndex): Plan {
  const index = 'byId' in catalogue ? catalogue : indexCatalogue(catalogue);
  const days = Math.max(3, Math.min(7, Math.round(input.daysPerWeek)));
  const seed = input.seed ?? 1;
  const weekNumber = input.weekNumber ?? 1;
  const restrictions = restrictionsFor({ painAreas: input.painAreas, healthFlags: input.healthFlags });
  const gentler = restrictions.gentler;
  const level = ladderLevel(input.experience, input.feltHistory, input.levelOffset ?? 0);

  const styles = input.styles.length ? input.styles : (['normal'] as Style[]);
  const counts = allocateStyles(styles, days, input.mix);
  const styleOrder = orderStyles(counts);
  const offsets = sessionDayOffsets(styleOrder.length);

  // Focus for every session.
  const parts = input.goal === 'body_part' ? input.bodyParts.slice(0, 2) : [];
  const targets = new Set(parts.length ? targetIndexes(styleOrder.length) : []);
  const focuses: Focus[] = [];
  const rotation: Focus[] = ['push', 'legs', 'pull', 'core'];
  let cardioAt = -1;
  if (input.goal === 'stay_fit') {
    const want = Math.floor(styleOrder.length / 2);
    let bestDist = Number.POSITIVE_INFINITY;
    styleOrder.forEach((s, i) => {
      if (s === 'yoga') return;
      const d = Math.abs(i - want);
      if (d < bestDist) {
        bestDist = d;
        cardioAt = i;
      }
    });
  }
  let r = 0;
  styleOrder.forEach((_, i) => {
    if (input.goal === 'body_part') focuses.push(targets.has(i) ? 'parts' : 'full');
    else if (i === cardioAt) focuses.push('cardio');
    else {
      focuses.push(rotation[r % rotation.length] as Focus);
      r += 1;
    }
  });

  const dayList: PlanDay[] = [];
  let rest = 0;
  for (let d = 0; d < 7; d += 1) {
    const date = addDays(input.startDate, d);
    const sessionIdx = offsets.indexOf(d);
    if (sessionIdx < 0) {
      const suggestion: RestSuggestion = rest % 2 === 0 ? 'walk' : 'stretch';
      rest += 1;
      dayList.push({
        dayIndex: d,
        date,
        kind: 'rest',
        style: null,
        focus: null,
        parts: [],
        title: suggestion === 'walk' ? 'Rest day: take a walk' : 'Rest day: gentle stretch',
        restSuggestion: suggestion,
        session: null,
      });
      continue;
    }
    const style = styleOrder[sessionIdx] as Style;
    const focus = focuses[sessionIdx] as Focus;
    const session = buildSession(
      {
        id: `w${weekNumber}-d${d}`,
        style,
        focus,
        parts: focus === 'parts' ? parts : undefined,
        level,
        intensity: input.intensity,
        restrictions,
        seed: seed + d * 7919,
      },
      index,
    );
    dayList.push({
      dayIndex: d,
      date,
      kind: 'training',
      style,
      focus,
      parts: focus === 'parts' ? [...parts] : [],
      title: session.title,
      restSuggestion: null,
      session,
    });
  }

  const skipped = skippedMoves(index, restrictions, styles).map((s) => ({ ...s }));
  const why: WhyFact[] = [];
  if (input.goal === 'body_part' && parts.length) {
    why.push({
      kind: 'focus',
      text: `You chose ${list(parts)}, so about 60% of your sessions work them (${targetSlotCount(5)} of 5 moves).`,
    });
  } else {
    why.push({ kind: 'focus', text: 'You want to stay fit, so the week rotates full-body sessions with one cardio day.' });
  }
  why.push({
    kind: 'days',
    text: `${days} ${plural(days, 'day', 'days')} a week, 15 minutes each, with ${7 - days} rest ${plural(7 - days, 'day', 'days')}.`,
  });
  why.push({
    kind: 'experience',
    text: `You said you are ${EXPERIENCE_TEXT[input.experience ?? 'new']}, so moves start at the matching level.`,
  });
  why.push({
    kind: 'style',
    text: list(STYLES.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${s}`)) + '.',
  });
  const byReason = new Map<string, string[]>();
  for (const s of skipped) {
    const names = byReason.get(s.reason) ?? [];
    names.push(s.name.toLowerCase());
    byReason.set(s.reason, names);
  }
  for (const [reason, names] of byReason) {
    if (reason === 'gentler') continue;
    why.push({ kind: 'skip', text: `Skipping ${list(names)} because of ${REASON_TEXT[reason] ?? reason}.` });
  }
  if (gentler) {
    why.push({
      kind: 'gentler',
      text: 'Your answers switch you to the gentler plan: no HIIT, no jumping, and easier starting moves. Check with your doctor if you are unsure.',
    });
  }

  const reverse = reverseWalkEligibility({
    healthFlags: input.healthFlags,
    age: input.age ?? null,
    balanceConcern: input.balanceConcern ?? false,
    usedTodayS: 0,
  });

  return {
    variant: gentler ? 'gentler' : 'standard',
    weekNumber,
    startDate: input.startDate,
    days: dayList,
    skipped,
    why,
    guards: { hiit: !gentler, jumping: !gentler, reverseWalk: reverse.allowed },
    restrictions,
    engineVersion: ENGINE_VERSION,
  };
}

/** True when the last finished session was 7 or more days ago (D14). */
export function isLapsed(lastSessionDate: string | null, today: string): boolean {
  if (!lastSessionDate) return false;
  return diffDays(lastSessionDate, today) >= LAPSED_AFTER_DAYS;
}

/**
 * The quiet comeback rebuild (PRD idea 4): one rung easier, a lighter week, no missed-day count.
 * Returns new input; call buildPlan with it.
 */
export function comebackInput(input: PlanInput): PlanInput {
  return {
    ...input,
    daysPerWeek: Math.max(3, Math.min(input.daysPerWeek, 7) - 1),
    levelOffset: (input.levelOffset ?? 0) - 1,
    intensity: -1,
  };
}

const STYLE_BITS: Record<Style, number> = { normal: 1, yoga: 2, dance: 4 };

/**
 * What the server may receive (D3): goal, styles, days, experience and the derived variant.
 * Health flags and pain areas are never in it.
 */
export function toServerPlan(
  input: Pick<PlanInput, 'goal' | 'styles' | 'daysPerWeek' | 'experience'>,
  plan: Pick<Plan, 'variant'>,
): {
  goal: 'stay_fit' | 'body_part' | 'gentler';
  stylesBitmask: number;
  daysPerWeek: number;
  experience: Experience;
  variant: PlanVariant;
} {
  return {
    goal: plan.variant === 'gentler' ? 'gentler' : input.goal,
    stylesBitmask: input.styles.reduce((a, s) => a | STYLE_BITS[s], 0),
    daysPerWeek: input.daysPerWeek,
    experience: input.experience ?? 'new',
    variant: plan.variant,
  };
}
