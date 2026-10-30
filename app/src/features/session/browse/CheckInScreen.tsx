// Weekly check-in: how the week felt, weight and waist, all optional. Local only: this is health
// data and it stays on the phone unless the user turns on sync. A trend is shown, never one day.

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { WeeklyCheckin } from '../../../db/repositories';
import { addDays } from '../../../engine';
import { getRepositories, hasRepositories } from '../../../state/storage';
import {
  Card,
  FilledButton,
  Icon,
  InfoNote,
  OutlinedButton,
  Stepper,
  Text,
  TextButton,
  TextField,
  Touchable,
  radius,
  space,
  useTokens,
} from '../../../ui';
import { getSessionDeps } from '../deps';
import { localDate, weekdayIndex } from './model';
import { Page, useBackOrHome, useBrowseNav } from './Page';

/** Monday of the week that holds `date`, 'YYYY-MM-DD'. */
export function weekStartOf(date: string): string {
  return addDays(date, -((weekdayIndex(date) + 6) % 7));
}

type Mood = NonNullable<WeeklyCheckin['mood']>;
const MOODS: { value: Mood; label: string; icon: string }[] = [
  { value: 'tough', label: 'Tough', icon: 'sentiment_dissatisfied' },
  { value: 'good', label: 'Good', icon: 'sentiment_satisfied' },
  { value: 'great', label: 'Great', icon: 'sentiment_very_satisfied' },
];

function Trend({ points }: { points: number[] }) {
  const t = useTokens();
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Your weight over ${points.length} weeks: ${points.map((p) => `${p} kilograms`).join(', ')}`}
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s, height: 56 }}
    >
      {points.map((p, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 12 + ((p - lo) / (hi - lo || 1)) * 44, borderRadius: radius.s, backgroundColor: i === points.length - 1 ? t.p : t.pc }}
        />
      ))}
    </View>
  );
}

export function CheckInScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const t = useTokens();
  const week = weekStartOf(localDate(getSessionDeps().clock.wall()));
  const [mood, setMood] = useState<Mood | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [showWaist, setShowWaist] = useState(false);
  const [waist, setWaist] = useState('');
  const [past, setPast] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRepositories()) return undefined;
    let live = true;
    const repos = getRepositories();
    void (async () => {
      const [profile, current] = await Promise.all([repos.profile.get(), repos.checkin.get(week)]);
      const before = await Promise.all([1, 2, 3].map((i) => repos.checkin.get(addDays(week, -7 * i))));
      if (!live) return;
      setMood(current?.mood ?? null);
      setWeight(current?.weightKg ?? profile?.weightKg ?? null);
      if (current?.waistCm) {
        setWaist(String(current.waistCm));
        setShowWaist(true);
      }
      setPast(before.reverse().flatMap((c) => (c?.weightKg ? [c.weightKg] : [])));
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [week]);

  const points = weight !== null ? [...past, weight] : past;

  const save = async () => {
    const waistCm = waist.trim() ? Number(waist.replace(',', '.')) : null;
    if (waistCm !== null && !(waistCm >= 30 && waistCm <= 250)) {
      setError('Waist should be between 30 and 250 cm. You can also leave it blank.');
      return;
    }
    setError(null);
    try {
      if (hasRepositories()) await getRepositories().checkin.save({ weekStart: week, mood, weightKg: weight, waistCm });
      nav.navigate('Recap');
    } catch {
      setError('We could not save that. Your answers are still here, so try again.');
    }
  };

  return (
    <Page
      topBar={{ title: 'Weekly check-in', leading: 'close', onLeading: back }}
      footer={
        <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
          <TextButton label="Skip this week" onPress={back} />
          <FilledButton label="Save" onPress={() => void save()} style={{ flex: 1 }} />
        </View>
      }
    >
      <Text color="osv">Two minutes, once a week. Every question is optional, and only you see the answers.</Text>

      <Text variant="title" accessibilityRole="header">
        How did this week feel?
      </Text>
      <View style={{ flexDirection: 'row', gap: space.s }} accessibilityLabel="How this week felt">
        {MOODS.map((m) => {
          const on = mood === m.value;
          return (
            <Touchable
              key={m.value}
              label={m.label}
              selected={on}
              onPress={() => setMood(on ? null : m.value)}
              minSize={72}
              style={{ flex: 1, minHeight: 72, borderRadius: radius.l, backgroundColor: on ? t.sc : t.c3, alignItems: 'center', justifyContent: 'center', gap: space.xs }}
            >
              <Icon name={m.icon} size={28} color={on ? 'osc' : 'osv'} />
              <Text variant="labelStrong" color={on ? 'osc' : 'osv'}>
                {m.label}
              </Text>
            </Touchable>
          );
        })}
      </View>

      <Text variant="title" accessibilityRole="header">
        Weight <Text color="osv">· optional</Text>
      </Text>
      {weight === null ? (
        <OutlinedButton label="Add my weight" leadingIcon="add" onPress={() => setWeight(60)} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stepper label="weight" unit="kg" value={weight} min={20} max={300} step={0.1} onChange={setWeight} />
          <TextButton label="Clear weight" onPress={() => setWeight(null)} />
        </View>
      )}
      <Card tone="c3" style={{ gap: space.s }}>
        <Text variant="label" color="osv">
          Your 4-week trend
        </Text>
        {points.length >= 2 ? <Trend points={points} /> : <Text color="osv">Your trend shows up after two check-ins with a weight.</Text>}
        <Text variant="bodySmall" color="osv">
          {"We show a trend, never one day's number. Weight moves 1 to 2 kg a day with water alone."}
        </Text>
      </Card>

      <Text variant="title" accessibilityRole="header">
        Waist <Text color="osv">· optional, monthly</Text>
      </Text>
      {showWaist ? (
        <TextField label="Waist" suffix="cm" value={waist} onChange={setWaist} keyboardType="decimal-pad" optional />
      ) : (
        <OutlinedButton label="Add a waist measurement" leadingIcon="straighten" onPress={() => setShowWaist(true)} />
      )}
      {error ? <InfoNote icon="info" tone="erc" text={error} /> : null}
    </Page>
  );
}
