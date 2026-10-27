import { createContent, loadContent, resetContentCache } from './loader';
import type { FoodItem, HealthFlag } from './types';

const c = loadContent();
const must = <T,>(v: T | undefined | null, what = 'value'): T => {
  if (v === undefined || v === null) throw new Error(`missing ${what}`);
  return v;
};

describe('loadContent', () => {
  it('returns one shared instance and a fresh one after a reset', () => {
    expect(loadContent()).toBe(c);
    resetContentCache();
    expect(loadContent()).not.toBe(c);
    expect(createContent(c.raw).exercises).toHaveLength(c.exercises.length);
  });

  it('is en-IN', () => {
    expect(c.locale).toBe('en-IN');
  });
});

describe('strings', () => {
  it('looks up a string and returns the key when missing', () => {
    expect(c.t('exercise.squat.name')).toBe('Squat');
    expect(c.t('nope.nothing')).toBe('nope.nothing');
    expect(c.has('exercise.squat.name')).toBe(true);
    expect(c.has('nope.nothing')).toBe(false);
  });

  it('fills {{tokens}} and leaves unknown ones alone', () => {
    expect(c.cue('up_next', { name: 'Squat' })).toBe('Up next: Squat.');
    expect(c.t('cue.up_next.1')).toContain('{{name}}');
  });

  it('picks the plural form from count', () => {
    expect(c.t('unit.katori', { count: 1 })).toBe('katori');
    expect(c.t('food.boiled_egg_piece.unit', { count: 1 })).toBe('egg');
    expect(c.t('food.boiled_egg_piece.unit', { count: 2 })).toBe('eggs');
  });
});

describe('exercises', () => {
  it('finds an exercise and its two demo frames', () => {
    const squat = must(c.exercise('squat'));
    expect(squat.demo.frames).toHaveLength(2);
    expect(squat.formCheckable).toBe(true);
    expect(c.exercise('nope')).toBeUndefined();
  });

  it('hides exercises the user cannot do', () => {
    const lunge = must(c.exercise('lunge'));
    expect(c.isAllowed(lunge, [])).toBe(true);
    expect(c.isAllowed(lunge, ['knee'])).toBe(false);
    expect(c.blockingFlags(lunge, ['knee', 'wrist'])).toEqual(['knee']);
    expect(c.allowedExercises(['knee']).some((e) => e.id === 'lunge')).toBe(false);
    expect(c.allowedExercises(['knee'], { style: 'yoga' }).every((e) => e.style === 'yoga')).toBe(true);
    expect(c.allowedExercises([], { phase: 'cooldown' }).length).toBeGreaterThan(5);
  });

  it('shows a caution for flags that need care', () => {
    const squat = must(c.exercise('squat'));
    expect(c.cautionFlagsFor(squat, ['knee', 'back'])).toEqual(['knee']);
  });

  it('swaps a blocked move for one that suits the user', () => {
    expect(c.replacementFor('lunge', ['knee'])?.id).toBe('glute_bridge');
    expect(c.replacementFor('squat', ['knee'])?.id).toBe('squat');
    expect(c.replacementFor('nope', [])).toBeUndefined();
  });

  it('always finds a replacement for every exercise and every single flag', () => {
    const flags: HealthFlag[] = ['knee', 'back', 'shoulder', 'wrist', 'other_pain', 'heart_bp', 'pregnancy', 'recent_surgery'];
    for (const e of c.exercises) {
      for (const f of flags) {
        const r = c.replacementFor(e.id, [f]);
        expect(r).toBeDefined();
        expect(c.isAllowed(must(r), [f])).toBe(true);
      }
    }
  });

  it('walks the ladder', () => {
    expect(c.ladder('pushup').map((e) => e.id)).toEqual(['wall_pushup', 'knee_pushup', 'pushup', 'diamond_pushup', 'pike_pushup']);
    expect(c.easier('pushup')?.id).toBe('knee_pushup');
    expect(c.harder('pushup')?.id).toBe('diamond_pushup');
    expect(c.easier('wall_pushup')).toBeUndefined();
    expect(c.harder('pike_pushup')).toBeUndefined();
  });

  it('lists substitutions by kind', () => {
    expect(c.substitutionsFor('jumping_jacks', 'low_impact').map((s) => s.toExerciseId)).toEqual(['step_jacks']);
    expect(c.substitutionsFor('squat').length).toBeGreaterThan(1);
  });
});

describe('plans', () => {
  it('has a 15-minute shape: 2 + 11 + 2', () => {
    for (const p of c.plans.filter((x) => x.kind === 'full15')) {
      expect(c.planTime(p)).toEqual({ warmupS: 120, workS: 660, cooldownS: 120, totalS: 900 });
    }
  });

  it('has a four-minute desk reset', () => {
    expect(c.planTime(must(c.plan('desk_reset'))).totalS).toBe(240);
  });

  it('filters by style and by flags', () => {
    expect(c.plansFor({ style: 'dance' }).every((p) => p.style === 'dance')).toBe(true);
    const kneeSafe = c.plansFor({ flags: ['knee'] });
    expect(kneeSafe.length).toBeGreaterThan(3);
    for (const p of kneeSafe) {
      const ids = [...p.warmup, ...p.work, ...p.cooldown].map((m) => m.exerciseId);
      expect(ids.every((id) => c.isAllowed(must(c.exercise(id)), ['knee']))).toBe(true);
    }
    expect(kneeSafe.some((p) => p.id === 'cardio_burst')).toBe(false);
  });

  it('gives yoga three free taster plans and dance two', () => {
    expect(c.styles.find((s) => s.id === 'yoga')?.tasterPlanIds).toHaveLength(3);
    expect(c.styles.find((s) => s.id === 'dance')?.tasterPlanIds).toHaveLength(2);
    expect(c.styles.find((s) => s.id === 'normal')?.proOnly).toBe(false);
  });
});

describe('foods', () => {
  const dal = must(c.food('dal_tadka_katori'));

  it('finds a food and keeps katori as its default unit', () => {
    expect(dal.units[0]?.unit).toBe('katori');
    expect(dal.units[0]?.gramsOrMl).toBe(150);
    expect(c.food('nope')).toBeUndefined();
  });

  it('computes nutrients for a quantity of the default unit', () => {
    const one = c.nutrients(dal, 'katori', 1);
    expect(one).toEqual({ kcal: dal.perDefaultUnit.kcal, proteinG: 7, carbsG: 16, fatG: 5.5 });
    const half = c.nutrients(dal, 'katori', 0.5);
    expect(half.kcal).toBe(Math.round(dal.perDefaultUnit.kcal / 2));
    expect(half.proteinG).toBe(3.5);
  });

  it('converts katori to chamach and back (1 katori is 10 chamach)', () => {
    expect(c.convert(dal, 1, 'katori', 'chamach')).toBe(10);
    expect(c.convert(dal, 3, 'chamach', 'katori')).toBe(0.3);
    expect(c.nutrients(dal, 'chamach', 10).kcal).toBe(dal.perDefaultUnit.kcal);
  });

  it('converts to grams and gives matching nutrients', () => {
    const grams = c.convert(dal, 1, 'katori', 'g');
    expect(grams).toBe(150);
    expect(c.nutrients(dal, 'g', 150).kcal).toBe(dal.perDefaultUnit.kcal);
    const roti = must(c.food('roti_phulka_piece'));
    expect(c.convert(roti, 2, 'piece', 'g')).toBe(80);
    expect(c.nutrients(roti, 'piece', 2).proteinG).toBe(6.2);
  });

  it('throws for a unit the food does not have', () => {
    expect(() => c.nutrients(dal, 'piece', 1)).toThrow(/no piece unit/);
  });

  it('labels a quantity', () => {
    expect(c.unitLabel(dal, 'katori', 1.5)).toBe('1.5 katori');
    expect(c.unitLabel(must(c.food('roti_phulka_piece')), 'piece', 2)).toBe('2 rotis');
  });

  it('searches by prefix and by word, ranking the best match first', () => {
    const r = c.searchFoods('dal');
    expect(r.length).toBeGreaterThanOrEqual(8);
    expect(c.t(must(r[0]).nameKey).toLowerCase()).toMatch(/^dal/);
    expect(c.searchFoods('makhani').map((f) => f.id)).toContain('dal_makhani_katori');
    expect(c.searchFoods('zzzzzz')).toEqual([]);
    expect(c.searchFoods('dal', { limit: 3 })).toHaveLength(3);
  });

  it('filters by kind, diet and allergen', () => {
    expect(c.searchFoods('', { kind: 'packaged' }).every((f) => f.kind === 'packaged')).toBe(true);
    const veg = c.searchFoods('', { diet: 'jain' });
    expect(veg.length).toBeGreaterThan(20);
    expect(veg.every((f) => f.diet.includes('jain'))).toBe(true);
    const noDairy = c.searchFoods('paneer', { excludeAllergens: ['dairy'] });
    expect(noDairy).toEqual([]);
    const noPeanut: FoodItem[] = c.searchFoods('', { excludeAllergens: ['peanut'] });
    expect(noPeanut.some((f) => f.allergens.includes('peanut'))).toBe(false);
  });
});

describe('learn', () => {
  it('has ordered myths with verdicts and a source', () => {
    expect(c.myths.map((m) => m.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(c.myth('ten_thousand_steps')?.verdict).toBe('partly_true');
    expect(c.t(must(c.myth('crunches_belly_fat')).titleKey)).toBe('Crunches burn belly fat');
    expect(c.myths.every((m) => m.sources.length > 0)).toBe(true);
  });

  it('has eight concepts with one start-here card', () => {
    expect(c.concepts).toHaveLength(8);
    expect(c.concepts.filter((x) => x.startHere).map((x) => x.id)).toEqual(['warm_up']);
    expect(c.concept('warm_up')?.bodyKeys).toHaveLength(3);
  });

  it('marks every card as pending review', () => {
    expect([...c.myths, ...c.concepts].every((x) => x.reviewStatus === 'pending' && x.needsExpertReview)).toBe(true);
  });
});

describe('voice cues', () => {
  it('rotates through variants and wraps', () => {
    expect(c.cue('switch_sides', undefined, 0)).toBe('Switch sides.');
    expect(c.cue('switch_sides', undefined, 1)).toBe('Change sides now.');
    expect(c.cue('switch_sides', undefined, 2)).toBe('Switch sides.');
    expect(c.cue('switch_sides', undefined, -1)).toBe('Change sides now.');
    expect(c.cue('nope')).toBe('');
  });

  it('has a count-in from three', () => {
    expect([c.cue('count_3'), c.cue('count_2'), c.cue('count_1')]).toEqual(['Three.', 'Two.', 'One.']);
  });

  it('gives form cues for the four analysed exercises only', () => {
    for (const id of ['squat', 'pushup', 'plank', 'lunge']) expect(c.formCues(id).length).toBeGreaterThanOrEqual(4);
    expect(c.formCues('glute_bridge')).toEqual([]);
    expect(c.formCues('squat')[0]).toEqual({ id: 'knees_in', text: 'Knees out a little.' });
  });

  it('exposes the voice event', () => {
    expect(c.voiceEvent('step_start')?.tokens).toEqual(['name', 'cue']);
  });
});
