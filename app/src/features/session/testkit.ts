// Test helpers: a fake clock, a D1-exact plan, an in-memory snapshot store and spies.
// The timeline builder mirrors engine buildTimeline (including per-set rung overrides) so
// store tests run without the engine lane; the engine's own tests cover the real one.

import { configureSessionDeps } from './deps';
import { useSessionStore } from './store';
import {
  setKey,
  type Cue,
  type PlanStep,
  type SessionDeps,
  type SessionLogRow,
  type SessionPlan,
  type SessionSnapshotRow,
  type Timeline,
  type TimelineOptions,
  type TimelineSegment,
} from './types';

export function createFakeClock(startMono = 1000, startWall = 1_700_000_000_000) {
  let mono = startMono;
  let wall = startWall;
  return {
    now: () => mono,
    wall: () => wall,
    advance(ms: number) {
      mono += ms;
      wall += ms;
    },
    /** Wall clock jumps (time zone, user change) without the monotonic clock moving. */
    jumpWall(ms: number) {
      wall += ms;
    },
  };
}

function timing(rung: -1 | 0 | 1): { w: number; r: number } {
  return rung === -1 ? { w: 30, r: 30 } : rung === 1 ? { w: 45, r: 15 } : { w: 40, r: 20 };
}

export function testBuildTimeline(plan: { steps: PlanStep[] }, opts: TimelineOptions = {}): Timeline {
  const segments: TimelineSegment[] = [];
  let t = 0;
  let warmupS = 0;
  let workS = 0;
  let cooldownS = 0;
  const push = (kind: TimelineSegment['kind'], st: PlanStep, i: number, set: number, side: 'R' | 'L' | null, d: number) => {
    if (d <= 0) return;
    segments.push({ index: segments.length, kind, phase: st.phase, stepIndex: i, stepId: st.id, set, side, startS: t, durationS: d, endS: t + d });
    t += d;
    if (st.phase === 'warmup') warmupS += d;
    else if (st.phase === 'work') workS += d;
    else cooldownS += d;
  };
  plan.steps.forEach((st, i) => {
    push('transition', st, i, 0, null, st.transitionS);
    for (let set = 1; set <= st.sets; set += 1) {
      let w = st.workS;
      let r = st.restS;
      const o = st.phase === 'work' ? opts.rungBySet?.[setKey(st.id, set)] : undefined;
      if (o !== undefined) {
        const tm = timing(o);
        w = tm.w;
        r = tm.r;
      }
      const side = st.sides === 'each' ? (set === 1 ? 'R' : 'L') : null;
      push('work', st, i, set, side, w);
      push('rest', st, i, set, side, r);
    }
  });
  return { segments, totalS: t, warmupS, workS, cooldownS };
}

/** The canonical D1 session: 4 warm-up, 5 work, 4 cool-down. Exactly 15:00. */
export function makePlan(overrides: Partial<SessionPlan> = {}, workMoves = 5): SessionPlan {
  const steps: PlanStep[] = [];
  const base = { sides: 'none' as const, rung: 0 as const, lowImpact: true, formCheckable: false, mode: 'timed' as const };
  for (let i = 0; i < 4; i += 1) {
    steps.push({ ...base, id: `w${i}`, phase: 'warmup', exerciseId: `warm-${i}`, name: `Warm ${i}`, sets: 1, workS: 30, restS: 0, transitionS: 0 });
  }
  for (let i = 0; i < workMoves; i += 1) {
    steps.push({
      ...base,
      id: `m${i}`,
      phase: 'work',
      exerciseId: `move-${i}`,
      name: `Move ${i}`,
      sets: 2,
      workS: 40,
      restS: 20,
      transitionS: 12,
      sides: i === 1 ? 'each' : 'none',
      formCheckable: i === 2,
    });
  }
  for (let i = 0; i < 4; i += 1) {
    steps.push({ ...base, id: `c${i}`, phase: 'cooldown', exerciseId: `cool-${i}`, name: `Cool ${i}`, sets: 1, workS: 30, restS: 0, transitionS: 0 });
  }
  return { id: 'plan-1', title: 'Core and glutes 15', style: 'normal', budgetS: 900, steps, ...overrides };
}

export function createHarness(opts: { start?: number } = {}) {
  const clock = createFakeClock(opts.start);
  const cues: Cue[] = [];
  const logs: SessionLogRow[] = [];
  const micro: { activeS: number }[] = [];
  let snapshot: SessionSnapshotRow | null = null;
  const keepAwake = { active: false, activations: 0 };
  let n = 0;
  const deps: Partial<SessionDeps> = {
    clock,
    buildTimeline: testBuildTimeline,
    cues: {
      play: (c) => {
        cues.push(c);
      },
      stop: () => {},
    },
    keepAwake: {
      activate: () => {
        if (!keepAwake.active) keepAwake.activations += 1;
        keepAwake.active = true;
      },
      deactivate: () => {
        keepAwake.active = false;
      },
    },
    snapshot: {
      save: async (s) => {
        snapshot = s;
      },
      load: async (now) => (snapshot && snapshot.expiresAt > now ? snapshot : null),
      clear: async () => {
        snapshot = null;
      },
    },
    sessionLog: {
      insert: async (l) => {
        logs.push(l);
        return true;
      },
    },
    micro: {
      insert: async (m) => {
        micro.push({ activeS: m.activeS });
        return true;
      },
    },
    newId: () => `id-${(n += 1)}`,
  };
  configureSessionDeps(deps);
  const store = useSessionStore;
  store.getState().reset();
  return {
    clock,
    cues,
    logs,
    micro,
    keepAwake,
    store,
    getSnapshot: () => snapshot,
    /** Move the clock and run the ticker once, like the 4 Hz interval would. */
    advance(ms: number) {
      clock.advance(ms);
      store.getState().tick();
    },
  };
}
