import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { VerifyCodeResponse } from '@casafit/shared';

type Session = {
  accessToken: string;
  refreshToken: string;
  verifiedAt: number;
};

type AuthState = {
  session: Session | null;
  freeChecksRemaining: number;
  pro: { active: boolean; expiresAt: string | null };
  hydrate: () => Promise<void>;
  save: (r: VerifyCodeResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

const KEY_SESSION = 'casafit.session';
const KEY_ENTS = 'casafit.entitlements';
const GRACE_MS = 7 * 24 * 60 * 60 * 1000; // see docs/architecture.md §2.3

export const useAuth = create<AuthState>((set) => ({
  session: null,
  freeChecksRemaining: 2,
  pro: { active: false, expiresAt: null },
  async hydrate() {
    const raw = await SecureStore.getItemAsync(KEY_SESSION);
    const ents = await SecureStore.getItemAsync(KEY_ENTS);
    if (!raw) return;
    const session = JSON.parse(raw) as Session;
    if (Date.now() - session.verifiedAt > GRACE_MS) return; // force re-verify
    set({
      session,
      ...(ents ? JSON.parse(ents) : {}),
    });
  },
  async save(r) {
    const session: Session = {
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      verifiedAt: Date.now(),
    };
    await SecureStore.setItemAsync(KEY_SESSION, JSON.stringify(session));
    await SecureStore.setItemAsync(
      KEY_ENTS,
      JSON.stringify({ freeChecksRemaining: r.freeChecksRemaining, pro: r.pro }),
    );
    set({ session, freeChecksRemaining: r.freeChecksRemaining, pro: r.pro });
  },
  async signOut() {
    await SecureStore.deleteItemAsync(KEY_SESSION);
    await SecureStore.deleteItemAsync(KEY_ENTS);
    set({ session: null, freeChecksRemaining: 2, pro: { active: false, expiresAt: null } });
  },
}));
