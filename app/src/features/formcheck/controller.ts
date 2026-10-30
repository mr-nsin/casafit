// The live-check state machine (docs/plans/screens/camera-pro-nutrition.md Part A):
//
//   idle --start--> running (attempt "armed", key made, nothing spent)
//   running --close / framing lost / error--> idle   (no spend, nothing to refund)
//   running --rep 3 or 10 s hold--> counted --consume--> spent | spent_local (offline, queued)
//   counted --finish--> done (result in memory only)
//
// The attempt record is written to the phone before any network call. The same idempotency key is
// used for the first send and for every retry from the offline queue. Frames and landmarks stay in
// the engine and are dropped on stop; only the attempt (key, exercise, state) is stored.

import { create } from 'zustand';

import type { ConsumeResponse } from '@casafit/shared';
import {
  createEngine,
  type FormExercise,
  type FramingHint,
  type Issue,
  type PoseEngine,
  type PoseFrame,
  type PoseSource,
  type Rating,
} from '../../services/pose';
import { cueFor, findingText, GOOD_TIP, TIP } from './model';
import { getFormCheckDeps } from './deps';
import { currentProStatus, useEntitlements } from './entitlements';

export type Spend = 'none' | 'pro' | 'spent' | 'local' | 'overdrawn';
export type CheckPhase = 'idle' | 'running' | 'counted' | 'done' | 'unavailable';

export interface FormCheckResult {
  attemptId: string;
  exercise: FormExercise;
  repsAnalysed: number;
  repsClean: number;
  perRep: { index: number; ok: boolean; issue?: Issue }[];
  findings: { area: Issue; status: 'ok' | 'warn'; text: string }[];
  rating: Rating;
  tip: string;
  /** Plank only: seconds of the longest continuous hold. */
  holdSeconds?: number;
  spend: Spend;
  creditsLeft: number | 'unlimited';
}

export interface FormCheckState {
  exercise: FormExercise;
  phase: CheckPhase;
  attemptId: string | null;
  reps: number;
  holdMs: number;
  framing: { ok: boolean; hint?: FramingHint } | null;
  cue: string | null;
  /** Bumps on every new cue so the toast can replay and a live region re-announces it. */
  cueSeq: number;
  spend: Spend;
  result: FormCheckResult | null;
  /** Fixed when the attempt starts, so the header does not change when the balance does. */
  startedAs: { pro: boolean; number: number } | null;

  select(e: FormExercise): void;
  /** Creates the attempt and opens the pose source. 'unavailable' means no attempt, no spend. */
  start(): Promise<'started' | 'unavailable'>;
  /** The "See result" path. Only legal once counted; before that it cancels. */
  finish(): Promise<FormCheckResult | null>;
  /** Close before the count point: stops everything, spends nothing. */
  cancel(): Promise<void>;
  reset(): void;
}

interface Live {
  engine: PoseEngine;
  source: PoseSource;
  key: string;
  spending: Promise<void> | null;
}

let live: Live | null = null;

const blank = {
  phase: 'idle' as CheckPhase,
  attemptId: null,
  reps: 0,
  holdMs: 0,
  framing: null,
  cue: null,
  cueSeq: 0,
  spend: 'none' as Spend,
  result: null,
  startedAs: null,
};

function stopLive(): void {
  if (!live) return;
  try {
    live.source.stop();
  } catch {
    /* a source that fails to stop must not block leaving the screen */
  }
  live.engine.reset();
  live = null;
}

async function spendFree(attemptId: string, key: string, exercise: FormExercise): Promise<Spend> {
  const d = getFormCheckDeps();
  const repo = d.repos().formCheck;
  const ent = useEntitlements.getState();
  const body = { idempotencyKey: key, exercise };
  try {
    const r = await d.api<ConsumeResponse>('/entitlements/form-check/consume', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      await ent.setFreeChecks(r.freeChecksRemaining);
      await repo.setState(attemptId, 'spent', { spentAt: d.now() });
      return 'spent';
    }
    if (r.reason === 'pro_active') {
      await repo.setState(attemptId, 'spent', { spentAt: d.now() });
      return 'pro';
    }
    // The server had no credit left (another phone used it). Keep the result, charge nothing more.
    await ent.setFreeChecks(0);
    await repo.setState(attemptId, 'spent_local', { spentAt: d.now(), wouldHaveBeenCharged: true });
    return 'overdrawn';
  } catch {
    // Offline or the server is down: spend from the cache and queue the same key for later.
    await ent.setFreeChecks(Math.max(0, ent.freeChecks - 1));
    await d.enqueue({ kind: 'form_check.consume', method: 'POST', path: '/entitlements/form-check/consume', body, idempotencyKey: key });
    await repo.setState(attemptId, 'spent_local', { spentAt: d.now() });
    void d.flush();
    return 'local';
  }
}

export const useFormCheck = create<FormCheckState>((set, get) => {
  async function onCounted(): Promise<void> {
    const l = live;
    const id = get().attemptId;
    if (!l || !id || get().phase !== 'running') return;
    set({ phase: 'counted' });
    const d = getFormCheckDeps();
    const repo = d.repos().formCheck;
    await repo.setState(id, 'counted');
    const exercise = get().exercise;
    l.spending = (async () => {
      if (currentProStatus().active) {
        await repo.setState(id, 'spent', { spentAt: d.now() });
        await useEntitlements.getState().recordProCheck();
        set({ spend: 'pro' });
        return;
      }
      set({ spend: await spendFree(id, l.key, exercise) });
    })();
    await l.spending;
  }

  function onFrame(frame: PoseFrame): void {
    const l = live;
    if (!l) return;
    const phase = get().phase;
    if (phase !== 'running' && phase !== 'counted') return;
    for (const ev of l.engine.push(frame)) {
      switch (ev.k) {
        case 'framing':
          set({ framing: { ok: ev.ok, hint: ev.hint } });
          break;
        case 'rep': {
          // One cue per faulty rep, and silence after a clean one.
          const issue = ev.issues[0];
          set((s) => ({
            reps: ev.index,
            cue: issue ? cueFor(s.exercise, issue) : null,
            cueSeq: issue ? s.cueSeq + 1 : s.cueSeq,
          }));
          break;
        }
        case 'hold':
          set({ holdMs: ev.ms });
          break;
        case 'counted':
          void onCounted();
          break;
        case 'unscored':
          set({ cue: null });
          break;
      }
    }
  }

  return {
    exercise: 'squat',
    ...blank,
    result: null,

    select: (exercise) => set({ exercise }),

    async start() {
      stopLive();
      const d = getFormCheckDeps();
      const exercise = get().exercise;
      const source = d.poseSource(exercise);
      if (!source.available) {
        set({ ...blank, phase: 'unavailable' });
        return 'unavailable';
      }
      const attemptId = d.newId();
      const key = d.newId();
      // On the phone first, before any network call.
      await d.repos().formCheck.create({
        id: attemptId,
        idempotencyKey: key,
        exercise,
        state: 'armed',
        startedAt: d.now(),
        spentAt: null,
        wouldHaveBeenCharged: false,
      });
      live = { engine: createEngine(exercise), source, key, spending: null };
      const left = useEntitlements.getState().freeChecks;
      set({ ...blank, phase: 'running', attemptId, startedAs: { pro: currentProStatus().active, number: Math.min(2, Math.max(1, 3 - left)) } });
      try {
        source.start(onFrame);
      } catch {
        await get().cancel();
        set({ phase: 'unavailable' });
        return 'unavailable';
      }
      return 'started';
    },

    async finish() {
      const l = live;
      const s = get();
      if (!l || !s.attemptId) return null;
      if (s.phase !== 'counted') {
        await get().cancel();
        return null;
      }
      await l.spending;
      const sum = l.engine.summary();
      stopLive();
      const status = currentProStatus();
      const spend = get().spend;
      const warn = sum.findings.find((f) => f.status === 'warn');
      const result: FormCheckResult = {
        attemptId: s.attemptId,
        exercise: sum.exercise,
        repsAnalysed: sum.repsAnalysed,
        repsClean: sum.repsClean,
        perRep: sum.perRep,
        findings: sum.findings.map((f) => ({ ...f, text: findingText(f.area, f.status) })),
        rating: sum.rating ?? 'okay',
        tip: warn ? TIP[warn.area] : GOOD_TIP,
        ...(sum.holdSeconds !== undefined ? { holdSeconds: sum.holdSeconds } : {}),
        spend,
        creditsLeft: status.active ? 'unlimited' : useEntitlements.getState().freeChecks,
      };
      set({ phase: 'done', result, cue: null });
      return result;
    },

    async cancel() {
      // Only an attempt that has not reached the count point can be cancelled. After that the
      // check is spent and the way out is finish().
      if (get().phase !== 'running') return;
      const id = get().attemptId;
      stopLive();
      set({ ...blank });
      if (id) {
        try {
          await getFormCheckDeps().repos().formCheck.setState(id, 'cancelled');
        } catch {
          /* the attempt never spent anything, so a missed write loses nothing */
        }
      }
    },

    reset() {
      stopLive();
      set({ ...blank });
    },
  };
});
