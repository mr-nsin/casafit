// Public surface of the steps lane. Register with
// <Stack.Screen name={name} component={entry.component} options={entry.options} />.

import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { StepsScreen } from './StepsScreen';
import { StepsPermissionScreen } from './StepsPermissionScreen';
import { ReverseScreen, ReverseTimerScreen } from './ReverseScreens';

export { StepsScreen, StepsPermissionScreen, ReverseScreen, ReverseTimerScreen };

export type StepsRouteName = 'Steps' | 'StepsPermission' | 'Reverse' | 'ReverseTimer';

export interface StepsRouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

export const stepsRoutes: Record<StepsRouteName, StepsRouteEntry> = {
  Steps: { component: StepsScreen, options: { headerShown: false } },
  StepsPermission: { component: StepsPermissionScreen, options: { headerShown: false, presentation: 'modal' } },
  Reverse: { component: ReverseScreen, options: { headerShown: false } },
  // A running bout must not be swiped away by accident.
  ReverseTimer: { component: ReverseTimerScreen, options: { headerShown: false, gestureEnabled: false } },
};

export { useBout, configureBoutDeps } from './reverseStore';
export type { BoutState, BoutDeps } from './reverseStore';
export { useStepsData } from './hooks';
export type { StepsData } from './hooks';
export { formatCount, buildWeek, goalFor, usedSeconds, reverseHidden } from './model';
