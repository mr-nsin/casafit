// Plain data and copy for the form-check screens. Wording is plain and kind: it says what to do,
// never what went wrong with the person.

import type { PainArea } from '../../db/repositories';
import type { FormExercise, Issue, Rating } from '../../services/pose';

export const EXERCISE_LABEL: Record<FormExercise, string> = {
  squat: 'Squat',
  push_up: 'Push-up',
  plank: 'Plank',
  lunge: 'Lunge',
};

/**
 * Which exercises each pain flag switches off in the form camera (plan flag A4, an assumption
 * until product confirms): knees turn off the lunge, wrists turn off the push-up. Back and
 * shoulders block nothing here; the session planner already leaves those moves out.
 */
export const PAIN_BLOCKS: Partial<Record<PainArea, FormExercise[]>> = {
  knees: ['lunge'],
  wrists: ['push_up'],
};

const PAIN_WORD: Partial<Record<PainArea, string>> = { knees: 'knee', wrists: 'wrist' };

export interface ExerciseChoice {
  id: FormExercise;
  label: string;
  disabled: boolean;
  reason?: string;
}

export function exerciseChoices(painAreas: readonly PainArea[]): ExerciseChoice[] {
  return (Object.keys(EXERCISE_LABEL) as FormExercise[]).map((id) => {
    const area = painAreas.find((a) => PAIN_BLOCKS[a]?.includes(id));
    return area
      ? { id, label: EXERCISE_LABEL[id], disabled: true, reason: `${EXERCISE_LABEL[id]} is unavailable because of your ${PAIN_WORD[area]}` }
      : { id, label: EXERCISE_LABEL[id], disabled: false };
  });
}

export const isHold = (e: FormExercise): boolean => e === 'plank';

/** The count point in words: "3 reps", or "10 seconds" for the plank. */
export const countPoint = (e: FormExercise): string => (isHold(e) ? '10 seconds' : '3 reps');

export const AREA_LABEL: Record<Issue, string> = { depth: 'Depth', knees: 'Knees', back: 'Back', hips: 'Hips', elbows: 'Elbows' };

/** One short spoken or shown cue per faulty rep. */
export function cueFor(e: FormExercise, issue: Issue): string {
  switch (issue) {
    case 'depth':
      return e === 'lunge' ? 'Lower a little' : 'A little deeper';
    case 'back':
      return e === 'lunge' ? 'Stand a little taller' : 'Chest up a little';
    case 'knees':
      return e === 'lunge' ? 'Keep the knee over the foot' : 'Knees out a little';
    case 'hips':
      return e === 'plank' || e === 'push_up' ? 'Hips in line with your body' : 'Keep your hips level';
    case 'elbows':
      return e === 'plank' ? 'Elbows under your shoulders' : 'Lower a little more';
  }
}

const OK_TEXT: Record<Issue, string> = {
  depth: 'Good depth',
  knees: 'Knees tracked well',
  back: 'Stayed neutral',
  hips: 'Hips stayed in line',
  elbows: 'Good range',
};

const WARN_TEXT: Record<Issue, string> = {
  depth: 'Try going a little lower',
  knees: 'Try to keep your knees over your toes',
  back: 'Try to keep your chest a little higher',
  hips: 'Try to keep your hips in line',
  elbows: 'Try to lower a little more',
};

export const findingText = (area: Issue, status: 'ok' | 'warn'): string => (status === 'ok' ? OK_TEXT[area] : WARN_TEXT[area]);

export const TIP: Record<Issue, string> = {
  depth: 'Slow down and sit a little lower. Stop where it feels comfortable.',
  knees: 'Push your knees out over your toes as you go down.',
  back: 'Look slightly ahead and keep your chest proud.',
  hips: 'Squeeze your belly and glutes to keep a straight line.',
  elbows: 'Go down until your elbows are about square, then press up.',
};

export const GOOD_TIP = 'Nice and steady. Try one more set when you are ready.';

export const RATING_LABEL: Record<Rating, string> = {
  good: 'Good form',
  okay: 'Okay form',
  needs_work: 'Needs work',
};

export const PRIVACY_LINE = 'Runs on this phone only. Nothing is recorded, saved or uploaded.';
