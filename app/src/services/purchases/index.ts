import { createRevenueCatPurchases } from './revenuecat';
import type { PurchasesPort } from './types';

export * from './types';
export * from './pricing';
export * from './entitlement';
export { createFakePurchases, SAMPLE_OFFERINGS } from './fake';
export type { FakePurchases } from './fake';
export { createRevenueCatPurchases, revenueCatKey, mapCustomerInfo, ENTITLEMENT_ID } from './revenuecat';

let current: PurchasesPort | null = null;
export const getPurchases = (): PurchasesPort => (current ??= createRevenueCatPurchases());
export function setPurchases(p: PurchasesPort | null): void {
  current = p;
}
