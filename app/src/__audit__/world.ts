// Builds the app's runtime around one screen: a throwaway database, the same wiring `bootstrap` gives
// the real app, and fakes for everything native or networked. Every fake records what the screen asks of it.

import { NetworkError } from '../api/client';
import { createTestDb } from '../db/testing/nodeSqliteDriver';
import type { Repositories } from '../db/repositories';
import { bootstrap } from '../app/bootstrap';
import { configureFormCheckDeps } from '../features/formcheck/deps';
import { useEntitlements } from '../features/formcheck/entitlements';
import { useFormCheck } from '../features/formcheck/controller';
import { configureOnboardingDeps } from '../features/onboarding/deps';
import { useVerifyOutcome } from '../features/onboarding/flowState';
import { configureNutritionDeps } from '../features/nutrition/deps';
import { configureSessionDeps } from '../features/session/deps';
import { useEditDraft } from '../features/session/browse/editing';
import { useSessionStore } from '../features/session/store';
import { useTrialNotice } from '../features/session/trial';
import { createHarness } from '../features/session/testkit';
import { seedPlan } from '../features/session/browse/testkit';
import { configureSettingsDeps } from '../features/settings/deps';
import { configureBoutDeps, useBout } from '../features/steps/reverseStore';
import { createFakeAuth, fakeSession, setAuth } from '../services/auth';
import { createFakeKeepAwake } from '../services/keep-awake';
import { createFakeNotificationService, setNotificationService, type OsPermission } from '../services/notifications';
import { createDevCameraPermission, type CameraPermission, type PoseFrame, type PoseSource } from '../services/pose';
import { DAY_MS, createFakePurchases, freeProInfo, setPurchases, type ProInfo } from '../services/purchases';
import { createFakeStepCounter, setStepCounter, type StepPermissionState } from '../services/step-counter';
import { useAuth } from '../state/auth';
import { setConsentSyncer, useConsent } from '../state/consent';
import { emptyDraft, useOnboarding } from '../state/onboardingDraft';
import { defaultPreferences, usePreferences } from '../state/preferences';
import { setRepositories } from '../state/storage';
import { recordCalls, callLog, resetCalls, spyOnSystem } from './instrument';

export interface WorldOptions {
  /** Default true. False leaves the auth store signed out (Welcome, Age and Verify screens). */
  signedIn?: boolean;
  /** Pro entitlement, with the shape the Manage Pro screen reads. */
  pro?: Partial<ProInfo> | false;
  freeChecks?: number;
  /** Every API call rejects with a NetworkError and the app reports offline. */
  offline?: boolean;
  camera?: CameraPermission;
  steps?: StepPermissionState;
  stepsToday?: number;
  notifications?: OsPermission;
  /** Seed a four-day plan. Default true. */
  plan?: boolean;
  /** 0 is a workout day; 2 a walk day; 4 a stretch day (see seedPlan). */
  dayOffset?: number;
  name?: string | null;
  painAreas?: string[];
  /** Seed local data for Nutrition and Progress. */
  history?: boolean;
  nutritionProfile?: boolean;
  hideCalories?: boolean;
}

export interface World {
  auth: ReturnType<typeof createFakeAuth>;
  notif: ReturnType<typeof createFakeNotificationService>;
  purchases: ReturnType<typeof createFakePurchases>;
  steps: ReturnType<typeof createFakeStepCounter>;
  permission: ReturnType<typeof createDevCameraPermission>;
  /** Canned answers for the API; replace to script a failure. */
  apiBehaviour: { fail: ((path: string, init?: RequestInit) => unknown) | null };
  repos: Repositories;
  rawRepos: Repositories;
  harness: ReturnType<typeof createHarness>;
  /** Local "today" for the seeded plan. */
  today: string;
  /** Feed frames to the live check, if one is running. */
  pushFrame(f: PoseFrame): void;
  close(): void;
}

export const NOW = Date.now();
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

let active: World | null = null;
let restoreSystem: (() => void) | null = null;

export async function closeWorld(): Promise<void> {
  restoreSystem?.();
  restoreSystem = null;
  active?.close();
  active = null;
}

export async function buildWorld(opts: WorldOptions = {}): Promise<World> {
  await closeWorld();
  resetCalls();
  restoreSystem = spyOnSystem();

  const db = await createTestDb();
  const repos = recordCalls('repos', db.repos);

  const rawAuth = createFakeAuth({ session: opts.signedIn === false ? null : fakeSession() });
  const auth = recordCalls('auth', rawAuth);
  setAuth(auth);
  const rawNotif = createFakeNotificationService(opts.notifications ?? 'granted');
  const notif = recordCalls('notifications', rawNotif);
  setNotificationService(notif);
  const proInfo: ProInfo | null = opts.pro
    ? {
        active: true,
        plan: 'pro_yearly',
        expiresAt: NOW + 300 * DAY_MS,
        willRenew: true,
        billingIssue: false,
        trial: false,
        priceString: '₹2,999',
        verifiedAt: NOW,
        ...opts.pro,
      }
    : null;
  const rawPurchases = createFakePurchases({ info: proInfo ?? freeProInfo(NOW) });
  const purchases = recordCalls('purchases', rawPurchases);
  setPurchases(purchases);
  const rawSteps = createFakeStepCounter({
      state: opts.steps ?? 'granted',
      reading: (r: { startMs: number; endMs: number }) => ({
        steps: r.startMs <= NOW && NOW < r.endMs ? (opts.stepsToday ?? 4820) : 0,
        minuteBuckets: null,
      }),
  });
  const steps = recordCalls('stepCounter', rawSteps);

  const sent: string[] = [];
  await bootstrap({
    openDatabase: async () => ({ driver: db.driver, repos }),
    hydrateAuth: async () => undefined,
    isOnline: async () => !opts.offline,
    send: async (item) => {
      sent.push(`queue ${item.method} ${item.path}`);
      callLog.effects.push(`queue.send ${item.method} ${item.path}`);
      return { status: 200 };
    },
    stepCounter: () => steps,
    keepAwake: () => createFakeKeepAwake(),
    openPrivacyNotice: () => {
      callLog.effects.push('openPrivacyNotice');
    },
  });

  // Stores back to a known state (bootstrap hydrated them from an empty database).
  useAuth.setState({
    session: opts.signedIn === false ? null : fakeSession(),
    account: opts.signedIn === false ? null : { email: 'priya@gmail.com', emailMasked: 'p***@gmail.com', provider: 'google' },
    freeChecksRemaining: opts.freeChecks ?? 2,
    pro: opts.pro ? { active: true, expiresAt: new Date(NOW + 300 * DAY_MS).toISOString() } : { active: false, expiresAt: null },
    sessionEnded: false,
  });
  useConsent.setState({ latest: {}, hydrated: true });
  useOnboarding.setState({ draft: emptyDraft(), hydrated: true });
  useVerifyOutcome.getState().reset();
  usePreferences.setState({ ...defaultPreferences(), hydrated: true, ...(opts.hideCalories ? { hideCalories: true } : {}) });
  useEditDraft.setState(useEditDraft.getInitialState?.() ?? {});
  useTrialNotice.setState({ message: null });
  useBout.getState().reset();
  setConsentSyncer(async () => {
    callLog.effects.push('consent.sync');
  });

  // Network: one place, with canned answers by path.
  const apiBehaviour: World['apiBehaviour'] = { fail: null };
  const api = async (path: string, init?: RequestInit): Promise<any> => {
    callLog.effects.push(`api ${init?.method ?? 'GET'} ${path}`);
    if (opts.offline) throw new NetworkError();
    if (apiBehaviour.fail) {
      const f = apiBehaviour.fail(path, init);
      if (f) throw f;
    }
    if (path === '/me/entitlements') {
      return { freeChecksRemaining: opts.freeChecks ?? 2, pro: opts.pro ? { active: true, expiresAt: new Date(NOW + 300 * DAY_MS).toISOString() } : { active: false, expiresAt: null } };
    }
    if (path === '/me') return init?.method === 'DELETE' ? null : { email: 'priya@gmail.com', emailMasked: 'p***@gmail.com', provider: 'google', freeChecksRemaining: opts.freeChecks ?? 2, pro: { active: !!opts.pro, expiresAt: null } };
    if (path === '/me/export') return { account: {}, plan: {}, sessions: [] };
    if (path.startsWith('/entitlements/form-check/consume')) return { ok: true, freeChecksRemaining: Math.max(0, (opts.freeChecks ?? 2) - 1) };
    return { ok: true };
  };
  configureSettingsDeps({
    api: api as never,
    share: async () => {
      callLog.effects.push('share');
    },
    openUrl: async (url) => {
      callLog.effects.push(`openUrl ${url}`);
    },
    now: () => NOW,
  });

  const permission = createDevCameraPermission(opts.camera ?? 'granted');
  let push: (f: PoseFrame) => void = () => undefined;
  const source: PoseSource = { kind: 'simulated', available: true, start: (cb: (f: PoseFrame) => void) => (push = cb), stop: () => undefined } as PoseSource;
  configureFormCheckDeps({
    api: api as never,
    now: () => NOW,
    openSettings: async () => {
      callLog.effects.push('openSettings');
    },
    openUrl: async (url) => {
      callLog.effects.push(`openUrl ${url}`);
    },
    poseSource: () => source,
    permission: () => permission,
  });
  useEntitlements.setState({ hydrated: true, freeChecks: opts.freeChecks ?? 2, pro: proInfo, offline: !!opts.offline, proChecksThisMonth: 0, welcomeKind: 'purchase' });
  useFormCheck.getState().reset();
  useFormCheck.getState().select('squat');

  configureNutritionDeps({ now: () => new Date(NOW) });
  configureOnboardingDeps({ now: () => NOW, seed: () => 7 });
  configureBoutDeps?.({ haptic: () => undefined });

  // Session lane: fake clock, cues, keep-awake, log and snapshot sinks. Real engine timeline is replaced by the
  // mirror in the testkit (the engine's own tests cover the real one), so ticks are fully deterministic.
  const harness = createHarness();
  useSessionStore.getState().reset();
  configureSessionDeps({ clock: harness.clock });

  let today = dayKey(NOW);
  if (opts.plan !== false) {
    today = await seedPlan(
      { repos: db.repos, driver: db.driver, close: () => undefined } as never,
      { dayOffset: opts.dayOffset, name: opts.name, painAreas: opts.painAreas },
    );
    // Monotonic time comes from the test clock (so a screen can be moved to minute 3); wall time is real, shifted to the chosen day.
    configureSessionDeps({ clock: { now: harness.clock.now, wall: () => Date.now() + (opts.dayOffset ?? 0) * DAY_MS } });
  } else {
    await db.repos.profile.save({ name: opts.name === undefined ? 'Priya' : opts.name, onboarded: true });
  }
  setRepositories(repos);

  if (opts.history) {
    await db.repos.sessionLog.insert({
      id: 'h1', planWeek: 1, planDay: 0, style: 'normal', status: 'complete', durationS: 900, movesDone: 8, movesPlanned: 8,
      felt: 'about_right', rungChanges: [], feelSignals: [], warmupSkipped: false, formChecks: 0, quiet: false, completedAt: NOW - DAY_MS,
    });
    await db.repos.steps.upsert?.({ onDate: dayKey(NOW - DAY_MS), steps: 5400, briskMinutes: 0, source: 'pedometer', updatedAt: NOW, syncedAt: null } as never);
  }
  if (opts.nutritionProfile) {
    await db.repos.nutrition.saveProfile?.({
      diet: 'veg', allergies: [], allergyOther: null, goal: 'maintain', mealsPerDay: 4, targetKcal: 1800, targetProteinG: 70, computedAt: NOW, inputsHash: 'x',
    } as never);
  }

  const world: World = {
    auth: rawAuth,
    notif: rawNotif,
    purchases: rawPurchases,
    steps: rawSteps,
    permission,
    apiBehaviour,
    repos,
    rawRepos: db.repos,
    harness,
    today,
    pushFrame: (f) => push(f),
    close() {
      useSessionStore.getState().reset();
      useFormCheck.getState().reset();
      useBout.getState().reset();
      setRepositories(null);
      setAuth(null);
      setNotificationService(null);
      setPurchases(null);
      setStepCounter(null);
      db.driver.close();
    },
  };
  active = world;
  return world;
}
