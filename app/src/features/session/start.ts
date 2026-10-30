// Entry points other screens use to start or resume a session. Kept out of index.ts so the
// browse screens can import them without a require cycle through the route table.

import { useSessionStore, type StartOptions } from './store';
import type { SessionPlan } from './types';

/** Start a session from the plan. The caller then navigates to `stageRouteFor(plan.style)`. */
export function startSession(plan: SessionPlan, opts?: StartOptions) {
  useSessionStore.getState().start(plan, opts);
  return plan.style === 'yoga' ? ('Yoga' as const) : plan.style === 'dance' ? ('Dance' as const) : ('Player' as const);
}

/** For Home's Resume card (D13): loads a saved session if one is inside its 24 h window. */
export async function loadResumableSession(): Promise<{ title: string; minutesDone: number } | null> {
  const store = useSessionStore.getState();
  // A session already in memory is the truth; never overwrite it from the last snapshot.
  if (store.plan && (store.status === 'active' || store.status === 'paused' || store.status === 'confirm_end')) {
    return null;
  }
  await store.expireStale();
  const ok = await store.restoreFromSnapshot();
  if (!ok) return null;
  const s = useSessionStore.getState();
  return { title: s.plan?.title ?? '', minutesDone: Math.floor(s.activeMs / 60000) };
}
