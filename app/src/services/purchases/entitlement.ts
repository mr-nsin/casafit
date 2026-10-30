// How long we trust a Pro answer. Pure functions, so every rule is tested without a store.

import type { ProInfo } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Re-ask the store once the cached answer is older than this. */
export const PRO_TTL_MS = DAY_MS;
/** Keep honouring the last known answer this long while offline (docs/architecture.md 2.3). */
export const PRO_GRACE_MS = 7 * DAY_MS;

export type ProState = 'free' | 'trial' | 'active' | 'active_cancelled' | 'billing_issue' | 'lapsed';

export interface ProStatus {
  /** Pro features are on. */
  active: boolean;
  state: ProState;
  /** The cached answer is older than a day: refresh when online. */
  stale: boolean;
  /** Epoch ms the answer comes from, for the "as of" note. */
  asOf: number | null;
}

export function proStatus(info: ProInfo | null, now: number): ProStatus {
  if (!info) return { active: false, state: 'free', stale: true, asOf: null };
  const age = now - info.verifiedAt;
  const stale = age > PRO_TTL_MS;
  if (!info.active) return { active: false, state: info.expiresAt ? 'lapsed' : 'free', stale, asOf: info.verifiedAt };
  // Never pull Pro mid-session: an old answer still counts through the grace window.
  if (age > PRO_GRACE_MS) return { active: false, state: 'lapsed', stale: true, asOf: info.verifiedAt };
  const state: ProState = info.billingIssue ? 'billing_issue' : info.trial ? 'trial' : !info.willRenew ? 'active_cancelled' : 'active';
  return { active: true, state, stale, asOf: info.verifiedAt };
}

export const freeProInfo = (now: number): ProInfo => ({
  active: false,
  plan: null,
  expiresAt: null,
  willRenew: false,
  billingIssue: false,
  trial: false,
  priceString: null,
  verifiedAt: now,
});
