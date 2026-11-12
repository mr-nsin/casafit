import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { ExerciseVisual, Text, curve, radius, space, useTokens } from '../../../ui';
import { Btn, InfoNote, Screen, TopBar } from '../components';
import { getSessionDeps } from '../deps';
import { useSessionScreen } from '../hooks';
import { useSessionStore } from '../store';
import { formatClock } from '../view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const REASON: Record<string, string> = {
  call: 'Paused for a call.',
  background: 'Paused when you left the app.',
  headset: 'Paused when your headphones disconnected.',
  audio_focus: 'Paused because another app took the sound.',
  camera: 'Paused for your form check.',
};

/** Which move is waiting and how much of it is left. Nothing is counting while paused. */
function HeldPill({ text }: { text: string }) {
  const t = useTokens();
  return (
    <View
      accessibilityRole="timer"
      style={{ backgroundColor: t.c3, borderRadius: radius.round, ...curve, borderWidth: 1, borderColor: t.edge, paddingHorizontal: space.l, paddingVertical: space.s, marginTop: space.m }}
    >
      <Text variant="bodySmall" tabular>
        {text}
      </Text>
    </View>
  );
}

export function PausedScreen() {
  const nav = useNavigation<Nav>();
  const v = useSessionScreen('Paused');
  const act = useSessionStore.getState;
  const reason = v.pausedReason ? REASON[v.pausedReason] : undefined;
  const ready = v.ready;
  const alt = v.step ? getSessionDeps().content.exercise(v.step.exerciseId)?.alt : undefined;

  return (
    <Screen>
      <TopBar
        title={v.moveLabel}
        subtitle={v.title}
        onClose={() => {
          act().requestEnd();
          nav.navigate('EndSession');
        }}
      />
      <View style={{ alignItems: 'center', marginTop: space.l }}>
        {/* The move that is waiting, held still at its working pose. */}
        {v.step ? <ExerciseVisual exerciseId={v.step.exerciseId} size="card" label={alt} /> : null}
        <Text variant="display" style={{ marginTop: space.l }} accessibilityRole="header" accessibilityLiveRegion="polite">
          {ready ? 'Ready' : 'Paused'}
        </Text>
        {v.step ? <HeldPill text={`${v.step.name} · ${formatClock(v.segmentRemainingMs)} left`} /> : null}
        {ready ? (
          <Text variant="bodySmall" color="osv" style={{ marginTop: space.s, textAlign: 'center' }}>
            Get in position, then tap Start.
          </Text>
        ) : null}
        {reason ? (
          <Text variant="bodySmall" color="osv" style={{ marginTop: space.s, textAlign: 'center' }}>
            {reason}
          </Text>
        ) : null}
      </View>
      <View style={{ marginTop: space.xl }}>
        <InfoNote>
          {ready ? 'The clock starts when you tap Start.' : 'You can pick this session up again for the next 24 hours. Your time so far is saved.'}
        </InfoNote>
      </View>
      <View style={{ marginTop: space.m }}>
        <Btn label="Sound and voice" kind="text" onPress={() => nav.navigate('SessionSettings')} />
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ gap: space.s }}>
        <Btn label={ready ? 'Start' : 'Resume'} height={56} onPress={() => act().resume()} />
        <Btn label="Skip move" kind="tonal" onPress={() => act().skipMove()} />
        <Btn
          label="End session"
          kind="outline"
          onPress={() => {
            act().requestEnd();
            nav.navigate('EndSession');
          }}
        />
      </View>
    </Screen>
  );
}
