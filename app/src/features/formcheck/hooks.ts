import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { evaluateFraming, type FormExercise, type PoseSource } from '../../services/pose';
import { getFormCheckDeps } from './deps';
import { useEntitlements } from './entitlements';

export type Nav = NativeStackNavigationProp<RootStackParamList>;
export const useFormNav = () => useNavigation<Nav>();

/** Goes back, or home after a stack reset. */
export function useBackOrHome() {
  const nav = useFormNav();
  return useCallback(() => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Main');
  }, [nav]);
}

/** Back to the workout the person came from, or home. */
export function usePlayerOrHome() {
  const nav = useFormNav();
  return useCallback(() => {
    if (typeof nav.popTo === 'function') nav.popTo('Player');
    else nav.navigate('Main');
  }, [nav]);
}

/** Reads the cached balance and Pro state, then refreshes them when the network allows. */
export function useEntitlementsLoaded() {
  useEffect(() => {
    let live = true;
    void (async () => {
      const s = useEntitlements.getState();
      if (!s.hydrated) await s.hydrate();
      if (live) await useEntitlements.getState().refresh();
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return useEntitlements();
}

export interface FramingView {
  running: boolean;
  /** Null until the first frame. */
  body: { ok: boolean; hint?: 'closer' | 'back' } | null;
  lightOk: boolean | null;
  toggle(): void;
}

/**
 * The free framing preview: runs the pose source and reports framing only. It creates no
 * attempt, spends nothing and uses no network. It stops on toggle, on unmount and on a new exercise.
 */
export function useFramingPreview(exercise: FormExercise, available: boolean): FramingView {
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<Pick<FramingView, 'body' | 'lightOk'>>({ body: null, lightOk: null });
  const source = useRef<PoseSource | null>(null);

  const stop = useCallback(() => {
    source.current?.stop();
    source.current = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop, exercise]);

  const toggle = useCallback(() => {
    if (source.current) return stop();
    if (!available) return;
    const s = getFormCheckDeps().poseSource(exercise);
    if (!s.available) return;
    source.current = s;
    setRunning(true);
    s.start((frame) => {
      const f = evaluateFraming(frame, exercise);
      const light = f.confidence >= 0.6;
      setView((prev) =>
        prev.body?.ok === f.ok && prev.body?.hint === f.hint && prev.lightOk === light ? prev : { body: { ok: f.ok, hint: f.hint }, lightOk: light },
      );
    });
  }, [available, exercise, stop]);

  return { running, ...view, toggle };
}
