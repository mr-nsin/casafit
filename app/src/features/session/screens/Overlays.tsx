// Overlay routes: EndSession (dialog), Feel (sheet) and SessionSettings (sheet).

import { useEffect } from 'react';
import { BackHandler, Pressable, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { dark, radius, space, type } from '../../../theme';
import { Btn, InfoNote, RadioGroup, styles as base } from '../components';
import { useSessionView } from '../hooks';
import { movesDone, useSessionStore } from '../store';
import type { FeelValue } from '../types';
import { formatClock } from '../view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Scrim({ children, align }: { children: React.ReactNode; align: 'center' | 'bottom' }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: align === 'center' ? 'center' : 'flex-end',
        padding: align === 'center' ? space.xl : 0,
      }}
    >
      {children}
    </View>
  );
}

export function EndSessionScreen() {
  const nav = useNavigation<Nav>();
  const v = useSessionView();
  const status = useSessionStore((s) => s.status);
  const act = useSessionStore.getState;

  // Android back means keep going.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      act().keepGoing();
      return false;
    });
    return () => sub.remove();
  }, [act]);

  // Leave the dialog once it has been answered.
  useEffect(() => {
    if (status === 'active' || status === 'paused') nav.goBack();
    else if (status === 'ended') {
      nav.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }, [status, nav]);

  const done = movesDone(useSessionStore.getState(), v.elapsedMs);
  const total = useSessionStore.getState().plan?.steps.filter((x) => x.phase === 'work').length ?? 0;
  const spent = formatClock(useSessionStore.getState().activeMs);

  return (
    <Scrim align="center">
      <View
        accessibilityRole="alert"
        accessibilityViewIsModal
        style={{ backgroundColor: dark.c3, borderRadius: radius.xl, padding: space.xxl, gap: space.m }}
      >
        <Text style={[type.headline, { color: dark.on }]} accessibilityRole="header">
          End this session?
        </Text>
        <Text style={[type.body, { color: dark.osv }]}>
          {`You finished ${done} of ${total} moves in ${spent}. Save it and come back within 24 hours, or end it now.`}
        </Text>
        <Btn label="Keep going" onPress={() => act().keepGoing()} />
        <Btn label="Save and finish later" kind="tonal" onPress={() => void act().saveForLater()} />
        <Btn label="End without saving" kind="outline" onPress={() => void act().endWithoutSaving()} />
      </View>
    </Scrim>
  );
}

const FEEL: { value: FeelValue; title: string; sub: string }[] = [
  { value: 'easy', title: 'Easy', sub: 'Go harder' },
  { value: 'good', title: 'Good', sub: 'Keep it' },
  { value: 'hard', title: 'Hard', sub: 'Ease off' },
];

export function FeelScreen() {
  const nav = useNavigation<Nav>();
  const v = useSessionView();
  const act = useSessionStore.getState;

  // The sheet never outlives the rest it was shown in.
  useEffect(() => {
    if (v.status === 'idle' || v.kind !== 'rest') nav.goBack();
  }, [v.kind, v.status, nav]);

  const answer = (value: FeelValue | null) => {
    act().answerFeel(value);
    nav.goBack();
  };

  return (
    <Scrim align="bottom">
      <View
        accessibilityViewIsModal
        style={{ backgroundColor: dark.c3, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xxl, gap: space.m }}
      >
        <Text style={[type.headline, { color: dark.on }]} accessibilityRole="header">
          How does this feel?
        </Text>
        <Text style={[type.bodySmall, { color: dark.osv }]}>
          One tap changes your next set. Your answer also shapes next week.
        </Text>
        {FEEL.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={`${o.title}. ${o.sub}`}
            onPress={() => answer(o.value)}
            style={({ pressed }) => [
              {
                minHeight: 56,
                borderRadius: radius.l,
                backgroundColor: dark.c4,
                paddingHorizontal: space.l,
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[type.title, { color: dark.on }]}>{o.title}</Text>
            <Text style={[type.bodySmall, { color: dark.osv }]}>{o.sub}</Text>
          </Pressable>
        ))}
        <Btn label="Skip" kind="text" onPress={() => answer(null)} />
      </View>
    </Scrim>
  );
}

function SettingRow({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
      <View style={{ flex: 1 }}>
        <Text style={[type.title, { color: dark.on }]}>{title}</Text>
        <Text style={[type.bodySmall, { color: dark.osv }]}>{sub}</Text>
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: dark.p, false: dark.sv }}
        thumbColor={dark.on}
      />
    </View>
  );
}

export function SessionSettingsScreen() {
  const nav = useNavigation<Nav>();
  const prefs = useSessionStore((s) => s.prefs);
  const set = useSessionStore.getState().setPrefs;

  return (
    <Scrim align="bottom">
      <View
        accessibilityViewIsModal
        style={{ backgroundColor: dark.c3, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xxl, gap: space.s }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[type.headline, { color: dark.on, flex: 1 }]} accessibilityRole="header">
            Sound and voice
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => nav.goBack()}
            style={[base.iconBtn, { width: 48, height: 48 }]}
          >
            <Text style={{ color: dark.on, fontSize: 18, fontWeight: '700' }}>X</Text>
          </Pressable>
        </View>
        <SettingRow title="Voice coach" sub="Cues and count-ins, screen off too" value={prefs.voice} onChange={(voice) => set({ voice })} />
        <SettingRow
          title="Lower music while the coach talks"
          sub="Your music keeps playing"
          value={prefs.duck}
          onChange={(duck) => set({ duck })}
        />
        <SettingRow
          title="Quiet mode"
          sub="No jumping moves. Vibration instead of beeps."
          value={prefs.quiet}
          onChange={(quiet) => set({ quiet })}
        />
        <Text style={[type.title, { color: dark.on, marginTop: space.s }]}>Rest between sets</Text>
        <RadioGroup
          label="Rest between sets"
          value={prefs.restS === 10 ? 15 : prefs.restS}
          options={[
            { value: 15, label: '15 s' },
            { value: 20, label: '20 s' },
            { value: 30, label: '30 s' },
          ]}
          onChange={(restS) => set({ restS })}
        />
        <InfoNote>Longer rests may push today past 15 minutes. We show the new total before you start.</InfoNote>
      </View>
    </Scrim>
  );
}
