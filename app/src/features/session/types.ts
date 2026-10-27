// Session lane types. The shapes of PlanStep, SessionPlan, Timeline and the repository
// ports are structural copies of app/src/engine/types.ts and app/src/db/repositories.ts
// (those lanes are not merged into this branch yet). Real engine/db values are assignable
// to these types, so wiring is a single call to configureSessionDeps (see deps.ts).

export type Style = 'normal' | 'yoga' | 'dance';
export type Phase = 'warmup' | 'work' | 'cooldown';
export type StepMode = 'timed' | 'hold' | 'reps' | 'routine_step';
/** Easier, as planned, harder (D12). Yoga: gentler/deeper. Dance: low/high impact. */
export type Rung = -1 | 0 | 1;
/** Stored felt-effort enum (D12). */
export type Felt = 'easy' | 'about_right' | 'hard';
/** Feel sheet answer. Maps to a rung change and is stored as a feel signal. */
export type FeelValue = 'easy' | 'good' | 'hard';

export interface PlanStep {
  id: string;
  phase: Phase;
  exerciseId: string;
  name: string;
  mode: StepMode;
  sets: number;
  workS: number;
  restS: number;
  transitionS: number;
  sides: 'none' | 'each';
  rung: Rung;
  lowImpact: boolean;
  formCheckable: boolean;
}

export interface SessionPlan {
  id: string;
  title: string;
  style: Style;
  budgetS: number;
  steps: PlanStep[];
}

export type SegmentKind = 'work' | 'rest' | 'transition';

export interface TimelineSegment {
  index: number;
  kind: SegmentKind;
  phase: Phase;
  stepIndex: number;
  stepId: string;
  set: number;
  side: 'R' | 'L' | null;
  startS: number;
  durationS: number;
  endS: number;
}

export interface Timeline {
  segments: TimelineSegment[];
  totalS: number;
  warmupS: number;
  workS: number;
  cooldownS: number;
}

export interface TimelineOptions {
  rungBySet?: Readonly<Record<string, Rung>>;
}

/** Engine's `buildTimeline`. */
export type BuildTimeline = (plan: Pick<SessionPlan, 'steps'>, opts?: TimelineOptions) => Timeline;

/** Same key format as engine `setKey`. */
export function setKey(stepId: string, set: number): string {
  return `${stepId}#${set}`;
}

export type PauseReason = 'user' | 'call' | 'background' | 'headset' | 'audio_focus' | 'camera';

export interface SessionPrefs {
  voice: boolean;
  duck: boolean;
  lang: string;
  quiet: boolean;
  restS: 10 | 15 | 20 | 30;
}

export const DEFAULT_PREFS: SessionPrefs = {
  voice: true,
  duck: true,
  lang: 'en',
  quiet: false,
  restS: 20,
};

// ---- Persistence ports (structural copies of db/repositories) ----

export interface SessionSnapshotRow {
  planDayWeek: number | null;
  planDayIndex: number | null;
  startedAt: number;
  stateJson: string;
  snapshotAt: number;
  expiresAt: number;
}
export interface SnapshotPort {
  save(s: SessionSnapshotRow): Promise<void>;
  /** Returns null once expiresAt has passed. */
  load(now: number): Promise<SessionSnapshotRow | null>;
  clear(): Promise<void>;
}

export interface SessionLogRow {
  id: string;
  planWeek: number;
  planDay: number;
  style: Style;
  status: 'complete' | 'unfinished';
  durationS: number;
  movesDone: number;
  movesPlanned: number;
  felt: Felt | null;
  rungChanges: unknown[];
  feelSignals: unknown[];
  warmupSkipped: boolean;
  formChecks: number;
  quiet: boolean;
  completedAt: number;
}
export interface SessionLogPort {
  insert(log: SessionLogRow): Promise<boolean>;
}

export interface MicroLogPort {
  insert(m: { id: string; planId: string; activeS: number; at: number }): Promise<boolean>;
}

export interface PrefsPort {
  load(): Promise<Partial<SessionPrefs>>;
  save(prefs: SessionPrefs): Promise<void>;
}

// ---- Content port ----

export interface ExerciseInfo {
  id: string;
  cue: string;
  /** Two-frame SVG loop (D17). */
  demoFrames?: string[];
  alt?: string;
  breath?: { inS: number; outS: number };
  bpm?: number;
  /** Voice clip source per language. */
  voiceClips?: Record<string, number | string>;
}
export interface ContentPort {
  exercise(id: string): ExerciseInfo | null;
}

// ---- Services ----

export type CueKind =
  | 'get_ready'
  | 'step_start'
  | 'switch_sides'
  | 'rest'
  | 'up_next'
  | 'ten_seconds'
  | 'count'
  | 'halfway'
  | 'cooldown'
  | 'done'
  | 'paused'
  | 'resumed';

export interface Cue {
  kind: CueKind;
  /** Exercise name for step cues. */
  name?: string;
  exerciseId?: string;
  /** 3, 2 or 1 for count cues. */
  count?: number;
}

export interface CueService {
  play(cue: Cue, prefs: SessionPrefs): void;
  /** Stop anything playing (end of session, pause). */
  stop(): void;
}

export interface KeepAwakeService {
  activate(): void;
  deactivate(): void;
}

export interface Clock {
  /** Monotonic milliseconds. Never goes backwards, unaffected by wall-clock changes. */
  now(): number;
  /** Wall-clock epoch milliseconds, for snapshots and logs only. */
  wall(): number;
}

export interface SessionDeps {
  clock: Clock;
  buildTimeline: BuildTimeline;
  cues: CueService;
  keepAwake: KeepAwakeService;
  snapshot: SnapshotPort;
  sessionLog: SessionLogPort;
  micro: MicroLogPort;
  prefs: PrefsPort;
  content: ContentPort;
  newId(): string;
}
