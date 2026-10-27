// Player (normal), Yoga and Dance share one stage layout: they are views of the same store.

import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { dark, space, type } from '../../../theme';
import { BigTimer, Btn, IconBtn, InfoNote, RadioGroup, RUNG_OPTIONS, Screen, SegmentedProgress, Stage, TimerRing, TopBar } from '../components';
import { getSessionDeps } from '../deps';
import { useSessionScreen, type SessionRouteName } from '../hooks';
import { useSessionStore } from '../store';
import type { Rung } from '../types';
import { formatClock } from '../view';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Variant = 'normal' | 'yoga' | 'dance';

const COPY: Record<Variant, { unit: string; options: { value: Rung; label: string }[]; label: string; caption: string }> = {
  normal: {
    unit: 'Move',
    options: RUNG_OPTIONS,
    label: 'Intensity',
    caption: 'Changes start from the next set and shape next week',
  },
  yoga: {
    unit: 'Pose',
    options: [
      { value: -1, label: 'Gentler' },
      { value: 0, label: 'As planned' },
      { value: 1, label: 'Deeper' },
    ],
    label: 'Pose depth',
    caption: 'Changes start from the next pose',
  },
  dance: {
    unit: 'Step',
    options: [
      { value: 0, label: 'Low impact' },
      { value: 1, label: 'High impact' },
    ],
    label: 'Impact',
    caption: 'Low impact has no jumping. Switch any time.',
  },
};

export function StageScreen({ variant, route }: { variant: Variant; route: SessionRouteName }) {
  const nav = useNavigation<Nav>();
  const v = useSessionScreen(route);
  const quiet = useSessionStore((s) => s.prefs.quiet);
  const copy = COPY[variant];

  const act = useSessionStore.getState;
  const step = v.step;
  if (!step) {
    return (
      <Screen>
        <TopBar title="Session" subtitle="No session running" onClose={() => nav.goBack()} closeLabel="Close" />
        <InfoNote>Start a session from Home to see it here.</InfoNote>
      </Screen>
    );
  }

  const info = getSessionDeps().content.exercise(step.exerciseId);
  const cue = info?.cue ?? '';
  const total = v.segmentTotalMs;
  const kindWord = v.kind === 'transition' ? 'Get ready' : v.kind === 'rest' ? 'Rest' : step.mode === 'hold' ? 'Hold' : 'Work';
  const pill =
    variant === 'dance' && info?.bpm
      ? `Beat ${info.bpm}`
      : v.kind === 'transition'
        ? 'Up next'
        : `Set ${v.set} of ${v.sets}${v.side ? ` . ${v.side === 'R' ? 'Right' : 'Left'} side` : ''}`;
  const sub = `${kindWord} . ${formatClock(v.sessionRemainingMs)} left`;
  const options = variant === 'dance' && quiet ? copy.options.map((o) => (o.value === 1 ? { ...o, disabled: true } : o)) : copy.options;
  const unitProgress = `${copy.unit} ${v.moveNumber} of ${v.moveCount}`;
  const header = v.phase === 'work' ? unitProgress : v.moveLabel;

  const end = () => {
    act().requestEnd();
    nav.navigate('EndSession');
  };

  return (
    <Screen>
      <TopBar
        title={header}
        subtitle={v.title}
        onClose={end}
        trailing={<IconBtn label="Edit session" glyph="=" onPress={() => nav.navigate('Editor')} />}
      />
      <SegmentedProgress segments={v.progress} label={`Session progress, ${header}`} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.l }} showsVerticalScrollIndicator={false}>
        <Stage
          name={step.name}
          description={info?.alt ?? `${step.name} demonstration`}
          pill={pill}
          height={variant === 'yoga' ? 240 : 220}
        />
        <Text style={[type.headline, { color: dark.on, fontSize: 32, lineHeight: 38 }]} accessibilityRole="header">
          {step.name}
        </Text>
        {cue ? <Text style={[type.body, { color: dark.osv, marginBottom: space.m }]}>{cue}</Text> : null}

        {variant === 'yoga' ? (
          <View style={{ alignItems: 'center', marginVertical: space.m }}>
            <TimerRing
              size={160}
              remainingMs={v.segmentRemainingMs}
              totalMs={total}
              centre={formatClock(v.segmentRemainingMs)}
              sub={info?.breath ? `Breathe in for ${info.breath.inS}, out for ${info.breath.outS}` : 'Breathe'}
              label={`${formatClock(v.segmentRemainingMs)} left in this ${kindWord.toLowerCase()}`}
            />
          </View>
        ) : (
          <View style={{ marginVertical: space.m }}>
            <BigTimer text={formatClock(v.segmentRemainingMs)} caption={sub} />
          </View>
        )}

        <RadioGroup
          label={copy.label}
          options={options}
          value={v.rung}
          onChange={(r) => act().setRung(r)}
        />
        <Text style={[type.bodySmall, { color: dark.osv, marginTop: space.s, marginBottom: space.m }]}>{copy.caption}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
          <IconBtn label="Previous move" glyph="<" tone="tonal" size={56} onPress={() => act().previous()} />
          <IconBtn label="Pause" glyph="II" tone="filled" size={variant === 'normal' ? 96 : 80} onPress={() => act().pause('user')} />
          <IconBtn label="Next move" glyph=">" tone="tonal" size={56} onPress={() => act().skipMove()} />
        </View>

        {variant === 'normal' ? (
          <View style={{ flexDirection: 'row', gap: space.s, marginTop: space.l }}>
            <View style={{ flex: 1 }}>
              <Btn label="+15s rest" kind="outline" onPress={() => act().addRest(15)} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="+30s rest" kind="outline" onPress={() => act().addRest(30)} />
            </View>
          </View>
        ) : null}
        {variant === 'normal' && step.formCheckable ? (
          <View style={{ marginTop: space.s }}>
            <Btn
              label="Check form"
              kind="tonal"
              onPress={() => {
                act().pause('camera');
                nav.navigate('CameraPermission');
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
