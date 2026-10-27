import { skippedMoves } from './catalogue';
import { addDays } from './dates';
import {
  allocateStyles,
  buildPlan,
  comebackInput,
  isLapsed,
  ladderLevel,
  orderStyles,
  sessionDayOffsets,
  toServerPlan,
  type Plan,
} from './plan';
import { baseInput, index } from './testing/helpers';
import { totalS } from './timeline';
import type { HealthFlag, PainArea, SessionPlan, Style } from './types';

const sessions = (p: Plan): SessionPlan[] => p.days.flatMap((d) => (d.session ? [d.session] : []));
const exerciseIds = (p: Plan) => sessions(p).flatMap((s) => s.steps.map((x) => x.exerciseId));
const workIds = (p: Plan) => sessions(p).flatMap((s) => s.steps.filter((x) => x.phase === 'work').map((x) => x.exerciseId));

describe('week layout', () => {
  it.each([3, 4, 5, 6, 7])('fills %i training days and gives the rest to walking or stretching', (n) => {
    const p = buildPlan(baseInput({ daysPerWeek: n }), index);
    expect(p.days).toHaveLength(7);
    expect(p.days.filter((d) => d.kind === 'training')).toHaveLength(n);
    const rest = p.days.filter((d) => d.kind === 'rest');
    expect(rest).toHaveLength(7 - n);
    expect(rest.every((d) => d.restSuggestion === 'walk' || d.restSuggestion === 'stretch')).toBe(true);
    expect(rest.every((d) => d.session === null)).toBe(true);
  });

  it('starts today and rolls seven days from the start date (D19)', () => {
    const p = buildPlan(baseInput({ startDate: '2026-12-29' }), index);
    expect(p.days[0]?.kind).toBe('training');
    expect(p.days.map((d) => d.date)).toEqual([
      '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04',
    ]);
    expect(p.days.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('spreads sessions evenly', () => {
    expect(sessionDayOffsets(3)).toEqual([0, 2, 4]);
    expect(sessionDayOffsets(4)).toEqual([0, 1, 3, 5]);
    expect(sessionDayOffsets(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (let n = 1; n <= 7; n += 1) {
      const o = sessionDayOffsets(n);
      expect(o).toHaveLength(n);
      expect(o[0]).toBe(0);
      expect(new Set(o).size).toBe(n);
      expect(Math.max(...o)).toBeLessThanOrEqual(6);
    }
  });

  it('alternates walk and stretch on rest days', () => {
    const p = buildPlan(baseInput({ daysPerWeek: 3 }), index);
    const kinds = p.days.filter((d) => d.kind === 'rest').map((d) => d.restSuggestion);
    expect(kinds).toEqual(['walk', 'stretch', 'walk', 'stretch']);
  });

  it('clamps days per week to 3..7', () => {
    expect(buildPlan(baseInput({ daysPerWeek: 1 }), index).days.filter((d) => d.session)).toHaveLength(3);
    expect(buildPlan(baseInput({ daysPerWeek: 12 }), index).days.filter((d) => d.session)).toHaveLength(7);
  });

  it('is deterministic for the same input, and the seed changes the picks', () => {
    expect(buildPlan(baseInput(), index)).toEqual(buildPlan(baseInput(), index));
    const a = workIds(buildPlan(baseInput({ seed: 1 }), index));
    const b = workIds(buildPlan(baseInput({ seed: 2 }), index));
    expect(a).not.toEqual(b);
  });

  it('accepts a prebuilt index or a raw catalogue', () => {
    const p = buildPlan(baseInput(), { exercises: index.all });
    expect(p.days.filter((d) => d.session)).toHaveLength(4);
  });
});

describe('styles', () => {
  it('splits days equally, extras to normal then dance then yoga', () => {
    expect(allocateStyles(['normal', 'yoga', 'dance'], 4)).toEqual({ normal: 2, dance: 1, yoga: 1 });
    expect(allocateStyles(['normal', 'yoga', 'dance'], 6)).toEqual({ normal: 2, dance: 2, yoga: 2 });
    expect(allocateStyles(['yoga', 'dance'], 5)).toEqual({ normal: 0, dance: 3, yoga: 2 });
    expect(allocateStyles(['yoga'], 4)).toEqual({ normal: 0, dance: 0, yoga: 4 });
    expect(allocateStyles(['normal', 'yoga', 'dance'], 7)).toEqual({ normal: 3, dance: 2, yoga: 2 });
  });

  it('uses the customised mix when it adds up', () => {
    expect(allocateStyles(['normal', 'yoga', 'dance'], 4, { normal: 3, yoga: 1, dance: 0 })).toEqual({
      normal: 3, dance: 0, yoga: 1,
    });
  });

  it('ignores a mix that does not add up, uses an unchosen style, or has bad counts', () => {
    const equal = { normal: 2, dance: 1, yoga: 1 };
    expect(allocateStyles(['normal', 'yoga', 'dance'], 4, { normal: 3, yoga: 3 })).toEqual(equal);
    expect(allocateStyles(['normal', 'yoga'], 4, { normal: 2, dance: 2 })).toEqual({ normal: 2, dance: 0, yoga: 2 });
    expect(allocateStyles(['normal', 'yoga', 'dance'], 4, { normal: 5, yoga: -1 })).toEqual(equal);
    expect(allocateStyles(['normal', 'yoga', 'dance'], 4, { normal: 1.5, yoga: 1.5, dance: 1 })).toEqual(equal);
  });

  it('needs at least one style', () => {
    expect(() => allocateStyles([], 4)).toThrow();
  });

  it('orders styles without back-to-back repeats where possible', () => {
    const order = orderStyles({ normal: 2, dance: 1, yoga: 1 });
    expect(order).toHaveLength(4);
    for (let i = 1; i < order.length; i += 1) expect(order[i]).not.toBe(order[i - 1]);
    expect(order.filter((s) => s === 'normal')).toHaveLength(2);
    expect(orderStyles({ normal: 3, dance: 0, yoga: 0 })).toEqual(['normal', 'normal', 'normal']);
  });

  it('puts the counts from the mix into the week', () => {
    const p = buildPlan(
      baseInput({ styles: ['normal', 'yoga', 'dance'], daysPerWeek: 5, mix: { normal: 3, yoga: 1, dance: 1 } }),
      index,
    );
    const count = (s: Style) => p.days.filter((d) => d.style === s).length;
    expect(count('normal')).toBe(3);
    expect(count('yoga')).toBe(1);
    expect(count('dance')).toBe(1);
    expect(p.days.find((d) => d.style === 'yoga')?.session?.style).toBe('yoga');
  });

  it('falls back to normal when no style is given', () => {
    const p = buildPlan(baseInput({ styles: [] }), index);
    expect(p.days.filter((d) => d.session).every((d) => d.style === 'normal')).toBe(true);
  });
});

describe('goal rules', () => {
  it('rotates full-body sessions with one cardio-led day for stay fit', () => {
    for (let n = 3; n <= 7; n += 1) {
      const p = buildPlan(baseInput({ daysPerWeek: n }), index);
      const f = p.days.filter((d) => d.session).map((d) => d.focus);
      expect(f.filter((x) => x === 'cardio')).toHaveLength(1);
      expect(f.filter((x) => x === 'parts')).toHaveLength(0);
    }
    const four = buildPlan(baseInput({ daysPerWeek: 4 }), index).days.filter((d) => d.session).map((d) => d.focus);
    expect(new Set(four).size).toBe(4);
  });

  it('keeps cardio off yoga days and skips it when every day is yoga', () => {
    const mixed = buildPlan(baseInput({ styles: ['normal', 'yoga'], daysPerWeek: 4 }), index);
    expect(mixed.days.find((d) => d.focus === 'cardio')?.style).not.toBe('yoga');
    const yoga = buildPlan(baseInput({ styles: ['yoga'], daysPerWeek: 4 }), index);
    expect(yoga.days.some((d) => d.focus === 'cardio')).toBe(false);
  });

  it.each([
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 4],
    [7, 4],
  ])('targets the chosen parts on about 60%% of %i days (%i sessions)', (n, expected) => {
    const p = buildPlan(baseInput({ goal: 'body_part', bodyParts: ['core', 'glutes'], daysPerWeek: n }), index);
    const targeted = p.days.filter((d) => d.focus === 'parts');
    expect(targeted).toHaveLength(expected);
    const others = p.days.filter((d) => d.session && d.focus !== 'parts');
    expect(others.every((d) => d.focus === 'full')).toBe(true);
    for (const d of targeted) {
      const hits = d.session?.steps.filter((x) => x.phase === 'work' && (x.muscles.includes('core') || x.muscles.includes('glutes')));
      expect(hits?.length).toBeGreaterThanOrEqual(3);
      expect(d.parts).toEqual(['core', 'glutes']);
    }
  });

  it('does not train the same muscles on consecutive days when the week allows it', () => {
    for (const n of [3, 4, 5, 7]) {
      const p = buildPlan(baseInput({ goal: 'body_part', bodyParts: ['legs'], daysPerWeek: n }), index);
      const days = p.days.filter((d) => d.focus === 'parts').map((d) => d.dayIndex);
      for (let i = 1; i < days.length; i += 1) expect((days[i] as number) - (days[i - 1] as number)).toBeGreaterThan(1);
    }
  });

  it('uses only the first two body parts', () => {
    const p = buildPlan(baseInput({ goal: 'body_part', bodyParts: ['arms', 'chest', 'back'] }), index);
    expect(p.days.find((d) => d.focus === 'parts')?.parts).toEqual(['arms', 'chest']);
  });

  it('explains itself in "why this plan" lines', () => {
    const p = buildPlan(
      baseInput({ goal: 'body_part', bodyParts: ['core', 'glutes'], painAreas: ['knees'], styles: ['normal', 'yoga'] }),
      index,
    );
    const kinds = p.why.map((w) => w.kind);
    expect(kinds).toEqual(expect.arrayContaining(['focus', 'days', 'experience', 'style', 'skip']));
    expect(p.why.find((w) => w.kind === 'focus')?.text).toContain('core and glutes');
    expect(p.why.find((w) => w.kind === 'days')?.text).toBe('4 days a week, 15 minutes each, with 3 rest days.');
    expect(p.why.find((w) => w.kind === 'skip')?.text).toMatch(/^Skipping .*because of your knees\.$/);
    expect(p.why.find((w) => w.kind === 'style')?.text).toBe('2 normal and 2 yoga.');
  });
});

describe('exclusions', () => {
  const pains: PainArea[] = ['knees', 'back', 'shoulders', 'wrists'];

  it.each(pains)('removes every move contraindicated for %s', (area) => {
    const p = buildPlan(baseInput({ painAreas: [area], styles: ['normal', 'yoga', 'dance'], daysPerWeek: 7 }), index);
    for (const id of exerciseIds(p)) expect(index.byId.get(id)?.contraindications).not.toContain(area);
  });

  it('skips lunges and says why for sore knees', () => {
    const p = buildPlan(baseInput({ painAreas: ['knees'], daysPerWeek: 7 }), index);
    expect(exerciseIds(p).some((id) => id.includes('lunge'))).toBe(false);
    const lunge = p.skipped.find((s) => s.name.toLowerCase().includes('lunge'));
    expect(lunge?.reason).toBe('knees');
    expect(p.variant).toBe('standard');
    expect(p.guards.hiit).toBe(true);
  });

  it('removes nothing for "other" pain, which names no area', () => {
    const p = buildPlan(baseInput({ painAreas: ['other'] }), index);
    expect(p.skipped).toEqual([]);
  });

  it('lists a family as skipped only when no rung of it is allowed', () => {
    const r = buildPlan(baseInput({ painAreas: ['knees'] }), index).restrictions;
    const names = skippedMoves(index, r, ['normal']).map((s) => s.exerciseId);
    expect(names).toContain('reverse-lunge');
    expect(names).not.toContain('squat');
  });

  it('removes the right moves for each health flag', () => {
    const p = buildPlan(baseInput({ healthFlags: ['pregnancy'], daysPerWeek: 7 }), index);
    for (const id of exerciseIds(p)) expect(index.byId.get(id)?.contraindications).not.toContain('pregnancy');
  });

  it('copes with every restriction at once', () => {
    const p = buildPlan(
      baseInput({
        painAreas: ['knees', 'back', 'shoulders', 'wrists'],
        healthFlags: ['heart_bp', 'pregnancy', 'recent_surgery'],
        styles: ['normal', 'yoga', 'dance'],
        daysPerWeek: 7,
      }),
      index,
    );
    expect(sessions(p)).toHaveLength(7);
    for (const s of sessions(p)) expect(totalS(s)).toBe(900);
  });
});

describe('gentler plan', () => {
  const flags: HealthFlag[] = ['heart_bp', 'pregnancy', 'recent_surgery'];

  it.each(flags)('routes %s to the gentler plan', (flag) => {
    const p = buildPlan(baseInput({ healthFlags: [flag] }), index);
    expect(p.variant).toBe('gentler');
    expect(p.restrictions.gentler).toBe(true);
    expect(p.why.some((w) => w.kind === 'gentler')).toBe(true);
  });

  it('disables HIIT, jumping and reverse walking', () => {
    const p = buildPlan(baseInput({ healthFlags: ['heart_bp'], styles: ['normal', 'yoga', 'dance'], daysPerWeek: 7, experience: 'regular' }), index);
    expect(p.guards).toEqual({ hiit: false, jumping: false, reverseWalk: false });
    for (const id of exerciseIds(p)) {
      const ex = index.byId.get(id);
      expect(ex?.hiit).toBe(false);
      expect(ex?.jumping).toBe(false);
      expect(ex?.impact).not.toBe('high');
    }
  });

  it('starts on low rungs even for a regular user', () => {
    const p = buildPlan(baseInput({ healthFlags: ['recent_surgery'], experience: 'regular', daysPerWeek: 7 }), index);
    for (const s of sessions(p)) {
      for (const st of s.steps.filter((x) => x.phase === 'work')) expect(index.byId.get(st.exerciseId)?.level).toBeLessThanOrEqual(1);
    }
  });

  it('keeps jumping and HIIT available to everyone else', () => {
    let seen = false;
    for (let seed = 0; seed < 25 && !seen; seed += 1) {
      const p = buildPlan(baseInput({ experience: 'regular', daysPerWeek: 7, seed }), index);
      seen = exerciseIds(p).some((id) => index.byId.get(id)?.hiit);
    }
    expect(seen).toBe(true);
    expect(buildPlan(baseInput(), index).guards).toEqual({ hiit: true, jumping: true, reverseWalk: true });
  });

  it('hides reverse walking at 60 and over, and with a balance concern', () => {
    expect(buildPlan(baseInput({ age: 60 }), index).guards.reverseWalk).toBe(false);
    expect(buildPlan(baseInput({ age: 59 }), index).guards.reverseWalk).toBe(true);
    expect(buildPlan(baseInput({ balanceConcern: true }), index).guards.reverseWalk).toBe(false);
  });

  it('sends the server only goal, styles, days, experience and variant (D3)', () => {
    const input = baseInput({ healthFlags: ['pregnancy'], painAreas: ['knees'], styles: ['normal', 'dance'] });
    const payload = toServerPlan(input, buildPlan(input, index));
    expect(payload).toEqual({
      goal: 'gentler',
      stylesBitmask: 5,
      daysPerWeek: 4,
      experience: 'on_and_off',
      variant: 'gentler',
    });
    expect(JSON.stringify(payload)).not.toMatch(/knees|pregnancy|painAreas|healthFlags/);
    const std = baseInput({ goal: 'body_part', bodyParts: ['core'], styles: ['yoga'], experience: null });
    expect(toServerPlan(std, buildPlan(std, index))).toMatchObject({ goal: 'body_part', stylesBitmask: 2, experience: 'new', variant: 'standard' });
  });
});

describe('difficulty ladder', () => {
  const total = (p: Plan) =>
    sessions(p).flatMap((s) => s.steps.filter((x) => x.phase === 'work')).reduce((a, x) => a + (index.byId.get(x.exerciseId)?.level ?? 0), 0);

  it('maps experience to a starting level', () => {
    expect(ladderLevel('new')).toBe(0);
    expect(ladderLevel('on_and_off')).toBe(1);
    expect(ladderLevel('regular')).toBe(2);
    expect(ladderLevel(null)).toBe(0);
  });

  it('moves up after easy weeks, down after hard ones, and stays put otherwise', () => {
    expect(ladderLevel('on_and_off', ['easy', 'easy'])).toBe(2);
    expect(ladderLevel('on_and_off', ['hard', 'hard'])).toBe(0);
    expect(ladderLevel('on_and_off', ['easy', 'hard'])).toBe(1);
    expect(ladderLevel('on_and_off', ['easy', 'about_right', 'easy', 'hard'])).toBe(2);
    expect(ladderLevel('on_and_off', ['easy'])).toBe(1);
    expect(ladderLevel('new', ['hard', 'hard'])).toBe(0);
    expect(ladderLevel('on_and_off', ['easy', 'easy'], -1)).toBe(1);
  });

  it('only looks at the last four sessions', () => {
    expect(ladderLevel('regular', ['easy', 'easy', 'easy', 'about_right', 'about_right', 'about_right', 'about_right'])).toBe(2);
  });

  it('gives harder moves to regular users than to new users', () => {
    const n = total(buildPlan(baseInput({ experience: 'new', daysPerWeek: 7 }), index));
    const r = total(buildPlan(baseInput({ experience: 'regular', daysPerWeek: 7 }), index));
    expect(r).toBeGreaterThan(n);
  });

  it('treats a skipped experience answer like new', () => {
    expect(buildPlan(baseInput({ experience: null }), index)).toEqual(buildPlan(baseInput({ experience: 'new' }), index));
  });

  it('lets easy weeks raise next week', () => {
    const base = total(buildPlan(baseInput({ daysPerWeek: 7 }), index));
    const up = total(buildPlan(baseInput({ daysPerWeek: 7, feltHistory: ['easy', 'easy', 'easy'] }), index));
    expect(up).toBeGreaterThan(base);
  });
});

describe('comeback (D14)', () => {
  it('is lapsed from seven days', () => {
    expect(isLapsed('2026-10-20', '2026-10-26')).toBe(false);
    expect(isLapsed('2026-10-20', '2026-10-27')).toBe(true);
    expect(isLapsed(null, '2026-10-27')).toBe(false);
    expect(isLapsed('2026-10-27', addDays('2026-10-27', 30))).toBe(true);
  });

  it('rebuilds one rung easier and a lighter week', () => {
    const input = baseInput({ daysPerWeek: 5, experience: 'regular' });
    const back = comebackInput(input);
    expect(back.daysPerWeek).toBe(4);
    expect(back.levelOffset).toBe(-1);
    expect(back.intensity).toBe(-1);
    expect(comebackInput(baseInput({ daysPerWeek: 3 })).daysPerWeek).toBe(3);
    const p = buildPlan(back, index);
    expect(p.days.filter((d) => d.session)).toHaveLength(4);
    for (const s of sessions(p)) {
      expect(totalS(s)).toBe(900);
      expect(s.steps.filter((x) => x.phase === 'work').every((x) => x.rung === -1)).toBe(true);
    }
  });
});
