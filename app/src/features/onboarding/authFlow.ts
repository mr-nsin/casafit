// Verify talks to POST /v1/auth/code and POST /v1/auth/verify through the existing api client.
// This file turns every documented response into one small result the screen can render.

import type { SendCodeResponse, VerifyCodeResponse } from '@casafit/shared';
import { normaliseEmail, normalisePhoneE164 } from '@casafit/shared';
import { ApiError, NetworkError, api } from '../../api/client';
import { useAuth } from '../../state/auth';

export type Channel = 'phone' | 'email';
export type Identifier = { channel: Channel; value: string };

export function normaliseIdentifier(
  channel: Channel,
  raw: string,
  cc = '+91',
): { ok: true; value: string } | { ok: false; error: string } {
  try {
    if (channel === 'phone') {
      const v = normalisePhoneE164(raw, cc);
      if (!/^\+\d{10,15}$/.test(v)) return { ok: false, error: 'Enter a valid mobile number.' };
      return { ok: true, value: v };
    }
    const v = normaliseEmail(raw);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return { ok: false, error: 'Enter a valid email address.' };
    return { ok: true, value: v };
  } catch (e) {
    const m = (e as Error).message;
    return {
      ok: false,
      error: m.includes('Disposable')
        ? 'Use a regular email address, not a temporary one.'
        : channel === 'phone'
          ? 'Enter a valid mobile number.'
          : 'Enter a valid email address.',
    };
  }
}

const body = (id: Identifier) => (id.channel === 'phone' ? { phone: id.value } : { email: id.value });

export type SendResult =
  | { kind: 'sent'; resendInSeconds: number; attemptsLeft: number }
  | { kind: 'throttled'; resendInSeconds: number; limitReached: boolean }
  | { kind: 'invalid' }
  | { kind: 'attestation_failed' }
  | { kind: 'offline' }
  | { kind: 'error' };

export const RESEND_WINDOW_S = 30;

/**
 * The server answers 200 for a fresh send and for a throttled one. Throttled is recognised by
 * attemptsLeftThisHour 0 (hour limit reached) or by a wait shorter than the full resend window.
 */
export async function sendCode(id: Identifier): Promise<SendResult> {
  try {
    const r = await api<SendCodeResponse>('/auth/code', { method: 'POST', body: JSON.stringify(body(id)) });
    if (r.attemptsLeftThisHour === 0 && r.resendInSeconds > 0) {
      return { kind: 'throttled', resendInSeconds: r.resendInSeconds, limitReached: true };
    }
    if (r.resendInSeconds < RESEND_WINDOW_S) {
      return { kind: 'throttled', resendInSeconds: r.resendInSeconds, limitReached: false };
    }
    return { kind: 'sent', resendInSeconds: r.resendInSeconds, attemptsLeft: r.attemptsLeftThisHour };
  } catch (e) {
    if (e instanceof NetworkError) return { kind: 'offline' };
    if (e instanceof ApiError) {
      if (e.status === 400) return { kind: 'invalid' };
      if (e.status === 403) return { kind: 'attestation_failed' };
    }
    return { kind: 'error' };
  }
}

export type VerifyFailure = 'wrong' | 'expired' | 'no_tries_left';
export type VerifyResult =
  | { kind: 'ok'; isNewAccount: boolean; freeChecksRemaining: number }
  | { kind: 'failed'; reason: VerifyFailure }
  | { kind: 'invalid' }
  | { kind: 'offline' }
  | { kind: 'error' };

export async function verifyCode(id: Identifier, code: string): Promise<VerifyResult> {
  try {
    const r = await api<VerifyCodeResponse>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ ...body(id), code }),
    });
    await useAuth.getState().save(r);
    return { kind: 'ok', isNewAccount: r.isNewAccount, freeChecksRemaining: r.freeChecksRemaining };
  } catch (e) {
    if (e instanceof NetworkError) return { kind: 'offline' };
    if (e instanceof ApiError) {
      if (e.status === 401) {
        const c = (e.body as { code?: string } | null)?.code;
        return { kind: 'failed', reason: c === 'expired' || c === 'no_tries_left' ? c : 'wrong' };
      }
      if (e.status === 400) return { kind: 'invalid' };
    }
    return { kind: 'error' };
  }
}
