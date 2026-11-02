// The quiet comeback rebuild (PRD idea 4, D14). After a gap the week is rebuilt one rung easier
// with comebackInput(): one fewer day (never under 3), a lighter ladder level, softer intensity.
// It only runs after the person confirms. Nothing here counts missed days.

import { buildPlan, comebackInput, EngineError, type PlanInput } from '../../../engine';
import { getRepositories } from '../../../state/storage';
import { getOnboardingDeps } from '../../onboarding/deps';
import { dayRow } from '../../onboarding/buildAndSave';
import { refreshReminders } from '../../settings/reminders';
import { pushPlanMetadata } from '../../settings/serverSync';
import { getSessionDeps } from '../deps';
import { localDate } from './model';

/** Preference key: epoch ms of the last comeback rebuild. */
export const COMEBACK_KEY = 'comeback.rebuiltAt';

export type ComebackResult = { ok: true; days: number } | { ok: false; reason: 'no_plan' | 'cannot_build' };

/** Offer the rebuild only when it has not already been done since the last finished session. */
export async function comebackRebuildPending(lastSessionAt: number | null): Promise<boolean> {
  try {
    const raw = await getRepositories().prefs.get(COMEBACK_KEY);
    const at = raw ? Number(raw) : 0;
    return !(lastSessionAt !== null && at > lastSessionAt);
  } catch {
    return true;
  }
}

/** Rebuilds the saved plan one rung easier, starting today. Keeps goal, styles, experience and health answers. */
export async function rebuildComebackWeek(): Promise<ComebackResult> {
  const repos = getRepositories();
  const [plan, profile] = await Promise.all([repos.plan.get(), repos.profile.get()]);
  if (!plan) return { ok: false, reason: 'no_plan' };
  const now = getSessionDeps().clock.wall();
  const base: PlanInput = {
    goal: plan.goal === 'gentler' ? 'stay_fit' : plan.goal,
    bodyParts: plan.goal === 'body_part' ? (plan.bodyParts as PlanInput['bodyParts']) : [],
    styles: plan.styles.length ? plan.styles : ['normal'],
    mix: plan.styles.length === 3 ? plan.mix : undefined,
    daysPerWeek: plan.daysPerWeek,
    experience: plan.experience,
    painAreas: profile?.painAreas ?? [],
    healthFlags: profile?.healthFlags ?? [],
    startDate: localDate(now),
    weekNumber: plan.weekNumber,
    seed: Math.floor(now % 100000),
    age: profile?.birthYear ? new Date(now).getFullYear() - profile.birthYear : null,
  };
  const input = comebackInput(base);
  let next;
  try {
    next = buildPlan(input, getOnboardingDeps().catalogue());
  } catch (e) {
    if (e instanceof EngineError) return { ok: false, reason: 'cannot_build' };
    throw e;
  }
  await repos.plan.save({
    goal: plan.goal,
    bodyParts: plan.bodyParts,
    styles: plan.styles,
    mix: plan.mix,
    daysPerWeek: input.daysPerWeek as 3 | 4 | 5 | 6 | 7,
    experience: plan.experience,
    variant: next.variant,
    weekNumber: next.weekNumber,
    engineVersion: next.engineVersion,
  });
  await repos.plan.replaceDays(next.weekNumber, next.days.map((d) => dayRow(next.weekNumber, d)));
  await repos.prefs.set(COMEBACK_KEY, String(now));
  // The server only gets plan metadata, and the reminder text follows the new week. Neither waits.
  void pushPlanMetadata(await repos.plan.get());
  void refreshReminders();
  return { ok: true, days: input.daysPerWeek };
}
