import { z } from 'zod';
import { planSummary } from './auth';

// Mirrors api/openapi.json: PUT /v1/me/plan. Decision D3: the server only ever gets plan metadata.
// Age, sex, height, weight, pain areas and health flags stay on the phone; the API answers 400 if they are sent.

export const goal = z.enum(['stay_fit', 'body_part', 'gentler']);
export const style = z.enum(['normal', 'yoga', 'dance']);
export const experience = z.enum(['new', 'on_and_off', 'regular']);

/** Styles travel as a bitmask: 1 normal, 2 yoga, 4 dance. */
export const STYLE_BITS = { normal: 1, yoga: 2, dance: 4 } as const;

export const upsertPlanRequest = z
  .object({
    goal,
    /** Bitmask of styles, 1 to 7. */
    styles: z.number().int().min(1).max(7),
    days: z.number().int().min(3).max(7),
    experience,
    /** 1 to 32 characters: a-z, 0-9 and underscore, for example `standard` or `gentler`. */
    variant: z.string().regex(/^[a-z0-9_]{1,32}$/),
  })
  .strict();

export const upsertPlanResponse = planSummary;

export type UpsertPlanRequest = z.infer<typeof upsertPlanRequest>;
export type UpsertPlanResponse = z.infer<typeof upsertPlanResponse>;
