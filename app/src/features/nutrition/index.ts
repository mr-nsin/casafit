// Public surface of the nutrition lane. The app shell registers `nutritionRoutes`
// and mounts NutritionScreen as the Nutrition tab. Other lanes do not import from here.

import type { ComponentType } from 'react';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { FoodEmptyScreen } from './screens/FoodEmptyScreen';
import { FoodSearchScreen } from './screens/FoodSearchScreen';
import { MealScreen } from './screens/MealScreen';
import { NutriPlanScreen } from './screens/NutriPlanScreen';
import { NutriProfileScreen } from './screens/NutriProfileScreen';
import { NutritionScreen } from './screens/NutritionScreen';

export { NutritionScreen, NutriProfileScreen, NutriPlanScreen, FoodSearchScreen, MealScreen, FoodEmptyScreen };

export type NutritionRouteName = 'NutriProfile' | 'NutriPlan' | 'FoodSearch' | 'Meal' | 'FoodEmpty';

export interface NutritionRouteEntry {
  component: ComponentType<any>;
  options: NativeStackNavigationOptions;
}

const plain: NativeStackNavigationOptions = { headerShown: false };

/** Register with `<Stack.Screen name={name} component={entry.component} options={entry.options} />`. */
export const nutritionRoutes: Record<NutritionRouteName, NutritionRouteEntry> = {
  NutriProfile: { component: NutriProfileScreen, options: plain },
  NutriPlan: { component: NutriPlanScreen, options: plain },
  FoodSearch: { component: FoodSearchScreen, options: plain },
  Meal: { component: MealScreen, options: plain },
  FoodEmpty: { component: FoodEmptyScreen, options: plain },
};

/** The Nutrition tab component for TabNavigator. */
export const nutritionTab = NutritionScreen;

export { useShowCalories, Kcal } from './guard';
export { configureNutritionDeps } from './deps';
export { buildMealPlan, totals as foodTotals } from './logic';
