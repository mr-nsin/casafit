// Content validator. Two layers:
//   1. validateSchema: a small JSON Schema checker for the subset used by
//      app/assets/content/schema/content.schema.json.
//   2. validateContent: cross-reference and business rules (references,
//      ladders, plan timing, nutrition maths, copy rules, review marks).
//
// This file must stay free of runtime imports so that
// `node app/scripts/validate-content.ts` can run it with type stripping.

import type { HealthFlag, RawContent } from './types';

export interface Issue {
  /** Which pack the issue is in, for example "exercises". */
  pack: string;
  path: string;
  message: string;
}

type Obj = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Layer 1: JSON Schema subset
// ---------------------------------------------------------------------------

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function matchesType(v: unknown, t: string): boolean {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resolveRef(ref: string, root: Obj): Obj {
  if (!ref.startsWith('#/')) throw new Error('Unsupported $ref ' + ref);
  let node: unknown = root;
  for (const part of ref.slice(2).split('/')) {
    node = (node as Obj | undefined)?.[part];
  }
  if (!node || typeof node !== 'object') throw new Error('Unresolved $ref ' + ref);
  return node as Obj;
}

export function validateSchema(
  value: unknown,
  schema: Obj,
  root: Obj,
  path = '$',
  out: { path: string; message: string }[] = [],
): { path: string; message: string }[] {
  const fail = (message: string) => out.push({ path, message });

  if (typeof schema.$ref === 'string') {
    return validateSchema(value, resolveRef(schema.$ref, root), root, path, out);
  }
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf as Obj[]) validateSchema(value, sub, root, path, out);
  }
  if ('const' in schema && !deepEqual(value, schema.const)) {
    fail(`must be ${JSON.stringify(schema.const)}`);
    return out;
  }
  if (Array.isArray(schema.enum) && !(schema.enum as unknown[]).some((e) => deepEqual(e, value))) {
    fail(`must be one of ${(schema.enum as unknown[]).map((e) => JSON.stringify(e)).join(', ')}`);
    return out;
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((t) => matchesType(value, t))) {
      fail(`must be ${types.join(' or ')} but is ${typeOf(value)}`);
      return out;
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) fail(`is shorter than ${schema.minLength}`);
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) fail(`is longer than ${schema.maxLength}`);
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) fail(`does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail(`is below ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) fail(`is above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) fail(`needs at least ${schema.minItems} items`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) fail(`allows at most ${schema.maxItems} items`);
    if (schema.uniqueItems === true) {
      const seen = new Set(value.map((v) => JSON.stringify(v)));
      if (seen.size !== value.length) fail('has duplicate items');
    }
    if (schema.items && typeof schema.items === 'object') {
      value.forEach((item, i) => validateSchema(item, schema.items as Obj, root, `${path}[${i}]`, out));
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Obj;
    const props = (schema.properties ?? {}) as Record<string, Obj>;
    if (Array.isArray(schema.required)) {
      for (const key of schema.required as string[]) {
        if (!(key in obj)) out.push({ path: `${path}.${key}`, message: 'is required' });
      }
    }
    for (const [key, v] of Object.entries(obj)) {
      const sub = props[key];
      if (sub) validateSchema(v, sub, root, `${path}.${key}`, out);
      else if (schema.additionalProperties === false) out.push({ path: `${path}.${key}`, message: 'is not allowed here' });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateSchema(v, schema.additionalProperties as Obj, root, `${path}.${key}`, out);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Layer 2: cross-reference and business rules
// ---------------------------------------------------------------------------

export const MIN_COUNTS = { exercises: 60, foods: 250, myths: 10, concepts: 8 };

export const FORM_CHECKABLE = ['squat', 'pushup', 'plank', 'lunge'];
export const ALL_FLAGS = ['knee', 'back', 'shoulder', 'wrist', 'other_pain', 'heart_bp', 'pregnancy', 'recent_surgery'];

/** Words that shame the user. Copy must never use them. */
const SHAMING = /\b(lazy|laziness|failure|failed|pathetic|excuses?|guilty|guilt|shame|ashamed|punish\w*|slacker|cheat day|earn your food|no pain,? no gain!)\b/i;
/** All-caps words that are allowed in copy. */
const ALLOWED_CAPS = new Set(['BPM', 'DPDP', 'BP', 'IFCT', 'ICMR']);

/** Resolve a string key, trying the i18next plural forms too. */
function hasString(strings: Record<string, string>, key: string): boolean {
  return key in strings || `${key}_one` in strings || `${key}_other` in strings;
}

/** Collect every value stored under a property that ends in Key or Keys. */
function collectKeys(node: unknown, path: string, out: { path: string; key: string }[]): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectKeys(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Obj)) {
      const p = `${path}.${k}`;
      if (/Keys$/.test(k) && Array.isArray(v)) {
        v.forEach((x, i) => typeof x === 'string' && out.push({ path: `${p}[${i}]`, key: x }));
      } else if (/Key$/.test(k) && typeof v === 'string') {
        out.push({ path: p, key: v });
      } else if (k === 'key' && typeof v === 'string') {
        out.push({ path: p, key: v });
      } else if (k === 'keys' && Array.isArray(v) && v.every((x) => typeof x === 'string')) {
        v.forEach((x, i) => out.push({ path: `${p}[${i}]`, key: x as string }));
      } else {
        collectKeys(v, p, out);
      }
    }
  }
}

export function planDurationS(
  plan: { warmup: PlanMoveLike[]; work: PlanMoveLike[]; cooldown: PlanMoveLike[] },
  sides: (exerciseId: string) => 'none' | 'each' | undefined,
): { warmup: number; work: number; cooldown: number; total: number } {
  const sum = (moves: PlanMoveLike[]) =>
    moves.reduce((t, m) => t + m.sets * (m.workS * (sides(m.exerciseId) === 'each' ? 2 : 1) + m.restS), 0);
  const warmup = sum(plan.warmup);
  const work = sum(plan.work);
  const cooldown = sum(plan.cooldown);
  return { warmup, work, cooldown, total: warmup + work + cooldown };
}

interface PlanMoveLike {
  exerciseId: string;
  sets: number;
  workS: number;
  restS: number;
}

function checkCopy(text: string): string[] {
  const problems: string[] = [];
  if (text.trim() !== text) problems.push('has leading or trailing space');
  if (/\s{2,}/.test(text)) problems.push('has a double space');
  const first = text.replace(/\{\{\w+\}\}/g, 'X').replace(/^["'(]+/, '')[0];
  if (first && first === first.toLowerCase() && first !== first.toUpperCase()) problems.push('does not start with a capital letter');
  for (const word of text.match(/[A-Z]{3,}/g) ?? []) {
    if (!ALLOWED_CAPS.has(word)) problems.push(`has an all-caps word (${word})`);
  }
  if (SHAMING.test(text)) problems.push('uses shaming language');
  if (/!{2,}/.test(text)) problems.push('has repeated exclamation marks');
  return problems;
}

/** Strings that are single units or short labels and are exempt from the capital-letter rule. */
const COPY_EXEMPT = /^(unit\.|food\.[a-z0-9_]+\.unit)/;

export function validateContent(raw: RawContent, schema: Obj): Issue[] {
  const issues: Issue[] = [];
  const add = (pack: string, path: string, message: string) => issues.push({ pack, path, message });

  const packs: [keyof RawContent, string][] = [
    ['exercises', 'ExercisePack'],
    ['substitutions', 'SubstitutionPack'],
    ['plans', 'PlanPack'],
    ['foods', 'FoodPack'],
    ['learn', 'LearnPack'],
    ['voice', 'VoicePack'],
    ['strings', 'StringsPack'],
  ];
  for (const [name, def] of packs) {
    const value = raw[name];
    if (!value) {
      add(name, '$', 'pack is missing');
      continue;
    }
    for (const i of validateSchema(value, { $ref: `#/$defs/${def}` }, schema)) add(name, i.path, i.message);
  }
  // Semantic checks need well-formed packs. Stop here if the schema failed.
  if (issues.length > 0) return issues;

  const strings = raw.strings.strings;
  const exercises = raw.exercises.exercises;
  const exById = new Map(exercises.map((e) => [e.id, e]));

  // --- unique ids ---
  const unique = (pack: string, label: string, ids: string[]) => {
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      if (seen.has(id)) add(pack, `${label}[${i}]`, `duplicate id ${id}`);
      seen.add(id);
    });
  };
  unique('exercises', 'exercises', exercises.map((e) => e.id));
  unique('substitutions', 'substitutions', raw.substitutions.substitutions.map((s) => s.id));
  unique('plans', 'plans', raw.plans.plans.map((p) => p.id));
  unique('foods', 'foods', raw.foods.foods.map((f) => f.id));
  unique('learn', 'myths', raw.learn.myths.map((m) => m.id));
  unique('learn', 'concepts', raw.learn.concepts.map((c) => c.id));

  // --- minimum counts ---
  if (exercises.length < MIN_COUNTS.exercises) add('exercises', '$.exercises', `needs at least ${MIN_COUNTS.exercises} exercises`);
  if (raw.foods.foods.length < MIN_COUNTS.foods) add('foods', '$.foods', `needs at least ${MIN_COUNTS.foods} foods`);
  if (raw.learn.myths.length !== MIN_COUNTS.myths) add('learn', '$.myths', `needs exactly ${MIN_COUNTS.myths} myths`);
  if (raw.learn.concepts.length !== MIN_COUNTS.concepts) add('learn', '$.concepts', `needs exactly ${MIN_COUNTS.concepts} concepts`);

  // --- i18n keys resolve ---
  const keyRefs: { pack: string; path: string; key: string }[] = [];
  for (const name of ['exercises', 'substitutions', 'plans', 'foods', 'learn', 'voice'] as const) {
    const found: { path: string; key: string }[] = [];
    collectKeys(raw[name], '$', found);
    for (const f of found) keyRefs.push({ pack: name, ...f });
  }
  for (const r of keyRefs) {
    if (!hasString(strings, r.key)) add(r.pack, r.path, `string key ${r.key} is missing from strings`);
  }
  const referenced = new Set(keyRefs.map((r) => r.key));
  const refsBase = (k: string) => k.replace(/_(one|other)$/, '');
  for (const k of Object.keys(strings)) {
    // Unused strings are allowed for shared labels (flags, muscles, units, hints).
    if (!/^(flag|bodypart|muscle|difficulty|style|level|phase|unit|substitution\.reason|learn\.(verdict|myth\.label|concept\.label))/.test(k) && !referenced.has(k) && !referenced.has(refsBase(k))) {
      add('strings', `$.strings.${k}`, 'is not used by any record');
    }
  }

  // --- copy rules on every string ---
  for (const [k, v] of Object.entries(strings)) {
    if (COPY_EXEMPT.test(k)) continue;
    for (const p of checkCopy(v)) add('strings', `$.strings.${k}`, p);
    if (/\{\{[^}]*\}\}/.test(v) === false && /[{}]/.test(v)) add('strings', `$.strings.${k}`, 'has a stray brace');
  }
  // Voice cue length for TTS.
  for (const ev of raw.voice.events) {
    for (const key of ev.keys) {
      const text = strings[key] ?? '';
      if (text.length > ev.maxChars) add('voice', `$.events.${ev.id}`, `${key} is ${text.length} characters, over ${ev.maxChars}`);
      for (const token of ev.tokens) {
        if (!text.includes(`{{${token}}}`) && ev.id === 'step_start' && key.endsWith('.1')) add('voice', `$.events.${ev.id}`, `${key} should use {{${token}}}`);
      }
      const used = (text.match(/\{\{(\w+)\}\}/g) ?? []).map((t) => t.slice(2, -2));
      for (const u of used) if (!ev.tokens.includes(u)) add('voice', `$.events.${ev.id}`, `${key} uses undeclared token {{${u}}}`);
    }
  }
  const eventIds = new Set(raw.voice.events.map((e) => e.id));
  for (const need of ['step_start', 'switch_sides', 'ten_seconds', 'count_3', 'count_2', 'count_1', 'rest_start', 'up_next', 'session_complete', 'paused', 'resumed']) {
    if (!eventIds.has(need)) add('voice', '$.events', `missing event ${need}`);
  }

  // --- exercises ---
  exercises.forEach((e, i) => {
    const p = `$.exercises[${i}]`;
    if (e.formCheckable !== FORM_CHECKABLE.includes(e.id)) add('exercises', p, `formCheckable must be true only for ${FORM_CHECKABLE.join(', ')}`);
    if (e.mode === 'routine_step' && !e.bpm) add('exercises', p, 'routine_step moves need a bpm');
    if (e.bpm && e.style !== 'dance') add('exercises', p, 'bpm is only for dance moves');
    if (e.style === 'yoga' && !e.breath) add('exercises', p, 'yoga moves need breath timing');
    if (e.phases.includes('micro') && !e.seatedOk) add('exercises', p, 'desk moves must be seatedOk');
    if (e.excludedByFlags.some((f) => e.cautionFlags.includes(f))) add('exercises', p, 'a flag cannot be both excluded and a caution');
    const easy = e.difficulty === 'easy';
    if (easy && e.rung > 3) add('exercises', p, 'an easy move should not sit on a high rung');
    // No equipment words in the copy.
    const text = [e.nameKey, e.cueKey, ...e.stepKeys].map((k) => strings[k] ?? '').join(' ');
    if (/\b(dumbbell|barbell|kettlebell|resistance band|bench|treadmill|weights)\b/i.test(text)) add('exercises', p, 'mentions gym equipment');
    if (e.demo.frames[0].posture === e.demo.frames[1].posture && JSON.stringify(e.demo.frames[0]) === JSON.stringify(e.demo.frames[1]) && e.mode !== 'hold') {
      add('exercises', p, 'moving exercises need two different frames');
    }
  });
  // Ladder: each family has unique ids and rung ordering is consistent with subs below.
  const families = new Map<string, number[]>();
  for (const e of exercises) families.set(e.family, [...(families.get(e.family) ?? []), e.rung]);

  // --- substitutions ---
  const subsBy = new Map<string, typeof raw.substitutions.substitutions>();
  raw.substitutions.substitutions.forEach((s, i) => {
    const p = `$.substitutions[${i}]`;
    const from = exById.get(s.exerciseId);
    const to = exById.get(s.toExerciseId);
    if (!from) add('substitutions', p, `unknown exerciseId ${s.exerciseId}`);
    if (!to) add('substitutions', p, `unknown toExerciseId ${s.toExerciseId}`);
    if (!from || !to) return;
    if (from.id === to.id) add('substitutions', p, 'cannot substitute an exercise with itself');
    if ((s.kind === 'flag_swap') !== (s.flag !== undefined)) add('substitutions', p, 'flag is required for flag_swap and only for flag_swap');
    if (s.kind === 'easier' && !(to.family === from.family && to.rung < from.rung)) add('substitutions', p, 'easier must stay in the family on a lower rung');
    if (s.kind === 'harder' && !(to.family === from.family && to.rung > from.rung)) add('substitutions', p, 'harder must stay in the family on a higher rung');
    if (s.kind === 'low_impact' && !to.lowImpact) add('substitutions', p, 'low_impact target must be low impact');
    if (s.kind === 'seated' && !to.seatedOk) add('substitutions', p, 'seated target must be seatedOk');
    if (s.flag && to.excludedByFlags.includes(s.flag)) add('substitutions', p, `target is also excluded by ${s.flag}`);
    if (s.flag && !from.excludedByFlags.includes(s.flag)) add('substitutions', p, `source is not excluded by ${s.flag}`);
    subsBy.set(s.exerciseId, [...(subsBy.get(s.exerciseId) ?? []), s]);
  });
  // Every exclusion needs a swap, so a plan can always be rebuilt.
  for (const e of exercises) {
    for (const f of e.excludedByFlags) {
      const has = (subsBy.get(e.id) ?? []).some((s) => s.kind === 'flag_swap' && s.flag === f);
      if (!has) add('substitutions', `$.exercises.${e.id}`, `no flag_swap for ${f}`);
    }
  }
  // Ladder neighbours must exist where the family has other rungs.
  for (const e of exercises) {
    const rungs = families.get(e.family) ?? [];
    const lower = rungs.some((r) => r < e.rung);
    const higher = rungs.some((r) => r > e.rung);
    const mine = subsBy.get(e.id) ?? [];
    if (lower && !mine.some((s) => s.kind === 'easier')) add('substitutions', `$.exercises.${e.id}`, 'has an easier rung in its family but no easier substitution');
    if (higher && !mine.some((s) => s.kind === 'harder')) add('substitutions', `$.exercises.${e.id}`, 'has a harder rung in its family but no harder substitution');
  }

  // --- plans ---
  for (const s of raw.plans.styles) {
    for (const id of s.tasterPlanIds) {
      const plan = raw.plans.plans.find((p) => p.id === id);
      if (!plan) add('plans', `$.styles.${s.id}`, `unknown taster plan ${id}`);
      else if (plan.style !== s.id) add('plans', `$.styles.${s.id}`, `taster plan ${id} is not a ${s.id} plan`);
    }
  }
  const tasterNeeds: Record<string, number> = { yoga: 3, dance: 2 };
  for (const s of raw.plans.styles) {
    const need = tasterNeeds[s.id];
    if (need !== undefined && s.tasterPlanIds.length !== need) add('plans', `$.styles.${s.id}`, `needs ${need} taster plans`);
  }
  raw.plans.plans.forEach((plan, i) => {
    const p = `$.plans[${i}]`;
    const sidesOf = (id: string) => exById.get(id)?.sides;
    const groups: [string, typeof plan.work, string][] = [
      ['warmup', plan.warmup, plan.kind === 'micro' ? 'micro' : 'warmup'],
      ['work', plan.work, plan.kind === 'micro' ? 'micro' : 'work'],
      ['cooldown', plan.cooldown, plan.kind === 'micro' ? 'micro' : 'cooldown'],
    ];
    const used = new Set<string>();
    for (const [gname, moves, phase] of groups) {
      moves.forEach((m, j) => {
        const e = exById.get(m.exerciseId);
        if (!e) return add('plans', `${p}.${gname}[${j}]`, `unknown exercise ${m.exerciseId}`);
        if (!e.phases.includes(phase as 'work')) add('plans', `${p}.${gname}[${j}]`, `${e.id} is not allowed in ${phase}`);
        if (used.has(e.id)) add('plans', `${p}.${gname}[${j}]`, `${e.id} is used twice in one plan`);
        used.add(e.id);
        if (e.style !== 'normal' && e.style !== plan.style) add('plans', `${p}.${gname}[${j}]`, `${e.id} is a ${e.style} move in a ${plan.style} plan`);
        if (plan.safeForFlags.some((f) => e.excludedByFlags.includes(f))) add('plans', `${p}.${gname}[${j}]`, `${e.id} is excluded by a flag the plan claims to be safe for`);
      });
    }
    const t = planDurationS(plan, sidesOf);
    if (plan.kind === 'full15') {
      if (t.warmup !== 120) add('plans', p, `warm-up is ${t.warmup} s, needs 120`);
      if (t.work !== 660) add('plans', p, `work is ${t.work} s, needs 660`);
      if (t.cooldown !== 120) add('plans', p, `cool-down is ${t.cooldown} s, needs 120`);
      if (plan.work.length < 3 || plan.work.length > 8) add('plans', p, 'work needs 3 to 8 moves');
    } else if (t.total !== plan.durationS) {
      add('plans', p, `total is ${t.total} s, needs ${plan.durationS}`);
    }
    if (t.total !== plan.durationS) add('plans', p, `total is ${t.total} s but durationS is ${plan.durationS}`);
    // safeForFlags must be exactly the flags with no excluded move.
    const all = [...plan.warmup, ...plan.work, ...plan.cooldown].map((m) => exById.get(m.exerciseId));
    for (const f of ALL_FLAGS) {
      const safe = all.every((e) => e && !e.excludedByFlags.includes(f as HealthFlag));
      if (safe !== plan.safeForFlags.includes(f as HealthFlag)) add('plans', p, `safeForFlags is wrong for ${f}`);
    }
  });

  // --- foods ---
  raw.foods.foods.forEach((f, i) => {
    const p = `$.foods[${i}]`;
    const def = f.units[0];
    if (!def) return;
    const names = f.units.map((u) => u.unit);
    if (new Set(names).size !== names.length) add('foods', p, 'repeats a unit');
    if (!names.includes('g')) add('foods', p, 'needs a grams unit');
    if (def.unit === 'g') add('foods', p, 'default unit cannot be g');
    for (const u of f.units) {
      if (!u.steps.includes(u.default)) add('foods', p, `${u.unit} default ${u.default} is not one of its steps`);
      if ([...u.steps].sort((a, b) => a - b).join() !== u.steps.join()) add('foods', p, `${u.unit} steps are not sorted`);
      if (u.unit === 'katori' && u.gramsOrMl !== raw.foods.units.katoriMl) add('foods', p, 'katori must be 150 ml');
      if (u.unit === 'chamach' && u.gramsOrMl !== raw.foods.units.chamachMl) add('foods', p, 'chamach must be 15 ml');
      if (u.unit === 'g' && (u.gramsOrMl !== 1 || u.gramsPerUnit !== 1)) add('foods', p, 'g unit must be 1 g');
    }
    const katori = f.units.find((u) => u.unit === 'katori');
    const chamach = f.units.find((u) => u.unit === 'chamach');
    if (katori && chamach && Math.abs(katori.gramsPerUnit / 10 - chamach.gramsPerUnit) > 0.06) {
      add('foods', p, 'chamach weight must be one tenth of a katori');
    }
    const n = f.perDefaultUnit;
    const calc = 4 * n.proteinG + 4 * n.carbsG + 9 * n.fatG;
    if (Math.abs(calc - n.kcal) > Math.max(10, calc * 0.12)) add('foods', p, `kcal ${n.kcal} does not match macros (about ${Math.round(calc)})`);
    if (n.proteinG + n.carbsG + n.fatG > def.gramsPerUnit + 0.01) add('foods', p, 'macros weigh more than the portion');
    if (f.diet.includes('jain') && !f.diet.includes('veg')) add('foods', p, 'a Jain food must also be veg');
    if (f.diet.includes('veg') && f.diet.includes('egg') === false) add('foods', p, 'a veg food also suits egg eaters');
  });

  // --- learn ---
  raw.learn.myths.forEach((m, i) => {
    const p = `$.myths[${i}]`;
    if (m.order !== i + 1) add('learn', p, 'order must follow list position');
    if (m.sources.length === 0) add('learn', p, 'every myth needs a source entry');
    if (m.reviewStatus === 'reviewed' && !m.reviewedOn) add('learn', p, 'a reviewed card needs a reviewedOn date');
    if (m.reviewStatus === 'reviewed' && m.sources.some((s) => s.status === 'pending')) add('learn', p, 'a reviewed card cannot have a pending source');
    if (m.verdict === 'false' && /\bis true\b/i.test(strings[m.trueKey] ?? '')) add('learn', p, 'verdict and text disagree');
  });
  raw.learn.concepts.forEach((c, i) => {
    const p = `$.concepts[${i}]`;
    if (c.order !== i + 1) add('learn', p, 'order must follow list position');
    const words = c.bodyKeys.map((k) => strings[k] ?? '').join(' ').split(/\s+/).length;
    if (words > 220) add('learn', p, `is ${words} words, over a 90 second read`);
    if (words < 60) add('learn', p, `is ${words} words, under a 30 second read`);
  });
  if (raw.learn.concepts.filter((c) => c.startHere).length !== 1) add('learn', '$.concepts', 'exactly one concept must be startHere');

  // --- voice form cues refer to form-checkable exercises ---
  raw.voice.formCues.forEach((g, i) => {
    const e = exById.get(g.exerciseId);
    if (!e) add('voice', `$.formCues[${i}]`, `unknown exercise ${g.exerciseId}`);
    else if (!e.formCheckable) add('voice', `$.formCues[${i}]`, `${g.exerciseId} is not form-checkable`);
  });
  for (const id of FORM_CHECKABLE) {
    if (!raw.voice.formCues.some((g) => g.exerciseId === id)) add('voice', '$.formCues', `missing form cues for ${id}`);
  }

  return issues;
}
