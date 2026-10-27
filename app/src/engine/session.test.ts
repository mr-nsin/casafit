import { restrictionsFor } from './catalogue';
import {
  addExercise,
  applyIntensity,
  budgetStatus,
  buildSession,
  currentIntensity,
  musclesWorked,
  pickerOptions,
  rebuildCooldown,
  removeExercise,
  sameMuscleRun,
  shortenRestToFit,
  suggestReplacement,
  swapExercise,
  toQuietSession,
  withBudget,
} from './session';
import { fixtureExercise } from './testing/fixtures';
import { index } from './testing/helpers';
import { buildTimeline, totalS } from './timeline';
import { EngineError, type PlanStep, type SessionPlan } from './types';

const none = restrictionsFor({ painAreas: [], healthFlags: [] });

function make(over: Partial<Parameters<typeof buildSession>[0]> = {}): SessionPlan {
  return buildSession({ id: 's1', style: 'normal', focus: 'full', level: 1, restrictions: none, seed: 5, ...over }, index);
}

/** A session with chosen work moves, for exact cool-down tests. */
function withWork(ids: string[], style: 'normal' | 'yoga' | 'dance' = 'normal'): SessionPlan {
  const base = make({ style });
  const work: PlanStep[] = ids.map((id, i) => {
    const ex = fixtureExercise(id);
    const proto = base.steps.find((s) => s.phase === 'work') as PlanStep;
    return { ...proto, id: `work-${i}`, exerciseId: ex.id, name: ex.name, muscles: [...ex.muscles], mode: ex.mode, sides: ex.sides };
  });
  const s: SessionPlan = {
    ...base,
    steps: [...base.steps.filter((x) => x.phase === 'warmup'), ...work, ...base.steps.filter((x) => x.phase === 'cooldown')],
  };
  return rebuildCooldown(s, index);
}

const coolStretches = (s: SessionPlan) =>
  s.steps.filter((x) => x.phase === 'cooldown').flatMap((x) => x.stretches);

describe('buildSession', () => {
  it('builds 4 + 5 + 4 steps in order', () => {
    const s = make();
    expect(s.steps.map((x) => x.phase)).toEqual([
      ...Array(4).fill('warmup'),
      ...Array(5).fill('work'),
      ...Array(4).fill('cooldown'),
    ]);
    expect(totalS(s)).toBe(900);
    expect(s.budgetS).toBe(900);
  });

  it('is deterministic for the same seed and different for another', () => {
    const a = make({ seed: 7 });
    const b = make({ seed: 7 });
    expect(a).toEqual(b);
    const c = make({ seed: 8 });
    expect(c.steps.map((x) => x.exerciseId)).not.toEqual(a.steps.map((x) => x.exerciseId));
  });

  it('never repeats a move family in the work block', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const s = make({ seed });
      const fams = s.steps.filter((x) => x.phase === 'work').map((x) => index.byId.get(x.exerciseId)?.ladder);
      expect(new Set(fams).size).toBe(5);
    }
  });

  it('honours 3 and 8 work moves and rejects others', () => {
    expect(totalS(make({ workSlots: 3 }))).toBe(120 + 3 * 132 + 120);
    expect(totalS(make({ workSlots: 8 }))).toBe(120 + 8 * 132 + 120);
    expect(() => make({ workSlots: 2 })).toThrow(EngineError);
    expect(() => make({ workSlots: 9 })).toThrow(EngineError);
    expect(() => make({ workSlots: 4.5 })).toThrow(EngineError);
  });

  it('matches the work block to the focus', () => {
    const legs = make({ focus: 'legs', seed: 2 });
    const ex = legs.steps.filter((x) => x.phase === 'work').map((x) => index.byId.get(x.exerciseId));
    expect(ex.filter((e) => e?.pattern === 'legs').length).toBeGreaterThanOrEqual(3);
    const push = make({ focus: 'push', seed: 2 });
    const px = push.steps.filter((x) => x.phase === 'work').map((x) => index.byId.get(x.exerciseId));
    expect(px.filter((e) => e?.pattern === 'push').length).toBeGreaterThanOrEqual(3);
  });

  it('puts at least three of five moves on the chosen parts', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const s = make({ focus: 'parts', parts: ['core', 'glutes'], seed });
      const hits = s.steps.filter((x) => x.phase === 'work' && (x.muscles.includes('core') || x.muscles.includes('glutes')));
      expect(hits.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('titles sessions plainly', () => {
    expect(make({ focus: 'parts', parts: ['core', 'glutes'] }).title).toBe('Core + Glutes 15');
    expect(make({ focus: 'full' }).title).toBe('Full body 15');
    expect(make({ style: 'yoga' }).title).toBe('Yoga flow 15');
    expect(make({ style: 'dance' }).title).toBe('Dance cardio 15');
  });

  it('starts new users on easier rungs than regular users', () => {
    const lvl = (level: number) =>
      make({ level, seed: 3, focus: 'full' })
        .steps.filter((x) => x.phase === 'work')
        .reduce((a, x) => a + (index.byId.get(x.exerciseId)?.level ?? 0), 0);
    expect(lvl(0)).toBeLessThan(lvl(3));
  });

  it('caps the ladder for the gentler plan', () => {
    const r = restrictionsFor({ painAreas: [], healthFlags: ['heart_bp'] });
    for (let seed = 0; seed < 20; seed += 1) {
      const s = make({ level: 3, restrictions: r, seed });
      for (const st of s.steps.filter((x) => x.phase === 'work')) {
        expect(index.byId.get(st.exerciseId)?.level).toBeLessThanOrEqual(1);
      }
    }
  });

  it('records the exclusions that applied', () => {
    const r = restrictionsFor({ painAreas: ['knees'], healthFlags: [] });
    const s = make({ restrictions: r });
    expect(s.exclusions.some((e) => e.exerciseId === 'lunge' && e.reason === 'knees')).toBe(true);
    expect(s.steps.some((x) => x.exerciseId === 'lunge')).toBe(false);
  });

  it('throws a typed error when the catalogue is too small', () => {
    const tiny = { all: index.all.filter((e) => e.phase !== 'work'), byId: index.byId, byLadder: index.byLadder };
    try {
      buildSession({ id: 'x', style: 'normal', focus: 'full', level: 0, restrictions: none, seed: 1 }, tiny);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as EngineError).code).toBe('catalogue_too_small');
    }
  });

  it('avoids the same primary muscle three times in a row', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      for (const focus of ['push', 'pull', 'core', 'legs'] as const) {
        const s = make({ focus, seed });
        expect(sameMuscleRun(s)).toBeNull();
      }
    }
  });
});

describe('cool-down rebuild', () => {
  it('stretches what was worked', () => {
    const s = withWork(['pushup', 'squat', 'plank', 'towel-row', 'bridge-march']);
    expect(coolStretches(s)).toEqual(expect.arrayContaining(['chest']));
  });

  it('drops chest and shoulder stretches when the last pushing move goes', () => {
    const s = withWork(['pushup', 'chair-squat', 'standing-oblique-crunch', 'calf-raise', 'lateral-walk']);
    const before = coolStretches(s);
    expect(before).toContain('chest');
    const idx = s.steps.find((x) => x.exerciseId === 'pushup') as PlanStep;
    // Replace the only pusher with a legs move through the editor, then check the cool-down.
    const swapped = swapExercise(s, idx.id, 'wall-sit', index);
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    const after = coolStretches(swapped.session);
    expect(after).not.toContain('chest');
    expect(after).not.toContain('shoulders');
    expect(swapped.session.steps.filter((x) => x.phase === 'cooldown')).toHaveLength(4);
  });

  it('uses generic moves before off-target stretches', () => {
    const s = withWork(['chair-squat', 'wall-sit', 'calf-raise', 'lateral-walk', 'single-calf-raise']);
    const worked = new Set(musclesWorked(s));
    for (const st of s.steps.filter((x) => x.phase === 'cooldown')) {
      for (const m of st.stretches) expect(worked.has(m)).toBe(true);
    }
  });

  it('keeps the cool-down at 2:00 whatever the work block', () => {
    const s = withWork(['pushup', 'pike-hold', 'chair-dip', 'plank', 'standing-shoulder-tap']);
    expect(s.steps.filter((x) => x.phase === 'cooldown').reduce((a, x) => a + x.workS, 0)).toBe(120);
    expect(totalS(s)).toBe(900);
  });

  it('respects pain exclusions when rebuilding', () => {
    const r = restrictionsFor({ painAreas: ['knees'], healthFlags: [] });
    const s = rebuildCooldown(make({ restrictions: r, focus: 'legs' }), index);
    for (const st of s.steps.filter((x) => x.phase === 'cooldown')) {
      expect(index.byId.get(st.exerciseId)?.contraindications).not.toContain('knees');
    }
  });

  it('is stable: rebuilding twice gives the same result', () => {
    const s = make();
    expect(rebuildCooldown(s, index)).toEqual(rebuildCooldown(rebuildCooldown(s, index), index));
  });
});

describe('editor', () => {
  it('adds a move for +2:12 and rebuilds the cool-down', () => {
    const s = make();
    const opt = pickerOptions(s, index, { style: 'normal' })[0];
    expect(opt?.addsS).toBe(132);
    const r = addExercise(s, opt?.exercise.id ?? '', index);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.deltaS).toBe(132);
    expect(r.totalS).toBe(1032);
    expect(buildTimeline(r.session).totalS).toBe(1032);
    expect(r.session.steps.filter((x) => x.phase === 'work')).toHaveLength(6);
    expect(r.session.steps.filter((x) => x.phase === 'cooldown')).toHaveLength(4);
    expect(budgetStatus(r.session).overByS).toBe(132);
  });

  it('removes a move for -2:12', () => {
    const s = make();
    const target = s.steps.find((x) => x.phase === 'work') as PlanStep;
    const r = removeExercise(s, target.id, index);
    expect(r.ok && r.deltaS).toBe(-132);
    expect(r.ok && r.totalS).toBe(768);
    expect(r.ok && budgetStatus(r.session).underByS).toBe(132);
  });

  it('keeps the minimum of 3 and the maximum of 8', () => {
    let s = make();
    for (let i = 0; i < 2; i += 1) {
      const r = removeExercise(s, (s.steps.find((x) => x.phase === 'work') as PlanStep).id, index);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.session;
    }
    expect(s.steps.filter((x) => x.phase === 'work')).toHaveLength(3);
    const blocked = removeExercise(s, (s.steps.find((x) => x.phase === 'work') as PlanStep).id, index);
    expect(blocked).toEqual({ ok: false, reason: 'min_work' });

    s = make();
    for (let i = 0; i < 3; i += 1) {
      const r = addExercise(s, pickerOptions(s, index)[0]?.exercise.id ?? '', index);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.session;
    }
    expect(s.steps.filter((x) => x.phase === 'work')).toHaveLength(8);
    expect(addExercise(s, pickerOptions(s, index)[0]?.exercise.id ?? '', index)).toEqual({ ok: false, reason: 'max_work' });
    expect(totalS(s)).toBe(120 + 8 * 132 + 120);
  });

  it('refuses unknown, duplicate, excluded and non-work moves', () => {
    const s = make({ restrictions: restrictionsFor({ painAreas: ['knees'], healthFlags: [] }) });
    expect(addExercise(s, 'nope', index)).toEqual({ ok: false, reason: 'unknown_exercise' });
    expect(addExercise(s, 'lunge', index)).toEqual({ ok: false, reason: 'excluded' });
    expect(addExercise(s, 'wu-march', index)).toEqual({ ok: false, reason: 'not_work_move' });
    const have = (s.steps.find((x) => x.phase === 'work') as PlanStep).exerciseId;
    expect(addExercise(s, have, index)).toEqual({ ok: false, reason: 'duplicate' });
    expect(removeExercise(s, 'zzz', index)).toEqual({ ok: false, reason: 'unknown_step' });
    expect(removeExercise(s, 'warm-0', index)).toEqual({ ok: false, reason: 'not_work_move' });
  });

  it('gives a new move the intensity most moves are on', () => {
    const s = applyIntensity(make(), 1);
    expect(currentIntensity(s)).toBe(1);
    const r = addExercise(s, pickerOptions(s, index)[0]?.exercise.id ?? '', index);
    expect(r.ok && r.session.steps.filter((x) => x.phase === 'work').pop()?.rung).toBe(1);
  });

  it('swaps a move in place without changing the total', () => {
    const s = make();
    const target = s.steps.find((x) => x.phase === 'work') as PlanStep;
    const to = pickerOptions(s, index, { style: 'normal' })[0]?.exercise.id ?? '';
    const r = swapExercise(s, target.id, to, index);
    expect(r.ok && r.deltaS).toBe(0);
    expect(r.ok && r.session.steps.some((x) => x.id === target.id && x.exerciseId === to)).toBe(true);
  });

  it('suggests one replacement that is not already in the session and is allowed', () => {
    const r = restrictionsFor({ painAreas: ['wrists'], healthFlags: [] });
    const s = make({ restrictions: r });
    const removed = s.steps.find((x) => x.phase === 'work') as PlanStep;
    const rep = suggestReplacement(s, removed, index);
    expect(rep).not.toBeNull();
    expect(rep?.contraindications).not.toContain('wrists');
    expect(s.steps.some((x) => x.exerciseId === rep?.id)).toBe(false);
  });

  it('lists picker options that are allowed and filtered', () => {
    const r = restrictionsFor({ painAreas: [], healthFlags: ['pregnancy'] });
    const s = make({ restrictions: r });
    const opts = pickerOptions(s, index, { parts: ['core'], style: 'normal' });
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) {
      expect(o.exercise.muscles).toContain('core');
      expect(o.exercise.contraindications).not.toContain('pregnancy');
      expect(o.exercise.hiit).toBe(false);
    }
  });

  it('warns about three of the same muscle in a row', () => {
    const s = withWork(['chair-squat', 'wall-sit', 'calf-raise', 'plank', 'towel-row']);
    expect(sameMuscleRun(s)).toBe('legs');
    expect(sameMuscleRun(make())).toBeNull();
  });
});

describe('intensity and budget', () => {
  it('changes work and rest but not the total', () => {
    const s = make();
    for (const rung of [-1, 1, 0, 1, -1] as const) {
      const n = applyIntensity(s, rung);
      expect(totalS(n)).toBe(900);
      expect(n.steps.filter((x) => x.phase === 'work').every((x) => x.rung === rung)).toBe(true);
    }
  });

  it('applies from a step onward only', () => {
    const s = make();
    const from = s.steps.findIndex((x) => x.phase === 'work') + 2;
    const n = applyIntensity(s, 1, from);
    const rungs = n.steps.filter((x) => x.phase === 'work').map((x) => x.rung);
    expect(rungs).toEqual([0, 0, 1, 1, 1]);
  });

  it('reports over and under budget and the three fixes', () => {
    const s = make();
    expect(budgetStatus(s)).toMatchObject({ overByS: 0, underByS: 0, fixes: [] });
    const r = addExercise(s, pickerOptions(s, index)[0]?.exercise.id ?? '', index);
    if (!r.ok) throw new Error('add failed');
    expect(budgetStatus(r.session).fixes).toEqual(['shorten_rest', 'replace_exercise', 'extend_budget']);
    expect(budgetStatus(withBudget(r.session, 1032)).overByS).toBe(0);
  });

  it('shortens rest to fit but never below 10 s', () => {
    // At the easier rung (30 s rest) there is 20 s of slack per set to give back.
    const s = applyIntensity(make(), -1);
    const r = addExercise(s, pickerOptions(s, index)[0]?.exercise.id ?? '', index);
    if (!r.ok) throw new Error('add failed');
    const fit = shortenRestToFit(r.session);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    expect(totalS(fit.session)).toBeLessThanOrEqual(900);
    expect(totalS(fit.session)).toBeGreaterThanOrEqual(899);
    for (const st of fit.session.steps.filter((x) => x.phase === 'work')) expect(st.restS).toBeGreaterThanOrEqual(10);
  });

  it('says so when rest alone cannot make it fit', () => {
    let s = make();
    for (let i = 0; i < 3; i += 1) {
      const r = addExercise(s, pickerOptions(s, index)[0]?.exercise.id ?? '', index);
      if (r.ok) s = r.session;
    }
    const fit = shortenRestToFit(s);
    expect(fit.ok).toBe(false);
    if (!fit.ok) expect(fit.stillOverByS).toBeGreaterThan(0);
  });

  it('leaves a session that already fits alone', () => {
    const s = make();
    const fit = shortenRestToFit(s);
    expect(fit.ok && fit.session).toBe(s);
  });
});

describe('quiet mode', () => {
  it('swaps jumping and high-impact moves and keeps 15:00', () => {
    let swapped = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      const s = make({ level: 3, seed, focus: 'cardio' });
      const q = toQuietSession(s, index);
      expect(totalS(q.session)).toBe(900);
      for (const st of q.session.steps) {
        const ex = index.byId.get(st.exerciseId);
        if (!q.unresolved.includes(st.id)) {
          expect(ex?.jumping).toBe(false);
          expect(ex?.impact).not.toBe('high');
        }
      }
      if (q.session.steps.some((st, i) => st.exerciseId !== s.steps[i]?.exerciseId)) swapped += 1;
    }
    expect(swapped).toBeGreaterThan(0);
  });

  it('prefers the catalogue low-impact alternative', () => {
    const s = withWork(['jumping-jack', 'jump-squat', 'chair-squat', 'standing-oblique-crunch', 'calf-raise']);
    const q = toQuietSession(s, index);
    expect(q.session.steps.some((x) => x.exerciseId === 'step-jack')).toBe(true);
    expect(q.session.restrictions.quiet).toBe(true);
  });
});
