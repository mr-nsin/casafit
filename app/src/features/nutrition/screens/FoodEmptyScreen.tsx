import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, FilledButton, HeroIllustration, Icon, OutlinedButton, Text, Touchable, space, useTokens } from '../../../ui';
import { getNutritionDeps } from '../deps';
import { copyYesterday, useNav, useNutritionData } from '../hooks';
import { SLOT_LABEL, slotForHour, slotTotals, type PlanDays } from '../logic';

function suggestion(planDays: unknown, now: Date): string | null {
  const days = planDays as PlanDays | null;
  if (!Array.isArray(days)) return null;
  const dayIdx = (now.getDay() + 6) % 7; // Monday = 0
  const slot = days[dayIdx]?.find((s) => s.slot === slotForHour(now.getHours())) ?? days[dayIdx]?.[0];
  const item = slot?.items[0];
  if (!slot || !item) return null;
  const c = getNutritionDeps().content();
  const f = c.food(item.foodId);
  if (!f) return null;
  return `Today's suggestion: ${c.t(f.nameKey)}, ${slotTotals(c, slot).proteinG} g protein.`;
}

/** Body of m3-foodempty. Also rendered inside the Nutrition tab until the first entry of the day. */
export function FoodEmptyView({
  hasProfile,
  hasYesterday,
  onSameAsYesterday,
  plan,
}: {
  hasProfile: boolean;
  hasYesterday: boolean;
  onSameAsYesterday: () => void | Promise<void>;
  onShowCalories?: boolean;
  plan?: unknown;
}) {
  const nav = useNav();
  const t = useTokens();
  const now = getNutritionDeps().now();
  const slot = slotForHour(now.getHours());
  const time = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const day = now.toLocaleDateString('en-IN', { weekday: 'long' });
  const hint = hasProfile ? suggestion(plan, now) : null;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: space.xl, gap: space.l }}>
      <Text variant="bodySmall" color="osv">{`${day}, ${time}`}</Text>
      <Text variant="headline" accessibilityRole="header">
        Nutrition
      </Text>
      <View style={{ alignItems: 'center', gap: space.m, paddingVertical: space.xl }}>
        <HeroIllustration>
          <Icon name="soup_kitchen" size={64} color="p" />
        </HeroIllustration>
        <Text variant="title" accessibilityRole="header">
          Nothing logged yet today
        </Text>
        <Text color="osv" style={{ textAlign: 'center' }}>
          Add what you eat and we will show your protein as the day goes on.
        </Text>
      </View>
      <FilledButton label={`Log ${SLOT_LABEL[slot].toLowerCase()}`} onPress={() => nav.navigate('FoodSearch', { slot })} />
      <OutlinedButton label="Same as yesterday" disabled={!hasYesterday} onPress={() => void onSameAsYesterday()} />
      {hasProfile ? (
        hint ? (
          <Touchable label={hint} onPress={() => nav.navigate('NutriPlan')} style={{ paddingVertical: space.m }}>
            <Text color="osv">{hint}</Text>
          </Touchable>
        ) : null
      ) : (
        <Touchable label="Set up your food plan" onPress={() => nav.navigate('NutriProfile')} style={{ paddingVertical: space.m }}>
          <Text color="p">Set up your food plan</Text>
        </Touchable>
      )}
    </View>
  );
}

/** m3-foodempty as its own route (BottomNav shown because it sits outside the tabs). */
export function FoodEmptyScreen() {
  const nav = useNav();
  const data = useNutritionData();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }}>
      <FoodEmptyView
        hasProfile={!!data.profile}
        hasYesterday={data.yesterday.length > 0}
        plan={data.plan?.days}
        onSameAsYesterday={async () => {
          await copyYesterday(data.yesterday);
          nav.navigate('Main', { screen: 'Nutrition' });
        }}
      />
      <BottomNav
        current="nutrition"
        onSelect={(k) => nav.navigate('Main', { screen: k === 'workout' ? 'Workout' : k === 'nutrition' ? 'Nutrition' : 'Progress' })}
      />
    </View>
  );
}
