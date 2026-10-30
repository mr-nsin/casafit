// Local data for the settings screens. Everything reads the phone's database; nothing here
// needs the network.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';

import type { PlanRow, Profile } from '../../db/repositories';
import { computeProgress } from '../progress';
import { deviceTzOffsetMin, todayKey } from '../../services/step-counter';
import { getRepositories, hasRepositories } from '../../state/storage';
import { exportMyData, failureMessage } from './account';

export interface ProfileData {
  loading: boolean;
  profile: Profile | null;
  plan: PlanRow | null;
  /** Title of the first workout day: the preview line for reminders. */
  workoutTitle: string | null;
  reload(): Promise<void>;
  save(patch: Partial<Omit<Profile, 'updatedAt'>>): Promise<Profile | null>;
}

/** Profile and plan, re-read whenever the screen gains focus so edits show up on return. */
export function useProfileData(): ProfileData {
  const [state, setState] = useState<Pick<ProfileData, 'loading' | 'profile' | 'plan' | 'workoutTitle'>>({
    loading: true,
    profile: null,
    plan: null,
    workoutTitle: null,
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
    try {
      const repos = getRepositories();
      const [profile, plan] = await Promise.all([repos.profile.get(), repos.plan.get()]);
      const days = plan ? await repos.plan.days(plan.weekNumber) : [];
      const workout = days.find((d) => d.kind === 'workout');
      if (alive.current) setState({ loading: false, profile, plan, workoutTitle: workout?.title ?? null });
    } catch {
      if (alive.current) setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const save = useCallback(async (patch: Partial<Omit<Profile, 'updatedAt'>>) => {
    if (!hasRepositories()) return null;
    const next = await getRepositories().profile.save(patch);
    if (alive.current) setState((s) => ({ ...s, profile: next }));
    return next;
  }, []);

  return { ...state, reload, save };
}

export interface ProfileStats {
  streak: number;
  sessions: number;
  minutes: number;
}

/** Streak, finished sessions and active minutes, derived from the session log. */
export function useProfileStats(): ProfileStats | null {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!hasRepositories()) return undefined;
      let live = true;
      const repos = getRepositories();
      const now = Date.now();
      const tz = deviceTzOffsetMin(now);
      void Promise.all([repos.sessionLog.list(), repos.plan.get()])
        .then(async ([logs, plan]) => {
          const currentWeekDays = plan ? await repos.plan.days(plan.weekNumber) : [];
          const view = computeProgress({ today: todayKey(now, tz), tz, logs, microActiveS: 0, steps: [], plan, currentWeekDays });
          const done = logs.filter((l) => l.status === 'complete');
          if (live) setStats({ streak: view.streak, sessions: done.length, minutes: Math.round(done.reduce((a, l) => a + l.durationS, 0) / 60) });
        })
        .catch(() => live && setStats({ streak: 0, sessions: 0, minutes: 0 }));
      return () => {
        live = false;
      };
    }, []),
  );
  return stats;
}

/** Wraps an async action with a busy flag that never updates an unmounted screen. */
export function useBusy(): [boolean, <T>(fn: () => Promise<T>) => Promise<T>] {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      if (alive.current) setBusy(false);
    }
  }, []);
  return [busy, run];
}

export interface ExportState {
  busy: boolean;
  message: string | null;
  /** True once the share sheet was opened. */
  done: boolean;
  start(): Promise<void>;
}

/** Download my data: server copy plus local data to the share sheet. Offline shows a kind message. */
export function useDataExport(): ExportState {
  const [busy, run] = useBusy();
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const start = useCallback(async () => {
    setMessage(null);
    setDone(false);
    const r = await run(exportMyData);
    if (r.ok) setDone(true);
    else setMessage(failureMessage('export', r.reason));
  }, [run]);
  return { busy, message, done, start };
}

export const appVersion = (): string => (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';
