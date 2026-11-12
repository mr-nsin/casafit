// Overlay routes: EndSession (dialog), Feel (sheet) and SessionSettings (sheet).

import { useContext, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../../../app/types';
import { Text, Touchable, curve, fixed, radius, space, useTokens } from '../../../ui';
import { Btn, DarkScope, IconBtn, InfoNote, Notice, RadioGroup } from '../components';
import { useSessionView } from '../hooks';
import { movesDone, useSessionStore } from '../store';
import type { FeelValue } from '../types';
import { formatClock } from '../view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Scrim({ children, align }: { children: ReactNode; align: 'center' | 'bottom' }) {
  return (
    <DarkScope>
      <View
        style={{
          flex: 1,
          backgroundColor: fixed.scrim,
          justifyContent: align === 'center' ? 'center' : 'flex-end',
          padding: align === 'center' ? space.xl : 0,
        }}
      >
        {children}
      </View>
    </DarkScope>
  );
}

/** The dialog card. Lives inside the scrim so it reads the dark palette. */
function Dialog({ children }: { children: ReactNode }) {
  const t = useTokens();
  return (
    <View
      accessibilityRole="alert"
      accessibilityViewIsModal
      style={{ backgroundColor: t.c3, borderRadius: radius.xxl, ...curve, borderWidth: 1, borderColor: t.edge, padding: space.xxl, gap: space.m }}
    >
      {children}
    </View>
  );
}

/** A bottom sheet body: rounded top, clear of the gesture bar. */
function Sheet({ children, gap }: { children: ReactNode; gap: number }) {
  const t = useTokens();
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  return (
    <View
      accessibilityViewIsModal
      style={{
        backgroundColor: t.c3,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        ...curve,
        padding: space.xxl,
        paddingBottom: space.xxl + insets.bottom,
        gap,
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
      <Dialog>
        <Text variant="headline" accessibilityRole="header">
          End this session?
        </Text>
        <Text color="osv" tabular>
          {`You finished ${done} of ${total} moves in ${spent}. Save it and come back within 24 hours, or end it now.`}
        </Text>
        <Btn label="Keep going" onPress={() => act().keepGoing()} />
        <Btn label="Save and finish later" kind="tonal" onPress={() => void act().saveForLater()} />
        <Btn label="End without saving" kind="outline" onPress={() => void act().endWithoutSaving()} />
      </Dialog>
    </Scrim>
  );
}

const FEEL: { value: FeelValue; title: string; sub: string }[] = [
  { value: 'easy', title: 'Easy', sub: 'Go harder' },
  { value: 'good', title: 'Good', sub: 'Keep it' },
  { value: 'hard', title: 'Hard', sub: 'Ease off' },
];

function FeelOption({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  const t = useTokens();
  return (
    <Touchable
      label={`${title}. ${sub}`}
      onPress={onPress}
      minSize={64}
      haptic="select"
      spring={false}
      style={{ borderRadius: radius.xl, ...curve, backgroundColor: t.c4, paddingHorizontal: space.l, paddingVertical: space.s, justifyContent: 'center' }}
    >
      <Text variant="title">{title}</Text>
      <Text variant="bodySmall" color="osv">
        {sub}
      </Text>
    </Touchable>
  );
}

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
      <Sheet gap={space.m}>
        <Text variant="headline" accessibilityRole="header">
          How does this feel?
        </Text>
        <Text variant="bodySmall" color="osv">
          One tap changes your next set. Your answer also shapes next week.
        </Text>
        {FEEL.map((o) => (
          <FeelOption key={o.value} title={o.title} sub={o.sub} onPress={() => answer(o.value)} />
        ))}
        <Btn label="Skip" kind="text" onPress={() => answer(null)} />
      </Sheet>
    </Scrim>
  );
}

function SettingRow({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTokens();
  return (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.m }}>
      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        <Text variant="bodySmall" color="osv">
          {sub}
        </Text>
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.p, false: t.sv }}
        thumbColor={t.on}
      />
    </View>
  );
}

export function SessionSettingsScreen() {
  const nav = useNavigation<Nav>();
  const prefs = useSessionStore((s) => s.prefs);
  const set = useSessionStore.getState().setPrefs;
  const [restNote, setRestNote] = useState<string | null>(null);
  const chooseRest = (restS: 15 | 20 | 30) => {
    set({ restS });
    const s = useSessionStore.getState();
    const live = s.plan && (s.status === 'active' || s.status === 'paused' || s.status === 'confirm_end');
    setRestNote(live ? `Rest between sets is now ${restS} s, from your next rest.` : `Rest between sets is ${restS} s.`);
  };

  return (
    <Scrim align="bottom">
      <Sheet gap={space.s}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="headline" style={{ flex: 1 }} accessibilityRole="header">
            Sound and voice
          </Text>
          <IconBtn label="Close" icon="close" onPress={() => nav.goBack()} />
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
        <Text variant="title" style={{ marginTop: space.s }}>
          Rest between sets
        </Text>
        <RadioGroup
          label="Rest between sets"
          value={prefs.restS === 10 ? 15 : prefs.restS}
          options={[
            { value: 15, label: '15 s' },
            { value: 20, label: '20 s' },
            { value: 30, label: '30 s' },
          ]}
          onChange={chooseRest}
        />
        <Notice text={restNote} />
        <InfoNote>Applies from your next rest, not the one you are in. Longer rests may push today past 15 minutes.</InfoNote>
      </Sheet>
    </Scrim>
  );
}
