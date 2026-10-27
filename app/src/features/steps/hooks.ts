import { useCallback, useEffect, useRef, useState } from 'react';

import type { Profile } from '../../db/repositories';
import { addDays } from '../../engine';
import { getRepositories } from '../../state/storage';
import {
  deviceTzOffsetMin,
  getStepCounter,
  recentDates,
  syncDays,
  todayKey,
  type StepPermissionState,
} from '../../services/step-counter';
import { buildWeek, goalFor, reverseEligibilityFor, usedSeconds, type WeekView } from './model';
import type { ReverseEligibility } from '../../engine';

export interface StepsData {
  loading: boolean;
  permission: StepPermissionState;
  today: string;
  steps: number;
  briskMinutes: number;
  goal: number;
  week: WeekView;
  profile: Profile | null;
  reverse: ReverseEligibility;
  /** True when the number on screen is the last one we read, not a live one. */
  stale: boolean;
  refresh(): Promise<void>;
}

const REFRESH_MS = 60_000;

/** Today's steps, the rolling week, the goal and the reverse-walk gate. Local only. */
export function useStepsData(): StepsData {
  const [state, setState] = useState<Omit<StepsData, 'refresh'>>(() => {
    const today = todayKey();
    return {
      loading: true,
      permission: 'unknown',
      today,
      steps: 0,
      briskMinutes: 0,
      goal: 7000,
      week: buildWeek(today, []),
      profile: null,
      reverse: { allowed: false, reason: 'health_flag' },
      stale: false,
    };
  });
  const [extra, setExtra] = useState(0);
  const live = useRef({ base: 0, latest: 0 });
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const counter = getStepCounter();
    const repos = getRepositories();
    const now = Date.now();
    const tz = deviceTzOffsetMin(now);
    const today = todayKey(now, tz);
    const permission = await counter.getPermissionState();
    if (permission === 'granted') {
      try {
        await syncDays(counter, repos.steps, recentDates(today, 2), { now, tzOffsetMin: tz });
      } catch {
        /* keep what is stored */
      }
    }
    const rows = await repos.steps.range(addDays(today, -6), today);
    const profile = await repos.profile.get();
    const bouts = await repos.steps.boutsSince(Date.now() - 2 * 86_400_000);
    const used = usedSeconds(bouts, today, now, tz);
    const row = rows.find((r) => r.onDate === today);
    live.current = { base: live.current.latest, latest: live.current.latest };
    setExtra(0);
    if (!alive.current) return;
    setState({
      loading: false,
      permission,
      today,
      steps: row?.steps ?? 0,
      briskMinutes: row?.briskMinutes ?? 0,
      goal: goalFor(today, rows, profile?.birthYear ?? null, new Date(now).getFullYear()),
      week: buildWeek(today, rows),
      profile,
      reverse: reverseEligibilityFor(profile, used, new Date(now).getFullYear()),
      stale: permission !== 'granted',
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    // Loads local data on mount; state is set after the awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  // Live ring: stored value plus the steps counted since the last read.
  useEffect(() => {
    if (state.permission !== 'granted') return undefined;
    const off = getStepCounter().subscribeLive((n) => {
      live.current.latest = n;
      setExtra(Math.max(0, n - live.current.base));
    });
    return off;
  }, [state.permission]);

  return { ...state, steps: state.steps + (state.permission === 'granted' ? extra : 0), refresh };
}
