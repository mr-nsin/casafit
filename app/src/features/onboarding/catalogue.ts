// Maps the bundled content pack (app/assets/content) to the catalogue the rules engine reads.
// Pure and total: every field the engine needs is derived from the pack, nothing is invented
// beyond the derivations below.

import type { Exercise as ContentExercise } from '../../content';
import type { BodyPart, Catalogue, Exercise, HealthFlag, Impact, PainArea, Pattern, Phase } from '../../engine';

const FLAG_TO_CONTRA: Record<string, PainArea | HealthFlag> = {
  knee: 'knees',
  shoulder: 'shoulders',
  back: 'back',
  wrist: 'wrists',
  heart_bp: 'heart_bp',
  pregnancy: 'pregnancy',
  recent_surgery: 'recent_surgery',
};

const PUSH: string[] = ['chest', 'triceps'];
const PULL: string[] = ['lats', 'upper_back', 'biceps'];
const LEGS: string[] = ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'];

function patternOf(c: ContentExercise, phase: Phase): Pattern {
  if (c.style === 'dance') return 'dance';
  if (c.style === 'yoga') return phase === 'work' ? 'flow' : 'mobility';
  if (phase !== 'work') return 'mobility';
  const m: string[] = c.muscles;
  if (m.includes('full_body') || c.tags.includes('cardio') || c.mode === 'timed' && m.includes('hip_flexors')) return 'cardio';
  const first = m[0] ?? '';
  if (PUSH.includes(first)) return 'push';
  if (PULL.includes(first)) return 'pull';
  if (LEGS.includes(first)) return 'legs';
  if (['abs', 'obliques', 'lower_back'].includes(first)) return 'core';
  if (m.some((x) => PUSH.includes(x))) return 'push';
  if (m.some((x) => PULL.includes(x))) return 'pull';
  if (m.some((x) => LEGS.includes(x))) return 'legs';
  return 'core';
}

const isJumping = (c: ContentExercise) => /jump|burpee|hop|skater|tuck/.test(c.id);

export function contentToCatalogue(items: readonly ContentExercise[], nameOf: (key: string) => string = (k) => k): Catalogue {
  const exercises: Exercise[] = [];
  for (const c of items) {
    // A move listed for several phases serves its most specific one: cool-down, then warm-up, then work.
    // The catalogue has few cool-downs, so this keeps the engine's pool large enough.
    const phase: Phase | undefined = c.phases.includes('cooldown') ? 'cooldown' : c.phases.includes('warmup') ? 'warmup' : c.phases.includes('work') ? 'work' : undefined;
    if (!phase) continue; // micro-only moves belong to Desk reset, not to plans
    const jumping = isJumping(c);
    const impact: Impact = jumping ? 'high' : c.lowImpact ? 'low' : 'low';
    const bodyParts: BodyPart[] = c.bodyParts;
    exercises.push({
      id: c.id,
      name: nameOf(c.nameKey),
      family: c.family,
      style: c.style,
      phase,
      pattern: patternOf(c, phase),
      muscles: bodyParts,
      stretches: phase === 'cooldown' ? bodyParts : undefined,
      mode: c.mode,
      sides: c.sides,
      ladder: c.family,
      level: Math.max(0, c.rung - 1),
      impact,
      jumping,
      hiit: c.difficulty === 'hard' && !c.lowImpact,
      contraindications: c.excludedByFlags.map((f) => FLAG_TO_CONTRA[f] ?? (f as HealthFlag)),
      formCheckable: c.formCheckable,
    });
  }
  return { exercises };
}
