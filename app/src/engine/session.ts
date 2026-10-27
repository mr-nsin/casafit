import {
  type CatalogueIndex,
  exclusionReason,
  familyOf,
  isEligible,
  resolveLadder,
} from './catalogue';
import { createRng, hashString, shuffled, type Rng } from './rng';
import {
  COOLDOWN_STEPS,
  DEFAULT_BUDGET_S,
  DEFAULT_WORK_SLOTS,
  MAX_WORK_SLOTS,
  MIN_REST_S,
  MIN_WORK_SLOTS,
  SETS_PER_SLOT,
  SLOT_S,
  STEP_S,
  TRANSITION_S,
  WARMUP_STEPS,
  intensityTiming,
  totalS,
} from './timeline';
import {
  BODY_PARTS,
  EngineError,
  type BodyPart,
  type Exercise,
  type Focus,
  type Pattern,
  type PlanStep,
  type Restrictions,
  type Rung,
  type SessionPlan,
  type Style,
} from './types';

export const ENGINE_VERSION = '1.0.0';
/** The gentler plan never starts above this ladder level. */
export const GENTLER_MAX_LEVEL = 1;

export interface SessionRequest {
  id: string;
  style: Style;
  focus: Focus;
  /** Body parts for focus 'parts'. */
  parts?: readonly BodyPart[];
  /** Ladder level to start from (experience plus last week's felt). */
  level: number;
  /** Intensity rung applied to every work move. Default 0, as planned. */
  intensity?: Rung;
  restrictions: Restrictions;
  seed: number;
  /** 3 to 8, default 5. */
  workSlots?: number;
  title?: string;
}

// ---------------------------------------------------------------------------
// Step construction
// ---------------------------------------------------------------------------

function workStep(ex: Exercise, id: string, rung: Rung): PlanStep {
  const t = intensityTiming(ex.mode, rung);
  return {
    id,
    phase: 'work',
    exerciseId: ex.id,
    name: ex.name,
    mode: ex.mode,
    sets: SETS_PER_SLOT,
    workS: t.workS,
    restS: t.restS,
    transitionS: TRANSITION_S,
    sides: ex.sides,
    rung,
    muscles: ex.muscles.slice(),
    stretches: (ex.stretches ?? []).slice(),
    lowImpact: ex.impact !== 'high' && !ex.jumping,
    formCheckable: ex.formCheckable,
  };
}

function bookendStep(ex: Exercise, id: string, phase: 'warmup' | 'cooldown'): PlanStep {
  return {
    id,
    phase,
    exerciseId: ex.id,
    name: ex.name,
    mode: ex.mode,
    sets: 1,
    workS: STEP_S,
    restS: 0,
    transitionS: 0,
    // A 30 s warm-up or cool-down step is one block. Both sides are cued inside it.
    sides: 'none',
    rung: 0,
    muscles: ex.muscles.slice(),
    stretches: (ex.stretches ?? []).slice(),
    lowImpact: ex.impact !== 'high' && !ex.jumping,
    formCheckable: false,
  };
}

// ---------------------------------------------------------------------------
// Which moves go in the work block
// ---------------------------------------------------------------------------

interface Want {
  pattern?: Pattern;
  muscle?: BodyPart;
}

const RECIPES: Record<Exclude<Focus, 'parts'>, Pattern[]> = {
  push: ['push', 'push', 'core', 'push', 'legs'],
  pull: ['pull', 'pull', 'core', 'pull', 'legs'],
  legs: ['legs', 'legs', 'legs', 'core', 'cardio'],
  core: ['core', 'core', 'core', 'legs', 'push'],
  cardio: ['cardio', 'cardio', 'legs', 'cardio', 'core'],
  full: ['push', 'legs', 'pull', 'core', 'cardio'],
};

const FOCUS_MUSCLES: Record<Exclude<Focus, 'parts'>, BodyPart[]> = {
  push: ['chest', 'shoulders', 'arms', 'core', 'legs'],
  pull: ['back', 'arms', 'shoulders', 'core', 'glutes'],
  legs: ['legs', 'glutes', 'legs', 'core', 'back'],
  core: ['core', 'glutes', 'core', 'back', 'legs'],
  cardio: ['legs', 'core', 'shoulders', 'glutes', 'back'],
  full: ['legs', 'chest', 'back', 'core', 'shoulders'],
};

/** At least three of five slots (60%) go to the chosen parts. */
export function targetSlotCount(slots: number): number {
  return Math.max(MIN_WORK_SLOTS, Math.ceil(slots * 0.6));
}

function slotWants(
  style: Style,
  focus: Focus,
  parts: readonly BodyPart[],
  slots: number,
): Want[] {
  const wants: Want[] = [];
  const base: Exclude<Focus, 'parts'> = focus === 'parts' ? 'full' : focus;
  let targeted = 0;
  if (focus === 'parts' && parts.length > 0) {
    targeted = Math.min(slots, targetSlotCount(slots));
    for (let i = 0; i < targeted; i += 1) {
      wants.push({ muscle: parts[i % parts.length] });
    }
  }
  const recipe = RECIPES[base];
  const muscles = FOCUS_MUSCLES[base];
  for (let i = wants.length; i < slots; i += 1) {
    const k = i - targeted;
    if (style === 'normal') wants.push({ pattern: recipe[k % recipe.length] });
    else wants.push({ muscle: muscles[k % muscles.length] });
  }
  return wants;
}

function matches(ex: Exercise, want: Want): boolean {
  if (want.pattern && ex.pattern !== want.pattern) return false;
  if (want.muscle && !ex.muscles.includes(want.muscle)) return false;
  return true;
}

/**
 * Reorders so that no primary muscle appears three times running, when that is possible.
 * Picks, at each position, from the muscle with the most moves left that does not make a run.
 */
function breakRuns(steps: PlanStep[]): PlanStep[] {
  const main = (s: PlanStep) => s.muscles[0];
  const left = steps.slice();
  const out: PlanStep[] = [];
  while (left.length > 0) {
    const a = out[out.length - 1];
    const b = out[out.length - 2];
    const blocked = a && b && main(a) === main(b) ? main(a) : undefined;
    const remaining = new Map<string | undefined, number>();
    for (const s of left) remaining.set(main(s), (remaining.get(main(s)) ?? 0) + 1);
    let pick = -1;
    let pickCount = -1;
    left.forEach((s, i) => {
      if (blocked !== undefined && main(s) === blocked) return;
      const c = remaining.get(main(s)) ?? 0;
      if (c > pickCount) {
        pick = i;
        pickCount = c;
      }
    });
    if (pick < 0) pick = 0;
    out.push(left.splice(pick, 1)[0] as PlanStep);
  }
  return out;
}

/** The muscle that appears as primary three times in a row in the work block, or null. */
export function sameMuscleRun(session: Pick<SessionPlan, 'steps'>): BodyPart | null {
  const work = session.steps.filter((s) => s.phase === 'work');
  for (let i = 2; i < work.length; i += 1) {
    const m = work[i]?.muscles[0];
    if (m && m === work[i - 1]?.muscles[0] && m === work[i - 2]?.muscles[0]) return m;
  }
  return null;
}

function pickWork(
  req: SessionRequest,
  index: CatalogueIndex,
  level: number,
  rng: Rng,
  slots: number,
): Exercise[] {
  // One resolved move per ladder, at the user's level.
  const pool: Exercise[] = [];
  const ladders = new Set<string>();
  for (const ex of index.all) if (ex.phase === 'work' && ex.style === req.style) ladders.add(ex.ladder);
  for (const ladder of [...ladders].sort()) {
    const ex = resolveLadder(index, ladder, level, req.restrictions);
    if (ex && ex.style === req.style && ex.phase === 'work') pool.push(ex);
  }

  const wants = slotWants(req.style, req.focus, req.parts ?? [], slots);
  const chosen: Exercise[] = [];
  const usedFamilies = new Set<string>();
  const available = (ex: Exercise) => !usedFamilies.has(familyOf(ex)) && !chosen.includes(ex);

  for (const want of wants) {
    const strict = shuffled(pool.filter((ex) => available(ex) && matches(ex, want)), rng);
    const pick = strict[0] ?? shuffled(pool.filter(available), rng)[0];
    if (!pick) {
      throw new EngineError(
        'catalogue_too_small',
        `Not enough ${req.style} moves for ${slots} slots under these restrictions.`,
      );
    }
    chosen.push(pick);
    usedFamilies.add(familyOf(pick));
  }
  return chosen;
}

function pickWarmup(
  req: SessionRequest,
  index: CatalogueIndex,
  worked: BodyPart[],
  rng: Rng,
): Exercise[] {
  const weight = new Map<BodyPart, number>();
  for (const m of worked) weight.set(m, (weight.get(m) ?? 0) + 1);
  const eligible = index.all.filter((ex) => ex.phase === 'warmup' && isEligible(ex, req.restrictions));
  const scored = shuffled(eligible, rng)
    .map((ex) => ({
      ex,
      score:
        ex.muscles.reduce((a, m) => a + (weight.get(m) ?? 0), 0) +
        (ex.style === req.style ? 2 : ex.style === 'normal' ? 0.5 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  const out: Exercise[] = [];
  const fams = new Set<string>();
  for (const { ex } of scored) {
    if (out.length === WARMUP_STEPS) break;
    if (fams.has(familyOf(ex))) continue;
    fams.add(familyOf(ex));
    out.push(ex);
  }
  if (out.length < WARMUP_STEPS) {
    throw new EngineError('catalogue_too_small', 'Not enough warm-up moves under these restrictions.');
  }
  return out;
}

/**
 * Cool-down for the muscles actually worked (PRD section 9: "cool-down follows the edit").
 * Stretches that cover worked muscles come first. Generic moves (breathing, rest pose) fill
 * the rest. A stretch for a muscle that was not worked is used only when nothing else is left.
 */
export function pickCooldown(
  style: Style,
  workSteps: readonly Pick<PlanStep, 'muscles'>[],
  index: CatalogueIndex,
  restrictions: Restrictions,
  rng: Rng,
): Exercise[] {
  const weight = new Map<BodyPart, number>();
  for (const s of workSteps) {
    s.muscles.forEach((m, i) => weight.set(m, (weight.get(m) ?? 0) + (i === 0 ? 2 : 1)));
  }
  const pool = shuffled(
    index.all.filter((ex) => ex.phase === 'cooldown' && isEligible(ex, restrictions)),
    rng,
  );
  const out: Exercise[] = [];
  const covered = new Set<BodyPart>();
  const fams = new Set<string>();
  while (out.length < COOLDOWN_STEPS) {
    let best: Exercise | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const ex of pool) {
      if (out.includes(ex) || fams.has(familyOf(ex))) continue;
      let score = ex.style === style ? 0.5 : 0;
      for (const m of ex.stretches ?? []) {
        const w = weight.get(m);
        if (w === undefined) score -= 3;
        else if (!covered.has(m)) score += w;
      }
      if (score > bestScore) {
        best = ex;
        bestScore = score;
      }
    }
    if (!best) break;
    out.push(best);
    fams.add(familyOf(best));
    for (const m of best.stretches ?? []) covered.add(m);
  }
  if (out.length < COOLDOWN_STEPS) {
    throw new EngineError('catalogue_too_small', 'Not enough cool-down moves under these restrictions.');
  }
  return out;
}

const FOCUS_TITLES: Record<Exclude<Focus, 'parts'>, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  full: 'Full body',
};

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function sessionTitle(style: Style, focus: Focus, parts: readonly BodyPart[]): string {
  if (style === 'yoga') return focus === 'parts' && parts.length ? `Yoga: ${parts.map(capitalise).join(' + ')} 15` : 'Yoga flow 15';
  if (style === 'dance') return 'Dance cardio 15';
  if (focus === 'parts' && parts.length) return `${parts.map(capitalise).join(' + ')} 15`;
  return `${FOCUS_TITLES[focus === 'parts' ? 'full' : focus]} 15`;
}

/**
 * Builds one session: 4 warm-up steps, 3 to 8 work moves (5 by default), 4 cool-down steps.
 * With the default 5 moves the total is exactly 15:00 (D1).
 */
export function buildSession(req: SessionRequest, index: CatalogueIndex): SessionPlan {
  const slots = req.workSlots ?? DEFAULT_WORK_SLOTS;
  if (!Number.isInteger(slots) || slots < MIN_WORK_SLOTS || slots > MAX_WORK_SLOTS) {
    throw new EngineError('bad_slots', `Work moves must be ${MIN_WORK_SLOTS} to ${MAX_WORK_SLOTS}.`);
  }
  const rng = createRng(req.seed ^ hashString(req.id));
  const level = req.restrictions.gentler ? Math.min(req.level, GENTLER_MAX_LEVEL) : req.level;
  const intensity: Rung = req.intensity ?? 0;

  const work = pickWork(req, index, Math.max(0, level), rng, slots);
  const workSteps = breakRuns(work.map((ex, i) => workStep(ex, `work-${i}`, intensity)));
  const warm = pickWarmup(
    req,
    index,
    workSteps.flatMap((s) => s.muscles),
    rng,
  );
  const cool = pickCooldown(req.style, workSteps, index, req.restrictions, rng);

  const steps: PlanStep[] = [
    ...warm.map((ex, i) => bookendStep(ex, `warm-${i}`, 'warmup')),
    ...workSteps,
    ...cool.map((ex, i) => bookendStep(ex, `cool-${i}`, 'cooldown')),
  ];

  const exclusions: SessionPlan['exclusions'] = [];
  for (const ex of index.all) {
    if (ex.phase !== 'work' || ex.style !== req.style) continue;
    const reason = exclusionReason(ex, req.restrictions);
    if (reason) exclusions.push({ exerciseId: ex.id, reason });
  }

  return {
    id: req.id,
    title: req.title ?? sessionTitle(req.style, req.focus, req.parts ?? []),
    style: req.style,
    focus: req.focus,
    parts: req.focus === 'parts' ? [...(req.parts ?? [])] : [],
    budgetS: DEFAULT_BUDGET_S,
    steps,
    restrictions: req.restrictions,
    exclusions,
    engineVersion: ENGINE_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

/** Rebuilds the cool-down from the moves now in the work block. */
export function rebuildCooldown(session: SessionPlan, index: CatalogueIndex): SessionPlan {
  const work = session.steps.filter((s) => s.phase === 'work');
  const rng = createRng(hashString(`${session.id}:cooldown`));
  const cool = pickCooldown(session.style, work, index, session.restrictions, rng);
  const steps = session.steps
    .filter((s) => s.phase !== 'cooldown')
    .concat(cool.map((ex, i) => bookendStep(ex, `cool-${i}`, 'cooldown')));
  return { ...session, steps };
}

export type EditFailure =
  | 'min_work'
  | 'max_work'
  | 'unknown_exercise'
  | 'unknown_step'
  | 'excluded'
  | 'duplicate'
  | 'not_work_move';

export type EditResult =
  | { ok: true; session: SessionPlan; deltaS: number; totalS: number }
  | { ok: false; reason: EditFailure };

function done(before: SessionPlan, after: SessionPlan): EditResult {
  const t = totalS(after);
  return { ok: true, session: after, deltaS: t - totalS(before), totalS: t };
}

/** The rung most work moves are on. New moves join at this intensity. */
export function currentIntensity(session: Pick<SessionPlan, 'steps'>): Rung {
  const counts: Record<string, number> = { '-1': 0, '0': 0, '1': 0 };
  for (const s of session.steps) if (s.phase === 'work') counts[String(s.rung)] = (counts[String(s.rung)] ?? 0) + 1;
  const c0 = counts['0'] ?? 0;
  const cm = counts['-1'] ?? 0;
  const cp = counts['1'] ?? 0;
  if (cm > c0 && cm >= cp) return -1;
  if (cp > c0 && cp > cm) return 1;
  return 0;
}

function nextWorkId(session: SessionPlan): string {
  let max = -1;
  for (const s of session.steps) {
    const m = /^work-(\d+)$/.exec(s.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `work-${max + 1}`;
}

/** Adds a move to the end of the work block (+2:12) and rebuilds the cool-down. Max 8 moves. */
export function addExercise(session: SessionPlan, exerciseId: string, index: CatalogueIndex): EditResult {
  const ex = index.byId.get(exerciseId);
  if (!ex) return { ok: false, reason: 'unknown_exercise' };
  if (ex.phase !== 'work') return { ok: false, reason: 'not_work_move' };
  if (!isEligible(ex, session.restrictions)) return { ok: false, reason: 'excluded' };
  const work = session.steps.filter((s) => s.phase === 'work');
  if (work.length >= MAX_WORK_SLOTS) return { ok: false, reason: 'max_work' };
  if (work.some((s) => s.exerciseId === ex.id)) return { ok: false, reason: 'duplicate' };
  const step = workStep(ex, nextWorkId(session), currentIntensity(session));
  const firstCool = session.steps.findIndex((s) => s.phase === 'cooldown');
  const steps = session.steps.slice();
  steps.splice(firstCool < 0 ? steps.length : firstCool, 0, step);
  return done(session, rebuildCooldown({ ...session, steps }, index));
}

/** Removes a work move (-2:12) and rebuilds the cool-down. Min 3 moves. */
export function removeExercise(session: SessionPlan, stepId: string, index: CatalogueIndex): EditResult {
  const step = session.steps.find((s) => s.id === stepId);
  if (!step) return { ok: false, reason: 'unknown_step' };
  if (step.phase !== 'work') return { ok: false, reason: 'not_work_move' };
  const work = session.steps.filter((s) => s.phase === 'work');
  if (work.length <= MIN_WORK_SLOTS) return { ok: false, reason: 'min_work' };
  const steps = session.steps.filter((s) => s.id !== stepId);
  return done(session, rebuildCooldown({ ...session, steps }, index));
}

/** Swaps one work move for another in the same place. The total does not change. */
export function swapExercise(
  session: SessionPlan,
  stepId: string,
  exerciseId: string,
  index: CatalogueIndex,
): EditResult {
  const pos = session.steps.findIndex((s) => s.id === stepId);
  const old = session.steps[pos];
  if (!old) return { ok: false, reason: 'unknown_step' };
  if (old.phase !== 'work') return { ok: false, reason: 'not_work_move' };
  const ex = index.byId.get(exerciseId);
  if (!ex) return { ok: false, reason: 'unknown_exercise' };
  if (ex.phase !== 'work') return { ok: false, reason: 'not_work_move' };
  if (!isEligible(ex, session.restrictions)) return { ok: false, reason: 'excluded' };
  if (session.steps.some((s) => s.phase === 'work' && s.id !== stepId && s.exerciseId === ex.id)) {
    return { ok: false, reason: 'duplicate' };
  }
  const steps = session.steps.slice();
  steps[pos] = workStep(ex, old.id, old.rung);
  return done(session, rebuildCooldown({ ...session, steps }, index));
}

/** One move to refill the time after a removal: same main muscle first, then same style. */
export function suggestReplacement(
  session: SessionPlan,
  removed: Pick<PlanStep, 'muscles' | 'exerciseId'>,
  index: CatalogueIndex,
): Exercise | null {
  const inSession = new Set(session.steps.filter((s) => s.phase === 'work').map((s) => s.exerciseId));
  const families = new Set(
    session.steps
      .filter((s) => s.phase === 'work')
      .map((s) => index.byId.get(s.exerciseId))
      .filter((e): e is Exercise => !!e)
      .map(familyOf),
  );
  let best: Exercise | null = null;
  let bestScore = -1;
  const ladders = new Set<string>();
  for (const ex of index.all) if (ex.phase === 'work' && ex.style === session.style) ladders.add(ex.ladder);
  const removedEx = index.byId.get(removed.exerciseId);
  const targetLevel = removedEx?.level ?? 0;
  for (const ladder of [...ladders].sort()) {
    const ex = resolveLadder(index, ladder, targetLevel, session.restrictions);
    if (!ex || inSession.has(ex.id) || families.has(familyOf(ex))) continue;
    const score = (ex.muscles[0] === removed.muscles[0] ? 2 : 0) + (ex.muscles.some((m) => removed.muscles.includes(m)) ? 1 : 0);
    if (score > bestScore) {
      best = ex;
      bestScore = score;
    }
  }
  return best;
}

export interface PickerOption {
  exercise: Exercise;
  /** Time this move adds: always 2:12. */
  addsS: number;
}

/** Moves the picker can offer: allowed for this user, not already in the session. */
export function pickerOptions(
  session: SessionPlan,
  index: CatalogueIndex,
  filter: { parts?: readonly BodyPart[]; style?: Style } = {},
): PickerOption[] {
  const inSession = new Set(session.steps.filter((s) => s.phase === 'work').map((s) => s.exerciseId));
  const out: PickerOption[] = [];
  for (const ex of index.all) {
    if (ex.phase !== 'work' || inSession.has(ex.id)) continue;
    if (!isEligible(ex, session.restrictions)) continue;
    if (filter.style && ex.style !== filter.style) continue;
    if (filter.parts && filter.parts.length && !ex.muscles.some((m) => filter.parts?.includes(m))) continue;
    out.push({ exercise: ex, addsS: SLOT_S });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Intensity, budget, quiet mode
// ---------------------------------------------------------------------------

/** Sets every work move (from `fromStepIndex` on) to a rung. Work plus rest stay 60 s a set. */
export function applyIntensity(session: SessionPlan, rung: Rung, fromStepIndex = 0): SessionPlan {
  const steps = session.steps.map((s, i) => {
    if (s.phase !== 'work' || i < fromStepIndex) return s;
    const t = intensityTiming(s.mode, rung);
    return { ...s, rung, workS: t.workS, restS: t.restS };
  });
  return { ...session, steps };
}

export interface BudgetStatus {
  totalS: number;
  budgetS: number;
  overByS: number;
  underByS: number;
  /** Fixes the editor offers when over budget (PRD section 9). */
  fixes: ('shorten_rest' | 'replace_exercise' | 'extend_budget')[];
}

export function budgetStatus(session: SessionPlan): BudgetStatus {
  const t = totalS(session);
  const over = Math.max(0, t - session.budgetS);
  return {
    totalS: t,
    budgetS: session.budgetS,
    overByS: over,
    underByS: Math.max(0, session.budgetS - t),
    fixes: over > 0 ? ['shorten_rest', 'replace_exercise', 'extend_budget'] : [],
  };
}

/** "Go 16 min": the user lifts the limit for today. */
export function withBudget(session: SessionPlan, budgetS: number): SessionPlan {
  return { ...session, budgetS };
}

/**
 * Shortens rest, never below 10 s, until the session fits. May land up to 1 s under the budget
 * because rest comes off both sets of a move together.
 */
export function shortenRestToFit(
  session: SessionPlan,
): { ok: true; session: SessionPlan } | { ok: false; reason: 'cannot_fit'; stillOverByS: number } {
  let need = totalS(session) - session.budgetS;
  if (need <= 0) return { ok: true, session };
  const steps = session.steps.map((s) => ({ ...s }));
  while (need > 0) {
    let target: PlanStep | null = null;
    for (const s of steps) {
      if (s.phase === 'work' && s.restS > MIN_REST_S && (!target || s.restS > target.restS)) target = s;
    }
    if (!target) return { ok: false, reason: 'cannot_fit', stillOverByS: need };
    target.restS -= 1;
    need -= target.sets;
  }
  return { ok: true, session: { ...session, steps } };
}

/**
 * Quiet mode: swaps jumping and high-impact moves for low-impact ones. Timing does not change.
 * Moves with no allowed substitute are reported in `unresolved` and left in place.
 */
export function toQuietSession(
  session: SessionPlan,
  index: CatalogueIndex,
): { session: SessionPlan; unresolved: string[] } {
  const restrictions: Restrictions = { ...session.restrictions, quiet: true };
  const unresolved: string[] = [];
  const used = new Set(session.steps.map((s) => s.exerciseId));
  const steps = session.steps.map((s) => {
    const ex = index.byId.get(s.exerciseId);
    if (!ex || isEligible(ex, restrictions)) return s;
    let sub: Exercise | null = null;
    const alt = ex.lowImpactAlt ? index.byId.get(ex.lowImpactAlt) : undefined;
    if (alt && isEligible(alt, restrictions) && alt.phase === ex.phase && !used.has(alt.id)) sub = alt;
    if (!sub) sub = resolveLadder(index, ex.ladder, ex.level, restrictions);
    if (sub && used.has(sub.id) && sub.id !== ex.id) sub = null;
    if (!sub) {
      sub =
        index.all.find(
          (c) =>
            c.phase === ex.phase &&
            c.style === ex.style &&
            c.pattern === ex.pattern &&
            !used.has(c.id) &&
            isEligible(c, restrictions),
        ) ?? null;
    }
    if (!sub) {
      unresolved.push(s.id);
      return s;
    }
    used.add(sub.id);
    return s.phase === 'work' ? workStep(sub, s.id, s.rung) : bookendStep(sub, s.id, s.phase as 'warmup' | 'cooldown');
  });
  let next: SessionPlan = { ...session, steps, restrictions };
  // Cool-down already allowed under quiet mode is kept; rebuild only matches muscles to the new moves.
  next = rebuildCooldown(next, index);
  return { session: next, unresolved };
}

/** Distinct body parts worked in the session (primary muscles of work moves). */
export function musclesWorked(session: Pick<SessionPlan, 'steps'>): BodyPart[] {
  const set = new Set<BodyPart>();
  for (const s of session.steps) if (s.phase === 'work') for (const m of s.muscles) set.add(m);
  return BODY_PARTS.filter((p) => set.has(p));
}
