import { create } from 'zustand';
import type { ConsentPurpose, ConsentRecord } from '../db/repositories';
import { newId } from '../services/offline-queue/ids';
import { getRepositories } from './storage';

/** Bump when the privacy notice text changes. Stored with each record as evidence. */
export const NOTICE_VERSION = '2026-10-v1';

type State = {
  latest: Partial<Record<ConsentPurpose, ConsentRecord>>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Appends a record (never edits one). Withdrawal is also a record. */
  record: (
    purpose: ConsentPurpose,
    granted: boolean,
    source: ConsentRecord['source'],
  ) => Promise<ConsentRecord>;
  has: (purpose: ConsentPurpose) => boolean;
};

export const useConsent = create<State>((set, get) => ({
  latest: {},
  hydrated: false,
  async hydrate() {
    set({ latest: await getRepositories().consent.latest(), hydrated: true });
  },
  async record(purpose, granted, source) {
    const rec: ConsentRecord = {
      id: newId(),
      purpose,
      granted,
      noticeVersion: NOTICE_VERSION,
      at: Date.now(),
      source,
    };
    await getRepositories().consent.append(rec);
    set({ latest: { ...get().latest, [purpose]: rec } });
    return rec;
  },
  // No record means no consent: every purpose starts off, nothing is pre-ticked (D2).
  has: (purpose) => get().latest[purpose]?.granted === true,
}));

export const useHasConsent = (purpose: ConsentPurpose): boolean =>
  useConsent((s) => s.latest[purpose]?.granted === true);
