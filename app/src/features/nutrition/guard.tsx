// D7: the one guard every kcal surface reads. Nothing in this lane renders a calorie number
// except through useShowCalories() / <Kcal>.

import React, { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Text, space, type AppTextProps } from '../../ui';
import { useShowCalories as useShowCaloriesPref } from '../../state/preferences';

export const useShowCalories = (): boolean => useShowCaloriesPref();

/** Renders "<n> kcal" only when calories are shown; otherwise nothing. */
export function Kcal({ value, ...rest }: { value: number } & AppTextProps) {
  const show = useShowCalories();
  if (!show) return null;
  return (
    <Text tabular {...rest}>
      {Math.round(value).toLocaleString('en-IN')} kcal
    </Text>
  );
}

/** Joins the parts that are present, so a hidden kcal part leaves no stray separator. */
export const joinParts = (parts: (string | null | false | undefined)[], sep = ' · ') => parts.filter(Boolean).join(sep);

/** Top padding for a screen that draws its own header: the status bar inset plus a small gap. */
export const useTopInset = (): number => (useContext(SafeAreaInsetsContext)?.top ?? 0) + space.s;
