// Content loader. Builds indexed, read-only views over the bundled packs.
// The JSON files are bundled by Metro, so everything works offline.
//
//   const content = loadContent();
//   content.exercise('squat');
//   content.t('exercise.squat.name');
//
// Tests and tools can call createContent(raw) with their own data.

import type {
  Allergen,
  Concept,
  Diet,
  Exercise,
  FoodItem,
  FoodKind,
  FoodUnit,
  FoodUnitName,
  HealthFlag,
  Myth,
  Nutrients,
  Phase,
  ReadyMadePlan,
  RawContent,
  StyleInfo,
  Style,
  Substitution,
  SubstitutionKind,
  VoiceEvent,
} from './types';

import exercisesJson from '../../assets/content/exercises.json';
import foodsJson from '../../assets/content/foods.json';
import learnJson from '../../assets/content/learn.json';
import plansJson from '../../assets/content/plans.json';
import stringsJson from '../../assets/content/strings.en-IN.json';
import substitutionsJson from '../../assets/content/substitutions.json';
import voiceJson from '../../assets/content/voice-cues.json';

export const CONTENT_LOCALE = 'en-IN';

export type TParams = Record<string, string | number> & { count?: number };

export interface FoodSearchOptions {
  kind?: FoodKind;
  diet?: Diet;
  /** Foods that contain any of these allergens are left out. */
  excludeAllergens?: Allergen[];
  limit?: number;
}

export interface SessionTime {
  warmupS: number;
  workS: number;
  cooldownS: number;
  totalS: number;
}

export interface Content {
  raw: RawContent;
  locale: string;
  /** Look up a string. Replaces {{tokens}} and picks _one or _other by count. Returns the key if missing. */
  t(key: string, params?: TParams): string;
  has(key: string): boolean;

  exercises: readonly Exercise[];
  exercise(id: string): Exercise | undefined;
  /** Exercises that suit the user: not excluded by any of the flags. */
  allowedExercises(flags: readonly HealthFlag[], filter?: { style?: Style; phase?: Phase }): Exercise[];
  isAllowed(exercise: Exercise, flags: readonly HealthFlag[]): boolean;
  /** The flags that hide this exercise for this user. Empty when it is allowed. */
  blockingFlags(exercise: Exercise, flags: readonly HealthFlag[]): HealthFlag[];
  cautionFlagsFor(exercise: Exercise, flags: readonly HealthFlag[]): HealthFlag[];
  substitutionsFor(exerciseId: string, kind?: SubstitutionKind): Substitution[];
  /** The exercise to use instead for this user, following flag swaps. Returns the same exercise if allowed. */
  replacementFor(exerciseId: string, flags: readonly HealthFlag[]): Exercise | undefined;
  easier(exerciseId: string): Exercise | undefined;
  harder(exerciseId: string): Exercise | undefined;
  /** Position in the progression ladder: all exercises of the family, easiest first. */
  ladder(family: string): Exercise[];

  plans: readonly ReadyMadePlan[];
  styles: readonly StyleInfo[];
  plan(id: string): ReadyMadePlan | undefined;
  plansFor(filter?: { style?: Style; flags?: readonly HealthFlag[] }): ReadyMadePlan[];
  planTime(plan: ReadyMadePlan): SessionTime;

  foods: readonly FoodItem[];
  food(id: string): FoodItem | undefined;
  searchFoods(query: string, options?: FoodSearchOptions): FoodItem[];
  /** Nutrients for a quantity of a unit of a food, for example 1.5 katori. */
  nutrients(food: FoodItem, unit: FoodUnitName, quantity: number): Nutrients;
  /** Convert a quantity between two units of one food, for example 2 chamach to katori. */
  convert(food: FoodItem, quantity: number, from: FoodUnitName, to: FoodUnitName): number;
  /** Display label for a unit of a food, for example "1.5 katori". */
  unitLabel(food: FoodItem, unit: FoodUnitName, quantity: number): string;

  myths: readonly Myth[];
  concepts: readonly Concept[];
  myth(id: string): Myth | undefined;
  concept(id: string): Concept | undefined;

  voiceEvent(id: string): VoiceEvent | undefined;
  /** Pick a cue line. The variant index wraps, so the caller can rotate. */
  cue(eventId: string, params?: TParams, variant?: number): string;
  formCues(exerciseId: string): { id: string; text: string }[];
}

const round = (n: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

function unitOf(food: FoodItem, unit: FoodUnitName): FoodUnit {
  const u = food.units.find((x) => x.unit === unit);
  if (!u) throw new Error(`${food.id} has no ${unit} unit`);
  return u;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function createContent(raw: RawContent): Content {
  const strings = raw.strings.strings;

  const t = (key: string, params?: TParams): string => {
    let k = key;
    if (params?.count !== undefined) {
      const plural = params.count === 1 ? `${key}_one` : `${key}_other`;
      if (plural in strings) k = plural;
    }
    let text = strings[k] ?? strings[`${key}_other`] ?? strings[`${key}_one`];
    if (text === undefined) return key;
    if (params) {
      text = text.replace(/\{\{(\w+)\}\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
    }
    return text;
  };
  const has = (key: string) => key in strings || `${key}_one` in strings || `${key}_other` in strings;

  // --- exercises ---
  const exercises = raw.exercises.exercises;
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const subs = new Map<string, Substitution[]>();
  for (const s of raw.substitutions.substitutions) {
    subs.set(s.exerciseId, [...(subs.get(s.exerciseId) ?? []), s]);
  }
  const blockingFlags = (e: Exercise, flags: readonly HealthFlag[]) => e.excludedByFlags.filter((f) => flags.includes(f));
  const isAllowed = (e: Exercise, flags: readonly HealthFlag[]) => blockingFlags(e, flags).length === 0;
  const substitutionsFor = (id: string, kind?: SubstitutionKind) => (subs.get(id) ?? []).filter((s) => !kind || s.kind === kind);

  const replacementFor = (id: string, flags: readonly HealthFlag[]): Exercise | undefined => {
    let current = exById.get(id);
    const seen = new Set<string>();
    while (current && !isAllowed(current, flags) && !seen.has(current.id)) {
      seen.add(current.id);
      const blocked = blockingFlags(current, flags);
      const swap = (subs.get(current.id) ?? []).find((s) => s.kind === 'flag_swap' && s.flag && blocked.includes(s.flag));
      current = swap ? exById.get(swap.toExerciseId) : undefined;
    }
    return current && isAllowed(current, flags) ? current : undefined;
  };

  const ladder = (family: string) =>
    exercises.filter((e) => e.family === family).sort((a, b) => a.rung - b.rung || a.id.localeCompare(b.id));
  const neighbour = (id: string, kind: 'easier' | 'harder') => {
    const s = substitutionsFor(id, kind)[0];
    return s ? exById.get(s.toExerciseId) : undefined;
  };

  // --- plans ---
  const plans = raw.plans.plans;
  const planTime = (plan: ReadyMadePlan): SessionTime => {
    const sum = (moves: ReadyMadePlan['work']) =>
      moves.reduce((total, m) => total + m.sets * (m.workS * (exById.get(m.exerciseId)?.sides === 'each' ? 2 : 1) + m.restS), 0);
    const warmupS = sum(plan.warmup);
    const workS = sum(plan.work);
    const cooldownS = sum(plan.cooldown);
    return { warmupS, workS, cooldownS, totalS: warmupS + workS + cooldownS };
  };

  // --- foods ---
  const foods = raw.foods.foods;
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const searchIndex = foods.map((f) => ({ food: f, name: normalise(t(f.nameKey)) }));

  const nutrients = (food: FoodItem, unit: FoodUnitName, quantity: number): Nutrients => {
    const def = food.units[0];
    if (!def) throw new Error(`${food.id} has no units`);
    const grams = unitOf(food, unit).gramsPerUnit * quantity;
    const factor = grams / def.gramsPerUnit;
    const n = food.perDefaultUnit;
    return {
      kcal: Math.round(n.kcal * factor),
      proteinG: round(n.proteinG * factor),
      carbsG: round(n.carbsG * factor),
      fatG: round(n.fatG * factor),
    };
  };
  const convert = (food: FoodItem, quantity: number, from: FoodUnitName, to: FoodUnitName) =>
    round((quantity * unitOf(food, from).gramsPerUnit) / unitOf(food, to).gramsPerUnit, 2);

  const searchFoods = (query: string, options: FoodSearchOptions = {}): FoodItem[] => {
    const q = normalise(query);
    const tokens = q.split(' ').filter(Boolean);
    const ranked: { food: FoodItem; score: number }[] = [];
    for (const { food, name } of searchIndex) {
      if (options.kind && food.kind !== options.kind) continue;
      if (options.diet && !food.diet.includes(options.diet)) continue;
      if (options.excludeAllergens?.some((a) => food.allergens.includes(a))) continue;
      let score = 0;
      if (tokens.length === 0) score = 1;
      else if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (tokens.every((tok) => name.split(' ').some((w) => w.startsWith(tok)))) score = 60;
      else if (tokens.every((tok) => name.includes(tok))) score = 30;
      if (score > 0) ranked.push({ food, score });
    }
    ranked.sort((a, b) => b.score - a.score || a.food.id.localeCompare(b.food.id));
    const list = ranked.map((r) => r.food);
    return options.limit ? list.slice(0, options.limit) : list;
  };

  const unitLabel = (food: FoodItem, unit: FoodUnitName, quantity: number) => {
    const u = unitOf(food, unit);
    return `${quantity} ${t(u.labelKey, { count: quantity })}`;
  };

  // --- voice ---
  const events = new Map(raw.voice.events.map((e) => [e.id, e]));
  const cue = (eventId: string, params?: TParams, variant = 0) => {
    const ev = events.get(eventId);
    if (!ev) return '';
    const key = ev.keys[((variant % ev.keys.length) + ev.keys.length) % ev.keys.length] as string;
    return t(key, params);
  };

  return {
    raw,
    locale: raw.strings.locale,
    t,
    has,
    exercises,
    exercise: (id) => exById.get(id),
    allowedExercises: (flags, filter) =>
      exercises.filter((e) => isAllowed(e, flags) && (!filter?.style || e.style === filter.style) && (!filter?.phase || e.phases.includes(filter.phase))),
    isAllowed,
    blockingFlags,
    cautionFlagsFor: (e, flags) => e.cautionFlags.filter((f) => flags.includes(f)),
    substitutionsFor,
    replacementFor,
    easier: (id) => neighbour(id, 'easier'),
    harder: (id) => neighbour(id, 'harder'),
    ladder,
    plans,
    styles: raw.plans.styles,
    plan: (id) => plans.find((p) => p.id === id),
    plansFor: (filter) =>
      plans.filter((p) => (!filter?.style || p.style === filter.style) && (filter?.flags ?? []).every((f) => p.safeForFlags.includes(f))),
    planTime,
    foods,
    food: (id) => foodById.get(id),
    searchFoods,
    nutrients,
    convert,
    unitLabel,
    myths: raw.learn.myths,
    concepts: raw.learn.concepts,
    myth: (id) => raw.learn.myths.find((m) => m.id === id),
    concept: (id) => raw.learn.concepts.find((c) => c.id === id),
    voiceEvent: (id) => events.get(id),
    cue,
    formCues: (exerciseId) =>
      (raw.voice.formCues.find((g) => g.exerciseId === exerciseId)?.cues ?? []).map((c) => ({ id: c.id, text: t(c.key) })),
  };
}

/** The bundled packs as one object. The JSON is large, so it is cast once, here. */
export const bundledContent: RawContent = {
  exercises: exercisesJson as unknown as RawContent['exercises'],
  substitutions: substitutionsJson as unknown as RawContent['substitutions'],
  plans: plansJson as unknown as RawContent['plans'],
  foods: foodsJson as unknown as RawContent['foods'],
  learn: learnJson as unknown as RawContent['learn'],
  voice: voiceJson as unknown as RawContent['voice'],
  strings: stringsJson as unknown as RawContent['strings'],
};

let cached: Content | undefined;

/** The shared content instance. Built once, on first use. */
export function loadContent(): Content {
  if (!cached) cached = createContent(bundledContent);
  return cached;
}

/** For tests only. */
export function resetContentCache(): void {
  cached = undefined;
}
