import type {
  BodyPart,
  Catalogue,
  Exercise,
  HealthFlag,
  Impact,
  PainArea,
  Pattern,
  Phase,
  StepMode,
  Style,
} from '../types';

/**
 * A small invented catalogue for engine tests. It is not product content: the real
 * catalogue lives in app/assets/content and is mapped to `Exercise` by the content lane.
 */
type Contra = PainArea | HealthFlag;

interface Def {
  id: string;
  name: string;
  style: Style;
  phase?: Phase;
  pattern: Pattern;
  muscles: BodyPart[];
  stretches?: BodyPart[];
  mode?: StepMode;
  sides?: 'none' | 'each';
  ladder?: string;
  level?: number;
  impact?: Impact;
  jumping?: boolean;
  hiit?: boolean;
  contra?: Contra[];
  form?: boolean;
  alt?: string;
}

const out: Exercise[] = [];

function add(d: Def): void {
  out.push({
    id: d.id,
    name: d.name,
    style: d.style,
    phase: d.phase ?? 'work',
    pattern: d.pattern,
    muscles: d.muscles,
    stretches: d.stretches,
    mode: d.mode ?? 'timed',
    sides: d.sides ?? 'none',
    ladder: d.ladder ?? d.id,
    level: d.level ?? 0,
    impact: d.impact ?? 'low',
    jumping: d.jumping ?? false,
    hiit: d.hiit ?? false,
    contraindications: d.contra ?? [],
    formCheckable: d.form ?? false,
    lowImpactAlt: d.alt,
  });
}

/** Adds a ladder of moves, easiest first. */
function ladder(
  id: string,
  base: Omit<Def, 'id' | 'name' | 'ladder' | 'level'>,
  rungs: { id: string; name: string; contra?: Contra[]; impact?: Impact; jumping?: boolean; hiit?: boolean; form?: boolean; alt?: string }[],
): void {
  rungs.forEach((r, i) => add({ ...base, ...r, ladder: id, level: i }));
}

// --- Normal, push ---------------------------------------------------------
ladder('pushup', { style: 'normal', pattern: 'push', muscles: ['chest', 'shoulders', 'arms'] }, [
  { id: 'wall-pushup', name: 'Wall push-up' },
  { id: 'incline-pushup', name: 'Incline push-up', contra: ['wrists'] },
  { id: 'pushup', name: 'Push-up', contra: ['wrists', 'shoulders'], form: true },
  { id: 'diamond-pushup', name: 'Diamond push-up', contra: ['wrists', 'shoulders'] },
]);
ladder('pike', { style: 'normal', pattern: 'push', muscles: ['shoulders', 'arms'] }, [
  { id: 'pike-hold', name: 'Pike hold', contra: ['wrists', 'shoulders'] },
  { id: 'pike-pushup', name: 'Pike push-up', contra: ['wrists', 'shoulders'] },
]);
ladder('dip', { style: 'normal', pattern: 'push', muscles: ['arms', 'chest'] }, [
  { id: 'chair-dip-short', name: 'Short chair dip', contra: ['wrists', 'shoulders'] },
  { id: 'chair-dip', name: 'Chair dip', contra: ['wrists', 'shoulders'] },
]);
ladder('shoulder-tap', { style: 'normal', pattern: 'push', muscles: ['shoulders', 'core'] }, [
  { id: 'standing-shoulder-tap', name: 'Standing shoulder tap' },
  { id: 'plank-shoulder-tap', name: 'Plank shoulder tap', contra: ['wrists', 'shoulders'] },
]);
// --- Normal, pull ---------------------------------------------------------
ladder('superman', { style: 'normal', pattern: 'pull', muscles: ['back', 'glutes'] }, [
  { id: 'superman', name: 'Superman', contra: ['back', 'pregnancy'] },
  { id: 'swimmer', name: 'Swimmer', contra: ['back', 'pregnancy'] },
]);
ladder('snow-angel', { style: 'normal', pattern: 'pull', muscles: ['back', 'shoulders'] }, [
  { id: 'wall-snow-angel', name: 'Wall snow angel' },
  { id: 'prone-y-raise', name: 'Prone Y raise', contra: ['pregnancy', 'shoulders'] },
]);
ladder('towel-row', { style: 'normal', pattern: 'pull', muscles: ['back', 'arms'] }, [
  { id: 'towel-row', name: 'Towel row' },
  { id: 'door-row', name: 'Door row', contra: ['shoulders'] },
]);
ladder('reverse-fly', { style: 'normal', pattern: 'pull', muscles: ['back', 'shoulders'] }, [
  { id: 'standing-reverse-fly', name: 'Standing reverse fly' },
  { id: 'bent-reverse-fly', name: 'Bent-over reverse fly', contra: ['back'] },
]);
// --- Normal, legs ---------------------------------------------------------
ladder('squat', { style: 'normal', pattern: 'legs', muscles: ['legs', 'glutes'] }, [
  { id: 'chair-squat', name: 'Chair squat', form: true },
  { id: 'squat', name: 'Squat', form: true, contra: ['knees'] },
  { id: 'split-squat', name: 'Split squat', contra: ['knees'] },
  { id: 'jump-squat', name: 'Jump squat', contra: ['knees'], impact: 'high', jumping: true, hiit: true, alt: 'squat' },
]);
ladder('lunge', { style: 'normal', pattern: 'legs', muscles: ['legs', 'glutes'], sides: 'each' }, [
  { id: 'reverse-lunge', name: 'Reverse lunge', contra: ['knees'] },
  { id: 'lunge', name: 'Lunge', contra: ['knees'], form: true },
  { id: 'jump-lunge', name: 'Jump lunge', contra: ['knees'], impact: 'high', jumping: true, hiit: true, alt: 'lunge' },
]);
ladder('bridge', { style: 'normal', pattern: 'legs', muscles: ['glutes', 'core', 'legs'] }, [
  { id: 'glute-bridge', name: 'Glute bridge', contra: ['pregnancy'] },
  { id: 'single-leg-bridge', name: 'Single-leg bridge', contra: ['pregnancy'], },
  { id: 'bridge-march', name: 'Bridge march', contra: ['pregnancy'] },
]);
ladder('wall-sit', { style: 'normal', pattern: 'legs', muscles: ['legs', 'glutes'], mode: 'hold' }, [
  { id: 'wall-sit', name: 'Wall sit', contra: ['knees'] },
  { id: 'wall-sit-march', name: 'Wall sit march', contra: ['knees'] },
]);
ladder('calf-raise', { style: 'normal', pattern: 'legs', muscles: ['legs'] }, [
  { id: 'calf-raise', name: 'Calf raise' },
  { id: 'single-calf-raise', name: 'Single-leg calf raise' },
]);
ladder('lateral-walk', { style: 'normal', pattern: 'legs', muscles: ['glutes', 'legs'] }, [
  { id: 'lateral-walk', name: 'Lateral walk' },
  { id: 'lateral-squat-walk', name: 'Lateral squat walk', contra: ['knees'] },
]);
// --- Normal, core ---------------------------------------------------------
ladder('plank', { style: 'normal', pattern: 'core', muscles: ['core', 'shoulders'], mode: 'hold' }, [
  { id: 'knee-plank', name: 'Knee plank', contra: ['wrists', 'shoulders'] },
  { id: 'plank', name: 'Plank', contra: ['wrists', 'shoulders'], form: true },
  { id: 'plank-reach', name: 'Plank reach', contra: ['wrists', 'shoulders'] },
]);
ladder('dead-bug', { style: 'normal', pattern: 'core', muscles: ['core'] }, [
  { id: 'dead-bug', name: 'Dead bug', contra: ['pregnancy'] },
  { id: 'dead-bug-reach', name: 'Dead bug reach', contra: ['pregnancy'] },
]);
ladder('bird-dog', { style: 'normal', pattern: 'core', muscles: ['core', 'back', 'glutes'], sides: 'each' }, [
  { id: 'bird-dog', name: 'Bird dog', contra: ['wrists', 'knees'] },
  { id: 'bird-dog-hold', name: 'Bird dog hold', contra: ['wrists', 'knees'] },
]);
ladder('crunch', { style: 'normal', pattern: 'core', muscles: ['core'] }, [
  { id: 'crunch', name: 'Crunch', contra: ['pregnancy', 'recent_surgery', 'back'] },
  { id: 'bicycle-crunch', name: 'Bicycle crunch', contra: ['pregnancy', 'recent_surgery', 'back'] },
]);
ladder('side-plank', { style: 'normal', pattern: 'core', muscles: ['core', 'shoulders'], mode: 'hold', sides: 'each' }, [
  { id: 'side-plank-knee', name: 'Knee side plank', contra: ['wrists', 'shoulders'] },
  { id: 'side-plank', name: 'Side plank', contra: ['wrists', 'shoulders'] },
]);
ladder('standing-twist', { style: 'normal', pattern: 'core', muscles: ['core'] }, [
  { id: 'standing-oblique-crunch', name: 'Standing oblique crunch' },
  { id: 'standing-knee-twist', name: 'Standing knee twist' },
]);
ladder('mountain-climber', { style: 'normal', pattern: 'core', muscles: ['core', 'legs'] }, [
  { id: 'slow-mountain-climber', name: 'Slow mountain climber', contra: ['wrists', 'shoulders'] },
  { id: 'mountain-climber', name: 'Mountain climber', contra: ['wrists', 'shoulders'], hiit: true, impact: 'high' },
]);
// --- Normal, cardio -------------------------------------------------------
ladder('march', { style: 'normal', pattern: 'cardio', muscles: ['legs', 'core'] }, [
  { id: 'march', name: 'March in place' },
  { id: 'high-knee-march', name: 'High-knee march' },
  { id: 'high-knees', name: 'High knees', hiit: true, impact: 'high', alt: 'high-knee-march' },
]);
ladder('jacks', { style: 'normal', pattern: 'cardio', muscles: ['legs', 'shoulders'] }, [
  { id: 'step-jack', name: 'Step jack' },
  { id: 'jumping-jack', name: 'Jumping jack', jumping: true, impact: 'high', hiit: true, alt: 'step-jack' },
  { id: 'star-jump', name: 'Star jump', jumping: true, impact: 'high', hiit: true, alt: 'step-jack' },
]);
ladder('shadow-boxing', { style: 'normal', pattern: 'cardio', muscles: ['shoulders', 'core', 'arms'] }, [
  { id: 'shadow-boxing', name: 'Shadow boxing' },
  { id: 'fast-shadow-boxing', name: 'Fast shadow boxing', hiit: true },
]);
ladder('skater', { style: 'normal', pattern: 'cardio', muscles: ['legs', 'glutes'] }, [
  { id: 'skater-step', name: 'Skater step' },
  { id: 'skater-hop', name: 'Skater hop', contra: ['knees'], jumping: true, impact: 'high', hiit: true, alt: 'skater-step' },
]);
ladder('burpee', { style: 'normal', pattern: 'cardio', muscles: ['legs', 'chest', 'core'] }, [
  { id: 'step-back-burpee', name: 'Step-back burpee', contra: ['wrists', 'heart_bp'], hiit: true },
  { id: 'burpee', name: 'Burpee', contra: ['wrists', 'heart_bp'], jumping: true, impact: 'high', hiit: true, alt: 'step-back-burpee' },
]);

// --- Yoga, work -----------------------------------------------------------
const yogaPoses: { id: string; name: string; muscles: BodyPart[]; contra?: Contra[]; deeper?: Contra[]; sides?: 'each' }[] = [
  { id: 'mountain-pose', name: 'Mountain pose', muscles: ['legs', 'core'] },
  { id: 'chair-pose', name: 'Chair pose', muscles: ['legs', 'glutes'], contra: ['knees'] },
  { id: 'warrior-two', name: 'Warrior two', muscles: ['legs', 'shoulders'], contra: ['knees'], sides: 'each' },
  { id: 'tree-pose', name: 'Tree pose', muscles: ['legs', 'core'], sides: 'each' },
  { id: 'downward-dog', name: 'Downward dog', muscles: ['shoulders', 'back', 'legs'], contra: ['wrists', 'shoulders'] },
  { id: 'cobra', name: 'Cobra', muscles: ['back', 'chest'], contra: ['pregnancy', 'back', 'recent_surgery'] },
  { id: 'bridge-pose', name: 'Bridge pose', muscles: ['glutes', 'back'], contra: ['pregnancy'] },
  { id: 'boat-pose', name: 'Boat pose', muscles: ['core'], contra: ['pregnancy', 'recent_surgery'] },
  { id: 'triangle-pose', name: 'Triangle pose', muscles: ['legs', 'core'], sides: 'each' },
  { id: 'low-lunge', name: 'Low lunge', muscles: ['legs', 'glutes'], contra: ['knees'], sides: 'each' },
  { id: 'goddess-pose', name: 'Goddess pose', muscles: ['legs', 'glutes'], contra: ['knees'] },
  { id: 'plank-pose', name: 'Plank pose', muscles: ['core', 'shoulders', 'chest'], contra: ['wrists', 'shoulders'] },
  { id: 'seated-twist', name: 'Seated twist', muscles: ['core', 'back'], sides: 'each' },
  { id: 'side-stretch', name: 'Standing side stretch', muscles: ['core', 'back'], sides: 'each' },
  { id: 'eagle-arms', name: 'Eagle arms', muscles: ['shoulders', 'arms'] },
];
for (const p of yogaPoses) {
  ladder(
    p.id,
    { style: 'yoga', pattern: 'flow', muscles: p.muscles, mode: 'hold', impact: 'none', sides: p.sides },
    [
      { id: `${p.id}-gentle`, name: `${p.name}, gentle`, contra: p.contra },
      { id: `${p.id}-deep`, name: `${p.name}, deeper`, contra: p.contra },
    ],
  );
}

// --- Dance, work ----------------------------------------------------------
const dances: { id: string; name: string; muscles: BodyPart[] }[] = [
  { id: 'grapevine', name: 'Grapevine', muscles: ['legs', 'glutes'] },
  { id: 'salsa-step', name: 'Salsa step', muscles: ['legs', 'core'] },
  { id: 'bollywood-bounce', name: 'Bollywood bounce', muscles: ['legs', 'shoulders'] },
  { id: 'hip-hop-groove', name: 'Hip-hop groove', muscles: ['legs', 'core'] },
  { id: 'merengue', name: 'Merengue march', muscles: ['legs', 'glutes'] },
  { id: 'two-step', name: 'Two-step', muscles: ['legs', 'arms'] },
  { id: 'disco-point', name: 'Disco point', muscles: ['shoulders', 'arms', 'core'] },
  { id: 'shuffle', name: 'Shuffle', muscles: ['legs', 'back'] },
];
for (const d of dances) {
  ladder(d.id, { style: 'dance', pattern: 'dance', muscles: d.muscles, mode: 'routine_step' }, [
    { id: `${d.id}-low`, name: `${d.name}, low impact` },
    { id: `${d.id}-high`, name: `${d.name}, high impact`, contra: ['knees'], impact: 'high', jumping: true, alt: `${d.id}-low` },
  ]);
}

// --- Warm-ups -------------------------------------------------------------
const warm = (id: string, name: string, style: Style, muscles: BodyPart[], rest: Partial<Def> = {}) =>
  add({ id, name, style, phase: 'warmup', pattern: 'mobility', muscles, ...rest });
warm('wu-arm-circles', 'Arm circles', 'normal', ['shoulders', 'arms']);
warm('wu-leg-swings', 'Leg swings', 'normal', ['legs', 'glutes']);
warm('wu-march', 'Easy march', 'normal', ['legs', 'core']);
warm('wu-hip-circles', 'Hip circles', 'normal', ['glutes', 'core']);
warm('wu-shoulder-rolls', 'Shoulder rolls', 'normal', ['shoulders', 'back']);
warm('wu-torso-twist', 'Torso twist', 'normal', ['core', 'back']);
warm('wu-cat-cow', 'Cat-cow', 'normal', ['back', 'core'], { contra: ['wrists', 'knees'] });
warm('wu-light-jacks', 'Light jumping jacks', 'normal', ['legs', 'shoulders'], { jumping: true, impact: 'high', hiit: true });
warm('wu-ankle-bounce', 'Ankle bounces', 'normal', ['legs'], { jumping: true, impact: 'high' });
warm('wu-sun-reach', 'Standing reach', 'yoga', ['back', 'shoulders']);
warm('wu-yoga-cat-cow', 'Cat-cow flow', 'yoga', ['back', 'core'], { contra: ['wrists', 'knees'] });
warm('wu-sun-salute', 'Gentle sun salutation', 'yoga', ['legs', 'back', 'shoulders']);
warm('wu-neck-rolls', 'Neck rolls', 'yoga', ['shoulders']);
warm('wu-hip-sway', 'Hip sway', 'yoga', ['glutes', 'core']);
warm('wu-easy-step', 'Easy-step groove', 'dance', ['legs', 'core']);
warm('wu-step-touch', 'Step touch', 'dance', ['legs', 'arms']);
warm('wu-shoulder-groove', 'Shoulder groove', 'dance', ['shoulders', 'back']);
warm('wu-hip-roll', 'Hip roll', 'dance', ['glutes', 'core']);
warm('wu-bounce-warm', 'Light bounce', 'dance', ['legs'], { jumping: true, impact: 'high' });

// --- Cool-downs -----------------------------------------------------------
const cool = (id: string, name: string, style: Style, stretches: BodyPart[], rest: Partial<Def> = {}) =>
  add({ id, name, style, phase: 'cooldown', pattern: 'mobility', muscles: [], stretches, mode: 'hold', impact: 'none', ...rest });
cool('cd-chest-opener', 'Chest opener', 'normal', ['chest', 'shoulders']);
cool('cd-cross-body', 'Cross-body shoulder stretch', 'normal', ['shoulders'], { contra: ['shoulders'] });
cool('cd-triceps', 'Triceps stretch', 'normal', ['arms']);
cool('cd-quad', 'Standing quad stretch', 'normal', ['legs'], { contra: ['knees'] });
cool('cd-hamstring', 'Hamstring stretch', 'normal', ['legs']);
cool('cd-figure-four', 'Figure-four stretch', 'normal', ['glutes']);
cool('cd-child-pose', 'Child pose', 'normal', ['back', 'glutes'], { contra: ['knees'] });
cool('cd-lat', 'Side lat stretch', 'normal', ['back', 'core']);
cool('cd-spinal-twist', 'Lying spinal twist', 'normal', ['back', 'core'], { contra: ['pregnancy', 'recent_surgery'] });
cool('cd-hip-flexor', 'Hip flexor stretch', 'normal', ['legs', 'glutes'], { contra: ['knees'] });
cool('cd-calf', 'Calf stretch', 'normal', ['legs']);
cool('cd-deep-breathing', 'Deep breathing', 'normal', []);
cool('cd-rest-pose', 'Rest pose', 'normal', []);
cool('cd-yoga-seated-fold', 'Seated forward fold', 'yoga', ['legs', 'back']);
cool('cd-yoga-twist', 'Seated twist', 'yoga', ['core', 'back']);
cool('cd-yoga-rest', 'One-minute rest pose', 'yoga', []);
cool('cd-yoga-neck', 'Neck stretch', 'yoga', ['shoulders']);
cool('cd-dance-legs', 'Standing leg stretch', 'dance', ['legs', 'glutes']);
cool('cd-dance-hips', 'Standing hip stretch', 'dance', ['glutes', 'core']);
cool('cd-dance-shoulders', 'Standing shoulder stretch', 'dance', ['shoulders', 'arms']);
cool('cd-dance-breath', 'Slow breathing', 'dance', []);

export const fixtureCatalogue: Catalogue = { exercises: out };

export function fixtureExercise(id: string): Exercise {
  const ex = out.find((e) => e.id === id);
  if (!ex) throw new Error(`No fixture exercise ${id}`);
  return ex;
}
