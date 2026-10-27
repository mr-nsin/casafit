import type { DayReading, StepCounterService, StepPermissionState, StepSource, TimeRange } from './types';

export interface FakeStepCounter extends StepCounterService {
  state: StepPermissionState;
  /** What requestPermission() will resolve to. */
  nextRequestResult: StepPermissionState;
  requests: number;
  settingsOpened: number;
  ranges: TimeRange[];
  emitLive(steps: number): void;
}

/** In-memory counter for Jest and the component gallery. */
export function createFakeStepCounter(
  opts: { source?: StepSource; state?: StepPermissionState; reading?: DayReading | ((r: TimeRange) => DayReading) } = {},
): FakeStepCounter {
  const listeners = new Set<(n: number) => void>();
  const fake: FakeStepCounter = {
    source: opts.source ?? 'health_connect',
    state: opts.state ?? 'needs_primer',
    nextRequestResult: 'granted',
    requests: 0,
    settingsOpened: 0,
    ranges: [],
    async getPermissionState() {
      return fake.state;
    },
    async requestPermission() {
      fake.requests += 1;
      fake.state = fake.nextRequestResult;
      return fake.state;
    },
    async openSystemSettings() {
      fake.settingsOpened += 1;
    },
    async readRange(range) {
      fake.ranges.push(range);
      const r = opts.reading;
      if (typeof r === 'function') return r(range);
      return r ?? { steps: 0, minuteBuckets: null };
    },
    subscribeLive(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    emitLive(n) {
      listeners.forEach((l) => l(n));
    },
  };
  return fake;
}
