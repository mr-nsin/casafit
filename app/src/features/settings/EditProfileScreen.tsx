// Edit profile (m3-editprofile). Everything is saved on this phone only. A photo picker is not
// built yet (needs expo-image-picker), so the avatar shows initials.

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import type { PainArea, Sex } from '../../db/repositories';
import { Avatar, ChipGroup, FilledButton, InfoNote, SectionLabel, Text, TextField, space } from '../../ui';
import { SEX_OPTIONS, parseHeight, parseWeight } from '../onboarding/logic';
import { Page } from './Page';
import { useBusy, useProfileData } from './hooks';
import { PAIN_AREAS, initials, parseBirthYear } from './model';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PainChoice = PainArea | 'none';

export function EditProfileScreen() {
  const nav = useNavigation<Nav>();
  const { profile, loading, save } = useProfileData();
  const [name, setName] = useState('');
  const [born, setBorn] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [pain, setPain] = useState<PainArea[]>([]);
  const [errors, setErrors] = useState<{ born?: string; height?: string; weight?: string }>({});
  const [busy, run] = useBusy();
  const [filled, setFilled] = useState(false);

  // Fill the form once, when the saved profile arrives.
  useEffect(() => {
    if (loading || filled) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setFilled(true);
    if (profile) {
      setName(profile.name ?? '');
      setBorn(profile.birthYear ? String(profile.birthYear) : '');
      setHeight(profile.heightCm ? String(profile.heightCm) : '');
      setWeight(profile.weightKg ? String(profile.weightKg) : '');
      setSex(profile.sex);
      setPain(profile.painAreas);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loading, filled, profile]);

  const back = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main'));

  const submit = () =>
    run(async () => {
      const b = parseBirthYear(born);
      const h = parseHeight(height);
      const w = parseWeight(weight);
      const next = { born: b.error, height: h.error, weight: w.error };
      setErrors(next);
      if (next.born || next.height || next.weight) return;
      await save({
        name: name.trim() || null,
        birthYear: b.value,
        heightCm: h.value,
        weightKg: w.value,
        sex,
        painAreas: pain,
      });
      back();
    });

  return (
    <Page
      topBar={{ title: 'Edit profile', leading: 'back', onLeading: back }}
      footer={<FilledButton label="Save changes" loading={busy} onPress={() => void submit()} />}
    >
      <View style={{ alignItems: 'center', gap: space.s }}>
        <Avatar initials={initials(name)} size={88} />
        <Text variant="bodySmall" color="osv" style={{ textAlign: 'center' }}>
          Everything here stays on this phone.
        </Text>
      </View>

      <TextField label="Name" value={name} onChange={setName} maxLength={40} autoComplete="name" />
      <TextField label="Born" value={born} onChange={setBorn} keyboardType="number-pad" maxLength={4} placeholder="Year, like 1998" optional error={errors.born} />
      <TextField label="Height · cm" value={height} onChange={setHeight} keyboardType="number-pad" maxLength={3} optional error={errors.height} />
      <TextField label="Weight · kg" value={weight} onChange={setWeight} keyboardType="decimal-pad" maxLength={5} optional error={errors.weight} />

      <View style={{ gap: space.s }}>
        <SectionLabel title="Sex" hint="Used only for step and calorie estimates. You can skip it." />
        <ChipGroup
          label="Sex"
          options={SEX_OPTIONS}
          selected={sex && sex !== 'skip' ? [sex] : []}
          onChange={([v]) => setSex(v ?? null)}
        />
      </View>

      <View style={{ gap: space.s }}>
        <SectionLabel title="Pain or past injury" />
        <ChipGroup<PainChoice>
          label="Pain or past injury"
          multi
          exclusive="none"
          options={[{ value: 'none', label: 'None' }, ...PAIN_AREAS]}
          selected={pain.length ? pain : ['none']}
          onChange={(next) => setPain(next.filter((v): v is PainArea => v !== 'none'))}
        />
      </View>

      <InfoNote icon="info" text="Changing these rebuilds next week's plan. Today's session stays as it is." />
    </Page>
  );
}
