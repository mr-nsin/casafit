import * as SecureStore from 'expo-secure-store';
import type { MeResponse } from '@casafit/shared';

import { createFakeAuth, fakeSession, setAuth, type FakeAuth } from '../services/auth';
import { GRACE_MS, useAuth } from './auth';

jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => mem.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void mem.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void mem.delete(k)),
  };
});

const ME: MeResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'asha@gmail.com',
  emailMasked: 'a***@gmail.com',
  provider: 'google',
  locale: 'en-IN',
  onboarded: true,
  createdAt: '2026-10-30T10:00:00+00:00',
  freeChecksRemaining: 1,
  pro: { active: true, expiresAt: '2027-01-01T00:00:00+00:00' },
  plan: null,
};

let auth: FakeAuth;
beforeEach(async () => {
  auth = createFakeAuth({ session: fakeSession() });
  setAuth(auth);
  await SecureStore.deleteItemAsync('casafit.account-cache');
  useAuth.setState({ session: null, account: null, sessionEnded: false, freeChecksRemaining: 2, pro: { active: false, expiresAt: null } });
});
afterEach(() => setAuth(null));

describe('auth store', () => {
  it('hydrates the session from the provider and the cached account', async () => {
    await useAuth.getState().applyMe(ME);
    useAuth.setState({ session: null, account: null });
    await useAuth.getState().hydrate();
    expect(useAuth.getState().session?.email).toBe('asha@example.com');
    expect(useAuth.getState().account).toMatchObject({ emailMasked: 'a***@gmail.com', provider: 'google' });
    expect(useAuth.getState().pro.active).toBe(true);
  });

  it('starts signed out when the provider has no session', async () => {
    auth.session = null;
    await useAuth.getState().hydrate();
    expect(useAuth.getState().session).toBeNull();
  });

  it('keeps the 7-day offline grace: after it, Pro is treated as lapsed until /v1/me answers', async () => {
    await useAuth.getState().applyMe(ME);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + GRACE_MS + 60_000);
    useAuth.setState({ session: null });
    await useAuth.getState().hydrate();
    now.mockRestore();
    expect(useAuth.getState().session).not.toBeNull(); // still signed in
    expect(useAuth.getState().pro.active).toBe(false);
    expect(useAuth.getState().account?.emailMasked).toBe('a***@gmail.com');
  });

  it('follows the provider when it signs the person out', async () => {
    await useAuth.getState().hydrate();
    await useAuth.getState().applyMe(ME);
    auth.push(null);
    expect(useAuth.getState().session).toBeNull();
    expect(useAuth.getState().account).toBeNull();
    expect(useAuth.getState().freeChecksRemaining).toBe(2);
  });

  it('signOut calls the provider and clears the cache', async () => {
    await useAuth.getState().applyMe(ME);
    await useAuth.getState().signOut();
    expect(auth.signOutCalls).toBe(1);
    expect(await SecureStore.getItemAsync('casafit.account-cache')).toBeNull();
    expect(useAuth.getState().account).toBeNull();
  });

  it('endSession signs out and remembers why, until Welcome has said it', async () => {
    await useAuth.getState().endSession();
    expect(useAuth.getState().sessionEnded).toBe(true);
    useAuth.getState().clearSessionEnded();
    expect(useAuth.getState().sessionEnded).toBe(false);
  });
});
