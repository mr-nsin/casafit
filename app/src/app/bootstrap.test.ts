import { createTestDb } from '../db/testing/nodeSqliteDriver';
import { getOnboardingDeps } from '../features/onboarding';
import { getSessionDeps } from '../features/session';
import { createFakeStepCounter, getStepCounter, setStepCounter } from '../services/step-counter';
import { createFakeKeepAwake } from '../services/keep-awake';
import { hasRepositories, setRepositories } from '../state/storage';
import { usePreferences } from '../state/preferences';
import { bootstrap, type BootstrapIO } from './bootstrap';

const fakeCounter = createFakeStepCounter();
const keepAwake = createFakeKeepAwake();
const sent: { key: string; path: string; method: string; body: unknown }[] = [];

function fakeIO(over: Partial<BootstrapIO> = {}): Partial<BootstrapIO> {
  return {
    openDatabase: async () => {
      const { driver, repos } = await createTestDb();
      return { driver, repos };
    },
    hydrateAuth: async () => undefined,
    isOnline: async () => false,
    send: async (item) => {
      sent.push({ key: item.idempotencyKey, path: item.path, method: item.method, body: item.body });
      return { status: 200 };
    },
    stepCounter: () => fakeCounter,
    cueBackends: () => ({ audio: { play() {}, stop() {} }, haptics: { fire() {} } }),
    keepAwake: () => keepAwake,
    ...over,
  };
}

afterEach(() => {
  setRepositories(null);
  setStepCounter(null);
  sent.length = 0;
});

describe('bootstrap', () => {
  it('opens the db, publishes repositories and hydrates stores', async () => {
    const res = await bootstrap(fakeIO());
    expect(hasRepositories()).toBe(true);
    expect(res.repos).toBeDefined();
    expect(usePreferences.getState().hydrated).toBe(true);
  });

  it('configures every lane', async () => {
    await bootstrap(fakeIO());
    await expect(getOnboardingDeps().isOnline()).resolves.toBe(false);
    expect(getSessionDeps().keepAwake).toBe(keepAwake);
    expect(getSessionDeps().content.exercise('no-such-exercise')).toBeNull();
    expect(getStepCounter()).toBe(fakeCounter);
  });

  it('queues the plan with an idempotency key and flushes it', async () => {
    const res = await bootstrap(fakeIO());
    const body = { goal: 'stay_fit', styles: 1, days: 4, experience: 'new', variant: 'standard' } as const;
    await getOnboardingDeps().syncPlan(body);
    await res.flushQueue();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ path: '/me/plan', method: 'PUT', body });
    expect(sent[0]!.key.length).toBeGreaterThan(8);
  });

  it('keeps the plan queued while offline', async () => {
    const res = await bootstrap(fakeIO({ send: async () => { throw new Error('offline'); } }));
    await getOnboardingDeps().syncPlan({ goal: 'gentler', styles: 1, days: 3, experience: 'new', variant: 'gentler' });
    await res.flushQueue();
    expect((await res.queue.pending()).length).toBe(1);
  });

  it('survives a failed auth hydrate', async () => {
    await expect(bootstrap(fakeIO({ hydrateAuth: async () => { throw new Error('secure store'); } }))).resolves.toBeDefined();
  });

  it('rejects when the database cannot open so the caller can show the error screen', async () => {
    await expect(bootstrap(fakeIO({ openDatabase: async () => { throw new Error('disk full'); } }))).rejects.toThrow('disk full');
    expect(hasRepositories()).toBe(false);
  });
});
