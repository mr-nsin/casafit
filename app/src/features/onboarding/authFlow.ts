// Sign-in for the Verify screen: email one-time code or Google / Apple / Facebook, all through the AuthProvider.
// Supabase creates the session; GET /v1/me then creates (or finds) the account on our server.
// This file turns every outcome into one small result the screen can render.

import { maskEmail, normaliseEmail } from '@casafit/shared';
import type { AuthProvider as ProviderName } from '@casafit/shared';

import { fetchMe } from '../../api/auth';
import { getAuth, RESEND_COOLDOWN_S, type AuthSession, type SocialProvider } from '../../services/auth';

export { RESEND_COOLDOWN_S };

/** How long an emailed code is good for. Matches the Supabase "Email OTP expiration" setting (default 3600 s). */
export const CODE_LIFETIME_S = 3600;

export function validateEmail(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  try {
    return { ok: true, value: normaliseEmail(raw) };
  } catch {
    return { ok: false, error: 'Enter a valid email address.' };
  }
}

/**
 * Google everywhere, Facebook everywhere, Apple on iOS only. App Store rules ask for Sign in with Apple when other
 * social sign-in is offered, and Apple on Android needs the web flow with little benefit for Android phones.
 */
export function socialProvidersFor(os: string): SocialProvider[] {
  return os === 'ios' ? ['google', 'apple', 'facebook'] : ['google', 'facebook'];
}

export const PROVIDER_LABEL: Record<SocialProvider, string> = { google: 'Google', apple: 'Apple', facebook: 'Facebook' };

export type SendResult =
  | { kind: 'sent'; resendInSeconds: number }
  | { kind: 'throttled'; resendInSeconds: number }
  | { kind: 'invalid' }
  | { kind: 'unavailable' }
  | { kind: 'offline' }
  | { kind: 'error' };

export async function sendCode(email: string): Promise<SendResult> {
  const r = await getAuth().sendEmailCode(email);
  if (r.ok) return { kind: 'sent', resendInSeconds: RESEND_COOLDOWN_S };
  switch (r.reason) {
    case 'rate_limited':
      return { kind: 'throttled', resendInSeconds: r.retryAfterS ?? RESEND_COOLDOWN_S };
    case 'invalid_email':
      return { kind: 'invalid' };
    case 'unavailable':
      return { kind: 'unavailable' };
    case 'offline':
      return { kind: 'offline' };
    default:
      return { kind: 'error' };
  }
}

/** What the screen needs after a successful sign-in. `isNewAccount` is null when /v1/me could not be reached. */
export type SignedIn = {
  kind: 'ok';
  isNewAccount: boolean | null;
  masked: string | null;
  provider: ProviderName | null;
  freeChecksRemaining: number | null;
};

export type VerifyFailure = 'wrong' | 'expired' | 'rate_limited';
export type VerifyResult =
  | SignedIn
  | { kind: 'failed'; reason: VerifyFailure }
  | { kind: 'unavailable' }
  | { kind: 'offline' }
  | { kind: 'error' };

/**
 * Create the account on the server (first authenticated request) and read what we show afterwards.
 * Signing in already worked, so a network failure here is not an error: the person continues, and the
 * account is created on the next request.
 */
export async function completeSignIn(session: AuthSession): Promise<SignedIn> {
  try {
    const me = await fetchMe();
    return {
      kind: 'ok',
      isNewAccount: !me.plan && !me.onboarded,
      masked: me.emailMasked,
      provider: me.provider,
      freeChecksRemaining: me.freeChecksRemaining,
    };
  } catch {
    return {
      kind: 'ok',
      isNewAccount: null,
      masked: session.email ? maskEmail(session.email) : null,
      provider: session.method === 'dev' ? null : session.method,
      freeChecksRemaining: null,
    };
  }
}

/** `sentAt` lets a code the server calls wrong be reported as expired once its lifetime has passed. */
export async function verifyCode(email: string, code: string, sentAt: number, now: number): Promise<VerifyResult> {
  const r = await getAuth().verifyEmailCode(email, code);
  if (r.ok) return completeSignIn(r.session);
  switch (r.reason) {
    case 'wrong':
      return { kind: 'failed', reason: now - sentAt > CODE_LIFETIME_S * 1000 ? 'expired' : 'wrong' };
    case 'expired':
    case 'rate_limited':
      return { kind: 'failed', reason: r.reason };
    case 'offline':
      return { kind: 'offline' };
    case 'unavailable':
      return { kind: 'unavailable' };
    default:
      return { kind: 'error' };
  }
}

export type SocialResult = SignedIn | { kind: 'cancelled' } | { kind: 'unavailable' } | { kind: 'offline' } | { kind: 'error' };

export async function signInWithSocial(provider: SocialProvider): Promise<SocialResult> {
  const r = await getAuth().signInWithOAuth(provider);
  if (r.ok) return completeSignIn(r.session);
  return { kind: r.reason };
}

export async function signInAsDev(): Promise<SocialResult> {
  const auth = getAuth();
  const r = (await auth.signInAsDev?.()) ?? { ok: false as const, reason: 'unavailable' as const };
  if (r.ok) return completeSignIn(r.session);
  return { kind: r.reason };
}
