// What a tap on a ready-made plan or a body-part button does. Shared by Home, Library,
// BodyPart and the plan view so each of them behaves the same way.

import { loadContent } from '../../../content';
import { getSessionDeps } from '../deps';
import { startSession } from '../index';
import type { PlanData } from './hooks';
import { buildPartSession, restrictionsOf, sessionFromReadyMade, type PartStyle } from './library';
import type { Nav } from './Page';

function where(data: Pick<PlanData, 'plan' | 'clock'>) {
  return { planWeek: data.plan?.weekNumber ?? 1, planDay: data.clock?.dayIndex ?? 0 };
}

/** Starts a ready-made plan now and opens its stage. Returns false when it cannot be built. */
export function startReadyMadePlan(nav: Nav, planId: string, data: Pick<PlanData, 'plan' | 'clock' | 'profile'>): boolean {
  const content = loadContent();
  const plan = content.plan(planId);
  if (!plan) return false;
  if (plan.kind === 'micro') {
    nav.navigate('Desk');
    return true;
  }
  const session = sessionFromReadyMade(plan, content, restrictionsOf(data.profile), getSessionDeps().newId());
  if (!session) return false;
  nav.navigate(startSession(session, where(data)));
  return true;
}

/**
 * Tile or row tap. Yoga and dance start straight away, the desk reset opens its own screen,
 * and the rest open the plan to look at first.
 */
export function openReadyMade(nav: Nav, planId: string, data: Pick<PlanData, 'plan' | 'clock' | 'profile'>): void {
  const plan = loadContent().plan(planId);
  if (!plan) {
    nav.navigate('Plan', { readyMadeId: planId });
    return;
  }
  if (plan.kind === 'micro') nav.navigate('Desk');
  else if (plan.style !== 'normal') {
    if (!startReadyMadePlan(nav, planId, data)) nav.navigate('Plan', { readyMadeId: planId });
  } else nav.navigate('Plan', { readyMadeId: planId });
}

/** "Start a 15-minute session" on a body part. Returns false when the engine cannot fill it for this user. */
export function startPartSession(nav: Nav, part: string, style: PartStyle, data: Pick<PlanData, 'plan' | 'clock' | 'profile'>): boolean {
  let session;
  try {
    session = buildPartSession({
      part,
      style,
      profile: data.profile,
      experience: data.plan?.experience,
      id: getSessionDeps().newId(),
      seed: Math.floor(getSessionDeps().clock.wall() % 100000),
    });
  } catch {
    return false;
  }
  if (!session) return false;
  nav.navigate(startSession(session, where(data)));
  return true;
}
