// Two key poses for every move in assets/content/exercises.json, drawn as a jointed figure
// in a 120 x 120 box with the floor at y = 104. ExerciseVisual tweens between the two poses,
// so each move gets a small looping demonstration with no image files.
//
// Side views face right. `front: true` marks a front view (jacks, side lunges, dance steps),
// where both arms and both legs are drawn at full strength. F is the near limb, B the far one.
// Poses follow the wording in each exercise's `demo.frames`; a trainer still has to review them.

export type Pt = readonly [number, number];
export type Joints = {
  head: Pt; sh: Pt; hip: Pt;
  /** Optional middle of the spine, for a rounded or arched back. */
  sp?: Pt;
  eF: Pt; hF: Pt; eB: Pt; hB: Pt;
  kF: Pt; fF: Pt; kB: Pt; fB: Pt;
};
export type Accent = 'legs' | 'arms' | 'core';
export type Prop = 'wall' | 'chair' | 'mat' | 'none';
export type MovePoses = { a: Joints; b: Joints; accent: Accent; prop?: Prop; front?: boolean };

const P = (base: Joints, over: Partial<Joints> = {}): Joints => ({ ...base, ...over });
/** Same pose with near and far limbs swapped (the other side's turn). */
const swap = (j: Joints): Joints => ({ ...j, eF: j.eB, hF: j.hB, eB: j.eF, hB: j.hF, kF: j.kB, fF: j.fB, kB: j.kF, fB: j.fF });
/** Mirror left to right (front views). */
const flip = (j: Joints): Joints => {
  const m = (p: Pt): Pt => [120 - p[0], p[1]];
  return { head: m(j.head), sh: m(j.sh), hip: m(j.hip), sp: j.sp ? m(j.sp) : undefined, eF: m(j.eB), hF: m(j.hB), eB: m(j.eF), hB: m(j.hF), kF: m(j.kB), fF: m(j.fB), kB: m(j.kF), fB: m(j.fF) };
};
const lift = (j: Joints, dy: number, keepFeet = true): Joints => {
  const u = (p: Pt): Pt => [p[0], p[1] - dy];
  return { head: u(j.head), sh: u(j.sh), hip: u(j.hip), sp: j.sp ? u(j.sp) : undefined, eF: u(j.eF), hF: u(j.hF), eB: u(j.eB), hB: u(j.hB), kF: u(j.kF), kB: u(j.kB), fF: keepFeet ? j.fF : u(j.fF), fB: keepFeet ? j.fB : u(j.fB) };
};

// ---- Base positions -------------------------------------------------------------------
const STAND: Joints = {
  head: [60, 24], sh: [60, 38], hip: [60, 66],
  eF: [62, 52], hF: [63, 65], eB: [58, 52], hB: [57, 65],
  kF: [61, 85], fF: [62, 104], kB: [59, 85], fB: [58, 104],
};
/** Front view, feet under the hips, arms by the sides. */
const FRONT: Joints = {
  head: [60, 24], sh: [60, 38], hip: [60, 66],
  eF: [72, 52], hF: [74, 66], eB: [48, 52], hB: [46, 66],
  kF: [66, 85], fF: [66, 104], kB: [54, 85], fB: [54, 104],
};
const ARMS_UP = { eF: [63, 24], hF: [65, 10], eB: [57, 24], hB: [55, 10] } as const;
const HANDS_ON_HIPS = { eF: [70, 54], hF: [63, 64], eB: [52, 54], hB: [58, 64] } as const;
/** High plank, head to the right, hands under the shoulders. */
const PLANK: Joints = {
  head: [98, 71], sh: [86, 78], hip: [58, 87],
  eF: [87, 91], hF: [88, 104], eB: [84, 91], hB: [84, 104],
  kF: [40, 95], fF: [22, 104], kB: [39, 96], fB: [24, 104],
};
const KNEE_PLANK: Joints = P(PLANK, { hip: [58, 88], kF: [42, 104], fF: [26, 92], kB: [42, 104], fB: [28, 94] });
/** Hands and knees. */
const QUAD: Joints = {
  head: [97, 72], sh: [84, 76], hip: [46, 76],
  eF: [85, 90], hF: [86, 104], eB: [82, 90], hB: [82, 104],
  kF: [46, 104], fF: [26, 102], kB: [44, 104], fB: [28, 102],
};
/** Lying on the back, head to the left, knees bent, feet flat. */
const SUPINE: Joints = {
  head: [20, 96], sh: [33, 98], hip: [62, 98],
  eF: [46, 100], hF: [58, 101], eB: [45, 100], hB: [57, 101],
  kF: [80, 82], fF: [88, 104], kB: [78, 83], fB: [86, 104],
};
/** Lying face down, head to the right, arms reaching forward. */
const PRONE: Joints = {
  head: [96, 95], sh: [84, 98], hip: [56, 98],
  eF: [98, 99], hF: [112, 99], eB: [97, 100], hB: [110, 100],
  kF: [38, 99], fF: [20, 100], kB: [38, 100], fB: [22, 101],
};
/** Sitting on a chair, side view. */
const CHAIR_SIT: Joints = {
  head: [52, 32], sh: [52, 46], hip: [52, 76],
  eF: [56, 60], hF: [66, 70], eB: [54, 60], hB: [64, 71],
  kF: [74, 76], fF: [74, 104], kB: [72, 77], fB: [72, 104],
};
/** Sitting on the floor, legs out in front. */
const FLOOR_SIT: Joints = {
  head: [46, 54], sh: [46, 68], hip: [46, 98],
  eF: [54, 80], hF: [64, 90], eB: [52, 80], hB: [62, 91],
  kF: [70, 98], fF: [94, 98], kB: [70, 99], fB: [92, 99],
};
const SQUAT_LOW: Joints = {
  head: [65, 41], sh: [61, 54], hip: [49, 80],
  eF: [72, 58], hF: [85, 56], eB: [70, 60], hB: [83, 59],
  kF: [69, 84], fF: [63, 104], kB: [67, 85], fB: [59, 104],
};
const LUNGE_LOW: Joints = {
  head: [60, 37], sh: [60, 51], hip: [60, 80], ...HANDS_ON_HIPS,
  eF: [70, 66], hF: [63, 77], eB: [52, 66], hB: [58, 77],
  kF: [82, 84], fF: [82, 104], kB: [50, 98], fB: [33, 100],
};
/** Inverted V: hips high, hands and feet on the floor. */
const PIKE: Joints = {
  head: [86, 88], sh: [79, 80], hip: [57, 50],
  eF: [85, 92], hF: [91, 104], eB: [83, 92], hB: [88, 104],
  kF: [43, 77], fF: [30, 104], kB: [42, 78], fB: [32, 104],
};
const WIDE: Joints = P(FRONT, { kF: [74, 85], fF: [80, 104], kB: [46, 85], fB: [40, 104] });
const ARMS_OUT = { eF: [78, 40], hF: [94, 40], eB: [42, 40], hB: [26, 40] } as const;
const FRONT_ARMS_UP = { eF: [72, 24], hF: [68, 10], eB: [48, 24], hB: [52, 10] } as const;

const marchA = P(STAND, { kF: [75, 68], fF: [75, 86], eB: [67, 49], hB: [74, 41], eF: [54, 50], hF: [50, 61] });
const dogReach = P(QUAD, { eF: [98, 74], hF: [112, 72], kB: [30, 76], fB: [12, 76] });
const stepRight = P(FRONT, { hip: [66, 66], sh: [66, 38], head: [66, 24], kF: [76, 85], fF: [80, 104], kB: [62, 85], fB: [58, 104], eF: [80, 48], hF: [88, 40], eB: [54, 50], hB: [48, 60] });

// ---- Every move -----------------------------------------------------------------------
export const POSES: Record<string, MovePoses> = {
  // Warm-up
  march_in_place: { a: marchA, b: swap(marchA), accent: 'legs' },
  arm_circles: { a: P(STAND, ARMS_UP), b: P(STAND, { eF: [75, 40], hF: [90, 40], eB: [73, 42], hB: [88, 44] }), accent: 'arms' },
  hip_circles: { a: P(FRONT, { ...HANDS_ON_HIPS, hip: [66, 67] }), b: P(FRONT, { ...HANDS_ON_HIPS, hip: [54, 67] }), accent: 'core', front: true },
  shoulder_rolls: { a: P(STAND, { sh: [60, 35], eF: [63, 49], eB: [59, 49] }), b: P(STAND, { sh: [59, 40], eF: [60, 54], eB: [56, 54] }), accent: 'arms' },
  torso_twist: { a: P(FRONT, { eF: [78, 46], hF: [70, 44], eB: [56, 46], hB: [66, 44], sh: [63, 38] }), b: P(FRONT, { eF: [64, 46], hF: [54, 44], eB: [42, 46], hB: [50, 44], sh: [57, 38] }), accent: 'core', front: true },
  inchworm: { a: P(STAND, { head: [80, 90], sh: [71, 82], hip: [52, 56], eF: [74, 93], hF: [77, 104], eB: [72, 93], hB: [74, 104], kF: [52, 80], fF: [52, 104], kB: [50, 80], fB: [49, 104] }), b: PLANK, accent: 'core' },
  cat_cow: { a: P(QUAD, { sp: [65, 64], head: [95, 86] }), b: P(QUAD, { sp: [65, 85], head: [98, 66] }), accent: 'core' },
  // Cardio
  jumping_jacks: { a: FRONT, b: lift(P(WIDE, FRONT_ARMS_UP), 4), accent: 'legs', front: true },
  step_jacks: { a: FRONT, b: P(FRONT, { ...FRONT_ARMS_UP, kF: [72, 85], fF: [80, 104] }), accent: 'legs', front: true },
  high_knees: { a: lift(P(marchA, { kF: [77, 62], fF: [79, 80] }), 3), b: lift(swap(P(marchA, { kF: [77, 62], fF: [79, 80] })), 3), accent: 'legs' },
  mountain_climbers: { a: P(PLANK, { kF: [66, 91], fF: [54, 100] }), b: P(PLANK, { kB: [66, 91], fB: [54, 100] }), accent: 'core' },
  skater_hop: { a: P(FRONT, { head: [78, 32], sh: [74, 45], hip: [68, 70], kF: [72, 88], fF: [72, 104], kB: [56, 90], fB: [44, 98], eF: [70, 60], hF: [60, 70], eB: [62, 56], hB: [52, 62] }), b: flip(P(FRONT, { head: [78, 32], sh: [74, 45], hip: [68, 70], kF: [72, 88], fF: [72, 104], kB: [56, 90], fB: [44, 98], eF: [70, 60], hF: [60, 70], eB: [62, 56], hB: [52, 62] })), accent: 'legs', front: true },
  low_skater: { a: P(FRONT, { head: [74, 30], sh: [70, 43], hip: [66, 70], kF: [70, 88], fF: [70, 104], kB: [56, 88], fB: [48, 104], eF: [68, 58], hF: [60, 68] }), b: flip(P(FRONT, { head: [74, 30], sh: [70, 43], hip: [66, 70], kF: [70, 88], fF: [70, 104], kB: [56, 88], fB: [48, 104], eF: [68, 58], hF: [60, 68] })), accent: 'legs', front: true },
  shadow_boxing: { a: P(STAND, { eF: [70, 50], hF: [73, 38], eB: [66, 52], hB: [70, 41], fF: [68, 104], kF: [65, 86], fB: [52, 104], kB: [55, 86] }), b: P(STAND, { eF: [78, 40], hF: [95, 38], eB: [66, 52], hB: [70, 41], fF: [68, 104], kF: [65, 86], fB: [52, 104], kB: [55, 86], sh: [62, 38] }), accent: 'arms' },
  // Legs
  chair_squat: { a: STAND, b: P(SQUAT_LOW, { hip: [48, 78] }), accent: 'legs', prop: 'chair' },
  squat: { a: STAND, b: SQUAT_LOW, accent: 'legs' },
  sumo_squat: { a: P(WIDE, { eF: [68, 50], hF: [62, 56], eB: [52, 50], hB: [58, 56] }), b: P(WIDE, { head: [60, 40], sh: [60, 54], hip: [60, 82], kF: [78, 86], kB: [42, 86], eF: [68, 66], hF: [62, 72], eB: [52, 66], hB: [58, 72] }), accent: 'legs', front: true },
  jump_squat: { a: SQUAT_LOW, b: lift(P(STAND, { eF: [63, 27], hF: [65, 16], eB: [57, 27], hB: [55, 16] }), 5, false), accent: 'legs' },
  wall_sit: { a: P(STAND, { head: [44, 40], sh: [44, 54], hip: [44, 82], kF: [66, 82], fF: [66, 104], kB: [64, 83], fB: [64, 104], eF: [50, 68], hF: [60, 78], eB: [48, 68], hB: [58, 79] }), b: P(STAND, { head: [44, 41], sh: [44, 55], hip: [44, 82], kF: [66, 82], fF: [66, 104], kB: [64, 83], fB: [64, 104], eF: [50, 68], hF: [60, 78], eB: [48, 68], hB: [58, 79] }), accent: 'legs', prop: 'wall' },
  lunge: { a: P(STAND, HANDS_ON_HIPS), b: LUNGE_LOW, accent: 'legs' },
  reverse_lunge: { a: P(STAND, HANDS_ON_HIPS), b: P(LUNGE_LOW, { kF: [70, 84], fF: [70, 104], hip: [50, 80], sh: [50, 51], head: [50, 37], kB: [40, 98], fB: [23, 100], eF: [60, 66], hF: [53, 77], eB: [42, 66], hB: [48, 77] }), accent: 'legs' },
  side_lunge: { a: P(FRONT, HANDS_ON_HIPS), b: P(FRONT, { head: [72, 40], sh: [70, 53], hip: [68, 80], kF: [84, 86], fF: [84, 104], kB: [50, 92], fB: [34, 104], eF: [78, 66], hF: [70, 72], eB: [60, 66], hB: [66, 72] }), accent: 'legs', front: true },
  glute_bridge: { a: SUPINE, b: P(SUPINE, { hip: [62, 80], sh: [33, 96], kF: [82, 80] }), accent: 'legs', prop: 'mat' },
  single_leg_bridge: { a: P(SUPINE, { kB: [82, 84], fB: [102, 78] }), b: P(SUPINE, { hip: [62, 80], sh: [33, 96], kF: [82, 80], kB: [84, 70], fB: [104, 62] }), accent: 'legs', prop: 'mat' },
  donkey_kick: { a: QUAD, b: P(QUAD, { kB: [34, 72], fB: [30, 52] }), accent: 'legs', prop: 'mat' },
  fire_hydrant: { a: QUAD, b: P(QUAD, { kB: [42, 82], fB: [24, 80] }), accent: 'legs', prop: 'mat' },
  calf_raise: { a: STAND, b: lift(STAND, 6), accent: 'legs' },
  // Push
  wall_pushup: { a: P(STAND, { head: [72, 29], sh: [68, 42], hip: [58, 68], kF: [54, 86], fF: [50, 104], kB: [53, 86], fB: [48, 104], eF: [81, 45], hF: [94, 44], eB: [80, 47], hB: [94, 48] }), b: P(STAND, { head: [82, 31], sh: [77, 44], hip: [62, 68], kF: [56, 86], fF: [50, 104], kB: [55, 86], fB: [48, 104], eF: [80, 57], hF: [94, 44], eB: [79, 59], hB: [94, 48] }), accent: 'arms', prop: 'wall' },
  knee_pushup: { a: KNEE_PLANK, b: P(KNEE_PLANK, { head: [98, 86], sh: [86, 90], hip: [58, 94], eF: [77, 84], eB: [75, 85] }), accent: 'arms', prop: 'mat' },
  pushup: { a: PLANK, b: P(PLANK, { head: [98, 86], sh: [86, 90], hip: [58, 94], kF: [40, 99], eF: [77, 84], eB: [75, 85] }), accent: 'arms' },
  diamond_pushup: { a: P(PLANK, { hF: [90, 104], hB: [89, 104] }), b: P(PLANK, { head: [98, 86], sh: [86, 90], hip: [58, 94], kF: [40, 99], eF: [79, 86], eB: [78, 87], hF: [90, 104], hB: [89, 104] }), accent: 'arms' },
  pike_pushup: { a: PIKE, b: P(PIKE, { head: [93, 98], sh: [82, 87], eF: [78, 94], eB: [76, 95] }), accent: 'arms' },
  shoulder_taps: { a: PLANK, b: P(PLANK, { eF: [80, 86], hF: [83, 77] }), accent: 'core' },
  // Back and core
  superman: { a: PRONE, b: P(PRONE, { head: [96, 85], sh: [84, 92], eF: [98, 88], hF: [111, 83], eB: [97, 89], hB: [109, 85], kF: [38, 95], fF: [20, 88], kB: [38, 96], fB: [22, 90] }), accent: 'core', prop: 'mat' },
  plank: { a: PLANK, b: P(PLANK, { hip: [58, 86] }), accent: 'core' },
  knee_plank: { a: KNEE_PLANK, b: P(KNEE_PLANK, { hip: [58, 87] }), accent: 'core', prop: 'mat' },
  forearm_plank: { a: P(PLANK, { sh: [84, 84], head: [96, 78], hip: [58, 90], eF: [85, 103], hF: [100, 103], eB: [83, 103], hB: [98, 103] }), b: P(PLANK, { sh: [84, 84], head: [96, 78], hip: [58, 89], eF: [85, 103], hF: [100, 103], eB: [83, 103], hB: [98, 103] }), accent: 'core', prop: 'mat' },
  side_plank: { a: P(PLANK, { head: [95, 58], sh: [84, 67], hip: [55, 86], eF: [85, 86], hF: [86, 104], eB: [84, 54], hB: [84, 40], kF: [38, 96], fF: [22, 104], kB: [38, 95], fB: [23, 103] }), b: P(PLANK, { head: [95, 57], sh: [84, 66], hip: [55, 84], eF: [85, 86], hF: [86, 104], eB: [84, 53], hB: [84, 39], kF: [38, 95], fF: [22, 104], kB: [38, 94], fB: [23, 103] }), accent: 'core', prop: 'mat' },
  dead_bug: { a: P(SUPINE, { eF: [36, 82], hF: [38, 68], eB: [35, 82], hB: [36, 68], kF: [64, 76], fF: [82, 76], kB: [63, 77], fB: [80, 77] }), b: P(SUPINE, { eF: [36, 82], hF: [38, 68], eB: [22, 94], hB: [8, 92], kF: [80, 94], fF: [102, 94], kB: [63, 77], fB: [80, 77] }), accent: 'core', prop: 'mat' },
  bird_dog: { a: dogReach, b: P(dogReach, { hF: [112, 71], fB: [12, 75] }), accent: 'core', prop: 'mat' },
  crunch: { a: P(SUPINE, { eF: [26, 90], hF: [18, 92], eB: [26, 91], hB: [18, 93] }), b: P(SUPINE, { head: [27, 82], sh: [38, 91], sp: [50, 97], eF: [32, 80], hF: [24, 79], eB: [32, 81], hB: [24, 80] }), accent: 'core', prop: 'mat' },
  bicycle_crunch: { a: P(SUPINE, { head: [27, 83], sh: [38, 91], eF: [44, 82], hF: [30, 78], kF: [60, 80], fF: [76, 82], kB: [84, 92], fB: [104, 90] }), b: P(SUPINE, { head: [27, 83], sh: [38, 91], eF: [44, 82], hF: [30, 78], kB: [60, 80], fB: [76, 82], kF: [84, 92], fF: [104, 90] }), accent: 'core', prop: 'mat' },
  reverse_crunch: { a: P(SUPINE, { kF: [72, 76], fF: [90, 78], kB: [71, 77], fB: [88, 79] }), b: P(SUPINE, { hip: [60, 92], kF: [56, 72], fF: [72, 66], kB: [55, 73], fB: [70, 67] }), accent: 'core', prop: 'mat' },
  russian_twist: { a: P(FLOOR_SIT, { head: [38, 56], sh: [42, 69], hip: [54, 98], kF: [74, 84], fF: [90, 98], kB: [73, 85], fB: [88, 99], eF: [54, 78], hF: [66, 82], eB: [52, 79], hB: [64, 84] }), b: P(FLOOR_SIT, { head: [38, 56], sh: [42, 69], hip: [54, 98], kF: [74, 84], fF: [90, 98], kB: [73, 85], fB: [88, 99], eF: [46, 82], hF: [44, 94], eB: [44, 83], hB: [42, 95] }), accent: 'core', prop: 'mat' },
  hollow_hold: { a: P(SUPINE, { head: [24, 86], sh: [36, 92], eF: [24, 82], hF: [10, 76], eB: [24, 83], hB: [10, 78], kF: [82, 92], fF: [104, 86], kB: [82, 93], fB: [102, 88] }), b: P(SUPINE, { head: [24, 85], sh: [36, 91], eF: [24, 81], hF: [10, 75], eB: [24, 82], hB: [10, 77], kF: [82, 91], fF: [104, 85], kB: [82, 92], fB: [102, 87] }), accent: 'core', prop: 'mat' },
  // Stretches
  quad_stretch: { a: P(STAND, { kB: [58, 88], fB: [48, 76], eB: [56, 54], hB: [50, 73] }), b: P(STAND, { kB: [57, 88], fB: [46, 74], eB: [56, 54], hB: [48, 71] }), accent: 'legs' },
  hamstring_stretch: { a: P(FLOOR_SIT, { head: [58, 62], sh: [54, 74], eF: [66, 84], hF: [80, 92], eB: [64, 85], hB: [78, 93] }), b: P(FLOOR_SIT, { head: [66, 68], sh: [59, 78], eF: [72, 88], hF: [88, 94], eB: [70, 89], hB: [86, 95] }), accent: 'legs', prop: 'mat' },
  childs_pose: { a: P(QUAD, { head: [86, 97], sh: [73, 93], hip: [40, 90], kF: [58, 104], fF: [30, 103], kB: [57, 104], fB: [32, 103], eF: [90, 100], hF: [106, 103], eB: [88, 100], hB: [104, 103] }), b: P(QUAD, { head: [86, 98], sh: [73, 94], hip: [40, 90], kF: [58, 104], fF: [30, 103], kB: [57, 104], fB: [32, 103], eF: [90, 100], hF: [106, 103], eB: [88, 100], hB: [104, 103] }), accent: 'core', prop: 'mat' },
  chest_opener: { a: P(STAND, { eF: [54, 52], hF: [48, 62], eB: [53, 52], hB: [47, 63] }), b: P(STAND, { head: [61, 23], sh: [62, 38], eF: [52, 50], hF: [44, 58], eB: [51, 50], hB: [43, 59] }), accent: 'arms' },
  figure_four: { a: P(CHAIR_SIT, { kF: [72, 72], fF: [58, 78], eF: [58, 60], hF: [68, 68] }), b: P(CHAIR_SIT, { head: [58, 35], sh: [56, 48], kF: [72, 72], fF: [58, 78], eF: [62, 60], hF: [70, 68] }), accent: 'legs', prop: 'chair' },
  // Yoga
  mountain_pose: { a: STAND, b: P(STAND, ARMS_UP), accent: 'core' },
  warrior_ii: { a: P(WIDE, ARMS_OUT), b: P(WIDE, { ...ARMS_OUT, hip: [62, 74], sh: [62, 46], head: [62, 32], eF: [80, 48], hF: [96, 48], eB: [44, 48], hB: [28, 48], kF: [80, 84], fF: [84, 104] }), accent: 'legs', front: true },
  downward_dog: { a: PIKE, b: P(PIKE, { hip: [56, 48] }), accent: 'core', prop: 'mat' },
  cobra_pose: { a: P(PRONE, { eF: [86, 92], hF: [88, 103], eB: [84, 93], hB: [86, 103] }), b: P(PRONE, { head: [94, 70], sh: [86, 82], sp: [72, 94], eF: [88, 93], hF: [88, 103], eB: [86, 94], hB: [86, 103] }), accent: 'core', prop: 'mat' },
  tree_pose: { a: P(FRONT, { kF: [74, 78], fF: [60, 82], eF: [68, 48], hF: [61, 46], eB: [52, 48], hB: [59, 46] }), b: P(FRONT, { kF: [74, 78], fF: [60, 82], ...FRONT_ARMS_UP, hF: [61, 8], hB: [59, 8] }), accent: 'legs', front: true },
  chair_pose: { a: P(STAND, ARMS_UP), b: P(SQUAT_LOW, { eF: [72, 44], hF: [82, 30], eB: [70, 45], hB: [80, 32] }), accent: 'legs' },
  // Dance
  grapevine: { a: stepRight, b: flip(stepRight), accent: 'legs', front: true },
  step_touch: { a: P(stepRight, { eF: [76, 50], hF: [70, 44], eB: [56, 50], hB: [62, 44] }), b: flip(P(stepRight, { eF: [76, 50], hF: [70, 44], eB: [56, 50], hB: [62, 44] })), accent: 'legs', front: true },
  box_step: { a: P(FRONT, { kF: [68, 84], fF: [70, 100], ...HANDS_ON_HIPS }), b: P(FRONT, { kB: [52, 84], fB: [50, 100], ...HANDS_ON_HIPS }), accent: 'legs', front: true },
  hip_sway: { a: P(FRONT, { hip: [66, 66], eF: [78, 46], hF: [84, 34], eB: [46, 50], hB: [40, 60] }), b: P(FRONT, { hip: [54, 66], eB: [42, 46], hB: [36, 34], eF: [74, 50], hF: [80, 60] }), accent: 'core', front: true },
  bollywood_clap_step: { a: P(stepRight, { eF: [74, 34], hF: [64, 24], eB: [58, 34], hB: [62, 24] }), b: flip(P(stepRight, { eF: [80, 40], hF: [90, 30], eB: [52, 44], hB: [44, 34] })), accent: 'arms', front: true },
  // Desk
  neck_release: { a: CHAIR_SIT, b: P(CHAIR_SIT, { head: [57, 34] }), accent: 'core', prop: 'chair' },
  seated_twist: { a: CHAIR_SIT, b: P(CHAIR_SIT, { sh: [50, 46], eF: [50, 60], hF: [44, 72], eB: [60, 60], hB: [70, 72] }), accent: 'core', prop: 'chair' },
  wrist_stretch: { a: P(CHAIR_SIT, { eF: [64, 52], hF: [80, 50], eB: [62, 56], hB: [78, 46] }), b: P(CHAIR_SIT, { eF: [64, 52], hF: [80, 52], eB: [62, 56], hB: [78, 56] }), accent: 'arms', prop: 'chair' },
  shoulder_blade_squeeze: { a: P(CHAIR_SIT, { eF: [62, 56], hF: [70, 48] }), b: P(CHAIR_SIT, { sh: [53, 46], eF: [46, 58], hF: [54, 50], eB: [44, 59], hB: [52, 51] }), accent: 'arms', prop: 'chair' },
  ankle_pumps: { a: P(CHAIR_SIT, { kF: [74, 76], fF: [86, 98] }), b: P(CHAIR_SIT, { kF: [74, 76], fF: [92, 86] }), accent: 'legs', prop: 'chair' },
};

/** Used when an id has no entry: a calm standing figure, so nothing ever renders blank. */
export const DEFAULT_POSES: MovePoses = { a: STAND, b: P(STAND, ARMS_UP), accent: 'core' };

export function posesFor(exerciseId: string | null | undefined): MovePoses {
  return (exerciseId && POSES[exerciseId]) || DEFAULT_POSES;
}

const mix = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
/** Pose `t` of the way from a to b (0..1). */
export function tween(a: Joints, b: Joints, t: number): Joints {
  const mid = (j: Joints): Pt => j.sp ?? [(j.sh[0] + j.hip[0]) / 2, (j.sh[1] + j.hip[1]) / 2];
  const curved = !!a.sp || !!b.sp;
  return {
    head: mix(a.head, b.head, t), sh: mix(a.sh, b.sh, t), hip: mix(a.hip, b.hip, t),
    sp: curved ? mix(mid(a), mid(b), t) : undefined,
    eF: mix(a.eF, b.eF, t), hF: mix(a.hF, b.hF, t), eB: mix(a.eB, b.eB, t), hB: mix(a.hB, b.hB, t),
    kF: mix(a.kF, b.kF, t), fF: mix(a.fF, b.fF, t), kB: mix(a.kB, b.kB, t), fB: mix(a.fB, b.fB, t),
  };
}
