import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { FoodEntry, MealPlanRow, NutritionProfile, SavedMeal } from '../../db/repositories';
import type { RootStackParamList } from '../../app/types';
import { getNutritionDeps, todayKey, yesterdayKey } from './deps';
import { snapshotFor } from './logic';
import type { FoodUnitName } from '../../content/types';
import type { Meal } from '../../db/repositories';

export type Nav = NativeStackNavigationProp<RootStackParamList>;
export const useNav = () => useNavigation<Nav>();

export interface NutritionData {
  loaded: boolean;
  profile: NutritionProfile | null;
  today: FoodEntry[];
  yesterday: FoodEntry[];
  plan: MealPlanRow | null;
  saved: SavedMeal[];
  reload: () => Promise<void>;
}

/** Loads everything the Nutrition screens read, and reloads when the screen regains focus. */
export function useNutritionData(): NutritionData {
  const nav = useNav();
  const [state, setState] = useState<Omit<NutritionData, 'reload'>>({
    loaded: false,
    profile: null,
    today: [],
    yesterday: [],
    plan: null,
    saved: [],
  });
  const alive = useRef(true);
  const reload = useCallback(async () => {
    const r = getNutritionDeps().repos();
    const [profile, today, yesterday, plan, saved] = await Promise.all([
      r.nutrition.getProfile(),
      r.food.forDay(todayKey()),
      r.food.forDay(yesterdayKey()),
      r.nutrition.activeMealPlan(),
      r.nutrition.savedMeals(),
    ]);
    if (alive.current) setState({ loaded: true, profile, today, yesterday, plan, saved });
  }, []);
  useEffect(() => {
    alive.current = true;
    void reload();
    const off = (nav as { addListener?: (e: string, cb: () => void) => () => void }).addListener?.('focus', () => void reload());
    return () => {
      alive.current = false;
      off?.();
    };
  }, [nav, reload]);
  return { ...state, reload };
}

/** Writes one food entry with a nutrient snapshot (so later catalogue changes do not rewrite history). */
export async function logFood(foodId: string, unit: FoodUnitName, portions: number, meal: Meal, loggedOn = todayKey()): Promise<boolean> {
  const d = getNutritionDeps();
  const food = d.content().food(foodId);
  if (!food) return false;
  return d.repos().food.add({
    id: d.newId(),
    loggedOn,
    meal,
    foodId,
    unit,
    portions,
    snapshot: snapshotFor(d.content(), food, unit, portions),
    createdAt: d.now().getTime(),
  });
}

/** Copies yesterday's entries to today. Returns how many were copied. */
export async function copyYesterday(yesterday: FoodEntry[]): Promise<number> {
  let n = 0;
  for (const e of yesterday) {
    const ok = await logFood(e.foodId, e.unit as FoodUnitName, e.portions, e.meal);
    if (ok) n += 1;
  }
  return n;
}
