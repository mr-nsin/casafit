// Purchases port: the app talks to this interface, never to react-native-purchases directly.
// Prices are always the store's own strings; nothing in the app hard-codes an amount.

export type ProPlan = 'pro_monthly' | 'pro_yearly';

export interface StorePackage {
  id: string;
  plan: ProPlan;
  /** Store-localised, region-correct text such as the store shows it. The only price we display. */
  priceString: string;
  /** Numeric price in `currencyCode`, used only to work out a save percentage. */
  price: number;
  currencyCode: string;
  /** Opaque handle handed back to `purchase`. */
  native?: unknown;
}

export interface Offerings {
  packages: StorePackage[];
}

/** What we know about Pro, mapped from RevenueCat CustomerInfo. */
export interface ProInfo {
  active: boolean;
  plan: ProPlan | null;
  /** Epoch ms. */
  expiresAt: number | null;
  willRenew: boolean;
  billingIssue: boolean;
  trial: boolean;
  priceString: string | null;
  /** Epoch ms of the last time the store confirmed this. */
  verifiedAt: number;
}

export type PurchaseOutcome =
  | { kind: 'purchased'; info: ProInfo }
  | { kind: 'cancelled' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string };

export type UnavailableReason = 'unconfigured' | 'offline' | 'failed';

export class PurchasesUnavailableError extends Error {
  constructor(public readonly reason: UnavailableReason) {
    super(`Purchases unavailable: ${reason}`);
    this.name = 'PurchasesUnavailableError';
  }
}

export interface PurchasesPort {
  /** False when no RevenueCat key is set: every call then rejects with reason 'unconfigured'. */
  readonly configured: boolean;
  getOfferings(): Promise<Offerings>;
  purchase(pkg: StorePackage): Promise<PurchaseOutcome>;
  restore(): Promise<ProInfo>;
  customerInfo(): Promise<ProInfo>;
  /** Returns the unsubscribe function. */
  onCustomerInfo(listener: (info: ProInfo) => void): () => void;
  showManageSubscriptions(): Promise<void>;
}
