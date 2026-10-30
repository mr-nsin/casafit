// Test helpers for the onboarding lane. Only tests import this.

import { setRepositories } from '../../state/storage';
import { useOnboarding, emptyDraft } from '../../state/onboardingDraft';
import { useConsent } from '../../state/consent';
import { useAuth } from '../../state/auth';
import { createFakeAuth, setAuth, type FakeAuth } from '../../services/auth';
import { createTestDb } from '../../db/testing/nodeSqliteDriver';
import type { Repositories } from '../../db/repositories';
import { configureOnboardingDeps } from './deps';
import { useVerifyOutcome } from './flowState';

export const mockNav = {
  navigate: jest.fn(),
  replace: jest.fn(),
  reset: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export async function setupDb(): Promise<{ repos: Repositories; close: () => void; auth: FakeAuth }> {
  const { repos, driver } = await createTestDb();
  setRepositories(repos);
  useOnboarding.setState({ draft: emptyDraft(), hydrated: true });
  useConsent.setState({ latest: {}, hydrated: true });
  useVerifyOutcome.getState().reset();
  const auth = createFakeAuth();
  setAuth(auth);
  useAuth.setState({ session: null, account: null, sessionEnded: false, freeChecksRemaining: 2, pro: { active: false, expiresAt: null } });
  Object.values(mockNav).forEach((f) => f.mockClear());
  mockNav.canGoBack.mockReturnValue(true);
  configureOnboardingDeps({
    now: () => new Date(2026, 9, 27, 9, 0).getTime(), // Tue 27 Oct 2026, local
    isOnline: async () => true,
    syncPlan: async () => undefined,
    startToday: () => null,
    openPrivacyNotice: () => undefined,
    seed: () => 7,
  });
  return { repos, auth, close: () => { setRepositories(null); setAuth(null); driver.close(); } };
}

export function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}
