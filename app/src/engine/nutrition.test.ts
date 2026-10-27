import {
  CALORIE_FLOOR,
  activityFactor,
  ageFromBirthYear,
  bmi,
  bmr,
  computeNutritionTargets,
  proteinStatus,
  splitMeals,
  type NutritionInput,
  type NutritionResult,
} from './nutrition';

const woman: NutritionInput = { sex: 'woman', age: 28, heightCm: 162, weightKg: 60, workoutsPerWeek: 4, goal: 'maintain' };

function ok(r: NutritionResult) {
  if (r.status !== 'ok') throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r;
}

describe('formulas', () => {
  it('computes Mifflin-St Jeor', () => {
    expect(bmr('woman', 28, 162, 60)).toBeCloseTo(1311.5, 5);
    expect(bmr('man', 35, 175, 80)).toBeCloseTo(1723.75, 5);
    expect(bmr('other', 28, 162, 60)).toBeCloseTo((bmr('woman', 28, 162, 60) + bmr('man', 28, 162, 60)) / 2, 5);
  });

  it('maps workouts a week to a factor that stops at 1.5', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 9].map(activityFactor)).toEqual([1.2, 1.3, 1.3, 1.375, 1.375, 1.45, 1.45, 1.5, 1.5]);
    expect(activityFactor(-2)).toBe(1.2);
  });

  it('derives age and BMI', () => {
    expect(ageFromBirthYear(1998, 2026)).toBe(28);
    expect(bmi(160, 64)).toBeCloseTo(25, 5);
  });
});

describe('targets', () => {
  it('maintains at TDEE rounded to 10, with protein from weight', () => {
    const r = ok(computeNutritionTargets(woman));
    expect(r.tdee).toBe(1803);
    expect(r.kcal).toBe(1800);
    expect(r.proteinG).toBe(60);
    expect(r.atFloor).toBe(false);
    expect(r.floorKcal).toBe(1200);
    expect(r.kcal % 10).toBe(0);
  });

  it('takes a gentle deficit capped at 20% of TDEE', () => {
    const r = ok(computeNutritionTargets({ ...woman, goal: 'lose_gently' }));
    expect(r.kcal).toBe(1440);
    expect(r.proteinG).toBe(70);
    expect(r.expectedWeeklyChangeKg).toBeLessThan(0);
    expect(r.expectedWeeklyChangeKg).toBeGreaterThanOrEqual(-0.5);
  });

  it('takes a gentle surplus for gain', () => {
    const r = ok(computeNutritionTargets({ ...woman, goal: 'gain' }));
    expect(r.kcal).toBe(2080);
    expect(r.proteinG).toBe(85);
    expect(r.expectedWeeklyChangeKg).toBeGreaterThan(0);
  });

  it('clamps a requested loss between 0.5 and 0.75 kg a week to 0.5', () => {
    const big = { ...woman, weightKg: 110, heightCm: 170, goal: 'lose_gently' as const };
    const capped = ok(computeNutritionTargets({ ...big, weeklyChangeKg: 0.7 }));
    const half = ok(computeNutritionTargets({ ...big, weeklyChangeKg: 0.5 }));
    expect(capped.kcal).toBe(half.kcal);
    expect(capped.expectedWeeklyChangeKg).toBeGreaterThanOrEqual(-0.51);
  });

  it('never goes under the calorie floor', () => {
    const small = ok(computeNutritionTargets({ sex: 'woman', age: 60, heightCm: 150, weightKg: 48, workoutsPerWeek: 0, goal: 'maintain' }));
    expect(small.kcal).toBe(1200);
    expect(small.atFloor).toBe(true);
    const lose = ok(computeNutritionTargets({ sex: 'woman', age: 40, heightCm: 150, weightKg: 48, workoutsPerWeek: 0, goal: 'lose_gently' }));
    expect(lose.kcal).toBe(1200);
    expect(lose.atFloor).toBe(true);
    const man = ok(computeNutritionTargets({ sex: 'man', age: 70, heightCm: 160, weightKg: 52, workoutsPerWeek: 0, goal: 'maintain' }));
    expect(man.kcal).toBe(1500);
  });

  it('has floors of 1,200 and 1,500', () => {
    expect(CALORIE_FLOOR).toEqual({ woman: 1200, man: 1500, other: 1500 });
  });

  it('declines a very low target instead of lifting it', () => {
    expect(computeNutritionTargets({ sex: 'woman', age: 60, heightCm: 150, weightKg: 45, workoutsPerWeek: 0, goal: 'lose_gently' })).toEqual({
      status: 'declined',
      reason: 'very_low_target',
    });
  });

  it('declines loss at a low BMI', () => {
    expect(computeNutritionTargets({ ...woman, heightCm: 170, weightKg: 50, goal: 'lose_gently' })).toEqual({ status: 'declined', reason: 'low_bmi' });
    expect(computeNutritionTargets({ ...woman, heightCm: 170, weightKg: 50, goal: 'maintain' }).status).toBe('ok');
  });

  it('declines a rapid goal', () => {
    expect(computeNutritionTargets({ ...woman, goal: 'lose_gently', weeklyChangeKg: 0.8 })).toEqual({ status: 'declined', reason: 'too_rapid' });
    expect(computeNutritionTargets({ ...woman, goal: 'lose_gently', weeklyChangeKg: 0.75 }).status).toBe('ok');
  });

  it('declines everyone under 18', () => {
    for (const goal of ['maintain', 'lose_gently', 'gain'] as const) {
      expect(computeNutritionTargets({ ...woman, age: 17, goal })).toEqual({ status: 'declined', reason: 'under_18' });
    }
    expect(computeNutritionTargets({ ...woman, age: 18 }).status).toBe('ok');
  });

  it('asks for measures when height or weight was skipped', () => {
    expect(computeNutritionTargets({ ...woman, heightCm: null })).toEqual({ status: 'needs_measures' });
    expect(computeNutritionTargets({ ...woman, weightKg: null })).toEqual({ status: 'needs_measures' });
  });

  it('rejects impossible inputs', () => {
    expect(computeNutritionTargets({ ...woman, heightCm: 20 })).toEqual({ status: 'declined', reason: 'invalid_input' });
    expect(computeNutritionTargets({ ...woman, weightKg: 900 })).toEqual({ status: 'declined', reason: 'invalid_input' });
    expect(computeNutritionTargets({ ...woman, age: Number.NaN })).toEqual({ status: 'declined', reason: 'invalid_input' });
    expect(computeNutritionTargets({ ...woman, goal: 'lose_gently', weeklyChangeKg: 0 })).toEqual({ status: 'declined', reason: 'invalid_input' });
    expect(computeNutritionTargets({ ...woman, goal: 'gain', weeklyChangeKg: -1 })).toEqual({ status: 'declined', reason: 'invalid_input' });
  });

  it('caps protein per kg and share of energy', () => {
    const r = ok(computeNutritionTargets({ sex: 'man', age: 30, heightCm: 175, weightKg: 70, workoutsPerWeek: 5, goal: 'gain' }));
    expect(r.proteinG).toBeLessThanOrEqual(140);
    expect(r.proteinG * 4).toBeLessThanOrEqual(0.3 * r.kcal + 5);
    expect(r.proteinG % 5).toBe(0);
  });

  it('never returns a target under the floor across a sweep of people', () => {
    let okCount = 0;
    for (const sex of ['woman', 'man', 'other'] as const) {
      for (let age = 18; age <= 80; age += 7) {
        for (let h = 140; h <= 200; h += 15) {
          for (let w = 40; w <= 130; w += 15) {
            for (const goal of ['maintain', 'lose_gently', 'gain'] as const) {
              for (const workouts of [0, 3, 7]) {
                const r = computeNutritionTargets({ sex, age, heightCm: h, weightKg: w, workoutsPerWeek: workouts, goal });
                if (r.status !== 'ok') continue;
                okCount += 1;
                expect(r.kcal).toBeGreaterThanOrEqual(CALORIE_FLOOR[sex]);
                expect(r.kcal % 10).toBe(0);
                expect(r.proteinG).toBeGreaterThan(0);
                if (goal === 'lose_gently') expect(r.expectedWeeklyChangeKg).toBeGreaterThanOrEqual(-0.5);
              }
            }
          }
        }
      }
    }
    expect(okCount).toBeGreaterThan(500);
  });
});

describe('splitMeals', () => {
  it('adds up exactly for 2 to 6 meals and every plausible target', () => {
    for (let meals = 1; meals <= 7; meals += 1) {
      for (let kcal = 1200; kcal <= 3200; kcal += 10) {
        const parts = splitMeals(kcal, meals);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(kcal);
        expect(parts.every((p) => p > 0 && p % 10 === 0)).toBe(true);
        expect(parts).toHaveLength(Math.max(1, Math.min(6, meals)));
      }
    }
  });

  it('gives lunch the biggest share for 3 meals', () => {
    expect(splitMeals(1800, 3)).toEqual([540, 720, 540]);
  });
});

describe('proteinStatus', () => {
  it('uses neutral words and never a negative one', () => {
    expect(proteinStatus(10, 70)).toBe('building');
    expect(proteinStatus(52, 70)).toBe('on_track');
    expect(proteinStatus(70, 70)).toBe('met');
    expect(proteinStatus(120, 70)).toBe('met');
    expect(proteinStatus(0, 0)).toBe('met');
  });
});
