import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card, FilledButton, SectionLabel, Text, TopBar, space, useTokens } from '../../../ui';
import type { FoodUnitName } from '../../../content/types';
import { FoodRow, PortionPicker } from '../components';
import { getNutritionDeps } from '../deps';
import { joinParts, useShowCalories, useTopInset } from '../guard';
import { logFood, useNav } from '../hooks';
import { MAX_PIECES, SLOT_LABEL, asSlot, defaultUnitOf, portionText } from '../logic';
import type { RootScreenProps } from '../../../app/types';

/** m3-meal ("Add to lunch"): choose the portion of one food and log it. `mealId` is the catalogue food id. */
export function MealScreen({ route }: Partial<RootScreenProps<'Meal'>>) {
  const nav = useNav();
  const t = useTokens();
  const topInset = useTopInset();
  const show = useShowCalories();
  const d = getNutritionDeps();
  const content = d.content();
  const slot = asSlot(route?.params?.slot, d.now().getHours());
  const [foodId, setFoodId] = useState<string | undefined>(route?.params?.mealId);
  const food = foodId ? content.food(foodId) : undefined;
  const [unit, setUnit] = useState<FoodUnitName | null>(null);
  const [portions, setPortions] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!food) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: topInset }}>
        <TopBar title="Add food" onLeading={() => nav.goBack()} />
        <View style={{ padding: space.xl, gap: space.l }}>
          <Text color="osv">Pick a food to add first.</Text>
          <FilledButton label="Find a food" onPress={() => nav.navigate('FoodSearch', { slot })} />
        </View>
      </View>
    );
  }

  const u = unit && food.units.some((x) => x.unit === unit) ? unit : defaultUnitOf(food);
  const unitDef = food.units.find((x) => x.unit === u)!;
  const countable = u === 'piece';
  const qty =
    portions != null && (unitDef.steps.includes(portions) || (countable && Number.isInteger(portions) && portions >= 1 && portions <= MAX_PIECES))
      ? portions
      : unitDef.default;
  const n = content.nutrients(food, u, qty);
  const label = SLOT_LABEL[slot].toLowerCase();
  const others = content.foods.filter((f) => f.id !== food.id && f.section === food.section && f.kind === food.kind).slice(0, 2);

  const add = async () => {
    setBusy(true);
    try {
      await logFood(food.id, u, qty, slot);
      nav.navigate('Main', { screen: 'Nutrition' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: topInset }}>
      <TopBar title={`Add to ${label}`} onLeading={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: space.l, gap: space.xl, paddingBottom: 120 }}>
        <Card tone="c3">
          <View style={{ padding: space.l, gap: space.xs }}>
            <Text variant="title">{content.t(food.nameKey)}</Text>
            <Text color="osv" tabular>
              {joinParts([`Per ${portionText(content, food, u, 1)}`, `${Math.round(content.nutrients(food, u, 1).proteinG)} g protein`])}
            </Text>
          </View>
        </Card>
        <PortionPicker food={food} unit={u} portions={qty} onUnit={(x) => { setUnit(x); setPortions(null); }} onPortions={setPortions} />
        <Text variant="title" tabular accessibilityLiveRegion="polite">
          {joinParts([`You will log ${Math.round(n.proteinG)} g protein`, show ? `${Math.round(n.kcal)} kcal` : null], ' - ')}
        </Text>
        {others.length > 0 ? (
          <View>
            <SectionLabel title="Similar foods" />
            {others.map((f) => (
              <FoodRow key={f.id} food={f} onPress={() => { setFoodId(f.id); setUnit(null); setPortions(null); }} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: space.l, right: space.l, bottom: space.l }}>
        <FilledButton label={`Add to ${label}`} loading={busy} onPress={() => void add()} accessibilityHint={portionText(content, food, u, qty)} />
      </View>
    </View>
  );
}
