// Client view of "how many free checks are left" and "is Pro on". The phone keeps a cache
// (Op-SQLite, through repos.cache); the server is the source of truth for the balance and
// RevenueCat for Pro. Offline the cache is trusted: Pro for 7 days, the balance until we can ask.

import { create } from 'zustand';

import { ApiError, NetworkError } from '../../api/client';
import { freeProInfo, getPurchases, proStatus, type ProInfo, type ProStatus } from '../../services/purchases';
import { useAuth } from '../../state/auth';
import { getFormCheckDeps } from './deps';

interface Cached {
  v: 1;
  freeChecksRemaining: number;
  pro: ProInfo | null;
}

interface ServerStatus {
  freeChecksRemaining: number;
  pro: { active: boolean; expiresAt: string | null };
}

export interface EntitlementsState {
  hydrated: boolean;
  freeChecks: number;
  pro: ProInfo | null;
  /** The last refresh could not reach the network or the store. */
  offline: boolean;
  /** Pro checks this month (local only, shown on ManagePro). */
  proChecksThisMonth: number;
  /** Set by Paywall so ProWelcome can say "You're on Pro" or "Pro is back". */
  welcomeKind: 'purchase' | 'restore';
  setWelcomeKind(k: 'purchase' | 'restore'): void;
  hydrate(): Promise<void>;
  refresh(): Promise<void>;
  applyPro(info: ProInfo): Promise<void>;
  setFreeChecks(n: number): Promise<void>;
  recordProCheck(): Promise<void>;
}

const monthKey = (now: number): string => {
  const d = new Date(now);
  return `proChecks.${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

async function persist(freeChecks: number, pro: ProInfo | null): Promise<void> {
  const d = getFormCheckDeps();
  try {
    const body: Cached = { v: 1, freeChecksRemaining: freeChecks, pro };
    await d.repos().cache.setEntitlements(JSON.stringify(body), d.now());
  } catch {
    /* the cache is a convenience: a failed write never blocks a check */
  }
}

function mirrorToAuth(freeChecks: number, pro: ProInfo | null, now: number): void {
  const status = proStatus(pro, now);
  useAuth.setState({
    freeChecksRemaining: freeChecks,
    pro: { active: status.active, expiresAt: pro?.expiresAt ? new Date(pro.expiresAt).toISOString() : null },
  });
}

export const useEntitlements = create<EntitlementsState>((set, get) => ({
  hydrated: false,
  freeChecks: useAuth.getState().freeChecksRemaining,
  pro: null,
  offline: false,
  proChecksThisMonth: 0,
  welcomeKind: 'purchase',
  setWelcomeKind: (k) => set({ welcomeKind: k }),

  async hydrate() {
    const d = getFormCheckDeps();
    let freeChecks = useAuth.getState().freeChecksRemaining;
    let pro: ProInfo | null = null;
    let proChecks = 0;
    try {
      const row = await d.repos().cache.getEntitlements();
      if (row) {
        const c = JSON.parse(row.json) as Cached;
        if (c.v === 1) {
          freeChecks = Math.max(0, Math.min(2, c.freeChecksRemaining));
          pro = c.pro;
        }
      }
      proChecks = Number((await d.repos().prefs.get(monthKey(d.now()))) ?? 0) || 0;
    } catch {
      /* no cache yet: defaults */
    }
    set({ hydrated: true, freeChecks, pro, proChecksThisMonth: proChecks });
    mirrorToAuth(freeChecks, pro, d.now());
  },

  async refresh() {
    const d = getFormCheckDeps();
    const purchases = getPurchases();
    let offline = false;
    let pro = get().pro;

    if (purchases.configured) {
      try {
        pro = await purchases.customerInfo();
      } catch {
        offline = true;
      }
    }

    let freeChecks = get().freeChecks;
    try {
      const s = await d.api<ServerStatus>('/me/entitlements');
      freeChecks = Math.max(0, Math.min(2, s.freeChecksRemaining));
      // Without a store answer, the server's webhook-fed view stands in for it.
      if (!purchases.configured || offline) {
        if (s.pro.active && !proStatus(pro, d.now()).active) {
          pro = { ...freeProInfo(d.now()), active: true, willRenew: true, expiresAt: s.pro.expiresAt ? Date.parse(s.pro.expiresAt) : null };
        }
        offline = false;
      }
    } catch (e) {
      if (e instanceof NetworkError) offline = true;
      else if (!(e instanceof ApiError)) offline = true;
    }

    set({ freeChecks, pro, offline });
    mirrorToAuth(freeChecks, pro, d.now());
    await persist(freeChecks, pro);
  },

  async applyPro(info) {
    const { freeChecks } = get();
    set({ pro: info, offline: false });
    mirrorToAuth(freeChecks, info, getFormCheckDeps().now());
    await persist(freeChecks, info);
  },

  async setFreeChecks(n) {
    const free = Math.max(0, Math.min(2, n));
    const { pro } = get();
    set({ freeChecks: free });
    mirrorToAuth(free, pro, getFormCheckDeps().now());
    await persist(free, pro);
  },

  async recordProCheck() {
    const d = getFormCheckDeps();
    const n = get().proChecksThisMonth + 1;
    set({ proChecksThisMonth: n });
    try {
      await d.repos().prefs.set(monthKey(d.now()), String(n));
    } catch {
      /* local counter only */
    }
  },
}));

/** Pro status now, with the cache rules applied. */
export function useProStatus(): ProStatus {
  const pro = useEntitlements((s) => s.pro);
  return proStatus(pro, getFormCheckDeps().now());
}

export function currentProStatus(): ProStatus {
  return proStatus(useEntitlements.getState().pro, getFormCheckDeps().now());
}
