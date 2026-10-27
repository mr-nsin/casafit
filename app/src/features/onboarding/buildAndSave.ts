// Builds week one on the phone (D3) and saves it. Never waits for the network.

import type { OnboardingDraft, PlanDayRow } from '../../db/repositories';
import { buildPlan, EngineError, toServerPlan, type Plan, type PlanInput } from '../../engine';
import { getRepositories } from '../../state/storage';
import { useOnboarding } from '../../state/onboardingDraft';
import { getOnboardingDeps, todayKey } from './deps';
import { useVerifyOutcome } from './flowState';

export function draftToPlanInput(d: OnboardingDraft, startDate: string, thisYear: number, seed: number): PlanInput {
  return {
    goal: d.goal === 'gentler' ? 'stay_fit' : (d.goal ?? 'stay_fit'),
    bodyParts: d.goal === 'body_part' ? (d.bodyParts as PlanInput['bodyParts']) : [],
    styles: d.styles.length ? d.styles : ['normal'],
    mix: d.styles.length === 3 ? d.mix : undefined,
    daysPerWeek: d.daysPerWeek,
    experience: d.experience,
    painAreas: d.painAreas,
    healthFlags: d.healthFlags,
    startDate,
    seed,
    age: d.birthYear ? thisYear - d.birthYear : null,
  };
}

function dayRow(week: number, day: Plan['days'][number]): PlanDayRow {
  const kind: PlanDayRow['kind'] =
    day.kind === 'training' ? 'workout' : day.restSuggestion === 'walk' ? 'walk' : day.restSuggestion === 'stretch' ? 'stretch' : 'rest';
  return {
    planWeek: week,
    dayIndex: day.dayIndex,
    kind,
    style: day.style,
    title: day.title,
    sessionJson: day.session ? JSON.stringify(day.session) : null,
    overridden: false,
    status: day.dayIndex === 0 ? 'today' : 'upcoming',
  };
}

/** Runs once Building starts. Resolves with the plan; the draft is cleared only after the save. */
export async function buildAndSavePlan(draft: OnboardingDraft): Promise<Plan> {
  const deps = getOnboardingDeps();
  const now = deps.now();
  let input = draftToPlanInput(draft, todayKey(now), new Date(now).getFullYear(), deps.seed());
  let plan: Plan;
  let fellBack = false;
  try {
    plan = buildPlan(input, deps.catalogue());
  } catch (e) {
    // The bundled catalogue is small. If the chosen styles cannot fill a week, start with Normal
    // sessions rather than leave the user stuck; WeekOne says so.
    if (!(e instanceof EngineError) || (input.styles.length === 1 && input.styles[0] === 'normal')) throw e;
    input = { ...input, styles: ['normal'], mix: undefined };
    plan = buildPlan(input, deps.catalogue());
    fellBack = true;
  }
  const repos = getRepositories();

  await repos.plan.save({
    goal: plan.variant === 'gentler' ? 'gentler' : (draft.goal ?? 'stay_fit'),
    bodyParts: input.bodyParts.slice(),
    styles: input.styles.slice(),
    mix: input.mix ?? {},
    daysPerWeek: draft.daysPerWeek,
    experience: draft.experience ?? 'new',
    variant: plan.variant,
    weekNumber: plan.weekNumber,
    engineVersion: plan.engineVersion,
  });
  await repos.plan.replaceDays(plan.weekNumber, plan.days.map((d) => dayRow(plan.weekNumber, d)));
  await repos.profile.save({
    birthYear: draft.birthYear,
    confirmed18: draft.confirmed18,
    heightCm: draft.heightCm,
    weightKg: draft.weightKg,
    sex: draft.sex,
    painAreas: draft.painAreas as never,
    healthFlags: draft.healthFlags,
    onboarded: true,
  });
  useVerifyOutcome.getState().set({ plan, fellBackToNormal: fellBack });
  await useOnboarding.getState().finish();

  // D3: only goal, styles, days, experience and variant. Queued or sent by the shell; never awaited.
  const body = toServerPlan(input, plan);
  void deps.syncPlan(body).catch(() => undefined);
  return plan;
}
