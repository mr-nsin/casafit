// The kind message shown on the Exercise screen after a 30-second trial ends.

import { create } from 'zustand';

export const TRIAL_DONE = 'Nice work. That was 30 seconds.';
export const TRIAL_STOPPED = 'No problem. Try it again whenever you like.';

interface TrialNotice {
  message: string | null;
  set(message: string | null): void;
}

export const useTrialNotice = create<TrialNotice>((set) => ({ message: null, set: (message) => set({ message }) }));
