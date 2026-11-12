// Player (normal), Yoga and Dance share one stage layout: they are views of the same store.

import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { dark, space, type } from '../../../theme';
import { resolveFormCheckEntry } from '../../formcheck/gate';
import { BigTimer, Btn, IconBtn, InfoNote, Notice, RadioGroup, RUNG_OPTIONS, Screen, SegmentedProgress, Stage, TimerRing, TopBar } from '../components';
import { getSessionDeps } from '../deps';
import { useSessionScreen, type SessionRouteName } from '../hooks';
import { exerciseIcon } from '../icons';
import { restNotice, rungNotice } from '../feedback';
import { MAX_EXTRA_REST_MS, restTarget, useSessionStore } from '../store';
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

const variantStyle = (v: Variant) => ({ style: v === 'normal' ? ('normal' as const) : v });

export function StageScreen({ variant, route }: { variant: Variant; route: SessionRouteName }) {
  const nav = useNavigation<Nav>();
  const v = useSessionScreen(route);
  const quiet = useSessionStore((s) => s.prefs.quiet);
  const copy = COPY[variant];
  const [notice, setNotice] = useState<string | null>(null);

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
  const ready = v.ready;
  const kindWord = v.kind === 'transition' ? 'Get ready' : v.kind === 'rest' ? 'Rest' : step.mode === 'hold' ? 'Hold' : 'Work';
  const pill =
    variant === 'dance' && info?.bpm
      ? `Beat ${info.bpm}`
      : v.kind === 'transition'
        ? 'Up next'
        : `Set ${v.set} of ${v.sets}${v.side ? ` · ${v.side === 'R' ? 'Right' : 'Left'} side` : ''}`;
  const sub = ready ? `Ready · ${formatClock(v.sessionRemainingMs)} in total` : `${kindWord} · ${formatClock(v.sessionRemainingMs)} left`;
  const options = variant === 'dance' && quiet ? copy.options.map((o) => (o.value === 1 ? { ...o, disabled: true } : o)) : copy.options;
  const unitProgress = `${copy.unit} ${v.moveNumber} of ${v.moveCount}`;
  const header = v.phase === 'work' ? unitProgress : v.moveLabel;
  const unitWord = copy.unit.toLowerCase();
  const atFirstMove = v.stepIndex === 0 && v.elapsedMs < 1000;
  const rt = restTarget(useSessionStore.getState(), getSessionDeps().clock.now());
  const restOff = !rt || rt.atMax;
  const restLine = !rt
    ? 'No rest left in this session.'
    : rt.atMax
      ? `That rest already has the most extra time (${MAX_EXTRA_REST_MS / 1000} s).`
      : rt.extraMs > 0
        ? `Extra rest so far: +${rt.extraMs / 1000}s ${rt.where === 'current' ? 'on this rest' : `on your next rest, after ${rt.after}`}`
        : null;

  const chooseRung = (r: Rung) => {
    act().setRung(r);
    const label = copy.options.find((o) => o.value === r)?.label ?? '';
    setNotice(rungNotice(useSessionStore.getState(), getSessionDeps().clock.now(), label, unitWord));
  };
  const addRest = (s: 15 | 30) => setNotice(restNotice(act().addRest(s)));

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
        trailing={<IconBtn label="Edit session" icon="tune" onPress={() => nav.navigate('Editor')} />}
      />
      <SegmentedProgress segments={v.progress} label={`Session progress, ${header}`} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.l }} showsVerticalScrollIndicator={false}>
        <Stage
          icon={info?.icon ?? exerciseIcon(variantStyle(variant))}
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
          onChange={chooseRung}
        />
        <Text style={[type.bodySmall, { color: dark.osv, marginTop: space.s }]}>{copy.caption}</Text>
        <Notice text={notice} />
        <View style={{ height: space.m }} />

        {ready ? (
          <View style={{ gap: space.m }}>
            <Text style={[type.body, { color: dark.on, textAlign: 'center' }]} accessibilityLiveRegion="polite">
              Get in position, then tap Start.
            </Text>
            <Btn label="Start" height={72} onPress={() => act().resume()} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
            <IconBtn
              label="Previous move"
              icon="skip_previous"
              tone="tonal"
              size={56}
              disabled={atFirstMove}
              hint={atFirstMove ? 'You are at the start of the first move' : undefined}
              onPress={() => act().previous()}
            />
            <IconBtn label="Pause" icon="pause" tone="filled" size={variant === 'normal' ? 96 : 80} onPress={() => act().pause('user')} />
            <IconBtn label="Next move" icon="skip_next" tone="tonal" size={56} onPress={() => act().skipMove()} />
          </View>
        )}

        {variant === 'normal' && !ready ? (
          <View style={{ marginTop: space.l }}>
            <View style={{ flexDirection: 'row', gap: space.s }}>
              <View style={{ flex: 1 }}>
                <Btn label="+15s rest" kind="outline" disabled={restOff} onPress={() => addRest(15)} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn label="+30s rest" kind="outline" disabled={restOff} onPress={() => addRest(30)} />
              </View>
            </View>
            {restLine ? <Text style={[type.bodySmall, { color: dark.osv, marginTop: space.s, textAlign: 'center' }]}>{restLine}</Text> : null}
          </View>
        ) : null}
        {variant === 'normal' && !ready && step.formCheckable ? (
          <View style={{ marginTop: space.s }}>
            <Btn
              label="Check form"
              kind="tonal"
              onPress={() => {
                act().pause('camera');
                // Permission, then balance: CameraPermission, CameraDenied, NoCredits or FormCheck.
                void resolveFormCheckEntry().then((route) => nav.navigate(route));
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
