// Shared types for the pose engine and the pose source port. Pure TypeScript: no worklet,
// native or React imports, so Jest can run everything here.

/** Matches `consumeRequest.exercise` in @casafit/shared. */
export type FormExercise = 'squat' | 'push_up' | 'plank' | 'lunge';
export const FORM_EXERCISES: readonly FormExercise[] = ['squat', 'push_up', 'plank', 'lunge'];

/** What a rep can be faulted on. Exercises omit the areas they do not use. */
export type Issue = 'depth' | 'knees' | 'back' | 'hips' | 'elbows';
export type Rating = 'needs_work' | 'okay' | 'good';

/** One MediaPipe landmark: x and y normalised 0..1 (y down), visibility 0..1. */
export interface Landmark {
  x: number;
  y: number;
  v: number;
}

/** 33 landmarks (MediaPipe order) at time `t` in milliseconds. `w`/`h` scale x to the frame's aspect. */
export interface PoseFrame {
  t: number;
  lm: readonly Landmark[];
  w?: number;
  h?: number;
}

export type FramingHint = 'closer' | 'back' | 'lost' | 'position';

export type EngineEvent =
  | { k: 'framing'; ok: boolean; hint?: FramingHint }
  | { k: 'rep'; index: number; ok: boolean; issues: Issue[] }
  /** The rep in flight was dropped (framing lost). Neither clean nor faulty, and not counted. */
  | { k: 'unscored' }
  /** Rep 3 or a 10 second hold. The controller moves the attempt from armed to counted. */
  | { k: 'counted' }
  | { k: 'hold'; ms: number };

export interface EngineFinding {
  area: Issue;
  status: 'ok' | 'warn';
}

export interface EngineSummary {
  exercise: FormExercise;
  repsAnalysed: number;
  repsClean: number;
  perRep: { index: number; ok: boolean; issue?: Issue }[];
  findings: EngineFinding[];
  /** Null until at least one rep (or one hold block) was analysed. */
  rating: Rating | null;
  /** Plank only: longest continuous hold, in seconds. */
  holdSeconds?: number;
}

export interface Engine {
  readonly exercise: FormExercise;
  push(frame: PoseFrame): EngineEvent[];
  summary(): EngineSummary;
  /** Drops every frame-derived value. Called on blur, unmount and background. */
  reset(): void;
}

/** The call point of the spend: rep 3 for moving exercises, 10 s for the plank. */
export const COUNT_REPS = 3;
export const COUNT_HOLD_MS = 10_000;
