// Small in-memory store for what sign-in and Building learned, so WelcomeBack and WeekOne can read it.
// Nothing here is persisted (the plan itself is in Op-SQLite) and nothing here is sent anywhere.

import { create } from 'zustand';
import type { AuthProvider } from '@casafit/shared';
import type { Plan } from '../../engine';

type Outcome = {
  /** Masked email, for example n***@gmail.com. */
  masked: string | null;
  provider: AuthProvider | null;
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

const empty: Outcome = { masked: null, provider: null, isNewAccount: null, freeChecksRemaining: null, plan: null, fellBackToNormal: false };

export const useVerifyOutcome = create<State>((set) => ({
  ...empty,
  set: (p) => set(p),
  reset: () => set(empty),
}));
