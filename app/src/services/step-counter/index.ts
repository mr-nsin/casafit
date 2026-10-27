// Step counter service. Health Connect primary on Android, CoreMotion pedometer on iOS,
// fakes for Jest. Native libraries are required lazily so importing this file is safe in Jest.
// No GPS, no location permission, no minute buckets leave the device.

import { addDays, briskMinutes, localDateKey, parseDate, type TimeSpan } from '../../engine';
import type { StepRepo, StepSummary } from '../../db/repositories';
import { createHealthConnectCounter, type HealthConnectLib } from './healthConnect';
import { createPedometerCounter, type PedometerLib } from './pedometer';
import type { StepCounterService, StepSource } from './types';

export * from './types';
export { createFakeStepCounter } from './fake';
export type { FakeStepCounter } from './fake';
export { createHealthConnectCounter } from './healthConnect';
export type { HealthConnectLib, HealthConnectOptions } from './healthConnect';
export { createPedometerCounter } from './pedometer';
export type { PedometerLib, PedometerOptions } from './pedometer';

// ---- local days -------------------------------------------------------------------------

export const deviceTzOffsetMin = (at: number = Date.now()): number => -new Date(at).getTimezoneOffset();

export const todayKey = (now: number = Date.now(), tz: number = deviceTzOffsetMin(now)): string => localDateKey(now, tz);

/** [start, end) of a local calendar day as epoch ms. */
export function dayRange(date: string, tz: number = deviceTzOffsetMin()): { startMs: number; endMs: number } {
  const startMs = parseDate(date) - tz * 60_000;
  return { startMs, endMs: startMs + 86_400_000 };
}

// ---- singleton --------------------------------------------------------------------------

let current: StepCounterService | null = null;

export function setStepCounter(s: StepCounterService | null): void {
  current = s;
}

/** The counter the app shell configured, else one built for this platform. */
export function getStepCounter(): StepCounterService {
  if (!current) current = createPlatformStepCounter();
  return current;
}

declare const require: (id: string) => any;

/**
 * Builds the real counter. Android uses Health Connect; iOS uses the pedometer. Android
 * devices without Health Connect report hc_unavailable and the app shows the paused card.
 * (The Recording API fallback from the spike is not built; see the lane report.)
 */
export function createPlatformStepCounter(platform: 'ios' | 'android' | string = defaultPlatform()): StepCounterService {
  const openAppSettings = async () => {
    const { Linking } = require('react-native');
    await Linking.openSettings();
  };
  if (platform === 'android') {
    return createHealthConnectCounter({
      lib: lazyHealthConnect(),
      openStore: async () => {
        const { Linking } = require('react-native');
        await Linking.openURL('market://details?id=com.google.android.apps.healthdata');
      },
    });
  }
  const sensors = require('expo-sensors');
  return createPedometerCounter({
    lib: sensors.Pedometer as PedometerLib,
    platform: platform === 'ios' ? 'ios' : 'android',
    openSettings: openAppSettings,
  });
}

/** The phone's step sensor, live only (app open), for phones without Health Connect. Counts are partial. */
export function createLiveOnlyCounter(): StepCounterService {
  const sensors = require('expo-sensors');
  return createPedometerCounter({
    lib: sensors.Pedometer as PedometerLib,
    platform: 'android',
    openSettings: async () => {
      const { Linking } = require('react-native');
      await Linking.openSettings();
    },
  });
}

function defaultPlatform(): string {
  try {
    return require('react-native').Platform.OS;
  } catch {
    return 'ios';
  }
}

function lazyHealthConnect(): HealthConnectLib {
  let lib: HealthConnectLib | null = null;
  const get = () => (lib ??= require('react-native-health-connect') as HealthConnectLib);
  return {
    get SdkAvailabilityStatus() {
      return get().SdkAvailabilityStatus;
    },
    getSdkStatus: () => get().getSdkStatus(),
    initialize: () => get().initialize(),
    requestPermission: (p) => get().requestPermission(p),
    getGrantedPermissions: () => get().getGrantedPermissions(),
    aggregateRecord: (r) => get().aggregateRecord(r),
    aggregateGroupByDuration: (r) => get().aggregateGroupByDuration(r),
    openHealthConnectSettings: () => get().openHealthConnectSettings(),
  };
}

// ---- sync -------------------------------------------------------------------------------

const summarySource = (s: StepSource): StepSummary['source'] => (s === 'health_connect' ? 'health_connect' : 'pedometer');

/**
 * Rebuilds step_summary for the given dates: steps = the source's aggregate for that local
 * day (overwrite, never add); brisk minutes = minutes with 100+ steps minus declared reverse
 * bouts. When the source gives no minute buckets the earlier brisk value is kept.
 * Idempotent. Skips future days and writes nothing for a day the source cannot read.
 */
export async function syncDays(
  counter: StepCounterService,
  repo: StepRepo,
  dates: readonly string[],
  opts: { now?: number; tzOffsetMin?: number } = {},
): Promise<StepSummary['onDate'][]> {
  const now = opts.now ?? Date.now();
  const tz = opts.tzOffsetMin ?? deviceTzOffsetMin(now);
  const today = localDateKey(now, tz);
  const written: string[] = [];
  const earliest = dates.length ? [...dates].sort()[0]! : today;
  const bouts = await repo.boutsSince(dayRange(earliest, tz).startMs);
  const existing = new Map((await repo.range(earliest, today)).map((s) => [s.onDate, s]));
  for (const date of dates) {
    if (date > today) continue;
    const range = dayRange(date, tz);
    const reading = await counter.readRange(range);
    const spans: TimeSpan[] = bouts
      .filter((b) => b.startedAt < range.endMs && (b.endedAt ?? now) > range.startMs)
      .map((b) => ({ startMs: b.startedAt, endMs: b.endedAt ?? now }));
    const brisk = reading.minuteBuckets ? briskMinutes(reading.minuteBuckets, spans) : (existing.get(date)?.briskMinutes ?? 0);
    await repo.upsert({ onDate: date, steps: reading.steps, briskMinutes: brisk, source: summarySource(counter.source), updatedAt: now });
    written.push(date);
  }
  return written;
}

/** Dates `today - back .. today`, oldest first. */
export function recentDates(today: string, back: number): string[] {
  const out: string[] = [];
  for (let i = back; i >= 0; i -= 1) out.push(addDays(today, -i));
  return out;
}
