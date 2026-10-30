// Export and delete. Both need the server, so both fail kindly offline and change nothing.

import { QueryClientContext } from '@tanstack/react-query';
import { useContext } from 'react';

import { ApiError, NetworkError } from '../../api/client';
import { getNotificationService } from '../../services/notifications';
import { useAuth } from '../../state/auth';
import { useConsent } from '../../state/consent';
import { defaultPreferences, usePreferences } from '../../state/preferences';
import { getRepositories } from '../../state/storage';
import { emptyDraft, useOnboarding } from '../../state/onboardingDraft';
import { getSettingsDeps } from './deps';

export type AccountResult = { ok: true } | { ok: false; reason: 'offline' | 'signed_out' | 'server' };

export const failureMessage = (what: 'export' | 'delete', reason: 'offline' | 'signed_out' | 'server'): string => {
  const kept = what === 'delete' ? 'Nothing was deleted, and your data is still here. ' : 'Nothing was changed. ';
  if (reason === 'offline') return `You are offline. ${kept}Connect to the internet and try again.`;
  if (reason === 'signed_out') return `You need to be signed in for this. ${kept}Sign in again and retry.`;
  return `We could not reach our servers just now. ${kept}Please try again in a moment.`;
};

const classify = (e: unknown): 'offline' | 'signed_out' | 'server' =>
  e instanceof NetworkError ? 'offline' : e instanceof ApiError && e.status === 401 ? 'signed_out' : 'server';

/** Server copy plus what only lives on this phone, as one JSON file for the share sheet. */
export async function exportMyData(): Promise<AccountResult> {
  const deps = getSettingsDeps();
  try {
    const server = await deps.api<unknown>('/me/export', { method: 'POST' });
    const repos = getRepositories();
    const [profile, plan, logs, consent] = await Promise.all([
      repos.profile.get(),
      repos.plan.get(),
      repos.sessionLog.list(),
      repos.consent.history(),
    ]);
    const file = { exportedAt: new Date(deps.now()).toISOString(), server, onThisPhone: { profile, plan, sessions: logs, consents: consent } };
    await deps.share({ title: 'My CasaFit data', message: JSON.stringify(file, null, 2) });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: classify(e) };
  }
}

/** Wipes everything on this phone and signs out. Called only after the server confirmed the delete. */
export async function wipeLocalData(): Promise<void> {
  await getRepositories().wipeAll();
  await getNotificationService().cancelAll();
  await useAuth.getState().signOut();
  usePreferences.setState({ ...defaultPreferences(), hydrated: true });
  useConsent.setState({ latest: {}, hydrated: true });
  useOnboarding.setState({ draft: emptyDraft() });
}

/** Server first. If it fails, the phone keeps everything. */
export async function deleteMyAccount(): Promise<AccountResult> {
  try {
    await getSettingsDeps().api<null>('/me', { method: 'DELETE' });
  } catch (e) {
    return { ok: false, reason: classify(e) };
  }
  try {
    await wipeLocalData();
  } catch {
    // The account is gone on the server; a half-wiped phone still signs out below.
    await useAuth.getState().signOut();
  }
  return { ok: true };
}

/** Clears cached server data when a QueryClient is mounted. */
export function useClearQueryCache(): () => void {
  const client = useContext(QueryClientContext);
  return () => client?.clear();
}
