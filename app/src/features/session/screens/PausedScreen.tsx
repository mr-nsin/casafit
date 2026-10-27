import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { dark, radius, space, type } from '../../../theme';
import { Btn, InfoNote, Screen, TopBar } from '../components';
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

export function PausedScreen() {
  const nav = useNavigation<Nav>();
  const v = useSessionScreen('Paused');
  const act = useSessionStore.getState;
  const reason = v.pausedReason ? REASON[v.pausedReason] : undefined;

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
      <View style={{ alignItems: 'center', marginTop: space.xl }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: dark.pc, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: dark.opc, fontSize: 40, fontWeight: '800' }} importantForAccessibility="no">
            II
          </Text>
        </View>
        <Text style={[type.display, { color: dark.on, marginTop: space.l }]} accessibilityRole="header" accessibilityLiveRegion="polite">
          Paused
        </Text>
        {v.step ? (
          <View
            accessibilityRole="timer"
            style={{ backgroundColor: dark.c4, borderRadius: radius.round, paddingHorizontal: space.l, paddingVertical: space.s, marginTop: space.m }}
          >
            <Text style={[type.bodySmall, { color: dark.on, fontVariant: ['tabular-nums'] }]}>
              {`${v.step.name} . ${formatClock(v.segmentRemainingMs)} left`}
            </Text>
          </View>
        ) : null}
        {reason ? <Text style={[type.bodySmall, { color: dark.osv, marginTop: space.s }]}>{reason}</Text> : null}
      </View>
      <View style={{ marginTop: space.xl }}>
        <InfoNote>You can pick this session up again for the next 24 hours. Your time so far is saved.</InfoNote>
      </View>
      <View style={{ marginTop: space.m }}>
        <Btn label="Sound and voice" kind="text" onPress={() => nav.navigate('SessionSettings')} />
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ gap: space.s }}>
        <Btn label="Resume" height={56} onPress={() => act().resume()} />
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
