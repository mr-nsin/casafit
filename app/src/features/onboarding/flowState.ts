// Small in-memory store for what Verify and Building learned, so WelcomeBack and WeekOne can read it.
// Nothing here is persisted (the plan itself is in Op-SQLite) and nothing here is sent anywhere.

import { create } from 'zustand';
import type { Plan } from '../../engine';

type Outcome = {
  masked: string | null;
  isNewAccount: boolean | null;
  freeChecksRemaining: number | null;
  /** The plan Building just made. WeekOne falls back to the saved rows when this is null. */
  plan: Plan | null;
  /** True when the chosen styles could not fill a week and Normal sessions were used instead. */
  fellBackToNormal: boolean;
};
type State = Outcome & {
  set: (p: Partial<Outcome>) => void;
  reset: () => void;
};

const empty: Outcome = { masked: null, isNewAccount: null, freeChecksRemaining: null, plan: null, fellBackToNormal: false };

export const useVerifyOutcome = create<State>((set) => ({
  ...empty,
  set: (p) => set(p),
  reset: () => set(empty),
}));
