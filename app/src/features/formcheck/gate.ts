// Where "Check form" goes. Permission first (never spends anything), then the free balance.

import { useConsent } from '../../state/consent';
import { getFormCheckDeps } from './deps';
import { currentProStatus, useEntitlements } from './entitlements';

export type FormCheckEntry = 'CameraPermission' | 'CameraDenied' | 'NoCredits' | 'FormCheck';

/**
 * undetermined (or camera consent not given yet) -> CameraPermission, denied -> CameraDenied,
 * no free checks and not Pro -> NoCredits, otherwise FormCheck. An unavailable camera module goes
 * to FormCheck, which explains that checks are not ready on this build.
 */
export async function resolveFormCheckEntry(): Promise<FormCheckEntry> {
  const d = getFormCheckDeps();
  const perm = d.permission().status();
  if (perm === 'denied') return 'CameraDenied';
  if (perm === 'undetermined') return 'CameraPermission';

  const consent = useConsent.getState();
  if (!consent.hydrated) await consent.hydrate().catch(() => undefined);
  if (perm === 'granted' && !useConsent.getState().has('camera') && useConsent.getState().hydrated) return 'CameraPermission';

  return resolveCredits();
}

/** The balance half of the gate, used on its own right after the permission is granted. */
export async function resolveCredits(): Promise<'NoCredits' | 'FormCheck'> {
  const ent = useEntitlements.getState();
  if (!ent.hydrated) await ent.hydrate().catch(() => undefined);
  if (!currentProStatus().active && useEntitlements.getState().freeChecks <= 0) return 'NoCredits';
  return 'FormCheck';
}
