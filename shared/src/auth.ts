import { z } from 'zod';
import { emailSchema, phoneSchema } from './identifiers';

export const sendCodeRequest = z
  .object({
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((v) => !!v.phone !== !!v.email, {
    message: 'Provide exactly one of phone or email',
  });

export const sendCodeResponse = z.object({
  resendInSeconds: z.number().int().min(0),
  attemptsLeftThisHour: z.number().int().min(0),
});

export const verifyCodeRequest = z.object({
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const verifyCodeResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  isNewAccount: z.boolean(),
  freeChecksRemaining: z.number().int().min(0).max(2),
  pro: z.object({ active: z.boolean(), expiresAt: z.string().datetime().nullable() }),
});

export type SendCodeRequest = z.infer<typeof sendCodeRequest>;
export type SendCodeResponse = z.infer<typeof sendCodeResponse>;
export type VerifyCodeRequest = z.infer<typeof verifyCodeRequest>;
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponse>;
