// Permission primer and its follow-up states. One route; the variant follows the OS state:
//   needs_primer        m3-stepsperm
//   denied_can_ask      m3-stepsdenied
//   denied_permanent    m3-stepsblocked
//   hc_update_required / hc_unavailable   m3-stepshc
// Order matters (DPDP): the consent record is written first, then the OS prompt appears.

import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { useConsent } from '../../state/consent';
import {
  createLiveOnlyCounter,
  getStepCounter,
  setStepCounter,
  type StepPermissionState,
} from '../../services/step-counter';
import { FilledButton, InfoNote, PeopleIllustration, Text, TextButton, TopBar, space } from '../../ui';
import { Page } from './Page';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function StepsPermissionScreen() {
  const nav = useNavigation<Nav>();
  const [state, setState] = useState<StepPermissionState>('unknown');
  const [busy, setBusy] = useState(false);

  const recheck = useCallback(async () => {
    setState(await getStepCounter().getPermissionState());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recheck();
    // Coming back from Settings: read the OS again.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  useEffect(() => {
    if (state === 'granted') nav.replace('Steps');
  }, [state, nav]);

  const home = () => nav.navigate('Main');

  const ask = async () => {
    setBusy(true);
    try {
      if (!useConsent.getState().has('steps')) await useConsent.getState().record('steps', true, 'permission_primer');
      setState(await getStepCounter().requestPermission());
    } finally {
      setBusy(false);
    }
  };

  const useSensor = async () => {
    setStepCounter(createLiveOnlyCounter());
    await recheck();
  };

  const common = { onClose: home };

  if (state === 'denied_can_ask') {
    return (
      <Variant
        {...common}
        title="Step counting is off"
        body="You said no this time, and that is fine. Your workouts and food tracking work without it. Want to try again?"
        notes={[
          ['directions_walk', 'We read only your step count. No GPS, no location.'],
          ['undo', 'You can turn it off again any time in Privacy.'],
        ]}
        primary={{ label: 'Try again', onPress: ask, busy }}
        secondary={{ label: 'Not now', onPress: home }}
      />
    );
  }
  if (state === 'denied_permanent') {
    return (
      <Variant
        {...common}
        title="Turn on steps in Settings"
        body="Your phone will not ask again, so this one step happens in Settings. It takes about 20 seconds."
        notes={[
          ['looks_one', 'Open Settings, then Permissions'],
          ['looks_two', 'Choose Physical activity'],
          ['looks_3', 'Switch on CasaFit, then come back'],
        ]}
        primary={{ label: 'Open Settings', onPress: () => void getStepCounter().openSystemSettings() }}
        secondary={{ label: 'Not now', onPress: home }}
      />
    );
  }
  if (state === 'hc_update_required' || state === 'hc_unavailable') {
    return (
      <Variant
        {...common}
        title="Get Health Connect"
        body="Your phone needs a newer Health Connect to share steps with CasaFit. It is free from your app store."
        notes={[
          ['system_update', 'Install or update Health Connect, then return here.'],
          ['sensors', 'Prefer not to? Use your phone step sensor instead. It counts only while CasaFit is open.'],
        ]}
        primary={{ label: 'Get Health Connect', onPress: () => void getStepCounter().openSystemSettings() }}
        secondary={{ label: 'Use the step sensor instead', onPress: useSensor }}
      />
    );
  }
  return (
    <Variant
      {...common}
      art
      title="Count your steps too"
      body="Walks count on rest days. 7,000 steps a day gets most of the benefit."
      notes={[
        ['sensors', "Uses your phone's step sensor or Health Connect"],
        ['location_off', 'No GPS and no location, ever'],
      ]}
      primary={{ label: 'Allow step counting', onPress: ask, busy }}
      secondary={{ label: 'Not now', onPress: home }}
    />
  );
}

function Variant({
  title,
  body,
  notes,
  primary,
  secondary,
  onClose,
  art,
}: {
  title: string;
  body: string;
  notes: [string, string][];
  primary: { label: string; onPress: () => void | Promise<void>; busy?: boolean };
  secondary: { label: string; onPress: () => void | Promise<void> };
  onClose: () => void;
  art?: boolean;
}) {
  return (
    <Page
      top={<TopBar leading="close" onLeading={onClose} />}
      footer={
        <>
          <FilledButton label={primary.label} loading={primary.busy} onPress={() => void primary.onPress()} />
          <TextButton label={secondary.label} onPress={() => void secondary.onPress()} />
        </>
      }
    >
      {art ? (
        <View style={{ alignItems: 'center' }}>
          <PeopleIllustration pose="walk" a11yLabel="A person walking" />
        </View>
      ) : null}
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      <Text color="osv">{body}</Text>
      <View style={{ gap: space.s }}>
        {notes.map(([icon, text]) => (
          <InfoNote key={text} icon={icon} text={text} />
        ))}
      </View>
    </Page>
  );
}
