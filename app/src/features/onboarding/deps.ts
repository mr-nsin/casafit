// Dependency container for the onboarding lane. The app shell calls configureOnboardingDeps once;
// Jest passes fakes. Defaults are safe: online, bundled content, no server sync, no session hand-off.

import { loadContent } from '../../content';
import type { Catalogue, PlanDay } from '../../engine';
import { formatDate } from '../../engine';
import { contentToCatalogue } from './catalogue';

/** What the server may receive (D3). Health flags and pain areas are never in it. */
export interface ServerPlanBody {
  goal: 'stay_fit' | 'body_part' | 'gentler';
  stylesBitmask: number;
  daysPerWeek: number;
  experience: 'new' | 'on_and_off' | 'regular';
  variant: 'standard' | 'gentler';
}

export interface OnboardingDeps {
  now(): number;
  /** NetInfo wrapper. Splash never calls it; Verify and Offline do. */
  isOnline(): Promise<boolean>;
  catalogue(): Catalogue;
  /** Queue or send PUT /v1/me/plan. Building never waits for it. */
  syncPlan(body: ServerPlanBody): Promise<void>;
  /** Session lane hand-off: start today's session and return the stage route, or null to just go Home. */
  startToday(day: PlanDay): 'Player' | 'Yoga' | 'Dance' | null;
  openPrivacyNotice(): void;
  seed(): number;
}

async function defaultIsOnline(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = require('@react-native-community/netinfo').default as { fetch(): Promise<{ isConnected: boolean | null }> };
    const s = await NetInfo.fetch();
    return s.isConnected !== false;
  } catch {
    return true;
  }
}

let cached: Catalogue | null = null;

let deps: OnboardingDeps = {
  now: () => Date.now(),
  isOnline: defaultIsOnline,
  catalogue: () => (cached ??= (() => { const c = loadContent(); return contentToCatalogue(c.exercises, (k) => c.t(k)); })()),
  async syncPlan() {},
  startToday: () => null,
  openPrivacyNotice() {},
  seed: () => 1,
};

export function configureOnboardingDeps(partial: Partial<OnboardingDeps>): void {
  deps = { ...deps, ...partial };
}
export function getOnboardingDeps(): OnboardingDeps {
  return deps;
}

/** Local calendar date of "now" as 'YYYY-MM-DD'. */
export function todayKey(ms: number): string {
  const d = new Date(ms);
  return formatDate(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
