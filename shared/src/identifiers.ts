// Identifier handling. One source of truth for both the app and the api.
// See docs/data-model.md §1 for the rules. Identity is an email address (Supabase Auth); there is no phone login.

import { z } from 'zod';

const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/**
 * The address to send a sign-in code to: trimmed and lower-cased, nothing else.
 * Plus-tags and dots are kept, because the code must reach the address the person typed.
 * Throws when the input is not shaped like an email address.
 */
export function normaliseEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (!EMAIL_SHAPE.test(email) || email.length > 320) throw new Error('Enter a valid email address');
  return email;
}

/** True when `normaliseEmail` would accept the input. */
export function isValidEmail(input: string): boolean {
  try {
    normaliseEmail(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Canonical form used to recognise the same mailbox (strips plus-tags, strips Gmail dots).
 * Mirrors CasaFit.Application/Auth/EmailIdentity.Canonical. Never send a code to this form.
 */
export function canonicalEmail(input: string): string {
  const lower = input.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at <= 0 || at === lower.length - 1) return lower;
  let local = (lower.slice(0, at).split('+')[0] ?? '');
  const domain = lower.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') local = local.replace(/\./g, '');
  return local.length === 0 ? lower : `${local}@${domain}`;
}

/** For display, for example `n***@gmail.com`. Mirrors EmailIdentity.Mask in the api. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export const emailSchema = z
  .string()
  .transform((v, ctx) => {
    try {
      return normaliseEmail(v);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: (e as Error).message });
      return z.NEVER;
    }
  });
