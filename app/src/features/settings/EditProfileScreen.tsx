// Edit profile (m3-editprofile). Everything is saved on this phone only. A photo picker is not
// built yet (needs expo-image-picker), so the avatar shows initials.

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import type { PainArea, Sex } from '../../db/repositories';
import { Avatar, ChipGroup, FilledButton, HeightInput, InfoNote, SectionLabel, Text, TextField, WeightInput, space } from '../../ui';
import { GENDER_OPTIONS } from '../onboarding/logic';
import { Page } from './Page';
import { useBusy, useProfileData } from './hooks';
import { getRepositories } from '../../state/storage';
import { refreshReminders } from './reminders';
import { pushPlanMetadata } from './serverSync';
import { PAIN_AREAS, initials, parseBirthYear } from './model';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type PainChoice = PainArea | 'none';
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function EditProfileScreen() {
  const nav = useNavigation<Nav>();
  const { profile, loading, save } = useProfileData();
  const [name, setName] = useState('');
  const [born, setBorn] = useState('');
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [pain, setPain] = useState<PainArea[]>([]);
  const [errors, setErrors] = useState<{ born?: string }>({});
  const [hError, setHError] = useState<string | undefined>();
  const [wError, setWError] = useState<string | undefined>();
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
      setHeightCm(profile.heightCm ?? null);
      setWeightKg(profile.weightKg ?? null);
      setSex(profile.sex);
      setPain(profile.painAreas);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loading, filled, profile]);

  const back = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main'));

  const submit = () =>
    run(async () => {
      const b = parseBirthYear(born);
      setErrors({ born: b.error });
      if (b.error || hError || wError) return;
      const painChanged = !sameSet(profile?.painAreas ?? [], pain);
      await save({
        name: name.trim() || null,
        birthYear: b.value,
        heightCm,
        weightKg,
        sex,
        painAreas: pain,
      });
      if (painChanged) {
        // Pain areas stay on the phone (the API rejects them); the plan metadata is queued again
        // and the reminder text follows the plan. Neither waits on the network.
        const plan = await getRepositories().plan.get();
        void pushPlanMetadata(plan);
        void refreshReminders();
      }
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
      <HeightInput
        key={`h-${filled}`}
        valueCm={heightCm}
        optional
        testID="edit-height"
        onChange={(cm, err) => {
          setHeightCm(cm);
          setHError(err);
        }}
      />
      <WeightInput
        key={`w-${filled}`}
        valueKg={weightKg}
        optional
        testID="edit-weight"
        onChange={(kg, err) => {
          setWeightKg(kg);
          setWError(err);
        }}
      />

      <View style={{ gap: space.s }}>
        <SectionLabel title="Gender" hint="Used only for step and calorie estimates. You can skip it." />
        <ChipGroup
          label="Gender"
          options={GENDER_OPTIONS}
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
