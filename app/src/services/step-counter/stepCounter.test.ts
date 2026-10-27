import { createTestDb } from '../../db/testing/nodeSqliteDriver';
import {
  createFakeStepCounter,
  createHealthConnectCounter,
  createPedometerCounter,
  dayRange,
  recentDates,
  syncDays,
  type HealthConnectLib,
  type PedometerLib,
} from '.';

function hcLib(over: Partial<HealthConnectLib> & { granted?: boolean[] } = {}): HealthConnectLib & { calls: string[] } {
  const calls: string[] = [];
  let grantedNow = false;
  const lib: HealthConnectLib & { calls: string[] } = {
    calls,
    SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 },
    getSdkStatus: async () => 3,
    initialize: async () => true,
    requestPermission: async () => {
      calls.push('request');
      grantedNow = over.granted?.shift() ?? false;
      return [];
    },
    getGrantedPermissions: async () => (grantedNow ? [{ accessType: 'read', recordType: 'Steps' }] : []),
    aggregateRecord: async () => ({ COUNT_TOTAL: 4820 }),
    aggregateGroupByDuration: async () => [],
    openHealthConnectSettings: () => {
      calls.push('settings');
    },
    ...over,
  };
  return lib;
}

describe('Health Connect adapter', () => {
  it('walks needs_primer, denied_can_ask, denied_permanent and persists denials', async () => {
    let saved = 0;
    const c = createHealthConnectCounter({ lib: hcLib({ granted: [false, false] }), denials: { get: () => saved, set: (n) => (saved = n) } });
    expect(await c.getPermissionState()).toBe('needs_primer');
    expect(await c.requestPermission()).toBe('denied_can_ask');
    expect(await c.requestPermission()).toBe('denied_permanent');
    expect(saved).toBe(2);
    expect(await c.getPermissionState()).toBe('denied_permanent');
  });

  it('is granted once READ_STEPS is held', async () => {
    const c = createHealthConnectCounter({ lib: hcLib({ granted: [true] }) });
    expect(await c.requestPermission()).toBe('granted');
    expect(await c.getPermissionState()).toBe('granted');
  });

  it('reports update-required and unavailable providers', async () => {
    const upd = createHealthConnectCounter({ lib: hcLib({ getSdkStatus: async () => 2 }) });
    expect(await upd.getPermissionState()).toBe('hc_update_required');
    const none = createHealthConnectCounter({ lib: hcLib({ getSdkStatus: async () => 1 }) });
    expect(await none.requestPermission()).toBe('hc_unavailable');
    const broken = createHealthConnectCounter({ lib: hcLib({ getSdkStatus: async () => { throw new Error('x'); } }) });
    expect(await broken.getPermissionState()).toBe('hc_unavailable');
  });

  it('reads the un-filtered aggregate and per-minute buckets', async () => {
    const lib = hcLib({
      aggregateGroupByDuration: async () => [
        { result: { COUNT_TOTAL: 110 }, startTime: '2026-10-27T05:00:00.000Z', endTime: '2026-10-27T05:01:00.000Z' },
      ],
    });
    const spy = jest.spyOn(lib, 'aggregateRecord');
    const c = createHealthConnectCounter({ lib });
    const r = await c.readRange({ startMs: 0, endMs: 86_400_000 });
    expect(r.steps).toBe(4820);
    expect(r.minuteBuckets).toEqual([{ startMs: Date.parse('2026-10-27T05:00:00.000Z'), steps: 110 }]);
    expect(spy.mock.calls[0]![0]).not.toHaveProperty('dataOriginFilter');
  });

  it('keeps steps when minute buckets fail', async () => {
    const c = createHealthConnectCounter({ lib: hcLib({ aggregateGroupByDuration: async () => { throw new Error('no'); } }) });
    expect(await c.readRange({ startMs: 0, endMs: 1 })).toEqual({ steps: 4820, minuteBuckets: null });
  });

  it('opens the store for an update and settings otherwise', async () => {
    const lib = hcLib();
    let store = 0;
    const c = createHealthConnectCounter({ lib, openStore: async () => { store += 1; } });
    await c.openSystemSettings();
    expect(lib.calls).toContain('settings');
    const upd = createHealthConnectCounter({ lib: hcLib({ getSdkStatus: async () => 2 }), openStore: async () => { store += 1; } });
    await upd.openSystemSettings();
    expect(store).toBe(1);
  });
});

describe('Pedometer adapter', () => {
  const lib = (status = 'granted', canAskAgain = true): PedometerLib => ({
    isAvailableAsync: async () => true,
    getPermissionsAsync: async () => ({ status, canAskAgain }),
    requestPermissionsAsync: async () => ({ status: 'denied', canAskAgain: false }),
    getStepCountAsync: async (a, b) => ({ steps: b.getTime() - a.getTime() >= 3_600_000 ? 900 : 120 }),
    watchStepCount: (cb) => {
      cb({ steps: 5 });
      return { remove() {} };
    },
  });

  it('maps permission states', async () => {
    const mk = (s: string, ask: boolean) => createPedometerCounter({ lib: lib(s, ask), platform: 'ios', openSettings: async () => {} });
    expect(await mk('granted', true).getPermissionState()).toBe('granted');
    expect(await mk('undetermined', true).getPermissionState()).toBe('needs_primer');
    expect(await mk('denied', true).getPermissionState()).toBe('denied_can_ask');
    expect(await mk('denied', false).getPermissionState()).toBe('denied_permanent');
    expect(await mk('granted', true).requestPermission()).toBe('denied_permanent');
  });

  it('reads iOS history with per-minute buckets, never past now', async () => {
    const start = Date.UTC(2026, 9, 27);
    const c = createPedometerCounter({ lib: lib(), platform: 'ios', openSettings: async () => {}, now: () => start + 3 * 60_000 + 5_000 });
    const r = await c.readRange({ startMs: start, endMs: start + 86_400_000 });
    expect(r.steps).toBe(120);
    expect(r.minuteBuckets).toHaveLength(4);
  });

  it('Android pedometer is live only with no history', async () => {
    const c = createPedometerCounter({ lib: lib(), platform: 'android', openSettings: async () => {} });
    expect(c.source).toBe('live_only');
    expect(await c.readRange({ startMs: 0, endMs: 1 })).toEqual({ steps: 0, minuteBuckets: null });
    const seen: number[] = [];
    c.subscribeLive((n) => seen.push(n))();
    expect(seen).toEqual([5]);
  });
});

describe('syncDays', () => {
  it('overwrites a day, computes brisk minutes and excludes reverse bouts', async () => {
    const db = await createTestDb();
    const tz = 0;
    const day = '2026-10-27';
    const { startMs } = dayRange(day, tz);
    const buckets = [0, 1, 2, 3].map((i) => ({ startMs: startMs + 3_600_000 + i * 60_000, steps: 110 }));
    const counter = createFakeStepCounter({ state: 'granted', reading: { steps: 5000, minuteBuckets: buckets } });
    await db.repos.steps.startBout({ id: 'b', startedAt: startMs + 3_600_000 + 60_000 });
    await db.repos.steps.endBout('b', startMs + 3_600_000 + 150_000, 20, 'user');
    const now = startMs + 7_200_000;
    await syncDays(counter, db.repos.steps, [day, '2026-10-28'], { now, tzOffsetMin: tz });
    await syncDays(counter, db.repos.steps, [day], { now, tzOffsetMin: tz });
    const rows = await db.repos.steps.range(day, '2026-10-28');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ steps: 5000, briskMinutes: 2, source: 'health_connect' });
    db.driver.close();
  });

  it('keeps earlier brisk minutes when the source has no buckets', async () => {
    const db = await createTestDb();
    const day = '2026-10-27';
    await db.repos.steps.upsert({ onDate: day, steps: 1, briskMinutes: 7, source: 'pedometer', updatedAt: 1 });
    const counter = createFakeStepCounter({ reading: { steps: 900, minuteBuckets: null } });
    await syncDays(counter, db.repos.steps, [day], { now: dayRange(day, 0).startMs + 1000, tzOffsetMin: 0 });
    expect((await db.repos.steps.range(day, day))[0]).toMatchObject({ steps: 900, briskMinutes: 7 });
    db.driver.close();
  });

  it('recentDates lists oldest first', () => {
    expect(recentDates('2026-10-27', 2)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27']);
  });
});
