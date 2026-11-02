// Server copies of settings changes (consents, plan metadata). The phone is the source of truth;
// these go through the offline queue and never block or undo a local change.

import type { ConsentPurpose, ConsentRecord, PlanRow } from '../../db/repositories';
import { upsertPlanRequest } from '@casafit/shared';
import { toServerPlan } from '../../engine';
import type { QueueItem } from '../../services/offline-queue';
import { getOnboardingDeps } from '../onboarding/deps';

type Latest = Partial<Record<ConsentPurpose, ConsentRecord>>;
type Enqueue = (req: { kind: string; method: 'POST' | 'PUT'; path: string; body: unknown; idempotencyKey: string }) => Promise<QueueItem | unknown>;

export type ServerConsentType = 'health_sync' | 'analytics' | 'privacy_notice' | 'terms';

/**
 * Builds the body for POST /v1/me/consents, or null when the server has no such type.
 * Health answers and steps both fall under `health_sync`: it is on while either is on.
 * The camera consent never leaves the phone (no camera data is ever sent).
 */
export function consentBody(rec: ConsentRecord, latest: Latest): { type: ServerConsentType; granted: boolean; policyVersion: string } | null {
  const on = (p: ConsentPurpose) => (p === rec.purpose ? rec.granted : latest[p]?.granted === true);
  switch (rec.purpose) {
    case 'analytics':
      return { type: 'analytics', granted: rec.granted, policyVersion: rec.noticeVersion };
    case 'health_answers':
    case 'steps':
      return { type: 'health_sync', granted: on('health_answers') || on('steps'), policyVersion: rec.noticeVersion };
    case 'terms_privacy':
      return { type: 'privacy_notice', granted: rec.granted, policyVersion: rec.noticeVersion };
    default:
      return null;
  }
}

export async function queueConsent(enqueue: Enqueue, rec: ConsentRecord, latest: Latest): Promise<void> {
  const body = consentBody(rec, latest);
  if (!body) return;
  // The record id is the idempotency key: one withdrawal or grant is never sent twice.
  await enqueue({ kind: 'consent.post', method: 'POST', path: '/me/consents', body, idempotencyKey: rec.id });
}

export type ServerPlanBody = ReturnType<typeof toServerPlan>;

/**
 * Plan metadata only (decision D3): pain areas are never in it, the API answers 400 if they are.
 * Returns null when the saved plan would fail the strict schema, so we send nothing rather than a 400.
 */
export function planBody(plan: PlanRow | null): ServerPlanBody | null {
  if (!plan) return null;
  const body = toServerPlan({ goal: plan.goal === 'gentler' ? 'stay_fit' : plan.goal, styles: plan.styles, daysPerWeek: plan.daysPerWeek, experience: plan.experience }, plan);
  const parsed = upsertPlanRequest.safeParse(body);
  return parsed.success ? (parsed.data as ServerPlanBody) : null;
}

/** Queues PUT /v1/me/plan through the shell's queue. Never throws: offline simply retries later. */
export async function pushPlanMetadata(plan: PlanRow | null): Promise<boolean> {
  const body = planBody(plan);
  if (!body) return false;
  try {
    await getOnboardingDeps().syncPlan(body);
    return true;
  } catch {
    return false;
  }
}
