import { z } from 'zod';

// Sign-in is Supabase Auth (email one-time code, Google, Apple, Facebook). The app sends the Supabase access token
// as `Authorization: Bearer`. The API issues no tokens, so there are no code, verify or refresh types here.
// Mirrors api/openapi.json: GET /v1/me.

export const authProvider = z.enum(['email', 'google', 'apple', 'facebook']);

export const proState = z.object({
  active: z.boolean(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
});

export const planSummary = z.object({
  goal: z.string(),
  styles: z.number().int(),
  days: z.number().int(),
  experience: z.string(),
  variant: z.string(),
  weekNumber: z.number().int(),
  updatedAt: z.string().datetime({ offset: true }),
});

export const meResponse = z.object({
  id: z.string().uuid(),
  /** Lower-cased. Null when the provider shared no address (for example Apple private relay opt-out). */
  email: z.string().nullable(),
  /** For display, for example `n***@gmail.com`. */
  emailMasked: z.string().nullable(),
  provider: authProvider,
  locale: z.string(),
  onboarded: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  freeChecksRemaining: z.number().int().min(0).max(2),
  pro: proState,
  plan: planSummary.nullable(),
});

export type AuthProvider = z.infer<typeof authProvider>;
export type ProState = z.infer<typeof proState>;
export type MeResponse = z.infer<typeof meResponse>;
