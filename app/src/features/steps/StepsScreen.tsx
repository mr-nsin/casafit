// Mirrors project/m3-steps.dc.html. Walk modes: normal and brisk are always on (they are
// how counting works, not switches); reverse is opt-in and hidden when a health flag, age
// or balance concern blocks it. No GPS.

import type React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { stepsToGo, BRISK_GOAL_MINUTES } from '../../engine';
import {
  BottomNav,
  Card,
  Badge,
  Icon,
  InfoNote,
  SectionLabel,
  StatTile,
  StepRing,
  Text,
  TextButton,
  TonalButton,
  TopBar,
  WeekBars,
  radius,
  space,
  useTokens,
  type TabKey,
} from '../../ui';
import { useStepsData, type StepsData } from './hooks';
import { formatCount, reverseHidden } from './model';
import { Page } from './Page';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TAB_TARGET = { workout: 'Workout', nutrition: 'Nutrition', progress: 'Progress' } as const;

/** One calm card per paused state: a title, one sentence, one button. Never red, never shaming. */
export function pausedCopy(p: StepsData['permission']): { title: string; body: string; action?: string } | null {
  switch (p) {
    case 'granted':
    case 'unknown':
      return null;
    case 'needs_primer':
      return { title: 'Count your steps too', body: 'Walks count on rest days. Turn on step counting when you are ready.', action: 'Set up steps' };
    case 'denied_can_ask':
      return { title: 'Step counting is off', body: 'Your workouts and food tracking work without it. You can try again any time.', action: 'Try again' };
    case 'denied_permanent':
      return { title: 'Step counting is paused', body: 'Your phone will not ask again. It takes about 20 seconds in Settings.', action: 'Turn on in Settings' };
    case 'hc_update_required':
      return { title: 'Health Connect needs an update', body: 'Update it from your app store, or use the phone step sensor instead.', action: 'See options' };
    case 'hc_unavailable':
      return { title: 'Steps are not available here', body: 'This phone cannot share steps with CasaFit right now. Everything else still works.' };
  }
}

export function StepsScreen() {
  const nav = useNavigation<Nav>();
  const t = useTokens();
  const d = useStepsData();
  const paused = pausedCopy(d.permission);
  const toGo = stepsToGo(d.steps, d.goal);
  const met = d.steps >= d.goal;
  const hideReverse = reverseHidden(d.reverse);
  const capped = !d.reverse.allowed && d.reverse.reason === 'daily_cap';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Page
        top={<TopBar title="Daily steps" onLeading={() => nav.goBack()} />}
      >
        {paused ? (
          <Card tone="sc">
            <View style={{ gap: space.s }} testID="steps-paused-card">
              <Text variant="title" color="osc" accessibilityRole="header">
                {paused.title}
              </Text>
              <Text color="osc">{paused.body}</Text>
              {paused.action ? <TonalButton label={paused.action} height={48} onPress={() => nav.navigate('StepsPermission')} /> : null}
            </View>
          </Card>
        ) : null}

        <View style={{ alignItems: 'center', opacity: d.stale ? 0.6 : 1 }}>
          <StepRing
            value={d.steps}
            max={d.goal}
            size={192}
            stroke={20}
            a11yLabel={`${formatCount(d.steps)} of ${formatCount(d.goal)} steps today${d.stale ? ', last count' : ''}`}
            center={
              <View style={{ alignItems: 'center' }}>
                <Text variant="display" tabular>
                  {formatCount(d.steps)}
                </Text>
                <Text color="osv">{`of ${formatCount(d.goal)}`}</Text>
              </View>
            }
          />
        </View>

        <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
          <StatTile value={d.briskMinutes} suffix={`/ ${BRISK_GOAL_MINUTES}`} label="Brisk minutes" tone="tc" />
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Badge tone="tc" label={met ? 'Goal reached' : `${formatCount(toGo)} to go`} />
          </View>
        </View>

        <View style={{ gap: space.s }}>
          <SectionLabel title="This week" hint={`Goal ${formatCount(d.goal)}`} />
          <WeekBars values={d.week.values} labels={d.week.labels} goal={d.goal} highlightIndex={6} a11yLabels={d.week.a11yLabels} />
        </View>

        <View style={{ gap: space.xs }}>
          <SectionLabel title="Walk modes" />
          <WalkRow icon="directions_walk" title="Normal walk" subtitle="Counted all day in the background" trailing={<OnBadge />} />
          <WalkRow icon="bolt" title="Brisk walk" subtitle="About 100 steps a minute or faster" trailing={<OnBadge />} />
          {hideReverse ? null : (
            <WalkRow
              icon="undo"
              title="Reverse walk"
              subtitle={capped ? 'Done for today. Back tomorrow' : 'Opt-in. Safety check first, 15 min a day max'}
              trailing={capped ? null : <TextButton label="Try" onPress={() => nav.navigate('Reverse')} />}
            />
          )}
        </View>

        <InfoNote icon="location_off" text="No GPS. Counted by your phone's step sensor or Health Connect." />
      </Page>
      <BottomNav current={null} onSelect={(k: TabKey) => nav.navigate('Main', { screen: TAB_TARGET[k] })} />
    </View>
  );
}

function OnBadge() {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: t.tc, borderRadius: radius.s, paddingHorizontal: space.m, paddingVertical: space.xs }} accessible accessibilityLabel="On">
      <Icon name="check" size={16} color="otc" />
      <Text variant="labelStrong" color="otc">
        On
      </Text>
    </View>
  );
}

/** Not pressable as a whole: the trailing control is the only target, so it stays reachable. */
function WalkRow({ icon, title, subtitle, trailing }: { icon: string; title: string; subtitle: string; trailing?: React.ReactNode }) {
  return (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.l, paddingHorizontal: space.l }}>
      <Icon name={icon} color="osv" />
      <View style={{ flex: 1 }} accessible accessibilityLabel={`${title}, ${subtitle}`}>
        <Text>{title}</Text>
        <Text variant="bodySmall" color="osv">
          {subtitle}
        </Text>
      </View>
      {trailing}
    </View>
  );
}
