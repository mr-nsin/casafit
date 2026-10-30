// Entry points other screens use to start or resume a session. Kept out of index.ts so the
// browse screens can import them without a require cycle through the route table.

import { isFinished, useSessionStore, type StartOptions } from './store';
import type { PlanStep, SessionPlan } from './types';

/** Start a session from the plan. The caller then navigates to `stageRouteFor(plan.style)`. */
export function startSession(plan: SessionPlan, opts?: StartOptions) {
  useSessionStore.getState().start(plan, opts);
  return plan.style === 'yoga' ? ('Yoga' as const) : plan.style === 'dance' ? ('Dance' as const) : ('Player' as const);
}

export const TRIAL_SECONDS = 30;

/**
 * "Try 30 seconds" on the Exercise screen: a one-move session of 30 s with no warm-up, rest or
 * cool-down. It is never logged or saved, and the 15-minute session rules are not involved.
 * Both sides of a move done on one side each are covered inside the 30 s.
 */
export function trialPlan(ex: { id: string; name: string; style: SessionPlan['style']; mode: PlanStep['mode']; formCheckable?: boolean; lowImpact?: boolean }): SessionPlan {
  return {
    id: `trial-${ex.id}`,
    title: ex.name,
    style: ex.style,
    budgetS: TRIAL_SECONDS,
    steps: [
      {
        id: `trial-${ex.id}-1`,
        phase: 'work',
        exerciseId: ex.id,
        name: ex.name,
        mode: ex.mode,
        sets: 1,
        workS: TRIAL_SECONDS,
        restS: 0,
        transitionS: 0,
        sides: 'none',
        rung: 0,
        lowImpact: !!ex.lowImpact,
        formCheckable: !!ex.formCheckable,
      },
    ],
  };
}

/** Starts the 30-second trial and returns the route to open. Going back lands on the Exercise screen. */
export function startTrial(ex: Parameters<typeof trialPlan>[0]) {
  return startSession(trialPlan(ex), { trial: true });
}

/** For Home's Resume card (D13): loads a saved session if one is inside its 24 h window. */
export async function loadResumableSession(): Promise<{ title: string; minutesDone: number; finished: boolean } | null> {
  const store = useSessionStore.getState();
  // A session already in memory is the truth; never overwrite it from the last snapshot.
  if (store.plan && (store.status === 'active' || store.status === 'paused' || store.status === 'confirm_end')) {
    return null;
  }
  await store.expireStale();
  const ok = await store.restoreFromSnapshot();
  if (!ok) return null;
  const s = useSessionStore.getState();
  // `finished`: nothing left to play (complete, or the position is at the end) but never logged.
  return { title: s.plan?.title ?? '', minutesDone: Math.floor(s.activeMs / 60000), finished: isFinished(s) };
}
