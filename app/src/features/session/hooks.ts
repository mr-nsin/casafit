// Hooks shared by the Player family: the 4 Hz ticker, automatic routing between the
// screens as the clock moves, and automatic pause on interruptions.

import { useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { getSessionDeps } from './deps';
import { useSessionStore, type SessionStatus } from './store';
import { TRIAL_DONE, TRIAL_STOPPED, useTrialNotice } from './trial';
import { deriveView, type SessionView } from './view';

export type SessionRouteName =
  | 'Player'
  | 'Rest'
  | 'Paused'
  | 'EndSession'
  | 'Feel'
  | 'SessionSettings'
  | 'Yoga'
  | 'Dance'
  | 'Desk'
  | 'Complete';

export const TICK_MS = 250;
/** Pause the session when the app goes to the background (call, app switch). */
export const PAUSE_ON_BACKGROUND = true;

export function stageRouteFor(style: SessionView['style']): 'Player' | 'Yoga' | 'Dance' {
  return style === 'yoga' ? 'Yoga' : style === 'dance' ? 'Dance' : 'Player';
}

/**
 * Which base screen should be showing. null = no automatic move (idle, or an overlay is up).
 * Yoga and dance have no separate rest screen: they stay on their stage.
 */
export function routeForView(v: Pick<SessionView, 'status' | 'kind' | 'style'>): SessionRouteName | 'Main' | null {
  switch (v.status) {
    case 'paused':
      return 'Paused';
    case 'complete':
      return 'Complete';
    case 'ended':
      return 'Main';
    case 'active':
      if (v.style === 'normal' && v.kind === 'rest') return 'Rest';
      return stageRouteFor(v.style);
    default:
      return null;
  }
}

/** Ticks while active and returns the derived view. Safe to mount on more than one screen. */
export function useSessionView(intervalMs: number = TICK_MS): SessionView {
  const state = useSessionStore();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const active = state.status === 'active';
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      useSessionStore.getState().tick();
      bump();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return deriveView(state, getSessionDeps().clock.now());
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Replace this screen with the right one when the clock or the user changes the state. */
export function useSessionRouting(current: SessionRouteName): void {
  const nav = useNavigation<Nav>();
  const status = useSessionStore((s) => s.status);
  const kind = useSessionStore((s) => {
    // Cheap read: only the fields routeForView needs.
    return s.status === 'active' ? deriveView(s, getSessionDeps().clock.now()).kind : null;
  });
  const style = useSessionStore((s) => s.plan?.style ?? 'normal');
  const trial = useSessionStore((s) => s.trial);
  const target = routeForView({ status, kind, style });
  useEffect(() => {
    // A 30-second trial never goes to Complete or Home: it goes back to the Exercise screen it came from.
    if (trial && (status === 'complete' || status === 'ended')) {
      useTrialNotice.getState().set(status === 'complete' ? TRIAL_DONE : TRIAL_STOPPED);
      useSessionStore.getState().reset();
      if (nav.canGoBack()) nav.goBack();
      else nav.reset({ index: 0, routes: [{ name: 'Main' }] });
      return;
    }
    if (!target || target === current) return;
    if (target === 'Main') {
      nav.reset({ index: 0, routes: [{ name: 'Main' }] });
      return;
    }
    nav.replace(target);
  }, [target, current, nav, trial, status]);
}

/** Pause on background or other interruptions. */
export function useSessionInterruptions(): void {
  const last = useRef<string | null | undefined>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const was = last.current;
      last.current = next;
      if (PAUSE_ON_BACKGROUND && next === 'background' && was !== 'background') {
        useSessionStore.getState().pause('background');
      }
    });
    return () => sub.remove();
  }, []);
}

/** Everything a base screen needs: view, ticking, routing, interruptions. */
export function useSessionScreen(current: SessionRouteName): SessionView {
  useSessionRouting(current);
  useSessionInterruptions();
  return useSessionView();
}

export function isLive(status: SessionStatus): boolean {
  return status === 'active' || status === 'paused';
}
