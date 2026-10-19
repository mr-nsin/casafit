import { z } from 'zod';

export const idempotencyKey = z.string().min(16).max(128);

export const consumeRequest = z.object({
  idempotencyKey,
  exercise: z.enum(['squat', 'push_up', 'plank', 'lunge']),
});

export const consumeResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), freeChecksRemaining: z.number().int().min(0).max(2) }),
  z.object({ ok: z.literal(false), reason: z.enum(['no_credits', 'pro_active']) }),
]);

export const refundRequest = z.object({ idempotencyKey });

export const entitlementsStatus = z.object({
  freeChecksRemaining: z.number().int().min(0).max(2),
  pro: z.object({ active: z.boolean(), expiresAt: z.string().datetime().nullable() }),
});

export type ConsumeRequest = z.infer<typeof consumeRequest>;
export type ConsumeResponse = z.infer<typeof consumeResponse>;
export type EntitlementsStatus = z.infer<typeof entitlementsStatus>;
