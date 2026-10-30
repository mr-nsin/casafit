import type { Offerings, StorePackage } from './types';

export const packageFor = (o: Offerings, plan: StorePackage['plan']): StorePackage | undefined => o.packages.find((p) => p.plan === plan);

/**
 * Whole-number percent saved by paying yearly instead of twelve months. Null when it cannot be
 * worked out honestly (a missing plan, different currencies, no real saving), so the UI hides it.
 */
export function savePercent(o: Offerings): number | null {
  const y = packageFor(o, 'pro_yearly');
  const m = packageFor(o, 'pro_monthly');
  if (!y || !m) return null;
  if (!(y.price > 0) || !(m.price > 0) || y.currencyCode !== m.currencyCode) return null;
  const pct = Math.round((1 - y.price / (m.price * 12)) * 100);
  return pct >= 1 && pct <= 99 ? pct : null;
}
