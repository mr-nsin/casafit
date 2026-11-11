// What navigate() may be called with. Mirrors RootStackParamList in app/types.ts (types do not exist at
// run time). routeSpec.test.ts keeps this in step with the route map.

import { loadContent } from '../content';
import { rootRouteLanes, tabRouteLanes } from '../app/routes';
import type { NavCall } from './navMock';

/** Params a route cannot open without. */
export const REQUIRED_PARAMS: Record<string, string[]> = {
  BodyPart: ['part'],
  Exercise: ['exerciseId'],
};

/** Every param name a route accepts. Routes not listed take none. */
export const ALLOWED_PARAMS: Record<string, string[]> = {
  Main: ['screen', 'params'],
  Verify: ['email'],
  BodyPart: ['part'],
  Plan: ['planDayId', 'readyMadeId'],
  Player: ['sessionId'],
  Editor: ['planDayId', 'addExerciseId', 'from'],
  Picker: ['slot', 'stepId'],
  Parts: ['part'],
  Lunge: ['excludedExerciseId'],
  Exercise: ['exerciseId'],
  FoodSearch: ['slot'],
  Meal: ['mealId', 'slot'],
  Myth: ['mythId'],
  Concepts: ['conceptId'],
  Help: ['open'],
};

export const KNOWN_ROUTES: ReadonlySet<string> = new Set<string>(['Main', ...Object.keys(rootRouteLanes), ...Object.keys(tabRouteLanes)]);

let ids: { exercises: Set<string>; myths: Set<string>; concepts: Set<string> } | null = null;
function contentIds() {
  if (!ids) {
    const c = loadContent();
    ids = {
      exercises: new Set(c.exercises.map((e: { id: string }) => e.id)),
      myths: new Set(c.myths.map((m: { id: string }) => m.id)),
      concepts: new Set(c.concepts.map((m: { id: string }) => m.id)),
    };
  }
  return ids;
}

export interface NavProblem {
  call: string;
  problem: string;
}

function checkTarget(method: string, name: unknown, params: unknown): NavProblem[] {
  const out: NavProblem[] = [];
  const call = `${method}(${String(name)}${params ? ', ' + JSON.stringify(params) : ''})`;
  if (typeof name !== 'string' || !KNOWN_ROUTES.has(name)) {
    out.push({ call, problem: `route "${String(name)}" is not registered` });
    return out;
  }
  const p = (params ?? {}) as Record<string, unknown>;
  for (const req of REQUIRED_PARAMS[name] ?? []) {
    if (p[req] === undefined || p[req] === '') out.push({ call, problem: `missing required param "${req}"` });
  }
  const allowed = ALLOWED_PARAMS[name] ?? [];
  for (const k of Object.keys(p)) if (!allowed.includes(k)) out.push({ call, problem: `unexpected param "${k}" for ${name}` });
  const c = contentIds();
  if (typeof p.exerciseId === 'string' && !c.exercises.has(p.exerciseId)) out.push({ call, problem: `exerciseId "${p.exerciseId}" is not in the content` });
  if (typeof p.excludedExerciseId === 'string' && !c.exercises.has(p.excludedExerciseId)) out.push({ call, problem: `excludedExerciseId "${p.excludedExerciseId}" is not in the content` });
  if (typeof p.addExerciseId === 'string' && !c.exercises.has(p.addExerciseId)) out.push({ call, problem: `addExerciseId "${p.addExerciseId}" is not in the content` });
  if (typeof p.mythId === 'string' && !c.myths.has(p.mythId)) out.push({ call, problem: `mythId "${p.mythId}" is not in the content` });
  if (typeof p.conceptId === 'string' && !c.concepts.has(p.conceptId)) out.push({ call, problem: `conceptId "${p.conceptId}" is not in the content` });
  return out;
}

/** Checks every navigation call that names a route: registered, required params present, no stray params. */
export function validateNavCalls(calls: NavCall[]): NavProblem[] {
  const out: NavProblem[] = [];
  for (const c of calls) {
    if (c.method === 'navigate' || c.method === 'push' || c.method === 'replace' || c.method === 'popTo') {
      const [a, b] = c.args;
      if (a && typeof a === 'object') {
        const o = a as { name?: string; params?: unknown };
        out.push(...checkTarget(c.method, o.name, o.params));
      } else {
        out.push(...checkTarget(c.method, a, b));
      }
    } else if (c.method === 'reset') {
      const state = c.args[0] as { routes?: { name: string; params?: unknown }[] } | undefined;
      for (const r of state?.routes ?? []) out.push(...checkTarget('reset', r.name, r.params));
    }
  }
  return out;
}
