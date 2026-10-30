// Public surface of the settings lane. Register each entry with
// <Stack.Screen name={name} component={entry.component} options={entry.options} />.

import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { DeleteAccountScreen } from './DeleteAccountScreen';
import { EditProfileScreen } from './EditProfileScreen';
import { HelpScreen } from './HelpScreen';
import { LanguageScreen } from './LanguageScreen';
import { NotifyScreen } from './NotifyScreen';
import { PrivacyScreen } from './PrivacyScreen';
import { ProfileScreen } from './ProfileScreen';
import { SettingsScreen } from './SettingsScreen';

export { SettingsScreen, NotifyScreen, LanguageScreen, PrivacyScreen, ProfileScreen, EditProfileScreen, HelpScreen, DeleteAccountScreen };

export type SettingsRouteName = 'Settings' | 'Notify' | 'Language' | 'Privacy' | 'Profile' | 'EditProfile' | 'Help' | 'DeleteAccount';

export interface SettingsRouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

const page: NativeStackNavigationOptions = { headerShown: false };

export const settingsRoutes: Record<SettingsRouteName, SettingsRouteEntry> = {
  Settings: { component: SettingsScreen, options: page },
  Notify: { component: NotifyScreen, options: page },
  Language: { component: LanguageScreen, options: page },
  Privacy: { component: PrivacyScreen, options: page },
  Profile: { component: ProfileScreen, options: page },
  EditProfile: { component: EditProfileScreen, options: page },
  Help: { component: HelpScreen, options: page },
  // A dialog over the screen it was opened from.
  DeleteAccount: {
    component: DeleteAccountScreen,
    options: { headerShown: false, presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } },
  },
};

export { configureSettingsDeps, getSettingsDeps } from './deps';
export type { SettingsDeps } from './deps';
export { applyReminders } from './reminders';
export { exportMyData, deleteMyAccount, wipeLocalData } from './account';
