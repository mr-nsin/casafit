// Identifier normalisation. One source of truth for both the app and the api.
// See docs/data-model.md §1 for the rules.

import { z } from 'zod';

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'yopmail.com',
]);

/** Normalise a phone number to E.164. Accepts "9876543210" with a country hint. */
export function normalisePhoneE164(input: string, defaultCountry = '+91'): string {
  const trimmed = input.replace(/[\s()\-]/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.length === 10 && defaultCountry === '+91') return `+91${trimmed}`;
  throw new Error('Phone number must be in E.164 (for example +919876543210)');
}

/** Normalise an email: lower-case, strip plus-tags, strip Gmail dots. */
export function normaliseEmail(input: string): string {
  const [rawLocal, rawDomain] = input.trim().toLowerCase().split('@');
  if (!rawLocal || !rawDomain) throw new Error('Email must contain exactly one @');
  if (DISPOSABLE_EMAIL_DOMAINS.has(rawDomain)) {
    throw new Error('Disposable email addresses are not accepted');
  }
  const withoutPlus = rawLocal.split('+')[0] ?? rawLocal;
  const local = rawDomain === 'gmail.com' ? withoutPlus.replace(/\./g, '') : withoutPlus;
  return `${local}@${rawDomain}`;
}

export const phoneSchema = z
  .string()
  .min(10)
  .transform((v, ctx) => {
    try {
      return normalisePhoneE164(v);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: (e as Error).message });
      return z.NEVER;
    }
  });

export const emailSchema = z
  .string()
  .email()
  .transform((v, ctx) => {
    try {
      return normaliseEmail(v);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: (e as Error).message });
      return z.NEVER;
    }
  });
