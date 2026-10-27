import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ChipGroup, FilledButton, InfoRow, SegmentedControl, Text, TextField, TopBar, space, useTokens } from '../../../ui';
import type { NutritionProfile } from '../../../db/repositories';
import { getNutritionDeps } from '../deps';
import { useNav } from '../hooks';
import { DECLINE_COPY, profileHash, targetsFor } from '../logic';

type Diet = NutritionProfile['diet'];
type Goal = NutritionProfile['goal'];

const DIETS: { value: Diet; label: string }[] = [
  { value: 'veg', label: 'Vegetarian' },
  { value: 'egg', label: 'Eggetarian' },
  { value: 'nonveg', label: 'Non-vegetarian' },
  { value: 'jain', label: 'Jain' },
];
const ALLERGIES = [
  { value: 'none', label: 'None' },
  { value: 'peanut', label: 'Peanuts' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'other', label: 'Other' },
];
const GOALS: { value: Goal; label: string }[] = [
  { value: 'maintain', label: 'Keep steady' },
  { value: 'lose_gently', label: 'Lower gently' },
  { value: 'gain', label: 'Build up' },
];

/** m3-nutriprofile: four questions. Also the edit screen (pre-filled, CTA "Save"). */
export function NutriProfileScreen() {
  const nav = useNav();
  const t = useTokens();
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [diet, setDiet] = useState<Diet>('veg');
  const [allergies, setAllergies] = useState<string[]>(['none']);
  const [other, setOther] = useState('');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [meals, setMeals] = useState<'3' | '4' | '5'>('4');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [needsMeasures, setNeedsMeasures] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = getNutritionDeps().repos();
      const [p, me] = await Promise.all([r.nutrition.getProfile(), r.profile.get()]);
      if (p) {
        setEditing(true);
        setDiet(p.diet);
        setAllergies(p.allergies.length ? p.allergies : ['none']);
        setOther(p.allergyOther ?? '');
        setGoal(p.goal);
        setMeals(String(p.mealsPerDay) as '3' | '4' | '5');
      }
      if (me?.heightCm) setHeightCm(String(me.heightCm));
      if (me?.weightKg) setWeightKg(String(me.weightKg));
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      const d = getNutritionDeps();
      const r = d.repos();
      const h = Number(heightCm) || null;
      const w = Number(weightKg) || null;
      if (needsMeasures || (h && w)) await r.profile.save({ heightCm: h, weightKg: w });
      const [me, plan] = await Promise.all([r.profile.get(), r.plan.get()]);
      const result = targetsFor(me, goal, plan?.daysPerWeek ?? 3, d.now().getFullYear());
      if (result.status === 'needs_measures') {
        setNeedsMeasures(true);
        setNotice('Add your height and weight so we can work out your daily target.');
        return;
      }
      if (result.status === 'declined') {
        setNotice(DECLINE_COPY[result.reason] ?? DECLINE_COPY.invalid_input!);
        return;
      }
      const cleaned = allergies.filter((a) => a !== 'none');
      const base = {
        diet,
        allergies: cleaned,
        allergyOther: cleaned.includes('other') && other.trim() ? other.trim() : null,
        goal,
        mealsPerDay: Number(meals) as 3 | 4 | 5,
        targetKcal: result.kcal,
        targetProteinG: result.proteinG,
      };
      await r.nutrition.saveProfile({ ...base, computedAt: d.now().getTime(), inputsHash: profileHash(base) });
      nav.navigate('NutriPlan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <TopBar title="Your food plan" onLeading={() => nav.goBack()} />
      <ScrollView contentContainerStyle={{ padding: space.l, gap: space.xl, paddingBottom: space.xxxl }}>
        {loaded ? (
          <>
            <Section title="How do you eat?">
              <ChipGroup label="Diet" options={DIETS} selected={[diet]} onChange={(v) => v[0] && setDiet(v[0])} />
            </Section>
            <Section title="Any allergies?">
              <ChipGroup label="Allergies" multi exclusive="none" options={ALLERGIES} selected={allergies.length ? allergies : []} onChange={(v) => setAllergies(v.length ? v : ['none'])} />
              {allergies.includes('other') ? <TextField label="Which allergy" optional value={other} onChange={setOther} /> : null}
            </Section>
            <Section title="What is your goal?">
              <ChipGroup label="Goal" options={GOALS} selected={goal ? [goal] : []} onChange={(v) => v[0] && setGoal(v[0])} />
            </Section>
            <Section title="Meals a day">
              <SegmentedControl label="Meals a day" value={meals} onChange={setMeals} options={[{ value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }]} />
            </Section>
            {needsMeasures ? (
              <Section title="Your size">
                <TextField label="Height" suffix="cm" keyboardType="numeric" value={heightCm} onChange={setHeightCm} />
                <TextField label="Weight" suffix="kg" keyboardType="numeric" value={weightKg} onChange={setWeightKg} />
              </Section>
            ) : null}
            {notice ? <InfoRow icon="info" text={notice} /> : null}
            <InfoRow icon="health_and_safety" text="This is a starting guide, not medical advice. If you have a health condition, talk to your doctor or a dietitian." />
            <InfoRow icon="lock" text="Your answers stay on your phone." />
            <FilledButton label={editing ? 'Save' : 'Build my food plan'} disabled={!goal} loading={busy} onPress={() => void save()} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.m }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}
