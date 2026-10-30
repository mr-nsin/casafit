// Which lane builds which route. Drives PlaceholderScreen and the registration
// test. Every key of RootStackParamList and TabParamList must appear exactly once.

import type { RootRouteName, TabRouteName } from './types';

export type Lane =
  | 'shell'
  | 'onboarding'
  | 'session'
  | 'formcheck-pro'
  | 'nutrition'
  | 'steps-progress'
  | 'settings';

export const rootRouteLanes: Record<Exclude<RootRouteName, 'Main'>, Lane> = {
  Splash: 'onboarding',
  Welcome: 'onboarding',
  Age: 'onboarding',
  Verify: 'onboarding',
  Offline: 'onboarding',
  WelcomeBack: 'onboarding',
  Goals: 'onboarding',
  About: 'onboarding',
  Mix: 'onboarding',
  Health: 'onboarding',
  Building: 'onboarding',
  WeekOne: 'onboarding',

  HomeRest: 'session',
  WeekPlan: 'session',
  Why: 'session',
  Library: 'session',
  BodyPart: 'session',
  Plan: 'session',
  Player: 'session',
  Rest: 'session',
  Paused: 'session',
  EndSession: 'session',
  Editor: 'session',
  Picker: 'session',
  Parts: 'session',
  Lunge: 'session',
  Complete: 'session',
  Yoga: 'session',
  Dance: 'session',
  Desk: 'session',
  Exercise: 'session',
  SessionSettings: 'session',
  Feel: 'session',
  CheckIn: 'session',

  CameraPermission: 'formcheck-pro',
  FormCheck: 'formcheck-pro',
  LiveCheck: 'formcheck-pro',
  FormResult: 'formcheck-pro',
  CameraDenied: 'formcheck-pro',
  NoCredits: 'formcheck-pro',
  Paywall: 'formcheck-pro',
  ManagePro: 'formcheck-pro',
  ProWelcome: 'formcheck-pro',

  NutriProfile: 'nutrition',
  NutriPlan: 'nutrition',
  FoodSearch: 'nutrition',
  Meal: 'nutrition',
  FoodEmpty: 'nutrition',

  Steps: 'steps-progress',
  StepsPermission: 'steps-progress',
  Reverse: 'steps-progress',
  ReverseTimer: 'steps-progress',
  ProgressEmpty: 'steps-progress',
  Recap: 'steps-progress',
  Learn: 'steps-progress',
  Myth: 'steps-progress',
  Concepts: 'steps-progress',

  Settings: 'settings',
  Notify: 'settings',
  Language: 'settings',
  Privacy: 'settings',
  Profile: 'settings',
  EditProfile: 'settings',
  Help: 'settings',
  DeleteAccount: 'settings',
};

export const tabRouteLanes: Record<TabRouteName, Lane> = {
  Workout: 'session',
  Nutrition: 'nutrition',
  Progress: 'steps-progress',
};

export const tabLabels: Record<TabRouteName, string> = {
  Workout: 'Workout',
  Nutrition: 'Nutrition',
  Progress: 'Progress',
};

/** MaterialIcons glyph names (stopgap; W0-ui replaces the tab bar with Material Symbols Rounded). */
export const tabIcons: Record<TabRouteName, 'self-improvement' | 'restaurant' | 'bar-chart'> = {
  Workout: 'self-improvement',
  Nutrition: 'restaurant',
  Progress: 'bar-chart',
};

/**
 * Routes that have a real screen registered in RootNavigator (stack routes only; the Progress
 * and Nutrition tab roots are registered in TabNavigator). Everything else renders PlaceholderScreen.
 */
export const implementedRootRoutes = [
  // onboarding
  'Splash', 'Welcome', 'Age', 'Verify', 'Offline', 'WelcomeBack', 'Goals', 'About', 'Mix',
  'Health', 'Building', 'WeekOne',
  // session
  'HomeRest', 'WeekPlan', 'Why', 'Library', 'BodyPart', 'Plan', 'Editor', 'Picker', 'Parts', 'Lunge', 'Exercise', 'CheckIn',
  'Player', 'Yoga', 'Dance', 'Rest', 'Paused', 'Complete', 'Desk', 'EndSession', 'Feel',
  'SessionSettings',
  // nutrition
  'NutriProfile', 'NutriPlan', 'FoodSearch', 'Meal', 'FoodEmpty',
  // steps, learn, progress
  'Steps', 'StepsPermission', 'Reverse', 'ReverseTimer', 'Learn', 'Myth', 'Concepts',
  'ProgressEmpty', 'Recap',
  // settings
  'Settings', 'Notify', 'Language', 'Privacy', 'Profile', 'EditProfile', 'Help', 'DeleteAccount',
] as const satisfies readonly Exclude<RootRouteName, 'Main'>[];
