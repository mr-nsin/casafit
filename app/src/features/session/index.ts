// Public surface of the session lane (Player family). Other lanes import only from here.

import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { DanceScreen, PlayerScreen, YogaScreen } from './screens/Stages';
import { RestScreen } from './screens/RestScreen';
import { PausedScreen } from './screens/PausedScreen';
import { EndSessionScreen, FeelScreen, SessionSettingsScreen } from './screens/Overlays';
import { CompleteScreen } from './screens/CompleteScreen';
import { DeskScreen } from './screens/DeskScreen';
import { HomeRestScreen, HomeScreen } from './browse/HomeScreen';
import { PlanScreen, WeekPlanScreen, WhyScreen } from './browse/PlanScreens';
import type { SessionRouteName } from './hooks';
import { useSessionStore, type StartOptions } from './store';
import type { SessionPlan } from './types';

export { PlayerScreen, YogaScreen, DanceScreen };
export { HomeScreen, HomeRestScreen, WeekPlanScreen, WhyScreen, PlanScreen };
export { RestScreen, PausedScreen, EndSessionScreen, FeelScreen, SessionSettingsScreen, CompleteScreen, DeskScreen };

export interface SessionRouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

const stage: NativeStackNavigationOptions = { headerShown: false, gestureEnabled: false, animation: 'fade' };
const sheet: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
};

/**
 * Register each entry with `<Stack.Screen name={name} component={entry.component} options={entry.options} />`.
 * Names are keys of RootStackParamList. Yoga and Dance are the same store and stage with a
 * different layout; Player switches to them automatically from the plan style.
 */
export type BrowseRouteName = 'HomeRest' | 'WeekPlan' | 'Why' | 'Plan';

const page: NativeStackNavigationOptions = { headerShown: false };

export const sessionRoutes: Record<SessionRouteName | BrowseRouteName, SessionRouteEntry> = {
  HomeRest: { component: HomeRestScreen, options: page },
  WeekPlan: { component: WeekPlanScreen, options: page },
  Why: { component: WhyScreen, options: page },
  Plan: { component: PlanScreen, options: page },
  Player: { component: PlayerScreen, options: stage },
  Yoga: { component: YogaScreen, options: stage },
  Dance: { component: DanceScreen, options: stage },
  Rest: { component: RestScreen, options: stage },
  Paused: { component: PausedScreen, options: stage },
  Complete: { component: CompleteScreen, options: { headerShown: false, gestureEnabled: false } },
  Desk: { component: DeskScreen, options: { headerShown: false } },
  EndSession: { component: EndSessionScreen, options: sheet },
  Feel: { component: FeelScreen, options: sheet },
  SessionSettings: { component: SessionSettingsScreen, options: sheet },
};

export type { SessionRouteName } from './hooks';
export { stageRouteFor, routeForView } from './hooks';
export { configureSessionDeps, getSessionDeps } from './deps';
export { useSessionStore, createSessionStore, RESUME_WINDOW_MS } from './store';
export type { SessionState, SessionStore, StartOptions } from './store';
export { deriveView, formatClock } from './view';
export type { SessionView } from './view';
export type * from './types';

/** Start a session from the plan. The caller then navigates to `stageRouteFor(plan.style)`. */
export function startSession(plan: SessionPlan, opts?: StartOptions) {
  useSessionStore.getState().start(plan, opts);
  return plan.style === 'yoga' ? ('Yoga' as const) : plan.style === 'dance' ? ('Dance' as const) : ('Player' as const);
}

/** For Home's Resume card (D13): loads a saved session if one is inside its 24 h window. */
export async function loadResumableSession(): Promise<{ title: string; minutesDone: number } | null> {
  const store = useSessionStore.getState();
  await store.expireStale();
  const ok = await store.restoreFromSnapshot();
  if (!ok) return null;
  const s = useSessionStore.getState();
  return { title: s.plan?.title ?? '', minutesDone: Math.floor(s.activeMs / 60000) };
}
