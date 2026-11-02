import { createFakePurchases, freeProInfo, setPurchases } from '@/services/purchases';
import { useAuth } from '@/state/auth';
import { fetchMe } from './auth';
import { api } from './client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('./client', () => ({ api: jest.fn() }));

const me = {
  id: '3f1c1f0e-3f1c-4f1c-8f1c-3f1c1f0e3f1c',
  email: 'priya@gmail.com',
  emailMasked: 'p***@gmail.com',
  provider: 'google',
  locale: 'en-IN',
  onboarded: true,
  createdAt: '2026-10-01T00:00:00+00:00',
  freeChecksRemaining: 2,
  pro: { active: false, expiresAt: null },
  plan: null,
};

afterEach(() => setPurchases(null));

describe('fetchMe', () => {
  it('stores the account and links purchases to the account id', async () => {
    (api as jest.Mock).mockResolvedValue(me);
    const fake = createFakePurchases({ info: freeProInfo(0) });
    setPurchases(fake);
    await fetchMe();
    await Promise.resolve();
    expect(useAuth.getState().account?.emailMasked).toBe('p***@gmail.com');
    expect(fake.loggedInAs).toBe(me.id);
  });

  it('still succeeds when the store is unconfigured', async () => {
    (api as jest.Mock).mockResolvedValue(me);
    setPurchases(createFakePurchases({ configured: false, info: freeProInfo(0) }));
    await expect(fetchMe()).resolves.toMatchObject({ id: me.id });
  });
});
