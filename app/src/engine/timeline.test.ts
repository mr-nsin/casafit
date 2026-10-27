import { addDays, diffDays, formatDate, formatMmSs, localDateKey, parseDate } from './dates';
import { buildPlan } from './plan';
import { applyIntensity, buildSession } from './session';
import { baseInput, index } from './testing/helpers';
import {
  COOLDOWN_S,
  DEFAULT_BUDGET_S,
  SLOT_S,
  WARMUP_S,
  buildTimeline,
  canonicalProblems,
  intensityTiming,
  phaseS,
  setKey,
  stepDurationS,
  totalS,
} from './timeline';
import { restrictionsFor } from './catalogue';
import type { Rung, SessionPlan, Style } from './types';

const none = restrictionsFor({ painAreas: [], healthFlags: [] });

function make(style: Style = 'normal', over: Partial<Parameters<typeof buildSession>[0]> = {}): SessionPlan {
  return buildSession({ id: 's1', style, focus: 'full', level: 1, restrictions: none, seed: 3, ...over }, index);
}

describe('D1 constants', () => {
  it('adds up to 15:00', () => {
    expect(WARMUP_S).toBe(120);
    expect(COOLDOWN_S).toBe(120);
    expect(SLOT_S).toBe(132);
    expect(5 * SLOT_S).toBe(660);
    expect(DEFAULT_BUDGET_S).toBe(900);
  });

  it('keeps work + rest at 60 s at every intensity and mode', () => {
    for (const mode of ['timed', 'hold', 'reps', 'routine_step'] as const) {
      for (const rung of [-1, 0, 1] as Rung[]) {
        const t = intensityTiming(mode, rung);
        expect(t.workS + t.restS).toBe(60);
      }
    }
  });

  it('uses 30/30, 40/20 and 45/15 for timed work', () => {
    expect(intensityTiming('timed', -1)).toEqual({ workS: 30, restS: 30 });
    expect(intensityTiming('timed', 0)).toEqual({ workS: 40, restS: 20 });
    expect(intensityTiming('timed', 1)).toEqual({ workS: 45, restS: 15 });
  });

  it('shifts holds by 10 s and leaves dance routines alone', () => {
    expect(intensityTiming('hold', -1).workS).toBe(20);
    expect(intensityTiming('hold', 0).workS).toBe(30);
    expect(intensityTiming('hold', 1).workS).toBe(40);
    expect(intensityTiming('routine_step', -1)).toEqual(intensityTiming('routine_step', 1));
  });
});

describe('buildTimeline', () => {
  it.each(['normal', 'yoga', 'dance'] as Style[])('totals exactly 15:00 for a %s session', (style) => {
    const s = make(style);
    const t = buildTimeline(s);
    expect(t.totalS).toBe(900);
    expect(totalS(s)).toBe(900);
    expect(t.warmupS).toBe(120);
    expect(t.workS).toBe(660);
    expect(t.cooldownS).toBe(120);
    expect(canonicalProblems(s)).toEqual([]);
  });

  it.each([-1, 0, 1] as Rung[])('totals 15:00 at rung %i', (rung) => {
    const s = applyIntensity(make('normal'), rung);
    expect(buildTimeline(s).totalS).toBe(900);
    expect(canonicalProblems(s)).toEqual([]);
  });

  it('has contiguous segments that start at 0 and sum to the total', () => {
    const t = buildTimeline(make());
    let at = 0;
    for (const seg of t.segments) {
      expect(seg.startS).toBe(at);
      expect(seg.durationS).toBeGreaterThan(0);
      expect(seg.endS).toBe(seg.startS + seg.durationS);
      at = seg.endS;
    }
    expect(at).toBe(t.totalS);
    expect(t.segments.map((x) => x.index)).toEqual(t.segments.map((_, i) => i));
  });

  it('puts a 12 s transition before each work move and none before warm-up or cool-down', () => {
    const t = buildTimeline(make());
    const transitions = t.segments.filter((x) => x.kind === 'transition');
    expect(transitions).toHaveLength(5);
    expect(transitions.every((x) => x.durationS === 12 && x.phase === 'work')).toBe(true);
    expect(t.segments[0]?.phase).toBe('warmup');
    expect(t.segments[0]?.kind).toBe('work');
  });

  it('runs two sets of work then rest for each work move', () => {
    const s = make();
    const t = buildTimeline(s);
    const firstWork = s.steps.findIndex((x) => x.phase === 'work');
    const segs = t.segments.filter((x) => x.stepIndex === firstWork);
    expect(segs.map((x) => x.kind)).toEqual(['transition', 'work', 'rest', 'work', 'rest']);
    expect(segs.reduce((a, x) => a + x.durationS, 0)).toBe(132);
  });

  it('does cool-down and warm-up steps as one 30 s block each', () => {
    const t = buildTimeline(make());
    const warm = t.segments.filter((x) => x.phase === 'warmup');
    expect(warm).toHaveLength(4);
    expect(warm.every((x) => x.durationS === 30 && x.kind === 'work')).toBe(true);
    const cool = t.segments.filter((x) => x.phase === 'cooldown');
    expect(cool).toHaveLength(4);
  });

  it('does a two-sided move right then left, using its two sets', () => {
    const s = make();
    const target = s.steps.find((x) => x.phase === 'work');
    const withSides: SessionPlan = {
      ...s,
      steps: s.steps.map((x) => (x.id === target?.id ? { ...x, sides: 'each' as const } : x)),
    };
    const segs = buildTimeline(withSides).segments.filter((x) => x.stepId === target?.id && x.kind === 'work');
    expect(segs.map((x) => x.side)).toEqual(['R', 'L']);
    expect(segs.map((x) => x.set)).toEqual([1, 2]);
    expect(buildTimeline(withSides).totalS).toBe(900);
  });

  it('leaves the total alone when intensity changes between sets', () => {
    const s = make();
    const work = s.steps.filter((x) => x.phase === 'work');
    const overrides: Record<string, Rung> = {};
    work.forEach((x, i) => {
      overrides[setKey(x.id, 1)] = ([-1, 1, 0] as Rung[])[i % 3] as Rung;
      overrides[setKey(x.id, 2)] = ([1, -1, 1] as Rung[])[i % 3] as Rung;
    });
    const t = buildTimeline(s, { rungBySet: overrides });
    expect(t.totalS).toBe(900);
    const first = t.segments.find((x) => x.stepId === work[0]?.id && x.kind === 'work' && x.set === 1);
    expect(first?.durationS).toBe(intensityTiming(work[0]?.mode ?? 'timed', -1).workS);
  });

  it('ignores overrides on warm-up and cool-down', () => {
    const s = make();
    const warm = s.steps[0];
    const t = buildTimeline(s, { rungBySet: { [setKey(warm?.id ?? '', 1)]: 1 } });
    expect(t.totalS).toBe(900);
    expect(t.segments[0]?.durationS).toBe(30);
  });

  it('reports step durations', () => {
    const s = make();
    expect(s.steps.filter((x) => x.phase === 'work').every((x) => stepDurationS(x) === 132)).toBe(true);
    expect(phaseS(s, 'warmup')).toBe(120);
  });

  it('is exactly 900 s for a built plan, every training day', () => {
    const plan = buildPlan(baseInput({ daysPerWeek: 5, styles: ['normal', 'yoga', 'dance'] }), index);
    for (const d of plan.days) if (d.session) expect(buildTimeline(d.session).totalS).toBe(900);
  });
});

describe('time and date helpers', () => {
  it('formats mm:ss', () => {
    expect(formatMmSs(900)).toBe('15:00');
    expect(formatMmSs(132)).toBe('2:12');
    expect(formatMmSs(5)).toBe('0:05');
    expect(formatMmSs(-3)).toBe('0:00');
  });

  it('does day arithmetic across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-10-20', '2026-10-27')).toBe(7);
    expect(diffDays('2026-10-27', '2026-10-20')).toBe(-7);
    expect(formatDate(parseDate('2026-01-05'))).toBe('2026-01-05');
    expect(() => parseDate('27/10/2026')).toThrow();
  });

  it('turns an instant into a local date', () => {
    const t = Date.UTC(2026, 9, 27, 20, 0, 0);
    expect(localDateKey(t, 330)).toBe('2026-10-28');
    expect(localDateKey(t, 0)).toBe('2026-10-27');
  });
});
