import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { Icon, Text, curve, haptic, radius, space, useTokens } from '../../../ui';
import { Btn, IconBtn, RadioGroup, Screen } from '../components';
import { useSessionRouting } from '../hooks';
import { movesDone, useSessionStore } from '../store';
import type { Felt } from '../types';
import { formatClock } from '../view';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FELT: { value: Felt; label: string }[] = [
  { value: 'easy', label: 'Too easy' },
  { value: 'about_right', label: 'About right' },
  { value: 'hard', label: 'Too hard' },
];

function Stat({ value, caption }: { value: string; caption: string }) {
  const t = useTokens();
  return (
    <View style={{ flex: 1, backgroundColor: t.c3, borderRadius: radius.xl, ...curve, padding: space.l, alignItems: 'center', gap: space.xs }}>
      {/* A UI-face numeral, not the display serif: tabular figures line up across the two cards. */}
      <Text variant="title" tabular style={{ fontSize: 32, lineHeight: 38 }}>
        {value}
      </Text>
      <Text variant="bodySmall" color="osv">
        {caption}
      </Text>
    </View>
  );
}

/** The finish mark: a warm disc with a check, sitting in a soft halo of the card surface. */
function DoneBadge() {
  const t = useTokens();
  return (
    <View style={{ width: 112, height: 112, borderRadius: radius.round, backgroundColor: t.c3, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 88, height: 88, borderRadius: radius.round, backgroundColor: t.pc, borderWidth: 1, borderColor: t.edge, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={48} color="opc" />
      </View>
    </View>
  );
}

export function CompleteScreen() {
  const nav = useNavigation<Nav>();
  useSessionRouting('Complete');
  const title = useSessionStore((s) => s.plan?.title ?? '');
  const activeMs = useSessionStore((s) => s.activeMs);
  const finished = useSessionStore((s) => s.status === 'complete' && !s.trial);
  const done = movesDone(useSessionStore.getState(), Number.MAX_SAFE_INTEGER);
  // Design preselects "About right". That is the value we store if the user leaves it.
  const [felt, setFelt] = useState<Felt>('about_right');
  const leaving = useRef(false);

  // One success buzz, the first time this screen shows a finished session.
  const cheered = useRef(false);
  useEffect(() => {
    if (!finished || cheered.current) return;
    cheered.current = true;
    haptic('success');
  }, [finished]);

  const leave = async (to: 'home' | 'meal') => {
    if (leaving.current) return;
    leaving.current = true;
    await useSessionStore.getState().finalizeComplete(felt);
    useSessionStore.getState().reset();
    if (to === 'meal') nav.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Nutrition' } }] });
    else nav.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row' }}>
        <IconBtn label="Close" icon="close" onPress={() => void leave('home')} />
      </View>
      <ScrollView contentContainerStyle={{ gap: space.l, paddingBottom: space.l }}>
        <View style={{ alignItems: 'center', gap: space.s, marginTop: space.s }}>
          <DoneBadge />
          <Text variant="display" style={{ marginTop: space.s, textAlign: 'center' }} accessibilityRole="header">
            Session done
          </Text>
          <Text color="osv" style={{ textAlign: 'center' }}>
            {title}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <Stat value={formatClock(activeMs)} caption="Total time" />
          <Stat value={String(done)} caption="Moves" />
        </View>
        <Text variant="title">How did it feel?</Text>
        <RadioGroup label="How did it feel?" options={FELT} value={felt} onChange={setFelt} />
        <Text variant="bodySmall" color="osv">
          This shapes next week. You can change it later.
        </Text>
      </ScrollView>
      <View style={{ gap: space.s }}>
        <Btn label="Done" height={56} onPress={() => void leave('home')} />
        <Btn label="Log a meal" kind="tonal" onPress={() => void leave('meal')} />
      </View>
    </Screen>
  );
}
