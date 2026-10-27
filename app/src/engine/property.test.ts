import { restrictionsFor } from './catalogue';
import { buildPlan } from './plan';
import { createRng } from './rng';
import {
  addExercise,
  applyIntensity,
  buildSession,
  pickerOptions,
  removeExercise,
  sameMuscleRun,
  toQuietSession,
} from './session';
import { index, randomInput } from './testing/helpers';
import { buildTimeline, canonicalProblems, setKey, totalS } from './timeline';
import { STYLES, type Focus, type Rung, type SessionPlan, type Style } from './types';

/**
 * Property-style tests: many seeds and inputs, one invariant each. The main one is the
 * promise of the whole app: every generated session is exactly 15:00.
 */
const PLAN_RUNS = 400;
const RUNGS: Rung[] = [-1, 0, 1];

function allSessions(seed: number): { sessions: SessionPlan[]; gentler: boolean } {
  const input = randomInput(seed);
  const plan = buildPlan(input, index);
  return { sessions: plan.days.flatMap((d) => (d.session ? [d.session] : [])), gentler: plan.variant === 'gentler' };
}

describe('every generated session totals exactly 15:00', () => {
  it(`holds across ${PLAN_RUNS} random plans`, () => {
    let checked = 0;
    for (let seed = 1; seed <= PLAN_RUNS; seed += 1) {
      const input = randomInput(seed);
      const plan = buildPlan(input, index);
      const sessions = plan.days.flatMap((d) => (d.session ? [d.session] : []));
      expect(sessions).toHaveLength(Math.max(3, Math.min(7, input.daysPerWeek)));
      for (const s of sessions) {
        const t = buildTimeline(s);
        if (t.totalS !== 900 || totalS(s) !== 900) throw new Error(`seed ${seed} ${s.id}: ${t.totalS}`);
        expect([t.warmupS, t.workS, t.cooldownS]).toEqual([120, 660, 120]);
        expect(canonicalProblems(s)).toEqual([]);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(PLAN_RUNS * 3 - 1);
  });

  it('holds for every style, focus, level and intensity', () => {
    const focuses: Focus[] = ['push', 'pull', 'legs', 'core', 'cardio', 'full', 'parts'];
    let n = 0;
    for (const style of STYLES) {
      for (const focus of focuses) {
        for (let level = 0; level <= 3; level += 1) {
          for (const rung of RUNGS) {
            for (let seed = 0; seed < 4; seed += 1) {
              const s = buildSession(
                {
                  id: `p${n}`,
                  style,
                  focus,
                  parts: focus === 'parts' ? ['arms', 'back'] : undefined,
                  level,
                  intensity: rung,
                  restrictions: restrictionsFor({ painAreas: [], healthFlags: [] }),
                  seed,
                },
                index,
              );
              n += 1;
              expect(buildTimeline(s).totalS).toBe(900);
            }
          }
        }
      }
    }
    expect(n).toBe(3 * 7 * 4 * 3 * 4);
  });

  it('holds whatever intensity changes happen, set by set', () => {
    const rng = createRng(99);
    for (let seed = 1; seed <= 150; seed += 1) {
      const { sessions } = allSessions(seed);
      for (const s of sessions) {
        const overrides: Record<string, Rung> = {};
        for (const st of s.steps) {
          for (let set = 1; set <= st.sets; set += 1) {
            if (rng() < 0.5) overrides[setKey(st.id, set)] = RUNGS[Math.floor(rng() * 3)] as Rung;
          }
        }
        expect(buildTimeline(s, { rungBySet: overrides }).totalS).toBe(900);
        for (const r of RUNGS) {
          const n = applyIntensity(s, r, Math.floor(rng() * s.steps.length));
          expect(totalS(n)).toBe(900);
          expect(canonicalProblems(n)).toEqual([]);
        }
      }
    }
  });

  it('holds in quiet mode', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const { sessions } = allSessions(seed);
      for (const s of sessions) {
        const q = toQuietSession(s, index);
        expect(totalS(q.session)).toBe(900);
        expect(canonicalProblems(q.session)).toEqual([]);
      }
    }
  });
});

describe('plan invariants over random inputs', () => {
  it('uses no move the user is excluded from, and no HIIT or jumping on the gentler plan', () => {
    for (let seed = 1; seed <= PLAN_RUNS; seed += 1) {
      const input = randomInput(seed);
      const plan = buildPlan(input, index);
      expect(plan.variant).toBe(input.healthFlags.length > 0 ? 'gentler' : 'standard');
      expect(plan.guards.hiit).toBe(input.healthFlags.length === 0);
      if (input.healthFlags.length > 0) expect(plan.guards.reverseWalk).toBe(false);
      for (const d of plan.days) {
        for (const st of d.session?.steps ?? []) {
          const ex = index.byId.get(st.exerciseId);
          expect(ex).toBeDefined();
          for (const c of ex?.contraindications ?? []) {
            expect(input.painAreas as readonly string[]).not.toContain(c);
            expect(input.healthFlags as readonly string[]).not.toContain(c);
          }
          if (plan.variant === 'gentler') {
            expect(ex?.hiit).toBe(false);
            expect(ex?.jumping).toBe(false);
            expect(ex?.impact).not.toBe('high');
          }
        }
      }
    }
  });

  it('never repeats a move in the work block, never runs three of a muscle, and keeps order', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const s of allSessions(seed).sessions) {
        const work = s.steps.filter((x) => x.phase === 'work');
        expect(new Set(work.map((x) => x.exerciseId)).size).toBe(5);
        // Only impossible when all five moves share one main muscle.
        if (new Set(work.map((x) => x.muscles[0])).size > 1) expect(sameMuscleRun(s)).toBeNull();
        expect(s.steps.map((x) => x.id).length).toBe(new Set(s.steps.map((x) => x.id)).size);
      }
    }
  });

  it('keeps the week shape: day 0 trains, days are consecutive, sessions match styles', () => {
    for (let seed = 1; seed <= PLAN_RUNS; seed += 1) {
      const input = randomInput(seed);
      const plan = buildPlan(input, index);
      expect(plan.days[0]?.kind).toBe('training');
      expect(plan.days).toHaveLength(7);
      for (const d of plan.days) {
        if (d.kind === 'training') {
          expect(input.styles).toContain(d.style as Style);
          expect(d.session?.style).toBe(d.style);
          expect(d.title).toBe(d.session?.title);
        } else expect(d.session).toBeNull();
      }
      if (input.goal === 'body_part') {
        const n = plan.days.filter((d) => d.session).length;
        const targeted = plan.days.filter((d) => d.focus === 'parts').length;
        expect(targeted).toBe(Math.max(1, Math.min(n, Math.round(n * 0.6))));
      }
    }
  });

  it('is repeatable', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const input = randomInput(seed);
      expect(buildPlan(input, index)).toEqual(buildPlan(input, index));
    }
  });
});

describe('editing keeps the arithmetic', () => {
  it('changes the total by exactly 2:12 per move, within 3 to 8 moves', () => {
    const rng = createRng(2026);
    for (let seed = 1; seed <= 120; seed += 1) {
      const { sessions } = allSessions(seed);
      let s = sessions[Math.floor(rng() * sessions.length)] as SessionPlan;
      for (let i = 0; i < 25; i += 1) {
        const before = totalS(s);
        const work = s.steps.filter((x) => x.phase === 'work');
        if (rng() < 0.5) {
          const opts = pickerOptions(s, index);
          const pick = opts[Math.floor(rng() * opts.length)];
          const r = addExercise(s, pick?.exercise.id ?? '', index);
          if (work.length >= 8) expect(r).toEqual({ ok: false, reason: 'max_work' });
          else {
            expect(r.ok).toBe(true);
            if (r.ok) {
              expect(r.deltaS).toBe(132);
              expect(totalS(r.session)).toBe(before + 132);
              s = r.session;
            }
          }
        } else {
          const target = work[Math.floor(rng() * work.length)];
          const r = removeExercise(s, target?.id ?? '', index);
          if (work.length <= 3) expect(r).toEqual({ ok: false, reason: 'min_work' });
          else {
            expect(r.ok).toBe(true);
            if (r.ok) {
              expect(r.deltaS).toBe(-132);
              s = r.session;
            }
          }
        }
        const count = s.steps.filter((x) => x.phase === 'work').length;
        expect(count).toBeGreaterThanOrEqual(3);
        expect(count).toBeLessThanOrEqual(8);
        expect(totalS(s)).toBe(120 + count * 132 + 120);
        expect(buildTimeline(s).totalS).toBe(totalS(s));
        expect(s.steps.filter((x) => x.phase === 'cooldown')).toHaveLength(4);
        expect(canonicalProblems(s)).toEqual([]);
      }
    }
  });

  it('keeps cool-down stretches on worked muscles whenever a generic move can fill the gap', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      for (const s of allSessions(seed).sessions) {
        const worked = new Set(s.steps.filter((x) => x.phase === 'work').flatMap((x) => x.muscles));
        const cool = s.steps.filter((x) => x.phase === 'cooldown');
        const offTarget = cool.flatMap((x) => x.stretches).filter((m) => !worked.has(m));
        // Off-target stretches are a last resort; the fixture has plenty of generic moves.
        expect(offTarget.length).toBeLessThanOrEqual(1);
      }
    }
  });
});
