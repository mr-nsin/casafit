// iOS adapter: CoreMotion through expo-sensors Pedometer (58.0.4). getStepCountAsync is iOS
// only and covers about 7 days. On Android the same module only gives live counts, so the
// adapter reports source 'live_only' there and reads no history (the "partial" state).

import type { DayReading, MinuteBucket, StepCounterService, StepPermissionState, StepSource, TimeRange } from './types';

export interface PedometerLib {
  isAvailableAsync(): Promise<boolean>;
  getPermissionsAsync(): Promise<{ status: string; canAskAgain: boolean }>;
  requestPermissionsAsync(): Promise<{ status: string; canAskAgain: boolean }>;
  getStepCountAsync(start: Date, end: Date): Promise<{ steps: number }>;
  watchStepCount(cb: (r: { steps: number }) => void): { remove(): void };
}

export interface PedometerOptions {
  lib: PedometerLib;
  platform: 'ios' | 'android';
  openSettings: () => Promise<void>;
  /** Per-minute CoreMotion queries for brisk minutes. Throttling cost is unverified (spike 3). */
  perMinute?: boolean;
  now?: () => number;
}

const MINUTE = 60_000;
const BATCH = 30;

export function createPedometerCounter(opts: PedometerOptions): StepCounterService {
  const { lib } = opts;
  const now = opts.now ?? Date.now;
  const source: StepSource = opts.platform === 'ios' ? 'coremotion' : 'live_only';

  const map = (p: { status: string; canAskAgain: boolean }): StepPermissionState => {
    if (p.status === 'granted') return 'granted';
    if (p.status === 'undetermined') return 'needs_primer';
    return p.canAskAgain ? 'denied_can_ask' : 'denied_permanent';
  };

  return {
    source,
    async getPermissionState() {
      if (!(await lib.isAvailableAsync())) return 'hc_unavailable';
      return map(await lib.getPermissionsAsync());
    },
    async requestPermission() {
      return map(await lib.requestPermissionsAsync());
    },
    openSystemSettings: opts.openSettings,
    async readRange(range: TimeRange): Promise<DayReading> {
      if (opts.platform !== 'ios') return { steps: 0, minuteBuckets: null };
      const end = Math.min(range.endMs, now());
      if (end <= range.startMs) return { steps: 0, minuteBuckets: [] };
      const { steps } = await lib.getStepCountAsync(new Date(range.startMs), new Date(end));
      if (opts.perMinute === false) return { steps, minuteBuckets: null };
      const starts: number[] = [];
      for (let t = Math.floor(range.startMs / MINUTE) * MINUTE; t < end; t += MINUTE) starts.push(t);
      const buckets: MinuteBucket[] = [];
      for (let i = 0; i < starts.length; i += BATCH) {
        const part = await Promise.all(
          starts.slice(i, i + BATCH).map(async (startMs) => ({
            startMs,
            steps: (await lib.getStepCountAsync(new Date(startMs), new Date(startMs + MINUTE))).steps,
          })),
        );
        buckets.push(...part.filter((b) => b.steps > 0));
      }
      return { steps, minuteBuckets: buckets };
    },
    subscribeLive(cb) {
      const sub = lib.watchStepCount((r) => cb(r.steps));
      return () => sub.remove();
    },
  };
}
