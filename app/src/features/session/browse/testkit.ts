// Test helpers for the browse screens: a plan seeded into a throwaway database.

import type { PlanDayRow } from '../../../db/repositories';
import type { createTestDb } from '../../../db/testing/nodeSqliteDriver';
import { buildPlan } from '../../../engine';
import { getOnboardingDeps } from '../../onboarding/deps';
import { configureSessionDeps } from '../deps';
import { localDate } from './model';

export const DAY_MS = 86_400_000;
export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Day 0 is a workout, days 2 and 6 are walks, day 4 is a stretch (4 sessions). */
export async function seedPlan(
  db: TestDb,
  opts: { dayOffset?: number; name?: string | null; painAreas?: string[]; plan?: boolean; experience?: 'new' | 'on_and_off' | 'regular' } = {},
): Promise<string> {
  const { dayOffset = 0, name = 'Priya', painAreas = ['knees'], plan = true, experience = 'on_and_off' } = opts;
  const repos = db.repos;
  if (plan) {
    const start = localDate(Date.now());
    const p = buildPlan(
      { goal: 'stay_fit', bodyParts: [], styles: ['normal'], daysPerWeek: 4, experience, painAreas: painAreas as never, healthFlags: [], startDate: start, seed: 1 },
      getOnboardingDeps().catalogue(),
    );
    await repos.plan.save({ goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience, variant: 'standard', weekNumber: 1, engineVersion: p.engineVersion });
    const rows: PlanDayRow[] = p.days.map((d) => ({
      planWeek: 1,
      dayIndex: d.dayIndex,
      kind: d.kind === 'training' ? 'workout' : d.restSuggestion === 'stretch' ? 'stretch' : 'walk',
      style: d.style,
      title: d.title,
      sessionJson: d.session ? JSON.stringify(d.session) : null,
      overridden: false,
      status: 'upcoming',
    }));
    await repos.plan.replaceDays(1, rows);
  }
  await repos.profile.save({ name, painAreas: painAreas as never, onboarded: true });
  configureSessionDeps({ clock: { now: () => 1000, wall: () => Date.now() + dayOffset * DAY_MS } });
  return localDate(Date.now() + dayOffset * DAY_MS);
}
