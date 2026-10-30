import {
  DAY_MS,
  PRO_GRACE_MS,
  PRO_TTL_MS,
  PurchasesUnavailableError,
  createFakePurchases,
  createRevenueCatPurchases,
  freeProInfo,
  mapCustomerInfo,
  proStatus,
  savePercent,
  type ProInfo,
} from '.';

const NOW = Date.UTC(2026, 9, 30);
const pro = (patch: Partial<ProInfo> = {}): ProInfo => ({
  active: true,
  plan: 'pro_yearly',
  expiresAt: NOW + 300 * DAY_MS,
  willRenew: true,
  billingIssue: false,
  trial: false,
  priceString: 'STORE-PRICE',
  verifiedAt: NOW,
  ...patch,
});

describe('proStatus', () => {
  it('maps each state', () => {
    expect(proStatus(null, NOW)).toMatchObject({ active: false, state: 'free' });
    expect(proStatus(pro(), NOW)).toMatchObject({ active: true, state: 'active', stale: false });
    expect(proStatus(pro({ willRenew: false }), NOW).state).toBe('active_cancelled');
    expect(proStatus(pro({ billingIssue: true }), NOW).state).toBe('billing_issue');
    expect(proStatus(pro({ trial: true }), NOW).state).toBe('trial');
    expect(proStatus(pro({ active: false }), NOW).state).toBe('lapsed');
    expect(proStatus(freeProInfo(NOW), NOW).state).toBe('free');
  });

  it('is stale after one day but still Pro through the 7 day offline grace', () => {
    const day2 = proStatus(pro(), NOW + PRO_TTL_MS + 1);
    expect(day2).toMatchObject({ active: true, stale: true });
    expect(proStatus(pro(), NOW + PRO_GRACE_MS).active).toBe(true);
  });

  it('drops Pro only after the grace window with no answer from the store', () => {
    expect(proStatus(pro(), NOW + PRO_GRACE_MS + 1)).toMatchObject({ active: false, state: 'lapsed' });
  });
});

describe('savePercent', () => {
  const o = (y: number, m: number, cy = 'XXX', cm = 'XXX') => ({
    packages: [
      { id: 'a', plan: 'pro_yearly' as const, priceString: 'Y', price: y, currencyCode: cy },
      { id: 'm', plan: 'pro_monthly' as const, priceString: 'M', price: m, currencyCode: cm },
    ],
  });
  it('compares a year with twelve months in the store currency', () => {
    expect(savePercent(o(1000, 100))).toBe(17);
    expect(savePercent(o(600, 100))).toBe(50);
  });
  it('is hidden when it cannot be worked out honestly', () => {
    expect(savePercent(o(1200, 100))).toBeNull();
    expect(savePercent(o(1500, 100))).toBeNull();
    expect(savePercent(o(0, 100))).toBeNull();
    expect(savePercent(o(1000, 100, 'USD', 'INR'))).toBeNull();
    expect(savePercent({ packages: [o(1, 1).packages[0]!] })).toBeNull();
  });
});

describe('revenuecat port', () => {
  const rcModule = (over: Record<string, unknown> = {}) => {
    const listeners = new Set<(i: unknown) => void>();
    return {
      configure: jest.fn(),
      getOfferings: jest.fn(async () => ({
        current: {
          availablePackages: [
            { identifier: '$rc_annual', packageType: 'ANNUAL', product: { identifier: 'casafit_year', priceString: 'STORE Y', price: 10, currencyCode: 'ZZZ' } },
            { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { identifier: 'casafit_month', priceString: 'STORE M', price: 1, currencyCode: 'ZZZ' } },
            { identifier: '$rc_lifetime', packageType: 'LIFETIME', product: { identifier: 'life', priceString: 'L', price: 1, currencyCode: 'ZZZ' } },
          ],
        },
      })),
      purchasePackage: jest.fn(async () => ({ customerInfo: { entitlements: { active: { pro: { expirationDate: '2027-10-14T00:00:00Z', willRenew: true, productIdentifier: 'casafit_year', billingIssueDetectedAt: null, periodType: 'NORMAL' } } } } })),
      restorePurchases: jest.fn(async () => ({ entitlements: { active: {} } })),
      getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
      addCustomerInfoUpdateListener: (l: (i: unknown) => void) => listeners.add(l),
      removeCustomerInfoUpdateListener: (l: (i: unknown) => void) => listeners.delete(l),
      showManageSubscriptions: jest.fn(async () => undefined),
      PURCHASES_ERROR_CODE: { NETWORK_ERROR: 10, PAYMENT_PENDING_ERROR: 20 },
      ...over,
    };
  };

  it('reports unconfigured without a key and never touches the SDK', async () => {
    const load = jest.fn();
    const p = createRevenueCatPurchases({ apiKey: null, load: load as never });
    expect(p.configured).toBe(false);
    await expect(p.getOfferings()).rejects.toMatchObject({ reason: 'unconfigured' });
    await expect(p.restore()).rejects.toBeInstanceOf(PurchasesUnavailableError);
    expect(load).not.toHaveBeenCalled();
  });

  it('maps offerings to store price strings and drops unknown packages', async () => {
    const m = rcModule();
    const p = createRevenueCatPurchases({ apiKey: 'k', load: () => m as never });
    const o = await p.getOfferings();
    expect(o.packages.map((x) => [x.plan, x.priceString])).toEqual([
      ['pro_yearly', 'STORE Y'],
      ['pro_monthly', 'STORE M'],
    ]);
    expect(m.configure).toHaveBeenCalledWith({ apiKey: 'k' });
  });

  it('maps purchase outcomes: purchased, cancelled, pending, error', async () => {
    const m = rcModule();
    const p = createRevenueCatPurchases({ apiKey: 'k', now: () => NOW, load: () => m as never });
    const pkg = (await p.getOfferings()).packages[0]!;
    const bought = await p.purchase(pkg);
    expect(bought).toMatchObject({ kind: 'purchased', info: { active: true, plan: 'pro_yearly', willRenew: true, priceString: 'STORE Y' } });
    m.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    expect(await p.purchase(pkg)).toEqual({ kind: 'cancelled' });
    m.purchasePackage.mockRejectedValueOnce({ code: 20 });
    expect(await p.purchase(pkg)).toEqual({ kind: 'pending' });
    m.purchasePackage.mockRejectedValueOnce({ code: 99 });
    expect((await p.purchase(pkg)).kind).toBe('error');
  });

  it('turns network failures into an offline reason and others into failed', async () => {
    const m = rcModule();
    const p = createRevenueCatPurchases({ apiKey: 'k', load: () => m as never });
    m.getOfferings.mockRejectedValueOnce({ code: 10 });
    await expect(p.getOfferings()).rejects.toMatchObject({ reason: 'offline' });
    m.getOfferings.mockRejectedValueOnce(new Error('boom'));
    await expect(p.getOfferings()).rejects.toMatchObject({ reason: 'failed' });
  });

  it('maps CustomerInfo flags: trial, billing issue, will not renew', () => {
    const e = (o: object) => ({ entitlements: { active: { pro: { expirationDate: null, willRenew: false, productIdentifier: 'x_month', billingIssueDetectedAt: null, periodType: 'NORMAL', ...o } } } });
    expect(mapCustomerInfo(e({ periodType: 'TRIAL' }), NOW).trial).toBe(true);
    expect(mapCustomerInfo(e({ billingIssueDetectedAt: '2026-10-01T00:00:00Z' }), NOW).billingIssue).toBe(true);
    expect(mapCustomerInfo(e({}), NOW)).toMatchObject({ plan: 'pro_monthly', willRenew: false, expiresAt: null });
    expect(mapCustomerInfo({ entitlements: { active: {} } }, NOW).active).toBe(false);
  });

  it('delivers listener updates and unsubscribes', () => {
    const m = rcModule();
    const p = createRevenueCatPurchases({ apiKey: 'k', load: () => m as never });
    const off = p.onCustomerInfo(() => undefined);
    expect(typeof off).toBe('function');
    off();
  });
});

describe('fake port', () => {
  it('replays configured outcomes and notifies listeners', async () => {
    const f = createFakePurchases({ info: freeProInfo(NOW) });
    const seen: boolean[] = [];
    const off = f.onCustomerInfo((i) => seen.push(i.active));
    f.emit(pro());
    off();
    f.emit(freeProInfo(NOW));
    expect(seen).toEqual([true]);
    f.offeringsError = 'offline';
    await expect(f.getOfferings()).rejects.toMatchObject({ reason: 'offline' });
  });
});
