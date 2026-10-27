// Types for the bundled content packs. They mirror
// app/assets/content/schema/content.schema.json. Text is never stored in a
// record: records hold i18n keys and the strings pack holds the English (en-IN)
// text. Every pack and every record is marked needsExpertReview: true.

export type HealthFlag =
  | 'knee'
  | 'back'
  | 'shoulder'
  | 'wrist'
  | 'other_pain'
  | 'heart_bp'
  | 'pregnancy'
  | 'recent_surgery';

export type Style = 'normal' | 'yoga' | 'dance';
export type BodyPart = 'arms' | 'chest' | 'back' | 'shoulders' | 'core' | 'glutes' | 'legs';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Phase = 'warmup' | 'work' | 'cooldown' | 'micro';
export type StepMode = 'timed' | 'hold' | 'reps' | 'routine_step';

export type Muscle =
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'hip_flexors'
  | 'adductors'
  | 'abductors'
  | 'abs'
  | 'obliques'
  | 'lower_back'
  | 'upper_back'
  | 'lats'
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'neck'
  | 'forearms'
  | 'full_body';

/** Common header on every pack file. */
export interface PackHeader {
  schemaVersion: 1;
  contentType: string;
  packVersion: number;
  needsExpertReview: true;
  reviewNotes: string;
}

// ---- Exercises ----

export interface PoseFrame {
  posture:
    | 'standing'
    | 'seated'
    | 'kneeling'
    | 'quadruped'
    | 'supine'
    | 'prone'
    | 'side'
    | 'plank'
    | 'kneeling plank'
    | 'lunge'
    | 'inverted';
  torso: string;
  arms: string;
  legs: string;
}

export interface Exercise {
  id: string;
  style: Style;
  nameKey: string;
  cueKey: string;
  stepKeys: string[];
  /** D17: v1 demos are two-frame SVG loops. videoUrl is reserved. */
  demo: { frames: [PoseFrame, PoseFrame]; altKey: string; loopMs: number; videoUrl?: string };
  /** Progression ladder: exercises in a family are ordered by rung (1 easiest). */
  family: string;
  rung: number;
  difficulty: Difficulty;
  bodyParts: BodyPart[];
  muscles: Muscle[];
  equipment: 'none';
  mode: StepMode;
  defaultSets: number;
  defaultWorkS: number;
  /** each: work is done on both sides in every set. */
  sides: 'none' | 'each';
  breath?: { inS: number; outS: number };
  bpm?: number;
  formCheckable: boolean;
  lowImpact: boolean;
  seatedOk: boolean;
  phases: Phase[];
  /** Hidden from a plan when the user has any of these flags. */
  excludedByFlags: HealthFlag[];
  /** Allowed, but show a gentle caution. */
  cautionFlags: HealthFlag[];
  proOnly: boolean;
  tags: string[];
  voiceClips: Record<string, string>;
  catalogueVersion: number;
  needsExpertReview: true;
}

export interface ExercisePack extends PackHeader {
  contentType: 'exercises';
  exercises: Exercise[];
}

export type SubstitutionKind =
  | 'easier'
  | 'harder'
  | 'no_equipment'
  | 'low_impact'
  | 'seated'
  | 'flag_swap';

export interface Substitution {
  id: string;
  exerciseId: string;
  kind: SubstitutionKind;
  toExerciseId: string;
  flag?: HealthFlag;
  reasonKey: string;
  needsExpertReview: true;
}

export interface SubstitutionPack extends PackHeader {
  contentType: 'substitutions';
  substitutions: Substitution[];
}

// ---- Plans ----

export interface PlanMove {
  exerciseId: string;
  sets: number;
  /** Seconds of work per side. */
  workS: number;
  /** Rest after each set. */
  restS: number;
}

export interface ReadyMadePlan {
  id: string;
  style: Style;
  titleKey: string;
  blurbKey: string;
  level: Level;
  kind: 'full15' | 'micro';
  /** 900 for full15 (2 + 11 + 2 minutes), 240 for the desk reset. */
  durationS: 900 | 240;
  warmup: PlanMove[];
  work: PlanMove[];
  cooldown: PlanMove[];
  safeForFlags: HealthFlag[];
  tags: string[];
  needsExpertReview: true;
}

export interface StyleInfo {
  id: Style;
  proOnly: boolean;
  tasterPlanIds: string[];
}

export interface PlanPack extends PackHeader {
  contentType: 'plans';
  styles: StyleInfo[];
  plans: ReadyMadePlan[];
}

// ---- Foods ----

export type FoodUnitName = 'katori' | 'chamach' | 'piece' | 'g';
export type Diet = 'veg' | 'egg' | 'nonveg' | 'jain';
export type Allergen = 'peanut' | 'dairy' | 'gluten' | 'other';
export type FoodKind = 'home' | 'packaged' | 'restaurant' | 'custom';

export interface FoodUnit {
  unit: FoodUnitName;
  labelKey: string;
  gramsOrMl: number;
  gramsPerUnit: number;
  steps: number[];
  default: number;
}

export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodItem {
  id: string;
  nameKey: string;
  nameHiKey?: string;
  kind: FoodKind;
  section: string;
  /** Diets this food suits. A veg food suits egg and non-veg eaters too. */
  diet: Diet[];
  allergens: Allergen[];
  /** units[0] is the default unit. */
  units: FoodUnit[];
  /** Nutrients in ONE unit of units[0]. */
  perDefaultUnit: Nutrients;
  source: string;
  packVersion: number;
  needsExpertReview: true;
}

export interface FoodPack extends PackHeader {
  contentType: 'foods';
  units: { katoriMl: 150; chamachMl: 15 };
  foods: FoodItem[];
}

// ---- Learn ----

export interface LearnSource {
  label: string;
  status: 'found' | 'pending';
  url?: string;
}

export type Verdict = 'false' | 'partly_true' | 'true';

export interface Myth {
  id: string;
  kind: 'myth';
  order: number;
  titleKey: string;
  verdict: Verdict;
  trueKey: string;
  evidenceKey: string;
  cta: { labelKey: string; route: string; params?: Record<string, unknown> };
  sources: LearnSource[];
  reviewedOn: string | null;
  reviewStatus: 'pending' | 'reviewed';
  needsExpertReview: true;
}

export interface Concept {
  id: string;
  kind: 'concept';
  order: number;
  titleKey: string;
  readMinutes: number;
  icon: string;
  startHere: boolean;
  bodyKeys: string[];
  takeawayKey: string;
  sources: LearnSource[];
  reviewedOn: string | null;
  reviewStatus: 'pending' | 'reviewed';
  needsExpertReview: true;
}

export interface LearnPack extends PackHeader {
  contentType: 'learn';
  myths: Myth[];
  concepts: Concept[];
}

// ---- Voice cues ----

export interface VoiceEvent {
  id: string;
  group: string;
  keys: string[];
  tokens: string[];
  priority: number;
  duck: boolean;
  maxChars: number;
}

export interface FormCueGroup {
  exerciseId: string;
  cues: { id: string; key: string; maxPerRep: 1 }[];
}

export interface VoicePack extends PackHeader {
  contentType: 'voice-cues';
  lang: string;
  rules: {
    maxCuesPerRep: 1;
    quietWhenLowConfidence: boolean;
    countdownFromS: number;
    tenSecondWarning: boolean;
    clipIdPattern: string;
  };
  events: VoiceEvent[];
  formCues: FormCueGroup[];
  goodFormKeys: string[];
  needsExpertReviewNote?: string;
}

// ---- Strings ----

export interface StringsPack extends PackHeader {
  contentType: 'strings';
  locale: string;
  /** Flat, dotted keys. Plural forms use the i18next suffixes _one and _other. */
  strings: Record<string, string>;
}

/** All raw packs, as parsed from JSON. */
export interface RawContent {
  exercises: ExercisePack;
  substitutions: SubstitutionPack;
  plans: PlanPack;
  foods: FoodPack;
  learn: LearnPack;
  voice: VoicePack;
  strings: StringsPack;
}
