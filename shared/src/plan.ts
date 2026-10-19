import { z } from 'zod';

export const goal = z.enum(['stay_fit', 'body_part', 'gentler']);
export const style = z.enum(['normal', 'yoga', 'dance']);
export const experience = z.enum(['new', 'on_and_off', 'regular']);
export const bodyPart = z.enum(['arms', 'chest', 'back', 'shoulders', 'core', 'glutes', 'legs']);
export const painArea = z.enum(['knees', 'back', 'shoulders', 'wrists', 'other']);
export const healthFlag = z.enum(['heart_bp', 'pregnancy', 'recent_surgery']);
export const sex = z.enum(['female', 'male', 'other', 'prefer_not_to_say']);

export const upsertPlanRequest = z.object({
  goal,
  bodyParts: z.array(bodyPart).max(2),
  styles: z.array(style).min(1).max(3),
  mix: z.record(style, z.number().int().min(0).max(7)).optional(),
  ageYears: z.number().int().min(18).max(120),
  sex,
  heightCm: z.number().int().min(80).max(260).optional(),
  weightKg: z.number().min(20).max(300).optional(),
  experience,
  daysPerWeek: z.number().int().min(3).max(7),
  pain: z.array(painArea),
  health: z.array(healthFlag),
});

export const planDay = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  style: style.or(z.literal('rest')).or(z.literal('walk')).or(z.literal('stretch')),
  minutes: z.number().int().min(0).max(60),
  focus: z.array(bodyPart).optional(),
  excludedMoves: z.array(z.string()).optional(),
});

export const upsertPlanResponse = z.object({
  weekNumber: z.number().int().min(1),
  days: z.array(planDay).length(7),
  isGentlerPlan: z.boolean(),
  excludedBecauseOfPain: z.array(z.string()),
});

export type UpsertPlanRequest = z.infer<typeof upsertPlanRequest>;
export type UpsertPlanResponse = z.infer<typeof upsertPlanResponse>;
