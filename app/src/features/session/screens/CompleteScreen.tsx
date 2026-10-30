import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { dark, radius, space, type } from '../../../theme';
import { Icon } from '../../../ui';
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
  return (
    <View style={{ flex: 1, backgroundColor: dark.c3, borderRadius: radius.l, padding: space.l, alignItems: 'center' }}>
      <Text style={[type.headline, { color: dark.on, fontVariant: ['tabular-nums'] }]}>{value}</Text>
      <Text style={[type.bodySmall, { color: dark.osv }]}>{caption}</Text>
    </View>
  );
}

export function CompleteScreen() {
  const nav = useNavigation<Nav>();
  useSessionRouting('Complete');
  const title = useSessionStore((s) => s.plan?.title ?? '');
  const activeMs = useSessionStore((s) => s.activeMs);
  const done = movesDone(useSessionStore.getState(), Number.MAX_SAFE_INTEGER);
  // Design preselects "About right". That is the value we store if the user leaves it.
  const [felt, setFelt] = useState<Felt>('about_right');
  const leaving = useRef(false);

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
        <View style={{ alignItems: 'center', gap: space.s }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: dark.pc, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={52} color="opc" />
          </View>
          <Text style={[type.display, { color: dark.on }]} accessibilityRole="header">
            Session done
          </Text>
          <Text style={[type.body, { color: dark.osv }]}>{title}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <Stat value={formatClock(activeMs)} caption="Total time" />
          <Stat value={String(done)} caption="Moves" />
        </View>
        <Text style={[type.title, { color: dark.on }]}>How did it feel?</Text>
        <RadioGroup label="How did it feel?" options={FELT} value={felt} onChange={setFelt} />
        <Text style={[type.bodySmall, { color: dark.osv }]}>This shapes next week. You can change it later.</Text>
      </ScrollView>
      <View style={{ gap: space.s }}>
        <Btn label="Done" height={56} onPress={() => void leave('home')} />
        <Btn label="Log a meal" kind="tonal" onPress={() => void leave('meal')} />
      </View>
    </Screen>
  );
}
