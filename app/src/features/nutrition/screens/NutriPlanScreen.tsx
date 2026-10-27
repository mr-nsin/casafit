import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card, FilledButton, IconButton, Tabs, Text, TopBar, space, useTokens } from '../../../ui';
import type { NutritionProfile } from '../../../db/repositories';
import { getNutritionDeps } from '../deps';
import { Kcal, joinParts, useShowCalories } from '../guard';
import { useNav } from '../hooks';
import { SLOT_LABEL, SLOT_TIME, buildMealPlan, entryLine, profileHash, slotTotals, swapItems, type PlanDays } from '../logic';
import { splitMeals } from '../../../engine';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const GOAL_LINE: Record<NutritionProfile['goal'], string> = { maintain: 'Every day, for steady weight', lose_gently: 'Every day, for a gentle change', gain: 'Every day, to build up' };

/** m3-nutriplan: daily target and a sample week of meals. Plan is built on the phone from rules, no AI. */
export function NutriPlanScreen() {
  const nav = useNav();
  const t = useTokens();
  const show = useShowCalories();
  const d = getNutritionDeps();
  const content = d.content();
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [days, setDays] = useState<PlanDays | null>(null);
  const [day, setDay] = useState<(typeof DAYS)[number]>('Mon');

  useEffect(() => {
    void (async () => {
      const r = d.repos();
      const p = await r.nutrition.getProfile();
      setProfile(p);
      if (!p) return;
      const active = await r.nutrition.activeMealPlan();
      setDays(active && active.profileHash === profileHash(p) && Array.isArray(active.days) ? (active.days as PlanDays) : buildMealPlan(content, p));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idx = DAYS.indexOf(day);
  const shares = useMemo(() => (profile && days?.[0] ? splitMeals(profile.targetKcal, days[0].length) : []), [profile, days]);

  if (!profile || !days) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <TopBar title="Your food plan" onLeading={() => nav.goBack()} />
        {profile === null ? (
          <View style={{ padding: space.xl, gap: space.l }}>
            <Text color="osv">Answer four short questions and we will build a plan for you.</Text>
            <FilledButton label="Set up your food plan" onPress={() => nav.navigate('NutriProfile')} />
          </View>
        ) : null}
      </View>
    );
  }

  const swap = (si: number) => {
    const next = days.map((dd, di) => (di === idx ? dd.map((s, i) => (i === si ? { ...s, items: swapItems(content, profile, s, shares[si] ?? 0) } : s)) : dd));
    setDays(next);
  };

  const use = async () => {
    await d.repos().nutrition.saveMealPlan({ id: d.newId(), profileHash: profileHash(profile), days, createdAt: d.now().getTime() });
    nav.navigate('Main', { screen: 'Nutrition' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <TopBar title="Your food plan" onLeading={() => nav.goBack()} trailing={[{ icon: 'tune', label: 'Change my answers', onPress: () => nav.navigate('NutriProfile') }]} />
      <ScrollView contentContainerStyle={{ padding: space.l, gap: space.l, paddingBottom: space.xxxl }}>
        <Card tone="pc">
          <View style={{ padding: space.l, gap: space.s }}>
            <Text variant="title" color="opc">
              {GOAL_LINE[profile.goal]}
            </Text>
            <Kcal value={profile.targetKcal} variant="headline" color="opc" />
            <Text variant="headline" color="opc" tabular>
              {profile.targetProteinG} g protein
            </Text>
            <Text variant="bodySmall" color="opc">
              {joinParts([profile.diet === 'veg' ? 'Vegetarian' : profile.diet === 'egg' ? 'Eggetarian' : profile.diet === 'jain' ? 'Jain' : 'Non-vegetarian', `${profile.mealsPerDay} meals`, profile.allergies.length ? `avoids ${profile.allergies.join(', ')}` : 'no allergies'])}
            </Text>
          </View>
        </Card>

        <Tabs scrollable items={DAYS.map((x) => ({ value: x, label: x }))} selected={day} onSelect={setDay} />

        {days[idx]!.map((s, si) => {
          const tt = slotTotals(content, s);
          const text = s.items.map((i) => entryLine(content, i)).join(', ') || 'Nothing suggested';
          return (
            <Card key={`${s.slot}-${si}`} tone="c3">
              <View style={{ padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text variant="label" color="osv">
                    {joinParts([SLOT_LABEL[s.slot], SLOT_TIME[s.slot]])}
                  </Text>
                  <Text>{text}</Text>
                  <Text variant="bodySmall" color="osv" tabular>
                    {joinParts([`${tt.proteinG} g protein`, show ? `${tt.kcal} kcal` : null])}
                  </Text>
                </View>
                <IconButton icon="swap_horiz" label={`Swap ${SLOT_LABEL[s.slot].toLowerCase()}`} onPress={() => swap(si)} />
              </View>
            </Card>
          );
        })}

        <Text variant="bodySmall" color="osv">
          This is a sample plan to get you started, not medical advice. Amounts are a guide. If you have a health condition, check with your doctor or a dietitian.
        </Text>
        <FilledButton label="Use this plan" onPress={() => void use()} />
      </ScrollView>
    </View>
  );
}
