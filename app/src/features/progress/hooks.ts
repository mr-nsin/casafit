import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

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

type Loaded<V> = { loading: boolean; error: boolean; view: V | null; retry: () => void };

/** Loads from the phone's database. A failed read shows a retry, never a blank screen. Reloads on focus. */
function useLoaded<V>(back: number, build: (d: Awaited<ReturnType<typeof load>>) => V): Loaded<V> {
  const nav = useNavigation();
  const [view, setView] = useState<V | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const retry = useCallback(() => {
    setError(false);
    setTick((n) => n + 1);
  }, []);
  useEffect(() => {
    let alive = true;
    load(back)
      .then((d) => {
        if (alive) setView(build(d));
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [back, tick]);
  useEffect(() => {
    // Coming back to the tab after a session or a walk: read again so the numbers are current.
    const off = (nav as { addListener?: (e: string, cb: () => void) => () => void }).addListener?.('focus', () => setTick((n) => n + 1));
    return off;
  }, [nav]);
  return { loading: view === null && !error, error, view, retry };
}

export function useProgress(): Loaded<ProgressView> {
  return useLoaded(28, computeProgress);
}

export function useRecap(): Loaded<RecapView> {
  return useLoaded(14, computeRecap);
}
