import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { learnRoutes } from '../features/learn';
import { nutritionRoutes } from '../features/nutrition';
import { onboardingRoutes } from '../features/onboarding';
import { progressRoutes } from '../features/progress';
import { sessionRoutes } from '../features/session';
import { settingsRoutes } from '../features/settings';
import { stepsRoutes } from '../features/steps';
import { PlaceholderScreen } from './PlaceholderScreen';
import { implementedRootRoutes, rootRouteLanes } from './routes';
import { TabNavigator } from './TabNavigator';
import type { RootRouteName, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export interface RouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

/** Every lane's stack routes, merged. Progress is the tab root, so only its stack routes are here. */
const { Progress: _progressTab, ...progressStack } = progressRoutes;
export const laneRoutes: Partial<Record<Exclude<RootRouteName, 'Main'>, RouteEntry>> = {
  ...onboardingRoutes,
  ...sessionRoutes,
  ...nutritionRoutes,
  ...stepsRoutes,
  ...learnRoutes,
  ...progressStack,
  ...settingsRoutes,
};

const implemented: ReadonlySet<string> = new Set<string>(implementedRootRoutes);
export const placeholderRoutes = (
  Object.keys(rootRouteLanes) as Exclude<RootRouteName, 'Main'>[]
).filter((name) => !implemented.has(name));

export type InitialRoute = 'Splash' | 'Welcome' | 'Main';

/** Splash is the initial route: it resets to Welcome, Goals or Main once it has looked at the session and plan. */
export function RootNavigator({ initialRouteName = 'Splash' }: { initialRouteName?: InitialRoute }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      {(Object.keys(laneRoutes) as Exclude<RootRouteName, 'Main'>[]).map((name) => (
        <Stack.Screen
          key={name}
          name={name}
          component={laneRoutes[name]!.component}
          options={laneRoutes[name]!.options}
        />
      ))}
      {placeholderRoutes.map((name) => (
        <Stack.Screen key={name} name={name} component={PlaceholderScreen} />
      ))}
    </Stack.Navigator>
  );
}
