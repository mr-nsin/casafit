// Privacy and data (m3-privacy): one switch per purpose, export, notice, delete.
// Turning a purpose off appends a withdrawal record and deletes what we hold for it on this phone.

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import type { ConsentPurpose } from '../../db/repositories';
import { useConsent } from '../../state/consent';
import { getRepositories } from '../../state/storage';
import { ConsentRow, ConsentSheet, InfoBanner, ListRow, SectionHeader, StatusBanner } from '../../ui';
import { Page } from './Page';
import { useDataExport } from './hooks';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Purpose = Exclude<ConsentPurpose, 'terms_privacy'>;

const ROWS: { purpose: Purpose; icon: string; title: string; subtitle: string; label: string; consequence: string }[] = [
  {
    purpose: 'health_answers',
    icon: 'favorite',
    title: 'Health answers',
    subtitle: 'Pain areas and health flags, to keep your plan safe',
    label: 'health answers',
    consequence: 'We delete your pain areas and health answers from this phone. Until you add them again, your plan cannot leave out moves that may not suit you.',
  },
  {
    purpose: 'steps',
    icon: 'directions_walk',
    title: 'Step count',
    subtitle: "From your phone's sensor or Health Connect. No GPS.",
    label: 'step count',
    consequence: 'We stop counting your steps and delete the step history on this phone.',
  },
  {
    purpose: 'camera',
    icon: 'photo_camera',
    title: 'Camera for form checks',
    subtitle: 'Only while a check runs. Nothing is recorded.',
    label: 'the camera',
    consequence: 'Form checks stay off until you turn this back on. Nothing was ever recorded.',
  },
  {
    purpose: 'analytics',
    icon: 'insights',
    title: 'App improvement',
    subtitle: 'Anonymous usage counts. No health values.',
    label: 'app improvement',
    consequence: 'We stop sending anonymous usage counts.',
  },
];

/** Deletes what we hold for a purpose when it is withdrawn. */
async function purge(purpose: Purpose): Promise<void> {
  const repos = getRepositories();
  if (purpose === 'health_answers') await repos.profile.save({ painAreas: [], healthFlags: [] });
  if (purpose === 'steps') await repos.steps.purge();
}

export function PrivacyScreen() {
  const nav = useNavigation<Nav>();
  const latest = useConsent((s) => s.latest);
  const [asking, setAsking] = useState<(typeof ROWS)[number] | null>(null);
  const exporter = useDataExport();

  useEffect(() => {
    void useConsent.getState().hydrate();
  }, []);

  const change = async (purpose: Purpose, on: boolean) => {
    if (!on) await purge(purpose);
    await useConsent.getState().record(purpose, on, 'privacy_screen');
  };

  return (
    <Page topBar={{ title: 'Privacy and data', leading: 'back', onLeading: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main')) }}>
      <InfoBanner icon="verified_user">Each permission is separate. Turn one off and we stop using that data and delete what we hold.</InfoBanner>

      <View>
        <SectionHeader title="What you have allowed" />
        {ROWS.map((r) => (
          <ConsentRow
            key={r.purpose}
            icon={r.icon}
            purpose={r.title}
            subtitle={r.subtitle}
            value={latest[r.purpose]?.granted === true}
            onChange={(on) => (on ? void change(r.purpose, true) : setAsking(r))}
          />
        ))}
      </View>

      <View>
        <SectionHeader title="Your data" />
        <ListRow
          icon="download"
          title="Download my data"
          subtitle={exporter.busy ? 'Getting your data...' : exporter.done ? 'Ready. Choose where to save it.' : undefined}
          onPress={exporter.busy ? undefined : () => void exporter.start()}
        />
        {exporter.message ? <StatusBanner variant="info" icon="cloud_off">{exporter.message}</StatusBanner> : null}
        <ListRow icon="description" title="Read the privacy notice" onPress={() => nav.navigate('Help', { open: 'privacy' })} />
        <ListRow icon="delete" title="Delete my account and data" destructive onPress={() => nav.navigate('DeleteAccount')} />
      </View>

      <ConsentSheet
        visible={asking !== null}
        purpose={asking?.label ?? ''}
        consequence={asking?.consequence ?? ''}
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          const a = asking;
          setAsking(null);
          if (a) void change(a.purpose, false);
        }}
      />
    </Page>
  );
}
