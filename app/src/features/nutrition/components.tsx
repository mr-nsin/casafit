import React from 'react';
import { View } from 'react-native';

import type { FoodItem, FoodUnitName } from '../../content/types';
import { Card, Icon, SegmentedControl, Text, Touchable, space, useTokens } from '../../ui';
import { Kcal, joinParts, useShowCalories } from './guard';
import { fractionLabel, portionSteps } from './logic';
import { getNutritionDeps } from './deps';

export const UNIT_HELP: Record<FoodUnitName, string> = {
  katori: '1 katori is about a small steel bowl (150 ml)',
  chamach: '1 chamach is about one serving spoon (15 ml)',
  piece: 'Count each piece you eat',
  g: 'Weigh it, or estimate in grams',
};
const UNIT_TITLE: Record<FoodUnitName, string> = { katori: 'Katori', chamach: 'Chamach', piece: 'Piece', g: 'Grams' };

/** Katori, chamach, piece and gram portion picker. Steps come from the catalogue row. */
export function PortionPicker({
  food,
  unit,
  portions,
  onUnit,
  onPortions,
}: {
  food: FoodItem;
  unit: FoodUnitName;
  portions: number;
  onUnit: (u: FoodUnitName) => void;
  onPortions: (n: number) => void;
}) {
  const t = useTokens();
  const { steps } = portionSteps(food, unit);
  return (
    <View style={{ gap: space.m }}>
      <Text variant="title" accessibilityRole="header">
        How much?
      </Text>
      {food.units.length > 1 ? (
        <SegmentedControl
          label="Portion unit"
          value={unit}
          onChange={onUnit}
          options={food.units.map((u) => ({ value: u.unit, label: UNIT_TITLE[u.unit] }))}
        />
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Portion size" style={{ flexDirection: 'row', gap: space.s }}>
        {steps.map((s) => {
          const sel = s === portions;
          return (
            <Touchable
              key={s}
              role="radio"
              label={`${fractionLabel(s)} ${UNIT_TITLE[unit].toLowerCase()}`}
              selected={sel}
              onPress={() => onPortions(s)}
              minSize={48}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: sel ? t.sc : t.c3,
              }}
            >
              <Text variant="title" color={sel ? 'osc' : 'on'} tabular>
                {fractionLabel(s)}
              </Text>
            </Touchable>
          );
        })}
      </View>
      <Text variant="bodySmall" color="osv">
        {UNIT_HELP[unit]}
      </Text>
    </View>
  );
}

/** One catalogue result: name, default portion, protein and (if shown) kcal. Whole row opens the food. */
export function FoodRow({ food, onPress }: { food: FoodItem; onPress: () => void }) {
  const content = getNutritionDeps().content();
  const u = food.units[0]!;
  const n = content.nutrients(food, u.unit, u.default);
  const show = useShowCalories();
  const name = content.t(food.nameKey);
  const summary = joinParts([content.unitLabel(food, u.unit, u.default), `${Math.round(n.proteinG)} g protein`, show ? `${Math.round(n.kcal)} kcal` : null]);
  return (
    <Touchable
      label={`${name}, ${summary}`}
      onPress={onPress}
      minSize={64}
      style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.s }}
    >
      <View style={{ flex: 1 }}>
        <Text>{name}</Text>
        <Text variant="bodySmall" color="osv" tabular>
          {summary}
        </Text>
      </View>
      <Icon name="chevron_right" color="osv" />
    </Touchable>
  );
}

export { Card, Kcal };
