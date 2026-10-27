import { indexCatalogue } from '../catalogue';
import type { PlanInput } from '../plan';
import { createRng, type Rng } from '../rng';
import type { BodyPart, Experience, HealthFlag, PainArea, Style } from '../types';
import { BODY_PARTS, STYLES } from '../types';
import { fixtureCatalogue } from './fixtures';

export const index = indexCatalogue(fixtureCatalogue);

export function baseInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    goal: 'stay_fit',
    bodyParts: [],
    styles: ['normal'],
    daysPerWeek: 4,
    experience: 'on_and_off',
    painAreas: [],
    healthFlags: [],
    startDate: '2026-10-27',
    seed: 1,
    ...over,
  };
}

function pickSome<T>(items: readonly T[], rng: Rng, min: number, max: number): T[] {
  const n = min + Math.floor(rng() * (max - min + 1));
  const pool = items.slice();
  const out: T[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0] as T);
  }
  return out;
}

const PAIN: PainArea[] = ['knees', 'back', 'shoulders', 'wrists', 'other'];
const FLAGS: HealthFlag[] = ['heart_bp', 'pregnancy', 'recent_surgery'];
const EXP: (Experience | null)[] = ['new', 'on_and_off', 'regular', null];

/** A reproducible random valid input. */
export function randomInput(seed: number): PlanInput {
  const rng = createRng(seed * 2654435761);
  const styles: Style[] = pickSome(STYLES, rng, 1, 3);
  const goal = rng() < 0.5 ? 'stay_fit' : 'body_part';
  const bodyParts: BodyPart[] = goal === 'body_part' ? pickSome(BODY_PARTS, rng, 1, 2) : [];
  const daysPerWeek = 3 + Math.floor(rng() * 5);
  const painAreas = rng() < 0.5 ? pickSome(PAIN, rng, 1, 4) : [];
  const healthFlags = rng() < 0.3 ? pickSome(FLAGS, rng, 1, 3) : [];
  const day = 1 + Math.floor(rng() * 28);
  const month = 1 + Math.floor(rng() * 12);
  return {
    goal,
    bodyParts,
    styles,
    daysPerWeek,
    experience: EXP[Math.floor(rng() * EXP.length)] ?? null,
    painAreas,
    healthFlags,
    startDate: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    seed: Math.floor(rng() * 1_000_000),
    feltHistory: rng() < 0.4 ? (['easy', 'easy', 'hard', 'about_right'] as const).slice(0, 1 + Math.floor(rng() * 4)) : [],
    intensity: ([-1, 0, 1] as const)[Math.floor(rng() * 3)],
    age: rng() < 0.8 ? 18 + Math.floor(rng() * 60) : null,
  };
}
