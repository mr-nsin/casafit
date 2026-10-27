// Public surface of the learn lane. Names are keys of RootStackParamList.

import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { ConceptsScreen, LearnScreen, MythScreen } from './LearnScreens';

export { LearnScreen, MythScreen, ConceptsScreen };

export type LearnRouteName = 'Learn' | 'Myth' | 'Concepts';

export interface LearnRouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

export const learnRoutes: Record<LearnRouteName, LearnRouteEntry> = {
  Learn: { component: LearnScreen, options: { headerShown: false } },
  Myth: { component: MythScreen, options: { headerShown: false } },
  Concepts: { component: ConceptsScreen, options: { headerShown: false } },
};

export { configureLearnContent } from './LearnScreens';
export { reviewInfo, ctaTarget, longDate } from './model';
