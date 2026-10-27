import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  BottomSheet,
  Card,
  Fab,
  IconButton,
  ListRow,
  MacroBar,
  SearchField,
  Text,
  TextButton,
  TipCard,
  TonalButton,
  ToggleRow,
  TopBar,
  space,
  useTokens,
} from '../../../ui';
import { usePreferences } from '../../../state/preferences';
import type { FoodUnitName } from '../../../content/types';
import { getNutritionDeps, todayKey } from '../deps';
import { Kcal, joinParts, useShowCalories } from '../guard';
import { copyYesterday, logFood, useNav, useNutritionData } from '../hooks';
import { SLOTS, SLOT_LABEL, slotForHour, entryLine, entryNutrients, proteinCopy, STATUS_WORD, totals } from '../logic';
import { proteinStatus } from '../../../engine';
import { FoodEmptyView } from './FoodEmptyScreen';

/** Nutrition tab root (m3-nutrition). Shows the empty state (m3-foodempty) until something is logged. */
export function NutritionScreen() {
  const nav = useNav();
  const t = useTokens();
  const show = useShowCalories();
  const setShow = usePreferences((s) => s.setShowCalories);
  const data = useNutritionData();
  const [savedOpen, setSavedOpen] = useState(false);
  const content = getNutritionDeps().content();

  // First open: ask the four profile questions (PRD). Only after the load so we know there is none.
  useEffect(() => {
    if (data.loaded && !data.profile) nav.navigate('NutriProfile');
  }, [data.loaded, data.profile, nav]);

  if (!data.loaded) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  if (data.today.length === 0) {
    return (
      <FoodEmptyView
        hasProfile={!!data.profile}
        hasYesterday={data.yesterday.length > 0}
        onSameAsYesterday={async () => {
          await copyYesterday(data.yesterday);
          await data.reload();
        }}
        plan={data.plan?.days}
      />
    );
  }

  const tot = totals(content, data.today);
  const targetP = data.profile?.targetProteinG ?? 0;
  const targetK = data.profile?.targetKcal ?? 0;
  const day = getNutritionDeps().now().toLocaleDateString('en-IN', { weekday: 'long' });
  const status = proteinStatus(tot.proteinG, targetP);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <TopBar
        leading="none"
        title={day}
        trailing={[{ icon: 'tune', label: data.profile ? 'Food plan' : 'Set up food plan', onPress: () => nav.navigate(data.profile ? 'NutriPlan' : 'NutriProfile') }]}
      />
      <ScrollView contentContainerStyle={{ padding: space.l, gap: space.l, paddingBottom: 120 }}>
        <Text variant="headline" accessibilityRole="header">
          Nutrition
        </Text>
        <ToggleRow title="Show calories" subtitle="Turn off to track protein and portions only" value={show} onChange={(v) => void setShow(v)} />

        <Card tone="c3">
          <View style={{ padding: space.l, gap: space.m }}>
            {targetP > 0 ? (
              <MacroBar label="Protein" value={tot.proteinG} target={targetP} unit="g" />
            ) : (
              <Text tabular>{tot.proteinG} g protein so far</Text>
            )}
            {show ? (
              targetK > 0 ? (
                <MacroBar label="Calories" value={tot.kcal} target={targetK} unit="kcal" />
              ) : (
                <Kcal value={tot.kcal} />
              )
            ) : (
              <Text color="osv" tabular>
                {joinParts([STATUS_WORD[status], `${tot.portions} portions logged`])}
              </Text>
            )}
            {targetP > 0 ? <Text color="osv">{proteinCopy(tot.proteinG, targetP)}</Text> : null}
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
          <TonalButton
            label="Same as yesterday"
            height={48}
            disabled={data.yesterday.length === 0}
            onPress={async () => {
              await copyYesterday(data.yesterday);
              await data.reload();
            }}
          />
          <TonalButton label="Saved meals" height={48} onPress={() => setSavedOpen(true)} />
        </View>

        <SearchField value="" onChange={() => {}} placeholder="Search foods" onFocus={() => nav.navigate('FoodSearch')} />

        {SLOTS.map((slot) => {
          const rows = data.today.filter((e) => e.meal === slot || (slot === 'snack' && e.meal === 'other'));
          const slotTot = totals(content, rows);
          return (
            <View key={slot} style={{ gap: space.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
                  {SLOT_LABEL[slot]}
                </Text>
                {rows.length > 0 ? (
                  <Text variant="bodySmall" color="osv" tabular>
                    {joinParts([`${slotTot.proteinG} g protein`, show ? `${slotTot.kcal} kcal` : null])}
                  </Text>
                ) : null}
              </View>
              {rows.map((e) => (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1 }}>{entryLine(content, e)}</Text>
                  <IconButton
                    icon="delete"
                    label={`Remove ${entryLine(content, e)}`}
                    onPress={async () => {
                      await getNutritionDeps().repos().food.remove(e.id);
                      await data.reload();
                    }}
                  />
                </View>
              ))}
              <TextButton label={`Add ${SLOT_LABEL[slot].toLowerCase()}`} onPress={() => nav.navigate('FoodSearch', { slot })} />
            </View>
          );
        })}

        <TipCard text="Dal, curd and paneer are easy ways to add protein to a meal." />
      </ScrollView>
      <View style={{ position: 'absolute', right: space.l, bottom: space.xl }}>
        <Fab label="Log a meal" icon="add" onPress={() => nav.navigate('FoodSearch')} />
      </View>

      <BottomSheet visible={savedOpen} title="Saved meals" onDismiss={() => setSavedOpen(false)}>
        {data.saved.length === 0 ? (
          <Text color="osv">You have no saved meals yet.</Text>
        ) : (
          data.saved.map((m) => {
            const kcal = m.items.reduce((a, i) => a + (entryNutrients(content, { ...i, snapshot: null })?.kcal ?? 0), 0);
            return (
              <ListRow
                key={m.id}
                title={m.name}
                subtitle={show ? `${Math.round(kcal)} kcal` : `${m.items.length} items`}
                trailing="chevron"
                onPress={async () => {
                  for (const i of m.items) await logFood(i.foodId, i.unit as FoodUnitName, i.portions, slotForHour(getNutritionDeps().now().getHours()), todayKey());
                  setSavedOpen(false);
                  await data.reload();
                }}
              />
            );
          })
        )}
      </BottomSheet>
    </View>
  );
}
