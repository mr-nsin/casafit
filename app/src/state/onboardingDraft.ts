import { create } from 'zustand';
import type { OnboardingDraft } from '../db/repositories';
import { getRepositories } from './storage';

export const emptyDraft = (): OnboardingDraft => ({
  birthYear: null,
  confirmed18: false,
  goal: null,
  bodyParts: [],
  styles: [],
  mix: {},
  heightCm: null,
  weightKg: null,
  sex: null,
  experience: null,
  daysPerWeek: 4,
  painAreas: [],
  healthFlags: [],
  healthConsent: null, // unticked by default (D2)
});

/** Keeps the draft internally consistent whatever order the screens write in. */
export function normaliseDraft(d: OnboardingDraft): OnboardingDraft {
  const out = { ...d };
  if (out.goal !== 'body_part') out.bodyParts = [];
  else out.bodyParts = out.bodyParts.slice(0, 2);
  if (out.styles.length !== 3) out.mix = {};
  if (out.healthFlags.length === 0) out.healthConsent = null;
  return out;
}

type State = {
  draft: OnboardingDraft;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<OnboardingDraft>) => Promise<void>;
  /** Clears memory and storage; call when Building finishes. */
  finish: () => Promise<void>;
};

// Writes go through one chain so a slow earlier save cannot overwrite a later one.
let chain: Promise<unknown> = Promise.resolve();
const enqueueWrite = (fn: () => Promise<void>) => (chain = chain.then(fn, fn));

export const useOnboarding = create<State>((set, get) => ({
  draft: emptyDraft(),
  hydrated: false,
  async hydrate() {
    const saved = await getRepositories().onboardingDraft.load();
    set({ draft: saved ? normaliseDraft({ ...emptyDraft(), ...saved }) : emptyDraft(), hydrated: true });
  },
  async update(patch) {
    const next = normaliseDraft({ ...get().draft, ...patch });
    set({ draft: next });
    await enqueueWrite(() => getRepositories().onboardingDraft.save(next));
  },
  async finish() {
    set({ draft: emptyDraft() });
    await enqueueWrite(() => getRepositories().onboardingDraft.clear());
  },
}));
