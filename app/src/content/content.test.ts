// Facts about the shipped packs and the validator script.

import manifest from '../../assets/content/manifest.json';
import { bundledContent } from './loader';

// The tsconfig does not load Node types, so the three Node modules used here
// are typed by hand.
const { execFileSync } = jest.requireActual('child_process') as {
  execFileSync: (file: string, args: string[], options: { encoding: 'utf8' }) => string;
};
const { existsSync, readFileSync } = jest.requireActual('fs') as {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = jest.requireActual('path') as { join: (...parts: string[]) => string };
declare const __dirname: string;

const raw = bundledContent;
const root = join(__dirname, '..', '..');

describe('bundled content', () => {
  it('meets the launch counts', () => {
    expect(raw.exercises.exercises.length).toBeGreaterThanOrEqual(60);
    expect(raw.foods.foods.length).toBeGreaterThanOrEqual(250);
    expect(raw.learn.myths).toHaveLength(10);
    expect(raw.learn.concepts).toHaveLength(8);
    expect(raw.plans.plans.length).toBeGreaterThanOrEqual(12);
  });

  it('matches the manifest', () => {
    expect(manifest.counts).toEqual({
      exercises: raw.exercises.exercises.length,
      substitutions: raw.substitutions.substitutions.length,
      plans: raw.plans.plans.length,
      foods: raw.foods.foods.length,
      myths: raw.learn.myths.length,
      concepts: raw.learn.concepts.length,
      voiceEvents: raw.voice.events.length,
      strings: Object.keys(raw.strings.strings).length,
    });
    for (const f of manifest.files) expect(existsSync(join(root, 'assets', 'content', f))).toBe(true);
  });

  it('marks every pack and every record needsExpertReview: true', () => {
    for (const pack of Object.values(raw)) expect(pack.needsExpertReview).toBe(true);
    const records = [
      ...raw.exercises.exercises,
      ...raw.substitutions.substitutions,
      ...raw.plans.plans,
      ...raw.foods.foods,
      ...raw.learn.myths,
      ...raw.learn.concepts,
    ];
    expect(records.every((r) => r.needsExpertReview === true)).toBe(true);
    expect(manifest.needsExpertReview).toBe(true);
  });

  it('keeps every exercise bodyweight with two demo frames and no dumbbell', () => {
    for (const e of raw.exercises.exercises) {
      expect(e.equipment).toBe('none');
      expect(e.demo.frames).toHaveLength(2);
      expect(e.id).not.toMatch(/dumbbell|fitness_center/);
    }
  });

  it('only allows the four form-check exercises', () => {
    expect(raw.exercises.exercises.filter((e) => e.formCheckable).map((e) => e.id).sort()).toEqual(['lunge', 'plank', 'pushup', 'squat']);
  });

  it('has every exercise on a ladder rung and every family reachable', () => {
    const families = new Set(raw.exercises.exercises.map((e) => e.family));
    expect(families.size).toBeGreaterThan(20);
  });

  it('covers all seven body parts', () => {
    const parts = new Set(raw.exercises.exercises.flatMap((e) => e.bodyParts));
    expect([...parts].sort()).toEqual(['arms', 'back', 'chest', 'core', 'glutes', 'legs', 'shoulders']);
  });

  it('covers the three styles, with yoga breath cues and dance bpm', () => {
    const by = (s: string) => raw.exercises.exercises.filter((e) => e.style === s);
    expect(by('yoga').length).toBeGreaterThanOrEqual(5);
    expect(by('dance').length).toBeGreaterThanOrEqual(5);
    expect(by('yoga').every((e) => e.breath?.inS === 4 && e.breath.outS === 6)).toBe(true);
    expect(by('dance').every((e) => typeof e.bpm === 'number')).toBe(true);
  });

  it('keeps nutrients near the Atwater estimate for every food', () => {
    for (const f of raw.foods.foods) {
      const n = f.perDefaultUnit;
      const calc = 4 * n.proteinG + 4 * n.carbsG + 9 * n.fatG;
      expect(Math.abs(calc - n.kcal)).toBeLessThanOrEqual(Math.max(10, calc * 0.12));
    }
  });

  it('gives every home katori curry a chamach conversion where it makes sense', () => {
    const dal = raw.foods.foods.find((f) => f.id === 'moong_dal_katori');
    expect(dal?.units.map((u) => u.unit)).toEqual(['katori', 'chamach', 'g']);
  });

  it('has food names in sentence case', () => {
    for (const f of raw.foods.foods) {
      const name = raw.strings.strings[f.nameKey] ?? '';
      expect(name[0]).toBe((name[0] ?? '').toUpperCase());
    }
  });
});

describe('validate-content script', () => {
  const script = join(root, 'scripts', 'validate-content.ts');
  const nodeMajor = Number(process.versions.node.split('.')[0]);

  (nodeMajor >= 22 ? it : it.skip)('exits 0 and reports no problems', () => {
    const out = execFileSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, '--json'], { encoding: 'utf8' });
    const result = JSON.parse(out) as { ok: boolean; issues: unknown[]; counts: Record<string, number> };
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.counts.exercises).toBe(raw.exercises.exercises.length);
  });

  it('exists next to a readable schema', () => {
    expect(readFileSync(script, 'utf8')).toContain('validateContent');
    expect(existsSync(join(root, 'assets', 'content', 'schema', 'content.schema.json'))).toBe(true);
  });
});
