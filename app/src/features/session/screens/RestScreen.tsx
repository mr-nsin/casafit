import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { dark, radius, space, type } from '../../../theme';
import { Btn, Screen, TimerRing, TopBar } from '../components';
import { useSessionScreen } from '../hooks';
import { useSessionStore } from '../store';
import { formatClock } from '../view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function RestScreen() {
  const nav = useNavigation<Nav>();
  const v = useSessionScreen('Rest');
  const feelPending = useSessionStore((s) => s.feelPending);

  // After the middle move, offer the Feel sheet once. The timer keeps running under it.
  useEffect(() => {
    if (feelPending && v.kind === 'rest') {
      useSessionStore.getState().openFeel();
      nav.navigate('Feel');
    }
  }, [feelPending, v.kind, nav]);

  const act = useSessionStore.getState;
  const secs = Math.ceil(v.segmentRemainingMs / 1000);
  const next = v.upNext;
  const done = v.set >= v.sets ? `${v.moveLabel.replace(/ of .*/, '')} ${v.moveNumber} of ${v.moveCount} done` : `Set ${v.set} of ${v.sets} done`;

  return (
    <Screen>
      <TopBar
        title={done}
        onClose={() => {
          act().requestEnd();
          nav.navigate('EndSession');
        }}
      />
      <Text style={[type.headline, { color: dark.on, textAlign: 'center' }]} accessibilityRole="header">
        Rest
      </Text>
      <View style={{ alignItems: 'center', marginVertical: space.xl }}>
        <TimerRing
          remainingMs={v.segmentRemainingMs}
          totalMs={v.segmentTotalMs}
          centre={formatClock(v.segmentRemainingMs)}
          sub={`of ${formatClock(v.segmentTotalMs)} rest`}
          label={`${secs} seconds of rest left`}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: space.s, justifyContent: 'center' }}>
        <View style={{ flex: 1 }}>
          <Btn label="+15s" kind="outline" onPress={() => act().addRest(15)} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="+30s" kind="outline" onPress={() => act().addRest(30)} />
        </View>
      </View>
      {next ? (
        <View style={{ backgroundColor: dark.c3, borderRadius: radius.l, padding: space.l, marginTop: space.xl }}>
          <Text style={[type.label, { color: dark.osv }]}>Up next</Text>
          <Text style={[type.title, { color: dark.on }]}>{next.name}</Text>
          <Text style={[type.bodySmall, { color: dark.osv }]}>{`Set ${next.set} of ${next.sets} . ${next.workS} sec`}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      <Btn label="Skip rest" height={56} onPress={() => act().skipRest()} />
    </Screen>
  );
}
