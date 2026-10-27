/**
 * Engine types. The engine is pure TypeScript and imports nothing but its own files.
 * Value unions mirror docs/plans/screens/onboarding.md and session.md.
 */

export type Style = 'normal' | 'yoga' | 'dance';
export type BodyPart = 'arms' | 'chest' | 'back' | 'shoulders' | 'core' | 'glutes' | 'legs';
export type Goal = 'stay_fit' | 'body_part';
export type Sex = 'woman' | 'man' | 'other';
export type Experience = 'new' | 'on_and_off' | 'regular';
export type PainArea = 'knees' | 'back' | 'shoulders' | 'wrists' | 'other';
export type HealthFlag = 'heart_bp' | 'pregnancy' | 'recent_surgery';
/** Stored felt-effort enum (D12). */
export type Felt = 'easy' | 'about_right' | 'hard';
/** Runtime intensity: easier, as planned, harder. */
export type Rung = -1 | 0 | 1;
export type Phase = 'warmup' | 'work' | 'cooldown';
export type StepMode = 'timed' | 'hold' | 'reps' | 'routine_step';
export type Pattern = 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'mobility' | 'flow' | 'dance';
export type Impact = 'none' | 'low' | 'high';
/** What a session emphasises. `full` is a mixed full-body day, `parts` targets chosen body parts. */
export type Focus = 'push' | 'pull' | 'legs' | 'core' | 'cardio' | 'full' | 'parts';
export type PlanVariant = 'standard' | 'gentler';

export const BODY_PARTS: readonly BodyPart[] = [
  'arms',
  'chest',
  'back',
  'shoulders',
  'core',
  'glutes',
  'legs',
];
export const STYLES: readonly Style[] = ['normal', 'dance', 'yoga'];

/** One catalogue entry, as the engine needs it. The content lane maps its JSON to this. */
export interface Exercise {
  id: string;
  name: string;
  /** Moves that are the same idea (for example all lunge variants). Defaults to `ladder`. */
  family?: string;
  style: Style;
  phase: Phase;
  pattern: Pattern;
  /** Primary muscles worked, main one first. */
  muscles: BodyPart[];
  /** Cool-down moves only: the muscles this stretch releases. Empty or absent = generic (breathing, rest pose). */
  stretches?: BodyPart[];
  mode: StepMode;
  sides: 'none' | 'each';
  /** Difficulty ladder this move belongs to, and its rung on it (0 = easiest). */
  ladder: string;
  level: number;
  impact: Impact;
  jumping: boolean;
  /** HIIT-style variant. Removed from the gentler plan. */
  hiit: boolean;
  /** Hard exclusions: a pain area or health flag that removes this move. */
  contraindications: readonly (PainArea | HealthFlag)[];
  formCheckable: boolean;
  /** Low-impact replacement used by quiet mode. */
  lowImpactAlt?: string;
}

export interface Catalogue {
  exercises: Exercise[];
}

/** Everything that removes or limits moves. Derived from the user's answers. */
export interface Restrictions {
  painAreas: readonly PainArea[];
  healthFlags: readonly HealthFlag[];
  /** Gentler plan: no HIIT, no jumping, nothing high impact, ladder capped. */
  gentler: boolean;
  /** Quiet mode: no jumping or high-impact moves. */
  quiet: boolean;
}

export interface PlanStep {
  id: string;
  phase: Phase;
  exerciseId: string;
  name: string;
  mode: StepMode;
  /** 1 for warm-up and cool-down, 2 for work. */
  sets: number;
  workS: number;
  /** Rest after each set (0 in warm-up and cool-down). */
  restS: number;
  /** Transition into this step (12 on work steps, else 0). */
  transitionS: number;
  /** 'each' means set 1 is the right side and set 2 the left (work only). */
  sides: 'none' | 'each';
  rung: Rung;
  muscles: BodyPart[];
  stretches: BodyPart[];
  lowImpact: boolean;
  formCheckable: boolean;
}

export interface SessionPlan {
  id: string;
  title: string;
  style: Style;
  focus: Focus;
  /** Body parts the day targets (empty unless focus is 'parts'). */
  parts: BodyPart[];
  /** Total allowed, 900 by default. The user may override it. */
  budgetS: number;
  steps: PlanStep[];
  /** What was used to build and edit this session. Health data: stays on the phone. */
  restrictions: Restrictions;
  /** Moves removed for this user, with the reason. */
  exclusions: { exerciseId: string; reason: PainArea | HealthFlag | 'gentler' | 'quiet' }[];
  engineVersion: string;
}

export type SegmentKind = 'work' | 'rest' | 'transition';

export interface TimelineSegment {
  index: number;
  kind: SegmentKind;
  phase: Phase;
  stepIndex: number;
  stepId: string;
  /** 1-based set number; 0 for a transition. */
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

export class EngineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}
