// Typed route map for every route in docs/plans/implementation.md section 1.
// A lane that needs a param on its own route extends the entry here (the shell
// lane owns this file; ask for the change rather than casting).

import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** The three bottom tabs: Workout, Nutrition, Progress. */
export type TabParamList = {
  Workout: undefined;
  Nutrition: undefined;
  Progress: undefined;
};

export type RootStackParamList = {
  /** Holds the three tabs. Home lives in the Workout tab. */
  Main: NavigatorScreenParams<TabParamList> | undefined;

  // Onboarding lane
  Splash: undefined;
  Welcome: undefined;
  Age: undefined;
  Verify: { phone?: string; email?: string } | undefined;
  Offline: undefined;
  WelcomeBack: undefined;
  Goals: undefined;
  About: undefined;
  Mix: undefined;
  Health: undefined;
  Building: undefined;
  WeekOne: undefined;

  // Plan and session lane
  HomeRest: undefined;
  WeekPlan: undefined;
  Why: undefined;
  Library: undefined;
  BodyPart: { part: string };
  Plan: { planDayId?: string; readyMadeId?: string };
  Player: { sessionId?: string } | undefined;
  Rest: undefined;
  Paused: undefined;
  EndSession: undefined;
  /** `planDayId` is 'week-day' (default today). `addExerciseId` appends a move when the editor opens. */
  Editor: { planDayId?: string; addExerciseId?: string; from?: 'plan' } | undefined;
  /** With `stepId` the picked move replaces that step; without it the move is added. */
  Picker: { slot?: number; stepId?: string } | undefined;
  Parts: { part?: 'warmup' | 'work' | 'cooldown' } | undefined;
  Lunge: { excludedExerciseId?: string } | undefined;
  Complete: undefined;
  Yoga: undefined;
  Dance: undefined;
  Desk: undefined;
  Exercise: { exerciseId: string };
  SessionSettings: undefined;
  Feel: undefined;
  CheckIn: undefined;

  // Form check and Pro lane
  CameraPermission: undefined;
  FormCheck: undefined;
  LiveCheck: undefined;
  FormResult: undefined;
  CameraDenied: undefined;
  NoCredits: undefined;
  Paywall: undefined;
  ManagePro: undefined;
  ProWelcome: undefined;

  // Nutrition lane
  NutriProfile: undefined;
  NutriPlan: undefined;
  FoodSearch: { slot?: string } | undefined;
  Meal: { mealId?: string; slot?: string } | undefined;
  FoodEmpty: undefined;

  // Steps, progress, learn lane
  Steps: undefined;
  StepsPermission: undefined;
  Reverse: undefined;
  ReverseTimer: undefined;
  ProgressEmpty: undefined;
  Recap: undefined;
  Learn: undefined;
  Myth: { mythId?: string } | undefined;
  Concepts: { conceptId?: string } | undefined;

  // Settings and privacy lane
  Settings: undefined;
  Notify: undefined;
  Language: undefined;
  Privacy: undefined;
  Profile: undefined;
  EditProfile: undefined;
  /** `open` is a FAQ id to expand first (the privacy notice link uses 'privacy'). */
  Help: { open?: string } | undefined;
  DeleteAccount: undefined;
};

export type RootRouteName = keyof RootStackParamList;
export type TabRouteName = keyof TabParamList;

export type RootScreenProps<T extends RootRouteName> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends TabRouteName> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // React Navigation documents this global merge for typed navigate() and useNavigation().
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
