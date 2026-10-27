// Public surface of the onboarding lane. The shell registers each entry with
// <Stack.Screen name={name} component={entry.component} options={entry.options} />.

import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { AgeScreen, SplashScreen, WelcomeScreen } from './screens/Entry';
import { OfflineScreen, VerifyScreen, WelcomeBackScreen } from './screens/Verify';
import { AboutScreen, GoalsScreen, HealthScreen, MixScreen } from './screens/Plan';
import { BuildingScreen, WeekOneScreen } from './screens/Finish';

export { SplashScreen, WelcomeScreen, AgeScreen, VerifyScreen, OfflineScreen, WelcomeBackScreen };
export { GoalsScreen, AboutScreen, MixScreen, HealthScreen, BuildingScreen, WeekOneScreen };

export type OnboardingRouteName =
  | 'Splash' | 'Welcome' | 'Age' | 'Verify' | 'Offline' | 'WelcomeBack'
  | 'Goals' | 'About' | 'Mix' | 'Health' | 'Building' | 'WeekOne';

export interface OnboardingRouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

const plain: NativeStackNavigationOptions = { headerShown: false };
const locked: NativeStackNavigationOptions = { headerShown: false, gestureEnabled: false };

export const onboardingRoutes: Record<OnboardingRouteName, OnboardingRouteEntry> = {
  Splash: { component: SplashScreen, options: { ...locked, animation: 'fade' } },
  Welcome: { component: WelcomeScreen, options: plain },
  Age: { component: AgeScreen, options: plain },
  Verify: { component: VerifyScreen, options: plain },
  Offline: { component: OfflineScreen, options: plain },
  WelcomeBack: { component: WelcomeBackScreen, options: locked },
  Goals: { component: GoalsScreen, options: plain },
  About: { component: AboutScreen, options: plain },
  Mix: { component: MixScreen, options: plain },
  Health: { component: HealthScreen, options: plain },
  Building: { component: BuildingScreen, options: locked },
  WeekOne: { component: WeekOneScreen, options: locked },
};

export { configureOnboardingDeps, getOnboardingDeps } from './deps';
export type { OnboardingDeps, ServerPlanBody } from './deps';
export { contentToCatalogue } from './catalogue';
export { buildAndSavePlan } from './buildAndSave';
