// Development only. Talks to the local API without a Supabase project: the token is minted by
// api/tools/mint-dev-token.mjs with the HS256 secret from docker-compose and set as EXPO_PUBLIC_DEV_AUTH_TOKEN.
// No request ever goes to Supabase. Ignored in release builds (see index.ts).

import type { AuthProvider, AuthSession } from './types';

/** Reads sub, email and exp from a JWT without verifying it (the API verifies it). */
export function decodeDevToken(token: string): AuthSession | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const claims = JSON.parse(atob(b64)) as { sub?: string; email?: string; exp?: number };
    if (!claims.sub) return null;
    return { userId: claims.sub, email: claims.email?.toLowerCase() ?? null, method: 'dev', expiresAt: (claims.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}

export function createDevAuth(token: string, now: () => number = Date.now): AuthProvider {
  const decoded = decodeDevToken(token);
  let signedIn = decoded !== null;
  const listeners = new Set<(s: AuthSession | null) => void>();
  const emit = (s: AuthSession | null) => listeners.forEach((l) => l(s));
  const current = () => (signedIn && decoded && decoded.expiresAt > now() ? decoded : null);
  return {
    kind: 'dev',
    configured: decoded !== null,
    sendEmailCode: async () => ({ ok: false, reason: 'unavailable' }),
    verifyEmailCode: async () => ({ ok: false, reason: 'unavailable' }),
    signInWithOAuth: async () => ({ ok: false, reason: 'unavailable' }),
    async signInAsDev() {
      const s = decoded && decoded.expiresAt > now() ? decoded : null;
      if (!s) return { ok: false, reason: 'error' };
      signedIn = true;
      emit(s);
      return { ok: true, session: s };
    },
    getSession: async () => current(),
    getAccessToken: async () => (current() ? token : null),
    refresh: async () => {
      const s = current();
      return s ? { ok: true, session: s } : { ok: false, reason: 'rejected' };
    },
    onChange(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async signOut() {
      signedIn = false;
      emit(null);
    },
  };
}
