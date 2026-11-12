import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { dark, radius, space, type } from '../../../theme';
import { Btn, Notice, Screen, TimerRing, TopBar } from '../components';
import { getSessionDeps } from '../deps';
import { restNotice } from '../feedback';
import { useSessionScreen } from '../hooks';
import { MAX_EXTRA_REST_MS, restTarget, useSessionStore } from '../store';
import { formatClock } from '../view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function RestScreen() {
  const nav = useNavigation<Nav>();
  const v = useSessionScreen('Rest');
  const feelPending = useSessionStore((s) => s.feelPending);
  const [notice, setNotice] = useState<string | null>(null);

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
  const rt = restTarget(useSessionStore.getState(), getSessionDeps().clock.now());
  const restOff = !rt || rt.atMax;
  const addRest = (s: 15 | 30) => setNotice(restNotice(act().addRest(s)));
  const done = v.set >= v.sets ? `Move ${v.moveNumber} of ${v.moveCount} done` : `Set ${v.set} of ${v.sets} done`;

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
          <Btn label="+15s" kind="outline" disabled={restOff} onPress={() => addRest(15)} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="+30s" kind="outline" disabled={restOff} onPress={() => addRest(30)} />
        </View>
      </View>
      <Notice text={notice} />
      {rt && rt.atMax ? (
        <Text style={[type.bodySmall, { color: dark.osv, textAlign: 'center', marginTop: space.s }]}>
          {`This rest already has the most extra time (${MAX_EXTRA_REST_MS / 1000} s).`}
        </Text>
      ) : rt && rt.extraMs > 0 ? (
        <Text style={[type.bodySmall, { color: dark.osv, textAlign: 'center', marginTop: space.s }]}>{`Extra rest so far: +${rt.extraMs / 1000}s`}</Text>
      ) : null}
      {next ? (
        <View style={{ backgroundColor: dark.c3, borderRadius: radius.l, padding: space.l, marginTop: space.xl }}>
          <Text style={[type.label, { color: dark.osv }]}>Up next</Text>
          <Text style={[type.title, { color: dark.on }]}>{next.name}</Text>
          <Text style={[type.bodySmall, { color: dark.osv }]}>{`Set ${next.set} of ${next.sets} · ${next.workS} sec`}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      <Btn label="Skip rest" height={56} onPress={() => act().skipRest()} />
    </Screen>
  );
}
