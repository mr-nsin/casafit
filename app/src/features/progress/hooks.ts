import { useEffect, useState } from 'react';

import { addDays } from '../../engine';
import { getRepositories } from '../../state/storage';
import { deviceTzOffsetMin, todayKey } from '../../services/step-counter';
import { computeProgress, computeRecap, planStartKey, type ProgressView, type RecapView } from './model';

async function load(back: number) {
  const repos = getRepositories();
  const now = Date.now();
  const tz = deviceTzOffsetMin(now);
  const today = todayKey(now, tz);
  const sinceMs = now - back * 86_400_000;
  const [logs, microActiveS, steps, plan] = await Promise.all([
    repos.sessionLog.list(),
    repos.micro.totalActiveS(sinceMs),
    repos.steps.range(addDays(today, -back), today),
    repos.plan.get(),
  ]);
  const currentWeekDays = plan ? await repos.plan.days(plan.weekNumber) : [];
  return { today, tz, logs, microActiveS, steps, plan, currentWeekDays, planStart: planStartKey(plan, tz) };
}

export function useProgress(): { loading: boolean; view: ProgressView | null } {
  const [view, setView] = useState<ProgressView | null>(null);
  useEffect(() => {
    let alive = true;
    void load(28).then((d) => alive && setView(computeProgress(d)));
    return () => {
      alive = false;
    };
  }, []);
  return { loading: view === null, view };
}

export function useRecap(): { loading: boolean; view: RecapView | null } {
  const [view, setView] = useState<RecapView | null>(null);
  useEffect(() => {
    let alive = true;
    void load(14).then((d) => alive && setView(computeRecap(d)));
    return () => {
      alive = false;
    };
  }, []);
  return { loading: view === null, view };
}

