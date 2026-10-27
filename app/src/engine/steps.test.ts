import {
  REVERSE_DAILY_CAP_S,
  boutSecondsCounted,
  briskMinutes,
  reverseBoutState,
  reverseWalkEligibility,
  stepGoal,
  stepsToGo,
  type MinuteBucket,
} from './steps';

const T0 = Date.UTC(2026, 9, 27, 8, 0, 0);
const min = (i: number, steps: number): MinuteBucket => ({ startMs: T0 + i * 60_000, steps });

describe('brisk minutes', () => {
  it('counts minutes with 100 or more steps', () => {
    expect(briskMinutes([min(0, 100), min(1, 99), min(2, 140), min(3, 0)])).toBe(2);
    expect(briskMinutes([])).toBe(0);
  });

  it('adds buckets that fall in the same clock minute', () => {
    expect(briskMinutes([min(0, 60), { startMs: T0 + 30_000, steps: 50 }])).toBe(1);
    expect(briskMinutes([min(0, 60), { startMs: T0 + 30_000, steps: 30 }])).toBe(0);
  });

  it('leaves out minutes that touch a reverse-walk bout', () => {
    const bout = { startMs: T0 + 90_000, endMs: T0 + 3 * 60_000 + 10_000 };
    // minutes 1, 2 and 3 overlap; 0 and 4 do not
    const buckets = [0, 1, 2, 3, 4].map((i) => min(i, 120));
    expect(briskMinutes(buckets, [bout])).toBe(2);
  });

  it('does not count a bout that ends exactly at a minute start', () => {
    expect(briskMinutes([min(1, 120)], [{ startMs: T0, endMs: T0 + 60_000 }])).toBe(1);
  });

  it('ignores bad buckets and supports another threshold', () => {
    expect(briskMinutes([min(0, Number.NaN), min(1, -5), { startMs: Number.NaN, steps: 200 }])).toBe(0);
    expect(briskMinutes([min(0, 80)], [], 80)).toBe(1);
  });
});

describe('step goal', () => {
  it('defaults to 7,000, and 6,000 at 60 and over', () => {
    expect(stepGoal()).toBe(7000);
    expect(stepGoal({ age: 59 })).toBe(7000);
    expect(stepGoal({ age: 60 })).toBe(6000);
    expect(stepGoal({ sevenDayAverage: null })).toBe(7000);
  });

  it('ramps from the 7-day average by about 1,000', () => {
    expect(stepGoal({ sevenDayAverage: 3000 })).toBe(4000);
    expect(stepGoal({ sevenDayAverage: 3040 })).toBe(4000);
    expect(stepGoal({ sevenDayAverage: 5440 })).toBe(6400);
    expect(stepGoal({ sevenDayAverage: 6000 })).toBe(7000);
    expect(stepGoal({ sevenDayAverage: 9000 })).toBe(7000);
    expect(stepGoal({ sevenDayAverage: 4000, age: 65 })).toBe(5000);
    expect(stepGoal({ sevenDayAverage: 5200, age: 65 })).toBe(6000);
  });

  it('never goes below a floor and never above the target', () => {
    expect(stepGoal({ sevenDayAverage: 0 })).toBe(2000);
    expect(stepGoal({ sevenDayAverage: Number.NaN })).toBe(7000);
    for (let a = 0; a <= 12000; a += 250) {
      const g = stepGoal({ sevenDayAverage: a });
      expect(g).toBeGreaterThanOrEqual(2000);
      expect(g).toBeLessThanOrEqual(7000);
    }
  });

  it('counts steps to go without going negative', () => {
    expect(stepsToGo(4820, 7000)).toBe(2180);
    expect(stepsToGo(8000, 7000)).toBe(0);
    expect(stepsToGo(-5, 7000)).toBe(7000);
  });
});

describe('reverse walking', () => {
  const free = { healthFlags: [], usedTodayS: 0 } as const;

  it('allows a fresh day: 15 minutes in all, aiming for 10 a bout', () => {
    expect(reverseWalkEligibility(free)).toEqual({ allowed: true, remainingS: 900, boutTargetS: 600 });
  });

  it('is never offered with a health flag', () => {
    for (const f of ['heart_bp', 'pregnancy', 'recent_surgery'] as const) {
      expect(reverseWalkEligibility({ ...free, healthFlags: [f] })).toEqual({ allowed: false, reason: 'health_flag' });
    }
    expect(reverseWalkEligibility({ ...free, healthFlags: ['heart_bp', 'pregnancy'] })).toEqual({ allowed: false, reason: 'health_flag' });
  });

  it('is not offered with a balance concern or from 60', () => {
    expect(reverseWalkEligibility({ ...free, balanceConcern: true })).toEqual({ allowed: false, reason: 'balance' });
    expect(reverseWalkEligibility({ ...free, age: 60 })).toEqual({ allowed: false, reason: 'age' });
    expect(reverseWalkEligibility({ ...free, age: 59 }).allowed).toBe(true);
    expect(reverseWalkEligibility({ ...free, age: null }).allowed).toBe(true);
  });

  it('stops offering bouts once 15 minutes are used', () => {
    expect(reverseWalkEligibility({ ...free, usedTodayS: 900 })).toEqual({ allowed: false, reason: 'daily_cap' });
    expect(reverseWalkEligibility({ ...free, usedTodayS: 5000 })).toEqual({ allowed: false, reason: 'daily_cap' });
    expect(reverseWalkEligibility({ ...free, usedTodayS: 600 })).toEqual({ allowed: true, remainingS: 300, boutTargetS: 300 });
    expect(reverseWalkEligibility({ ...free, usedTodayS: 342 })).toEqual({ allowed: true, remainingS: 558, boutTargetS: 558 });
  });

  it('puts the health flag ahead of the cap in the reason', () => {
    expect(reverseWalkEligibility({ healthFlags: ['heart_bp'], usedTodayS: 900 })).toEqual({ allowed: false, reason: 'health_flag' });
  });

  it('counts a running bout against today and auto-stops at 15:00', () => {
    expect(reverseBoutState({ usedBeforeS: 0, elapsedS: 342 })).toEqual({ usedTodayS: 342, remainingTodayS: 558, autoStop: false });
    expect(reverseBoutState({ usedBeforeS: 540, elapsedS: 360 })).toEqual({ usedTodayS: 900, remainingTodayS: 0, autoStop: true });
    expect(reverseBoutState({ usedBeforeS: 540, elapsedS: 9999 }).usedTodayS).toBe(REVERSE_DAILY_CAP_S);
    expect(reverseBoutState({ usedBeforeS: -5, elapsedS: -5 }).usedTodayS).toBe(0);
  });

  it('never lets a day pass 15 minutes in total', () => {
    let used = 0;
    let bouts = 0;
    while (reverseWalkEligibility({ healthFlags: [], usedTodayS: used }).allowed) {
      const e = reverseWalkEligibility({ healthFlags: [], usedTodayS: used });
      if (!e.allowed) break;
      used += boutSecondsCounted({ usedBeforeS: used, boutS: e.boutTargetS });
      bouts += 1;
      expect(bouts).toBeLessThan(10);
    }
    expect(used).toBe(900);
    expect(bouts).toBe(2);
  });

  it('clips counted bout seconds to the cap', () => {
    expect(boutSecondsCounted({ usedBeforeS: 800, boutS: 600 })).toBe(100);
    expect(boutSecondsCounted({ usedBeforeS: 900, boutS: 600 })).toBe(0);
    expect(boutSecondsCounted({ usedBeforeS: 0, boutS: 300 })).toBe(300);
  });
});
