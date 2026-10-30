// Pure helpers for Library, BodyPart, Exercise and the ready-made plan view.
// Content comes from the bundled packs (offline); the engine builds the sessions.
// No React and no navigation here.

import {
  loadContent,
  type Content,
  type Exercise as ContentExercise,
  type HealthFlag as ContentFlag,
  type PlanMove,
  type ReadyMadePlan,
  type Style as ContentStyle,
} from '../../../content';
import type { Profile } from '../../../db/repositories';
import {
  ENGINE_VERSION,
  TRANSITION_S,
  buildSession,
  indexCatalogue,
  ladderLevel,
  restrictionsFor,
  type Catalogue,
  type CatalogueIndex,
  type PlanStep,
  type Restrictions,
  type Experience,
  type SessionPlan,
} from '../../../engine';
import { getOnboardingDeps } from '../../onboarding/deps';
import { DOT, cap } from './model';

// ---- Catalogue index for the engine ----

let indexed: { catalogue: Catalogue; index: CatalogueIndex } | null = null;

/** The engine's catalogue index, built once per catalogue. */
export function getCatalogueIndex(): CatalogueIndex {
  const catalogue = getOnboardingDeps().catalogue();
  if (!indexed || indexed.catalogue !== catalogue) indexed = { catalogue, index: indexCatalogue(catalogue) };
  return indexed.index;
}

// ---- Flags and restrictions ----

const PAIN_TO_FLAG: Record<string, ContentFlag> = { knees: 'knee', back: 'back', shoulders: 'shoulder', wrists: 'wrist' };

/** The user's pain areas and health answers as content flags. */
export function contentFlags(profile: Pick<Profile, 'painAreas' | 'healthFlags'> | null | undefined): ContentFlag[] {
  if (!profile) return [];
  const out: ContentFlag[] = [];
  for (const p of profile.painAreas) {
    const f = PAIN_TO_FLAG[p];
    if (f && !out.includes(f)) out.push(f);
  }
  for (const h of profile.healthFlags) if (!out.includes(h)) out.push(h);
  return out;
}

export function restrictionsOf(profile: Pick<Profile, 'painAreas' | 'healthFlags'> | null | undefined): Restrictions {
  return restrictionsFor({ painAreas: (profile?.painAreas ?? []) as never, healthFlags: profile?.healthFlags ?? [] });
}

const FLAG_PHRASE: Record<string, string> = {
  knee: 'knees',
  back: 'back',
  shoulder: 'shoulders',
  wrist: 'wrists',
  other_pain: 'pain areas',
};

function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "knees", "back and shoulders" or "health answers". */
export function flagPhrase(flags: readonly string[]): string {
  const words = [...new Set(flags.map((f) => FLAG_PHRASE[f] ?? 'health answers'))];
  return joinWords(words);
}

// ---- Labels ----

export const LEVEL_LABEL: Record<ReadyMadePlan['level'], string> = { beginner: 'Easy', intermediate: 'Medium', advanced: 'Hard' };
export const DIFFICULTY_LABEL: Record<ContentExercise['difficulty'], string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export const planTitle = (content: Content, plan: ReadyMadePlan): string => content.t(plan.titleKey);
export const exerciseName = (content: Content, ex: ContentExercise): string => content.t(ex.nameKey);

export function planIcon(plan: ReadyMadePlan): string {
  if (plan.kind === 'micro') return 'chair';
  if (plan.style === 'yoga') return 'self_improvement';
  if (plan.style === 'dance') return 'music_note';
  if (/cardio/.test(plan.id)) return 'bolt';
  if (/core/.test(plan.id)) return 'sports_gymnastics';
  if (/morning/.test(plan.id)) return 'wb_twilight';
  return 'accessibility_new';
}

export const planMinutes = (plan: ReadyMadePlan): number => Math.round(plan.durationS / 60);

/** "Normal . Easy . 6 moves", or "Desk . 4 min, no sweat". */
export function planMeta(plan: ReadyMadePlan): string {
  if (plan.kind === 'micro') return ['Desk', `${planMinutes(plan)} min, no sweat`].join(` ${DOT} `);
  const n = plan.work.length;
  const unit = plan.style === 'yoga' ? 'poses' : 'moves';
  return [cap(plan.style), LEVEL_LABEL[plan.level], `${n} ${unit}`].join(` ${DOT} `);
}

// ---- Library ----

export type LibraryFilter = 'all' | 'normal' | 'yoga' | 'dance' | 'short';
export const LIBRARY_FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'normal', label: 'Normal' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'dance', label: 'Dance' },
  { value: 'short', label: 'Short' },
];

/** Plans that suit the user, filtered by chip, plus how many were left out for their answers. */
export function libraryPlans(content: Content, flags: readonly ContentFlag[], filter: LibraryFilter): { shown: ReadyMadePlan[]; hiddenCount: number } {
  const byFilter = content.plans.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'short') return p.kind === 'micro';
    return p.style === filter && p.kind === 'full15';
  });
  const safe = content.plansFor({ flags });
  const ids = new Set(safe.map((p) => p.id));
  const shown = byFilter.filter((p) => ids.has(p.id));
  return { shown, hiddenCount: byFilter.length - shown.length };
}

export const isSafePlan = (content: Content, planId: string, flags: readonly ContentFlag[]): boolean =>
  content.plansFor({ flags }).some((p) => p.id === planId);

// ---- Moves ----

/** "Easy . 2 x 30s . both sides . form check" */
export function moveMeta(ex: ContentExercise): string {
  const parts = [DIFFICULTY_LABEL[ex.difficulty], `${ex.defaultSets} × ${ex.defaultWorkS}s`];
  if (ex.sides === 'each') parts.push('both sides');
  if (ex.formCheckable) parts.push('form check');
  return parts.join(` ${DOT} `);
}

export function partsLabel(ex: Pick<ContentExercise, 'bodyParts'>, content: Content): string {
  return ex.bodyParts.map((p) => content.t(`bodypart.${p}`)).join(` ${DOT} `);
}

export interface PartInfo {
  id: string;
  title: string;
  blurb: string;
}

const PART_BLURB: Record<string, string> = {
  arms: 'your arms',
  chest: 'your chest',
  back: 'your back',
  shoulders: 'your shoulders',
  core: 'your abs, back and hips',
  glutes: 'your glutes and hips',
  legs: 'your legs',
  full: 'your whole body',
  stretch: 'slow stretching',
};
const PART_TITLE: Record<string, string> = { full: 'Full body', stretch: 'Stretch' };

export function partInfo(part: string): PartInfo {
  return { id: part, title: PART_TITLE[part] ?? cap(part), blurb: PART_BLURB[part] ?? part };
}

export type PartStyle = Extract<ContentStyle, 'normal' | 'yoga'>;
const ORDER = { easy: 0, medium: 1, hard: 2 } as const;

function matchesPart(ex: ContentExercise, part: string): boolean {
  if (part === 'stretch') return ex.phases.includes('cooldown');
  if (!ex.phases.includes('work')) return false;
  if (part === 'full') return ex.bodyParts.length >= 3 || ex.muscles.includes('full_body');
  return ex.bodyParts.includes(part as never);
}

/** Moves for a body part, split into those the user can do and those hidden for their answers. */
export function partMoves(
  content: Content,
  part: string,
  style: PartStyle,
  flags: readonly ContentFlag[],
  easyFirst: boolean,
): { shown: ContentExercise[]; hidden: { exercise: ContentExercise; flags: ContentFlag[] }[] } {
  const all = content.exercises.filter((e) => e.style === style && matchesPart(e, part));
  const shown = all.filter((e) => content.isAllowed(e, flags));
  const hidden = all.filter((e) => !content.isAllowed(e, flags)).map((e) => ({ exercise: e, flags: content.blockingFlags(e, flags) }));
  if (easyFirst) shown.sort((a, b) => ORDER[a.difficulty] - ORDER[b.difficulty] || a.id.localeCompare(b.id));
  return { shown, hidden };
}

// ---- Sessions ----

function stepOf(m: PlanMove, phase: PlanStep['phase'], id: string, index: CatalogueIndex): PlanStep | null {
  const ex = index.byId.get(m.exerciseId);
  if (!ex) return null;
  const work = phase === 'work';
  return {
    id,
    phase,
    exerciseId: ex.id,
    name: ex.name,
    mode: ex.mode,
    sets: work ? m.sets : 1,
    workS: m.workS,
    restS: work ? m.restS : 0,
    transitionS: work ? TRANSITION_S : 0,
    sides: ex.sides,
    rung: 0,
    muscles: ex.muscles.slice(),
    stretches: (ex.stretches ?? []).slice(),
    lowImpact: ex.impact !== 'high' && !ex.jumping,
    formCheckable: work && ex.formCheckable,
  };
}

/** A ready-made plan as a session the player can run. Null for the desk reset (it has its own screen). */
export function sessionFromReadyMade(plan: ReadyMadePlan, content: Content, restrictions: Restrictions, id: string, index: CatalogueIndex = getCatalogueIndex()): SessionPlan | null {
  if (plan.kind === 'micro') return null;
  const steps: PlanStep[] = [];
  const add = (moves: PlanMove[], phase: PlanStep['phase'], prefix: string) =>
    moves.forEach((m, i) => {
      const s = stepOf(m, phase, `${prefix}-${i}`, index);
      if (s) steps.push(s);
    });
  add(plan.warmup, 'warmup', 'warm');
  add(plan.work, 'work', 'work');
  add(plan.cooldown, 'cooldown', 'cool');
  if (!steps.some((s) => s.phase === 'work')) return null;
  return {
    id,
    title: planTitle(content, plan),
    style: plan.style,
    focus: 'full',
    parts: [],
    budgetS: plan.durationS,
    steps,
    restrictions,
    exclusions: [],
    engineVersion: ENGINE_VERSION,
  };
}

export const STRETCH_PLAN_ID = 'gentle_morning';

/**
 * A 15-minute session for one body part, built on the spot (PRD). "Full body" uses the full-body
 * recipe. "Stretch" has no engine focus, so it runs the gentle ready-made plan.
 */
export function buildPartSession(opts: {
  part: string;
  style: PartStyle;
  profile: Pick<Profile, 'painAreas' | 'healthFlags'> | null;
  experience: Experience | null | undefined;
  id: string;
  seed: number;
}): SessionPlan | null {
  const content = loadContent();
  const restrictions = restrictionsOf(opts.profile);
  if (opts.part === 'stretch') {
    const plan = content.plan(STRETCH_PLAN_ID);
    return plan ? sessionFromReadyMade(plan, content, restrictions, opts.id) : null;
  }
  const info = partInfo(opts.part);
  const full = opts.part === 'full';
  return buildSession(
    {
      id: opts.id,
      style: opts.style,
      focus: full ? 'full' : 'parts',
      parts: full ? undefined : [opts.part as never],
      level: ladderLevel(opts.experience ?? 'new'),
      restrictions,
      seed: opts.seed,
      title: opts.style === 'yoga' ? `Yoga: ${info.title} 15` : `${info.title} 15`,
    },
    getCatalogueIndex(),
  );
}
