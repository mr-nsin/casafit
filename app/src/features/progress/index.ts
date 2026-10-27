// Public surface of the progress lane. `Progress` is the tab root (register it in the tab
// navigator); ProgressEmpty and Recap are stack routes.

import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { ProgressEmptyScreen, ProgressScreen, RecapScreen } from './ProgressScreens';

export { ProgressScreen, ProgressEmptyScreen, RecapScreen };

export type ProgressRouteName = 'Progress' | 'ProgressEmpty' | 'Recap';

export interface ProgressRouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

export const progressRoutes: Record<ProgressRouteName, ProgressRouteEntry> = {
  Progress: { component: ProgressScreen, options: { headerShown: false } },
  ProgressEmpty: { component: ProgressEmptyScreen, options: { headerShown: false } },
  Recap: { component: RecapScreen, options: { headerShown: false } },
};

export { computeProgress, computeRecap, recapWeekStart, plannedDays } from './model';
export type { ProgressView, RecapView } from './model';
