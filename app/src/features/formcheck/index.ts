// Public surface of the form-check and Pro lane. Register each entry with
// <Stack.Screen name={name} component={entry.component} options={entry.options} />.

import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { CameraDeniedScreen, CameraPermissionScreen, FormCheckScreen, FormResultScreen, LiveCheckScreen, NoCreditsScreen } from './CheckScreens';
import { ManageProScreen, PaywallScreen, ProWelcomeScreen } from './ProScreens';

export { CameraPermissionScreen, FormCheckScreen, LiveCheckScreen, FormResultScreen, CameraDeniedScreen, NoCreditsScreen, PaywallScreen, ManageProScreen, ProWelcomeScreen };

export type FormCheckRouteName =
  | 'CameraPermission'
  | 'FormCheck'
  | 'LiveCheck'
  | 'FormResult'
  | 'CameraDenied'
  | 'NoCredits'
  | 'Paywall'
  | 'ManagePro'
  | 'ProWelcome';

export interface FormCheckRouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

const page: NativeStackNavigationOptions = { headerShown: false };

export const formCheckRoutes: Record<FormCheckRouteName, FormCheckRouteEntry> = {
  CameraPermission: { component: CameraPermissionScreen, options: page },
  FormCheck: { component: FormCheckScreen, options: page },
  // No swipe-back mid-check: leaving goes through the close button, which decides cancel or result.
  LiveCheck: { component: LiveCheckScreen, options: { headerShown: false, gestureEnabled: false } },
  FormResult: { component: FormResultScreen, options: { headerShown: false, gestureEnabled: false } },
  CameraDenied: { component: CameraDeniedScreen, options: page },
  NoCredits: { component: NoCreditsScreen, options: page },
  Paywall: { component: PaywallScreen, options: page },
  ManagePro: { component: ManageProScreen, options: page },
  ProWelcome: { component: ProWelcomeScreen, options: { headerShown: false, gestureEnabled: false } },
};

export { configureFormCheckDeps, getFormCheckDeps } from './deps';
export type { FormCheckDeps } from './deps';
export { resolveFormCheckEntry, resolveCredits } from './gate';
export type { FormCheckEntry } from './gate';
export { useFormCheck } from './controller';
export { useEntitlements } from './entitlements';
