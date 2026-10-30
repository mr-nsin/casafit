// Who is signed in, plus the cached account summary and entitlements.
// The session itself (tokens) belongs to the AuthProvider in services/auth; this store mirrors who it is so screens
// can render without awaiting. The cache in SecureStore lets the app start offline.

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthProvider as ProviderName, MeResponse } from '@casafit/shared';

import { getAuth, type AuthSession } from '../services/auth';

export type Account = {
  email: string | null;
  /** For display, for example `n***@gmail.com`. */
  emailMasked: string | null;
  provider: ProviderName;
};

type Pro = { active: boolean; expiresAt: string | null };

type AuthState = {
  session: AuthSession | null;
  account: Account | null;
  freeChecksRemaining: number;
  pro: Pro;
  /** True after the server stopped accepting the session. Welcome shows a kind "sign in again" note once. */
  sessionEnded: boolean;
  hydrate: () => Promise<void>;
  setSession: (s: AuthSession | null) => void;
  /** Apply GET /v1/me: account summary and entitlements, cached for offline starts. */
  applyMe: (me: MeResponse) => Promise<void>;
  /** The server rejected the session and one refresh did not help. Signs out and remembers why. */
  endSession: () => Promise<void>;
  clearSessionEnded: () => void;
  signOut: () => Promise<void>;
};

const KEY_CACHE = 'casafit.account-cache';
/** Offline grace for entitlements, see docs/architecture.md §2.3. After 7 days without a refresh Pro is treated as lapsed. */
export const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const FREE: Pro = { active: false, expiresAt: null };
const signedOutState = { session: null, account: null, freeChecksRemaining: 2, pro: FREE } as const;

type Cache = { account: Account | null; freeChecksRemaining: number; pro: Pro; cachedAt: number };

async function readCache(): Promise<Cache | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_CACHE);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

let unsubscribe: (() => void) | null = null;

export const useAuth = create<AuthState>((set, get) => ({
  ...signedOutState,
  sessionEnded: false,

  async hydrate() {
    const auth = getAuth();
    unsubscribe?.();
    unsubscribe = auth.onChange((s) => {
      if (s) set({ session: s });
      else {
        void SecureStore.deleteItemAsync(KEY_CACHE).catch(() => undefined);
        set({ ...signedOutState });
      }
    });
    const session = await auth.getSession().catch(() => null);
    if (!session) return;
    const cache = await readCache();
    const stale = !cache || Date.now() - cache.cachedAt > GRACE_MS;
    set({
      session,
      account: cache?.account ?? null,
      freeChecksRemaining: cache?.freeChecksRemaining ?? 2,
      pro: cache && !stale ? cache.pro : FREE,
    });
  },

  setSession: (session) => set({ session }),

  async applyMe(me) {
    const account: Account = { email: me.email, emailMasked: me.emailMasked, provider: me.provider };
    const next = { account, freeChecksRemaining: me.freeChecksRemaining, pro: me.pro };
    set({ ...next, sessionEnded: false });
    try {
      await SecureStore.setItemAsync(KEY_CACHE, JSON.stringify({ ...next, cachedAt: Date.now() } satisfies Cache));
    } catch {
      /* the cache is a convenience */
    }
  },

  async endSession() {
    await get().signOut();
    set({ sessionEnded: true });
  },

  clearSessionEnded: () => set({ sessionEnded: false }),

  async signOut() {
    await getAuth().signOut().catch(() => undefined);
    await SecureStore.deleteItemAsync(KEY_CACHE).catch(() => undefined);
    set({ ...signedOutState });
  },
}));
