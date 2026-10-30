import {
  PurchasesUnavailableError,
  type Offerings,
  type ProInfo,
  type PurchaseOutcome,
  type PurchasesPort,
  type StorePackage,
  type UnavailableReason,
} from './types';

/** Sample offerings for tests and dev. The strings only imitate a store; real builds read the store's. */
export const SAMPLE_OFFERINGS: Offerings = {
  packages: [
    { id: 'annual', plan: 'pro_yearly', priceString: 'SAMPLE-Y', price: 1000, currencyCode: 'XXX' },
    { id: 'monthly', plan: 'pro_monthly', priceString: 'SAMPLE-M', price: 100, currencyCode: 'XXX' },
  ],
};

export interface FakePurchases extends PurchasesPort {
  calls: string[];
  /** Behaviour switches, changeable between calls. */
  offerings: Offerings;
  offeringsError: UnavailableReason | null;
  purchaseOutcome: PurchaseOutcome | 'hang';
  restoreInfo: ProInfo | null;
  restoreError: UnavailableReason | null;
  info: ProInfo;
  infoError: UnavailableReason | null;
  /** Pushes a CustomerInfo update to listeners. */
  emit(info: ProInfo): void;
  /** Resolves a hanging purchase. */
  settle(outcome: PurchaseOutcome): void;
}

export function createFakePurchases(init: { configured?: boolean; info: ProInfo }): FakePurchases {
  const listeners = new Set<(i: ProInfo) => void>();
  let release: ((o: PurchaseOutcome) => void) | null = null;
  const configured = init.configured ?? true;
  const gate = (reason: UnavailableReason | null) => {
    if (!configured) throw new PurchasesUnavailableError('unconfigured');
    if (reason) throw new PurchasesUnavailableError(reason);
  };
  const fake: FakePurchases = {
    configured,
    calls: [],
    offerings: SAMPLE_OFFERINGS,
    offeringsError: null,
    purchaseOutcome: { kind: 'cancelled' },
    restoreInfo: null,
    restoreError: null,
    info: init.info,
    infoError: null,
    async getOfferings() {
      fake.calls.push('getOfferings');
      gate(fake.offeringsError);
      return fake.offerings;
    },
    async purchase(pkg: StorePackage) {
      fake.calls.push(`purchase:${pkg.id}`);
      gate(null);
      if (fake.purchaseOutcome === 'hang') return new Promise<PurchaseOutcome>((r) => (release = r));
      if (fake.purchaseOutcome.kind === 'purchased') fake.info = fake.purchaseOutcome.info;
      return fake.purchaseOutcome;
    },
    async restore() {
      fake.calls.push('restore');
      gate(fake.restoreError);
      if (fake.restoreInfo) fake.info = fake.restoreInfo;
      return fake.restoreInfo ?? fake.info;
    },
    async customerInfo() {
      fake.calls.push('customerInfo');
      gate(fake.infoError);
      return fake.info;
    },
    onCustomerInfo(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    async showManageSubscriptions() {
      fake.calls.push('manage');
    },
    emit(info) {
      fake.info = info;
      listeners.forEach((l) => l(info));
    },
    settle(outcome) {
      if (outcome.kind === 'purchased') fake.info = outcome.info;
      release?.(outcome);
      release = null;
    },
  };
  return fake;
}
