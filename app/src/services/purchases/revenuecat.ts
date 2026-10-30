// The real port over react-native-purchases. The module is required lazily so a build without the
// native store module (or a missing API key) degrades to "unavailable" instead of crashing.

import Constants from 'expo-constants';

import {
  PurchasesUnavailableError,
  type Offerings,
  type ProInfo,
  type ProPlan,
  type PurchaseOutcome,
  type PurchasesPort,
  type StorePackage,
} from './types';

/** The RevenueCat public SDK key comes from the environment or app config, never from source. */
export function revenueCatKey(): string | null {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? (Constants.expoConfig?.extra?.revenueCatKey as string | undefined);
  return key && key.trim() ? key.trim() : null;
}

interface RcProduct {
  identifier: string;
  priceString: string;
  price: number;
  currencyCode: string;
}
interface RcPackage {
  identifier: string;
  packageType: string;
  product: RcProduct;
}
interface RcEntitlement {
  expirationDate: string | null;
  willRenew: boolean;
  productIdentifier: string;
  billingIssueDetectedAt: string | null;
  periodType: string;
}
export interface RcCustomerInfo {
  entitlements: { active: Record<string, RcEntitlement | undefined> };
}
export interface RcModule {
  configure(c: { apiKey: string }): void;
  getOfferings(): Promise<{ current: { availablePackages: RcPackage[] } | null }>;
  purchasePackage(p: RcPackage): Promise<{ customerInfo: RcCustomerInfo }>;
  restorePurchases(): Promise<RcCustomerInfo>;
  getCustomerInfo(): Promise<RcCustomerInfo>;
  addCustomerInfoUpdateListener(l: (i: RcCustomerInfo) => void): void;
  removeCustomerInfoUpdateListener(l: (i: RcCustomerInfo) => void): boolean;
  showManageSubscriptions(): Promise<void>;
  PURCHASES_ERROR_CODE?: Record<string, string | number>;
}

export const ENTITLEMENT_ID = 'pro';

const planOf = (pkg: { packageType?: string; identifier?: string; productId?: string }): ProPlan | null => {
  const s = `${pkg.packageType ?? ''} ${pkg.identifier ?? ''} ${pkg.productId ?? ''}`.toLowerCase();
  if (/annual|year/.test(s)) return 'pro_yearly';
  if (/month/.test(s)) return 'pro_monthly';
  return null;
};

export function mapCustomerInfo(ci: RcCustomerInfo, now: number, prices: Record<string, string> = {}): ProInfo {
  const e = ci.entitlements.active[ENTITLEMENT_ID];
  if (!e) return { active: false, plan: null, expiresAt: null, willRenew: false, billingIssue: false, trial: false, priceString: null, verifiedAt: now };
  return {
    active: true,
    plan: planOf({ productId: e.productIdentifier }),
    expiresAt: e.expirationDate ? Date.parse(e.expirationDate) : null,
    willRenew: !!e.willRenew,
    billingIssue: !!e.billingIssueDetectedAt,
    trial: e.periodType === 'TRIAL' || e.periodType === 'INTRO',
    priceString: prices[e.productIdentifier] ?? null,
    verifiedAt: now,
  };
}

export function createRevenueCatPurchases(opts: { apiKey?: string | null; now?: () => number; load?: () => RcModule } = {}): PurchasesPort {
  const key = opts.apiKey === undefined ? revenueCatKey() : opts.apiKey;
  const now = opts.now ?? Date.now;
  let rc: RcModule | null = null;
  let ready = false;
  const prices: Record<string, string> = {};

  const sdk = (): RcModule => {
    if (!key) throw new PurchasesUnavailableError('unconfigured');
    if (!rc) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        rc = opts.load ? opts.load() : ((require('react-native-purchases') as { default: RcModule }).default as RcModule);
      } catch {
        throw new PurchasesUnavailableError('failed');
      }
    }
    if (!ready) {
      try {
        rc.configure({ apiKey: key });
        ready = true;
      } catch {
        throw new PurchasesUnavailableError('failed');
      }
    }
    return rc;
  };
  async function wrap<T>(fn: (m: RcModule) => Promise<T>): Promise<T> {
    const m = sdk();
    try {
      return await fn(m);
    } catch (e) {
      if (e instanceof PurchasesUnavailableError) throw e;
      const err = e as { code?: string | number };
      const net = m.PURCHASES_ERROR_CODE?.NETWORK_ERROR;
      throw new PurchasesUnavailableError(net !== undefined && err.code === net ? 'offline' : 'failed');
    }
  }

  return {
    configured: !!key,
    getOfferings: () =>
      wrap(async (m): Promise<Offerings> => {
        const o = await m.getOfferings();
        const packages: StorePackage[] = [];
        for (const p of o.current?.availablePackages ?? []) {
          const plan = planOf(p);
          if (!plan) continue;
          prices[p.product.identifier] = p.product.priceString;
          packages.push({ id: p.identifier, plan, priceString: p.product.priceString, price: p.product.price, currencyCode: p.product.currencyCode, native: p });
        }
        return { packages };
      }),
    async purchase(pkg): Promise<PurchaseOutcome> {
      const m = sdk();
      try {
        const r = await m.purchasePackage(pkg.native as RcPackage);
        return { kind: 'purchased', info: mapCustomerInfo(r.customerInfo, now(), prices) };
      } catch (e) {
        const err = e as { userCancelled?: boolean; code?: string | number };
        if (err.userCancelled) return { kind: 'cancelled' };
        const pending = m.PURCHASES_ERROR_CODE?.PAYMENT_PENDING_ERROR;
        if (pending !== undefined && err.code === pending) return { kind: 'pending' };
        return { kind: 'error', message: 'The store could not finish the purchase.' };
      }
    },
    restore: () => wrap(async (m) => mapCustomerInfo(await m.restorePurchases(), now(), prices)),
    customerInfo: () => wrap(async (m) => mapCustomerInfo(await m.getCustomerInfo(), now(), prices)),
    onCustomerInfo(listener) {
      let m: RcModule;
      try {
        m = sdk();
      } catch {
        return () => undefined;
      }
      const l = (ci: RcCustomerInfo) => listener(mapCustomerInfo(ci, now(), prices));
      m.addCustomerInfoUpdateListener(l);
      return () => {
        m.removeCustomerInfoUpdateListener(l);
      };
    },
    showManageSubscriptions: () => wrap((m) => m.showManageSubscriptions()),
  };
}
