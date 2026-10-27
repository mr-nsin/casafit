import type { PlanStep, Rung, SessionPlan, StepMode, Timeline, TimelineSegment } from './types';

/**
 * D1, to the second.
 *
 *   Warm-up   4 steps x 30 s                         = 2:00
 *   Work      5 slots x (12 s transition + 2 sets x (work + rest = 60 s)) = 5 x 2:12 = 11:00
 *   Cool-down 4 steps x 30 s                         = 2:00
 *   Total                                            = 15:00
 *
 * Work and rest always add to 60 s per set, so the three intensities (30/30, 40/20, 45/15)
 * never change the total. Adding or removing a work move changes it by 2:12.
 */
export const WARMUP_STEPS = 4;
export const COOLDOWN_STEPS = 4;
export const STEP_S = 30;
export const DEFAULT_WORK_SLOTS = 5;
export const MIN_WORK_SLOTS = 3;
export const MAX_WORK_SLOTS = 8;
export const SETS_PER_SLOT = 2;
export const SET_S = 60;
export const TRANSITION_S = 12;
/** Work-slot length including its transition: 2:12. */
export const SLOT_S = SETS_PER_SLOT * SET_S + TRANSITION_S;
export const WARMUP_S = WARMUP_STEPS * STEP_S;
export const COOLDOWN_S = COOLDOWN_STEPS * STEP_S;
export const DEFAULT_BUDGET_S = WARMUP_S + DEFAULT_WORK_SLOTS * SLOT_S + COOLDOWN_S;
/** Rest is never shortened below this (PRD section 9, over-budget fix). */
export const MIN_REST_S = 10;

/** Work and rest seconds for one set, by move type and intensity. */
export function intensityTiming(mode: StepMode, rung: Rung): { workS: number; restS: number } {
  switch (mode) {
    case 'hold':
      // Holds are 10 s shorter or longer than planned.
      return rung === -1 ? { workS: 20, restS: 40 } : rung === 1 ? { workS: 40, restS: 20 } : { workS: 30, restS: 30 };
    case 'routine_step':
      // Dance changes by impact version, not by timing.
      return { workS: 40, restS: 20 };
    case 'timed':
    case 'reps':
    default:
      return rung === -1 ? { workS: 30, restS: 30 } : rung === 1 ? { workS: 45, restS: 15 } : { workS: 40, restS: 20 };
  }
}

export function stepDurationS(step: PlanStep): number {
  return step.transitionS + step.sets * (step.workS + step.restS);
}

export function totalS(session: Pick<SessionPlan, 'steps'>): number {
  let t = 0;
  for (const s of session.steps) t += stepDurationS(s);
  return t;
}

export function phaseS(session: Pick<SessionPlan, 'steps'>, phase: PlanStep['phase']): number {
  let t = 0;
  for (const s of session.steps) if (s.phase === phase) t += stepDurationS(s);
  return t;
}

export function workMoveCount(session: Pick<SessionPlan, 'steps'>): number {
  return session.steps.filter((s) => s.phase === 'work').length;
}

export interface TimelineOptions {
  /**
   * Intensity changes made mid-session, keyed `${stepId}#${set}` (set is 1-based). A change
   * takes effect from the next set, so it is stored per set. Work steps only.
   */
  rungBySet?: Readonly<Record<string, Rung>>;
}

export function setKey(stepId: string, set: number): string {
  return `${stepId}#${set}`;
}

/**
 * Flat list of timed segments: transition, then for each set a work segment and a rest segment.
 * A segment starts exactly where the previous one ends.
 */
export function buildTimeline(session: Pick<SessionPlan, 'steps'>, opts: TimelineOptions = {}): Timeline {
  const segments: TimelineSegment[] = [];
  let t = 0;
  let warmupS = 0;
  let workS = 0;
  let cooldownS = 0;

  const push = (
    kind: TimelineSegment['kind'],
    step: PlanStep,
    stepIndex: number,
    set: number,
    side: 'R' | 'L' | null,
    durationS: number,
  ) => {
    if (durationS <= 0) return;
    segments.push({
      index: segments.length,
      kind,
      phase: step.phase,
      stepIndex,
      stepId: step.id,
      set,
      side,
      startS: t,
      durationS,
      endS: t + durationS,
    });
    t += durationS;
    if (step.phase === 'warmup') warmupS += durationS;
    else if (step.phase === 'work') workS += durationS;
    else cooldownS += durationS;
  };

  session.steps.forEach((step, stepIndex) => {
    push('transition', step, stepIndex, 0, null, step.transitionS);
    for (let set = 1; set <= step.sets; set += 1) {
      let w = step.workS;
      let r = step.restS;
      const override = step.phase === 'work' ? opts.rungBySet?.[setKey(step.id, set)] : undefined;
      if (override !== undefined) {
        const timing = intensityTiming(step.mode, override);
        w = timing.workS;
        r = timing.restS;
      }
      const side = step.sides === 'each' ? (set === 1 ? 'R' : 'L') : null;
      push('work', step, stepIndex, set, side, w);
      push('rest', step, stepIndex, set, side, r);
    }
  });

  return { segments, totalS: t, warmupS, workS, cooldownS };
}

/**
 * Problems with a session that is meant to follow D1 exactly. Empty means it does.
 * A session whose rest was shortened (over-budget fix) or whose budget was overridden is
 * valid but not canonical, so this is for the generator and for tests, not for the player.
 */
export function canonicalProblems(session: SessionPlan): string[] {
  const problems: string[] = [];
  const warm = session.steps.filter((s) => s.phase === 'warmup');
  const work = session.steps.filter((s) => s.phase === 'work');
  const cool = session.steps.filter((s) => s.phase === 'cooldown');
  if (warm.length !== WARMUP_STEPS) problems.push(`warm-up has ${warm.length} steps`);
  if (cool.length !== COOLDOWN_STEPS) problems.push(`cool-down has ${cool.length} steps`);
  if (work.length < MIN_WORK_SLOTS || work.length > MAX_WORK_SLOTS) {
    problems.push(`work has ${work.length} moves`);
  }
  for (const s of warm.concat(cool)) {
    if (s.sets !== 1 || s.workS !== STEP_S || s.restS !== 0 || s.transitionS !== 0) {
      problems.push(`step ${s.id} is not a single ${STEP_S} s step`);
    }
  }
  for (const s of work) {
    if (s.sets !== SETS_PER_SLOT) problems.push(`step ${s.id} has ${s.sets} sets`);
    if (s.workS + s.restS !== SET_S) problems.push(`step ${s.id} set is ${s.workS + s.restS} s`);
    if (s.transitionS !== TRANSITION_S) problems.push(`step ${s.id} transition is ${s.transitionS} s`);
  }
  const order = session.steps.map((s) => s.phase).join(',');
  const sorted = [...session.steps]
    .map((s) => s.phase)
    .sort((a, b) => ['warmup', 'work', 'cooldown'].indexOf(a) - ['warmup', 'work', 'cooldown'].indexOf(b))
    .join(',');
  if (order !== sorted) problems.push('phases are out of order');
  return problems;
}
