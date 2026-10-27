import schemaJson from '../../assets/content/schema/content.schema.json';
import { bundledContent } from './loader';
import { planDurationS, validateContent, validateSchema } from './validate';
import type { RawContent } from './types';

const schema = schemaJson as unknown as Record<string, unknown>;
const clone = (): RawContent => JSON.parse(JSON.stringify(bundledContent)) as RawContent;
const messages = (raw: RawContent) => validateContent(raw, schema).map((i) => `${i.pack} ${i.path} ${i.message}`);

describe('validateSchema', () => {
  const root = { $defs: { id: { type: 'string', pattern: '^[a-z_]+$' } } };
  const run = (value: unknown, s: Record<string, unknown>) => validateSchema(value, s, root);

  it('accepts a matching value and reports a wrong type', () => {
    expect(run('abc', { type: 'string' })).toEqual([]);
    expect(run(3, { type: 'string' })[0]?.message).toMatch(/must be string/);
  });

  it('checks integer, minimum and maximum', () => {
    expect(run(1.5, { type: 'integer' })).toHaveLength(1);
    expect(run(0, { type: 'integer', minimum: 1 })).toHaveLength(1);
    expect(run(9, { type: 'integer', maximum: 5 })).toHaveLength(1);
    expect(run(3, { type: 'integer', minimum: 1, maximum: 5 })).toEqual([]);
  });

  it('checks enum and const', () => {
    expect(run('a', { enum: ['a', 'b'] })).toEqual([]);
    expect(run('c', { enum: ['a', 'b'] })).toHaveLength(1);
    expect(run(false, { const: true })).toHaveLength(1);
  });

  it('checks required properties and additionalProperties false', () => {
    const s = { type: 'object', required: ['a'], additionalProperties: false, properties: { a: { type: 'number' } } };
    expect(run({ a: 1 }, s)).toEqual([]);
    expect(run({}, s)[0]).toEqual({ path: '$.a', message: 'is required' });
    expect(run({ a: 1, b: 2 }, s)[0]).toEqual({ path: '$.b', message: 'is not allowed here' });
  });

  it('checks arrays: length, uniqueness and item schema, with a path', () => {
    const s = { type: 'array', minItems: 2, maxItems: 3, uniqueItems: true, items: { type: 'number' } };
    expect(run([1], s)).toHaveLength(1);
    expect(run([1, 1], s)).toHaveLength(1);
    expect(run([1, 2, 3, 4], s)).toHaveLength(1);
    expect(run([1, 'x'], s)[0]?.path).toBe('$[1]');
  });

  it('checks string length and pattern', () => {
    expect(run('ab', { type: 'string', minLength: 3 })).toHaveLength(1);
    expect(run('abcd', { type: 'string', maxLength: 3 })).toHaveLength(1);
    expect(run('ABC', { type: 'string', pattern: '^[a-z]+$' })).toHaveLength(1);
  });

  it('follows $ref and supports type unions and allOf', () => {
    expect(run('ok_id', { $ref: '#/$defs/id' })).toEqual([]);
    expect(run('Bad', { $ref: '#/$defs/id' })).toHaveLength(1);
    expect(run(null, { type: ['string', 'null'] })).toEqual([]);
    expect(run({ a: 1 }, { allOf: [{ required: ['a'] }, { required: ['b'] }] })).toHaveLength(1);
  });

  it('throws on an unresolved $ref', () => {
    expect(() => run('x', { $ref: '#/$defs/missing' })).toThrow(/Unresolved/);
  });
});

describe('validateContent on the bundled packs', () => {
  it('finds no problems', () => {
    expect(messages(bundledContent)).toEqual([]);
  });

  it('reports a missing pack', () => {
    const raw = clone() as Partial<RawContent>;
    delete raw.foods;
    expect(messages(raw as RawContent)[0]).toMatch(/foods \$ pack is missing/);
  });

  it('rejects a pack that is not marked needsExpertReview', () => {
    const raw = clone();
    (raw.exercises as unknown as { needsExpertReview: boolean }).needsExpertReview = false;
    expect(messages(raw).join('\n')).toMatch(/exercises \$\.needsExpertReview must be true/);
  });

  it('rejects a record that is not marked needsExpertReview', () => {
    const raw = clone();
    (raw.foods.foods[3] as unknown as { needsExpertReview: boolean }).needsExpertReview = false;
    expect(messages(raw).join('\n')).toMatch(/foods \$\.foods\[3\]\.needsExpertReview/);
  });

  it('rejects a string key that is missing from the strings pack', () => {
    const raw = clone();
    delete raw.strings.strings['exercise.squat.cue'];
    expect(messages(raw).join('\n')).toMatch(/string key exercise\.squat\.cue is missing/);
  });

  it('rejects a duplicate id', () => {
    const raw = clone();
    const first = raw.exercises.exercises[0];
    if (!first) throw new Error('no exercises');
    raw.exercises.exercises[1] = { ...raw.exercises.exercises[1]!, id: first.id };
    expect(messages(raw).join('\n')).toMatch(/duplicate id march_in_place/);
  });

  it('rejects an exercise with equipment', () => {
    const raw = clone();
    (raw.exercises.exercises[0] as unknown as { equipment: string }).equipment = 'dumbbell';
    expect(messages(raw).join('\n')).toMatch(/equipment must be "none"/);
  });

  it('rejects a demo that does not have exactly two frames', () => {
    const raw = clone();
    raw.exercises.exercises[0]!.demo.frames = [raw.exercises.exercises[0]!.demo.frames[0]] as never;
    expect(messages(raw).join('\n')).toMatch(/frames needs at least 2 items/);
  });

  it('rejects an exclusion that has no flag swap', () => {
    const raw = clone();
    raw.substitutions.substitutions = raw.substitutions.substitutions.filter((s) => !(s.exerciseId === 'lunge' && s.flag === 'knee'));
    expect(messages(raw).join('\n')).toMatch(/no flag_swap for knee/);
  });

  it('rejects a flag swap whose target is excluded by the same flag', () => {
    const raw = clone();
    const sub = raw.substitutions.substitutions.find((s) => s.exerciseId === 'lunge' && s.flag === 'knee')!;
    sub.toExerciseId = 'reverse_lunge';
    expect(messages(raw).join('\n')).toMatch(/target is also excluded by knee/);
  });

  it('rejects an easier substitution that goes up the ladder', () => {
    const raw = clone();
    const sub = raw.substitutions.substitutions.find((s) => s.exerciseId === 'pushup' && s.kind === 'easier')!;
    sub.toExerciseId = 'diamond_pushup';
    expect(messages(raw).join('\n')).toMatch(/easier must stay in the family on a lower rung/);
  });

  it('rejects a plan that is not 15 minutes', () => {
    const raw = clone();
    raw.plans.plans[0]!.work[0]!.workS += 5;
    expect(messages(raw).join('\n')).toMatch(/work is 670 s, needs 660/);
  });

  it('rejects a plan that claims to be safe for a flag it is not', () => {
    const raw = clone();
    const plan = raw.plans.plans.find((p) => p.id === 'cardio_burst')!;
    plan.safeForFlags = [...plan.safeForFlags, 'knee'];
    expect(messages(raw).join('\n')).toMatch(/excluded by a flag the plan claims to be safe for/);
  });

  it('rejects calories that do not match the macros', () => {
    const raw = clone();
    raw.foods.foods[0]!.perDefaultUnit.kcal = 900;
    expect(messages(raw).join('\n')).toMatch(/kcal 900 does not match macros/);
  });

  it('rejects a chamach that is not a tenth of a katori', () => {
    const raw = clone();
    const food = raw.foods.foods.find((f) => f.units.some((u) => u.unit === 'chamach') && f.units.some((u) => u.unit === 'katori'))!;
    food.units.find((u) => u.unit === 'chamach')!.gramsPerUnit = 99;
    expect(messages(raw).join('\n')).toMatch(/chamach weight must be one tenth of a katori/);
  });

  it('rejects shaming or all-caps copy', () => {
    const raw = clone();
    raw.strings.strings['cue.encourage.1'] = 'No excuses today.';
    raw.strings.strings['cue.encourage.2'] = 'WORK HARDER now.';
    const out = messages(raw).join('\n');
    expect(out).toMatch(/cue\.encourage\.1 uses shaming language/);
    expect(out).toMatch(/cue\.encourage\.2 has an all-caps word/);
  });

  it('rejects a voice cue that is too long for speech', () => {
    const raw = clone();
    raw.strings.strings['cue.paused.1'] = 'Paused. '.repeat(20).trim();
    expect(messages(raw).join('\n')).toMatch(/cue\.paused\.1 is \d+ characters, over 80/);
  });

  it('rejects a reviewed card that still has a pending source', () => {
    const raw = clone();
    const myth = raw.learn.myths[0]!;
    myth.reviewStatus = 'reviewed';
    myth.reviewedOn = '2026-10-01';
    expect(messages(raw).join('\n')).toMatch(/a reviewed card cannot have a pending source/);
  });

  it('requires 10 myths and 8 concepts', () => {
    const raw = clone();
    raw.learn.myths.pop();
    raw.learn.concepts.pop();
    const out = messages(raw).join('\n');
    expect(out).toMatch(/needs exactly 10 myths/);
    expect(out).toMatch(/needs exactly 8 concepts/);
  });
});

describe('planDurationS', () => {
  it('doubles work time for exercises done on each side', () => {
    const sides = (id: string) => (id === 'a' ? 'each' : 'none');
    const t = planDurationS(
      {
        warmup: [],
        work: [
          { exerciseId: 'a', sets: 2, workS: 20, restS: 10 },
          { exerciseId: 'b', sets: 1, workS: 30, restS: 0 },
        ],
        cooldown: [],
      },
      sides,
    );
    expect(t.work).toBe(2 * (40 + 10) + 30);
    expect(t.total).toBe(130);
  });
});
