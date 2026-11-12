import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';

import { ChipGroup, FilledButton, HeightInput, InfoRow, SegmentedControl, Text, TextField, TopBar, WeightInput, space, useTokens } from '../../../ui';
import type { NutritionProfile, Sex } from '../../../db/repositories';
import { GENDER_OPTIONS } from '../../onboarding/logic';
import { useTopInset } from '../guard';
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
  const topInset = useTopInset();
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [diet, setDiet] = useState<Diet>('veg');
  const [allergies, setAllergies] = useState<string[]>(['none']);
  const [other, setOther] = useState('');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [meals, setMeals] = useState<'1' | '2' | '3' | '4' | '5'>('4');
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [hError, setHError] = useState<string | undefined>();
  const [wError, setWError] = useState<string | undefined>();
  const [needsYear, setNeedsYear] = useState(false);
  const [year, setYear] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
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
        setMeals(String(p.mealsPerDay) as '1' | '2' | '3' | '4' | '5');
      }
      if (me?.heightCm) setHeightCm(me.heightCm);
      if (me?.weightKg) setWeightKg(me.weightKg);
      if (me?.sex) setSex(me.sex);
      if (me && me.birthYear == null) setNeedsYear(true);
      setLoaded(true);
    })();
  }, []);

  const measuresOk = heightCm != null && weightKg != null && !hError && !wError;
  const nowYear = getNutritionDeps().now().getFullYear();
  const yearNum = Number(year);
  const yearOk = !needsYear || (/^\d{4}$/.test(year.trim()) && yearNum <= nowYear - 18 && yearNum >= nowYear - 100);
  const reason = !goal ? 'Pick a goal' : !measuresOk ? 'Add your height and weight' : !yearOk ? 'Add your year of birth (you must be 18 or older)' : null;
  const touch = () => setNotice(null);

  const save = async () => {
    if (!goal || !measuresOk || !yearOk) return;
    setBusy(true);
    try {
      const d = getNutritionDeps();
      const r = d.repos();
      await r.profile.save({ heightCm, weightKg, sex, ...(needsYear ? { birthYear: yearNum } : {}) });
      const [me, plan] = await Promise.all([r.profile.get(), r.plan.get()]);
      const result = targetsFor(me, goal, plan?.daysPerWeek ?? 3, d.now().getFullYear());
      if (result.status === 'needs_measures') {
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
        mealsPerDay: Number(meals) as 1 | 2 | 3 | 4 | 5,
        targetKcal: result.kcal,
        targetProteinG: result.proteinG,
      };
      await r.nutrition.saveProfile({ ...base, computedAt: d.now().getTime(), inputsHash: profileHash(base) });
      nav.replace('NutriPlan'); // replace, so Back from the plan returns to Nutrition and not to the form
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: topInset }}>
      <TopBar title="Your food plan" onLeading={() => nav.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.l, gap: space.xl, paddingBottom: space.xxxl }}>
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
              <ChipGroup label="Goal" options={GOALS} selected={goal ? [goal] : []} onChange={(v) => {
                  if (v[0]) setGoal(v[0]);
                  touch();
                }} />
            </Section>
            <Section title="Meals a day">
              <SegmentedControl label="Meals a day" value={meals} onChange={setMeals} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }]} />
            </Section>
            <Section title="Your size">
              <HeightInput
                valueCm={heightCm}
                testID="food-height"
                onChange={(cm, err) => {
                  setHeightCm(cm);
                  setHError(err);
                  touch();
                }}
              />
              <WeightInput
                valueKg={weightKg}
                testID="food-weight"
                onChange={(kg, err) => {
                  setWeightKg(kg);
                  setWError(err);
                  touch();
                }}
              />
              <Text variant="label" color="osv">
                Gender
              </Text>
              <ChipGroup
                label="Gender"
                options={GENDER_OPTIONS}
                selected={sex && sex !== 'skip' ? [sex] : []}
                onChange={([v]) => setSex(v ?? null)}
              />
              <Text variant="bodySmall" color="osv">
                Used only to work out your daily target. You can leave it blank.
              </Text>
              {needsYear ? (
                <TextField
                  label="Year of birth"
                  keyboardType="number-pad"
                  value={year}
                  onChange={(v) => {
                    setYear(v.replace(/[^0-9]/g, '').slice(0, 4));
                    touch();
                  }}
                  helper="We need this to work out your daily target. You must be 18 or older."
                  testID="food-year"
                />
              ) : null}
            </Section>
            {notice ? <InfoRow icon="info" text={notice} /> : null}
            <InfoRow icon="health_and_safety" text="This is a starting guide, not medical advice. If you have a health condition, talk to your doctor or a dietitian." />
            <InfoRow icon="lock" text="Your answers stay on your phone." />
            <FilledButton label={editing ? 'Save' : 'Build my food plan'} disabled={!!reason} loading={busy} onPress={() => void save()} />
            {reason ? (
              <Text color="osv" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
                {reason}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
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
