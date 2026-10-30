// Data for the browse screens. Everything is read from the local database (offline first);
// nothing here talks to the network.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { FoodEntry, PlanDayRow, PlanRow, Profile, SessionLog, StepSummary } from '../../../db/repositories';
import { deviceTzOffsetMin } from '../../../services/step-counter';
import { getRepositories, hasRepositories } from '../../../state/storage';
import { getSessionDeps } from '../deps';
import { getOnboardingDeps } from '../../onboarding/deps';
import { useVerifyOutcome } from '../../onboarding/flowState';
import { planClock, skippedFor, type PlanClock, type SkippedMove } from './model';

export interface PlanData {
  loading: boolean;
  plan: PlanRow | null;
  rows: PlanDayRow[];
  logs: SessionLog[];
  profile: Profile | null;
  clock: PlanClock | null;
  tz: number;
  reload(): Promise<void>;
}

/** Plan, its days, finished sessions and the profile. Reloads whenever the screen comes into focus. */
export function usePlanData(): PlanData {
  const [state, setState] = useState<Omit<PlanData, 'reload'>>({
    loading: true,
    plan: null,
    rows: [],
    logs: [],
    profile: null,
    clock: null,
    tz: deviceTzOffsetMin(),
  });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!hasRepositories()) {
      if (alive.current) setState((s) => ({ ...s, loading: false }));
      return;
    }
    const repos = getRepositories();
    try {
      const [plan, profile, logs] = await Promise.all([
        repos.plan.get(),
        repos.profile.get(),
        repos.sessionLog.list({ status: 'complete' }),
      ]);
      const rows = plan ? await repos.plan.days(plan.weekNumber) : [];
      const now = getSessionDeps().clock.wall();
      if (alive.current) {
        setState({ loading: false, plan, rows, logs, profile, clock: plan ? planClock(plan.updatedAt, now) : null, tz: deviceTzOffsetMin(now) });
      }
    } catch {
      if (alive.current) setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { ...state, reload };
}

export interface TodayExtras {
  steps: StepSummary | null;
  food: { kcal: number; proteinG: number; entries: number } | null;
  proteinTargetG: number | null;
  kcalTarget: number | null;
}

/** Today's step summary and food totals, only when the data already exists. Nothing is estimated. */
export function useTodayExtras(today: string | null): TodayExtras {
  const [extras, setExtras] = useState<TodayExtras>({ steps: null, food: null, proteinTargetG: null, kcalTarget: null });
  useFocusEffect(
    useCallback(() => {
      if (!today || !hasRepositories()) return undefined;
      let live = true;
      const repos = getRepositories();
      void Promise.all([repos.steps.range(today, today), repos.food.forDay(today), repos.nutrition.getProfile()])
        .then(([steps, entries, np]) => {
          if (!live) return;
          const counted = (entries as FoodEntry[]).filter((e) => e.snapshot);
          setExtras({
            steps: steps[0] ?? null,
            food: counted.length
              ? {
                  kcal: counted.reduce((a, e) => a + e.snapshot!.kcal, 0),
                  proteinG: counted.reduce((a, e) => a + e.snapshot!.proteinG, 0),
                  entries: counted.length,
                }
              : null,
            proteinTargetG: np?.targetProteinG ?? null,
            kcalTarget: np?.targetKcal ?? null,
          });
        })
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, [today]),
  );
  return extras;
}

/** Moves left out for this user: the fresh plan's list when Building just ran, else recomputed from the saved answers. */
export function useSkipped(plan: PlanRow | null, profile: Profile | null): SkippedMove[] {
  const fresh = useVerifyOutcome((s) => s.plan);
  return useMemo(() => {
    if (!plan) return [];
    if (fresh && fresh.weekNumber === plan.weekNumber && fresh.skipped.length) return fresh.skipped.map((s) => ({ ...s }));
    try {
      return skippedFor(profile, plan, getOnboardingDeps().catalogue());
    } catch {
      return [];
    }
  }, [plan, profile, fresh]);
}
