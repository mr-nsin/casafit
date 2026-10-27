// D7: the one guard every kcal surface reads. Nothing in this lane renders a calorie number
// except through useShowCalories() / <Kcal>.

import React from 'react';
import { Text, type AppTextProps } from '../../ui';
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
