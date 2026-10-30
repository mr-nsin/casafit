import { z } from 'zod';
import { proState } from './auth';

/** Paths, as in api/openapi.json. */
export const entitlementPaths = {
  status: '/v1/me/entitlements',
  consume: '/v1/entitlements/form-check/consume',
  refund: '/v1/entitlements/form-check/refund',
} as const;

export const idempotencyKey = z.string().min(16).max(128);

export const consumeRequest = z.object({
  idempotencyKey,
  exercise: z.enum(['squat', 'push_up', 'plank', 'lunge']),
});

export const consumeResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), freeChecksRemaining: z.number().int().min(0).max(2) }),
  z.object({ ok: z.literal(false), reason: z.enum(['no_credits', 'pro_active']) }),
]);

/** A refund is legal only before rep 3 and once per consume; later reps get ok:false. */
export const refundRequest = z.object({
  idempotencyKey,
  /** The idempotencyKey of the consume being reversed. */
  consumeIdempotencyKey: idempotencyKey,
  repsCompleted: z.number().int().min(0).max(1000),
});

export const refundResponse = z.object({
  ok: z.boolean(),
  freeChecksRemaining: z.number().int().min(0).max(2),
});

export const entitlementsStatus = z.object({
  freeChecksRemaining: z.number().int().min(0).max(2),
  pro: proState,
});

export type ConsumeRequest = z.infer<typeof consumeRequest>;
export type ConsumeResponse = z.infer<typeof consumeResponse>;
export type RefundRequest = z.infer<typeof refundRequest>;
export type RefundResponse = z.infer<typeof refundResponse>;
export type EntitlementsStatus = z.infer<typeof entitlementsStatus>;
