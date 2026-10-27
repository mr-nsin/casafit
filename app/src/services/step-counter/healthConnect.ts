// Android adapter: Health Connect. The library is injected so Jest never loads native code.
// Verified against react-native-health-connect 4.1.3 typings: getSdkStatus, initialize,
// requestPermission, getGrantedPermissions, aggregateRecord, aggregateGroupByDuration,
// openHealthConnectSettings. Totals use the un-filtered aggregate so Health Connect
// de-duplicates by the user's source priority; raw records are never summed.

import type { DayReading, StepCounterService, StepPermissionState, TimeRange } from './types';

type Range = { operator: 'between'; startTime: string; endTime: string };

/** The slice of react-native-health-connect that we use. */
export interface HealthConnectLib {
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: number;
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: number;
    SDK_AVAILABLE: number;
  };
  getSdkStatus(): Promise<number>;
  initialize(): Promise<boolean>;
  requestPermission(p: { accessType: 'read'; recordType: 'Steps' }[]): Promise<unknown[]>;
  getGrantedPermissions(): Promise<{ accessType?: string; recordType?: string }[]>;
  aggregateRecord(r: { recordType: 'Steps'; timeRangeFilter: Range }): Promise<{ COUNT_TOTAL?: number }>;
  aggregateGroupByDuration(r: {
    recordType: 'Steps';
    timeRangeFilter: Range;
    timeRangeSlicer: { duration: 'MINUTES'; length: number };
  }): Promise<{ result: { COUNT_TOTAL?: number }; startTime: string; endTime: string }[]>;
  openHealthConnectSettings(): void;
}

export interface HealthConnectOptions {
  lib: HealthConnectLib;
  /** Persisted denial count. Android stops prompting after two denials. */
  denials?: { get(): number; set(n: number): void };
  /** Opens the store page when the provider needs an update. */
  openStore?: () => Promise<void>;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function createHealthConnectCounter(opts: HealthConnectOptions): StepCounterService {
  const { lib } = opts;
  let denied = opts.denials?.get() ?? 0;
  let initialised = false;

  async function status(): Promise<StepPermissionState | 'available'> {
    let s: number;
    try {
      s = await lib.getSdkStatus();
    } catch {
      return 'hc_unavailable';
    }
    if (s === lib.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'hc_update_required';
    if (s !== lib.SdkAvailabilityStatus.SDK_AVAILABLE) return 'hc_unavailable';
    if (!initialised) {
      try {
        initialised = await lib.initialize();
      } catch {
        return 'hc_unavailable';
      }
      if (!initialised) return 'hc_unavailable';
    }
    return 'available';
  }

  async function hasRead(): Promise<boolean> {
    const granted = await lib.getGrantedPermissions();
    return granted.some((g) => g.recordType === 'Steps' && g.accessType === 'read');
  }

  return {
    source: 'health_connect',
    async getPermissionState() {
      const s = await status();
      if (s !== 'available') return s;
      if (await hasRead()) return 'granted';
      if (denied >= 2) return 'denied_permanent';
      return denied === 1 ? 'denied_can_ask' : 'needs_primer';
    },
    async requestPermission() {
      const s = await status();
      if (s !== 'available') return s;
      try {
        await lib.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
      } catch {
        /* counted as a denial below */
      }
      if (await hasRead()) return 'granted';
      denied += 1;
      opts.denials?.set(denied);
      return denied >= 2 ? 'denied_permanent' : 'denied_can_ask';
    },
    async openSystemSettings() {
      const s = await status();
      if (s === 'hc_update_required' && opts.openStore) return opts.openStore();
      lib.openHealthConnectSettings();
    },
    async readRange(range: TimeRange): Promise<DayReading> {
      const filter: Range = { operator: 'between', startTime: iso(range.startMs), endTime: iso(range.endMs) };
      const total = await lib.aggregateRecord({ recordType: 'Steps', timeRangeFilter: filter });
      let minuteBuckets: DayReading['minuteBuckets'] = null;
      try {
        const groups = await lib.aggregateGroupByDuration({
          recordType: 'Steps',
          timeRangeFilter: filter,
          timeRangeSlicer: { duration: 'MINUTES', length: 1 },
        });
        minuteBuckets = groups.map((g) => ({ startMs: Date.parse(g.startTime), steps: g.result.COUNT_TOTAL ?? 0 }));
      } catch {
        minuteBuckets = null; // steps still count; brisk minutes are skipped
      }
      return { steps: Math.round(total.COUNT_TOTAL ?? 0), minuteBuckets };
    },
    subscribeLive() {
      // Health Connect has no push stream. The screen re-reads every 60 s instead.
      return () => undefined;
    },
  };
}
