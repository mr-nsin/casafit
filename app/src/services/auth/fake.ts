// In-memory AuthProvider for Jest. Every outcome can be scripted.

import type {
  AuthProvider,
  AuthSession,
  OAuthResult,
  RefreshResult,
  SendCodeResult,
  SocialProvider,
  VerifyCodeResult,
} from './types';

export const FAKE_TOKEN = 'fake-access-token';

export interface FakeAuth extends AuthProvider {
  /** The code verifyEmailCode accepts. */
  code: string;
  sendResult: SendCodeResult;
  /** Overrides the code check when set (for example `{ ok: false, reason: 'expired' }`). */
  verifyResult: VerifyCodeResult | null;
  oauthResult: OAuthResult | null;
  refreshResult: RefreshResult;
  session: AuthSession | null;
  token: string;
  sent: string[];
  verified: { email: string; code: string }[];
  oauthCalls: SocialProvider[];
  refreshCalls: number;
  signOutCalls: number;
  /** Simulate Supabase pushing a session change (for example a refresh that was rejected). */
  push(session: AuthSession | null): void;
}

export const fakeSession = (over: Partial<AuthSession> = {}): AuthSession => ({
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'asha@example.com',
  method: 'email',
  expiresAt: Date.now() + 3600_000,
  ...over,
});

export function createFakeAuth(init: { configured?: boolean; session?: AuthSession | null } = {}): FakeAuth {
  const listeners = new Set<(s: AuthSession | null) => void>();
  const emit = (s: AuthSession | null) => listeners.forEach((l) => l(s));
  const f: FakeAuth = {
    kind: 'fake',
    configured: init.configured ?? true,
    code: '123456',
    sendResult: { ok: true },
    verifyResult: null,
    oauthResult: null,
    refreshResult: { ok: false, reason: 'rejected' },
    session: init.session ?? null,
    token: FAKE_TOKEN,
    sent: [],
    verified: [],
    oauthCalls: [],
    refreshCalls: 0,
    signOutCalls: 0,
    push(s) {
      f.session = s;
      emit(s);
    },
    async sendEmailCode(email) {
      f.sent.push(email);
      return f.sendResult;
    },
    async verifyEmailCode(email, code) {
      f.verified.push({ email, code });
      if (f.verifyResult) {
        if (f.verifyResult.ok) f.push(f.verifyResult.session);
        return f.verifyResult;
      }
      if (code !== f.code) return { ok: false, reason: 'wrong' };
      const session = fakeSession({ email });
      f.push(session);
      return { ok: true, session };
    },
    async signInWithOAuth(provider) {
      f.oauthCalls.push(provider);
      const r = f.oauthResult ?? { ok: true as const, session: fakeSession({ method: provider }) };
      if (r.ok) f.push(r.session);
      return r;
    },
    getSession: async () => f.session,
    getAccessToken: async () => (f.session ? f.token : null),
    async refresh() {
      f.refreshCalls += 1;
      if (f.refreshResult.ok) f.push(f.refreshResult.session);
      return f.refreshResult;
    },
    onChange(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async signOut() {
      f.signOutCalls += 1;
      f.push(null);
    },
  };
  return f;
}
