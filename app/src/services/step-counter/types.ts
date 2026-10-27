// Step counting behind one interface. No GPS and no location permission anywhere in this
// module. All-day counting is done by the OS (Health Connect, CoreMotion); the app only
// reads on open and on foreground (docs/plans/spikes/steps.md).

export type StepSource = 'health_connect' | 'coremotion' | 'live_only' | 'none';

export type StepPermissionState =
  | 'unknown'
  | 'needs_primer' // never asked: show the primer
  | 'denied_can_ask' // denied once, the OS will still prompt
  | 'denied_permanent' // only Settings can change it
  | 'hc_unavailable' // no Health Connect and no fallback
  | 'hc_update_required' // provider needs an update from the store
  | 'granted';

/** Steps in one clock minute starting at startMs. */
export interface MinuteBucket {
  startMs: number;
  steps: number;
}

export interface DayReading {
  steps: number;
  /** Per-minute counts when the source can give them, else null (no brisk minutes then). */
  minuteBuckets: MinuteBucket[] | null;
}

export interface TimeRange {
  startMs: number;
  endMs: number;
}

export interface StepCounterService {
  readonly source: StepSource;
  /** Always re-read from the OS. */
  getPermissionState(): Promise<StepPermissionState>;
  /** Call only after the consent record for 'steps' is written. */
  requestPermission(): Promise<StepPermissionState>;
  openSystemSettings(): Promise<void>;
  /** Total steps and minute buckets for the [startMs, endMs) range (one local day). */
  readRange(range: TimeRange): Promise<DayReading>;
  /** Foreground only. The callback gets steps counted since subscribing. */
  subscribeLive(cb: (stepsSinceStart: number) => void): () => void;
}
