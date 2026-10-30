import type { AuthProvider } from './types';

/** Used when neither Supabase keys nor a dev token are set. Nothing crashes; every sign-in call says "unavailable". */
export function createUnconfiguredAuth(): AuthProvider {
  return {
    kind: 'none',
    configured: false,
    sendEmailCode: async () => ({ ok: false, reason: 'unavailable' }),
    verifyEmailCode: async () => ({ ok: false, reason: 'unavailable' }),
    signInWithOAuth: async () => ({ ok: false, reason: 'unavailable' }),
    getSession: async () => null,
    getAccessToken: async () => null,
    refresh: async () => ({ ok: false, reason: 'none' }),
    onChange: () => () => undefined,
    signOut: async () => undefined,
  };
}
