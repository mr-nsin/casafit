// Progress (m3-progress, m3-progressempty) and the weekly recap (m3-recap).
// Local only: derived from session_log and step_summary. No weight here (it is optional
// and shown only as a trend, which is not built yet).

import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import {
  Card,
  EmptyState,
  FilledButton,
  Heatmap,
  Icon,
  SectionLabel,
  StatTile,
  Text,
  TopBar,
  WeekBars,
  WeekDots,
  radius,
  space,
  useTokens,
} from '../../ui';
import { useProgress, useRecap } from './hooks';
import { formatCount, type ProgressView } from './model';
import { Page } from './Page';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Progress tab root. Shows the empty state until the first session is logged. */
export function ProgressScreen() {
  const { view } = useProgress();
  if (!view) return <Page top={<TopBar title="Progress" leading="none" />}>{null}</Page>;
  return view.empty ? <ProgressEmptyScreen /> : <ProgressBody view={view} />;
}

export function ProgressBody({ view }: { view: ProgressView }) {
  const t = useTokens();
  return (
    <Page top={<TopBar title="Progress" leading="none" />}>
      <View
        accessible
        accessibilityLabel={`${view.streak} day streak. Your best is ${view.best} days.`}
        style={{ backgroundColor: t.pc, borderRadius: radius.xl, padding: space.xl, gap: space.xs }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s }}>
          <Text variant="display" color="opc" tabular>
            {view.streak}
          </Text>
          <Text variant="title" color="opc">
            day streak
          </Text>
        </View>
        <Text color="opc">{`Your best is ${view.best} ${view.best === 1 ? 'day' : 'days'}`}</Text>
        <Text variant="bodySmall" color="opc">
          Rest days never break it.
        </Text>
      </View>

      <View style={{ gap: space.s }}>
        <SectionLabel title="This week" />
        <WeekDots days={view.weekDots.map((d) => ({ label: d.label, done: d.done }))} />
      </View>

      <View style={{ gap: space.s }}>
        <SectionLabel title="Last 4 weeks" />
        <Heatmap cells={view.heat} summary={view.heatSummary} />
        <Text variant="bodySmall" color="osv">
          {view.heatSummary}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: space.m }}>
        <StatTile value={view.sessions28} label={view.sessions28 === 1 ? 'Session' : 'Sessions'} tone="tc" />
        <StatTile value={view.minutes28} label="Minutes trained" tone="sc" />
      </View>
      {view.avgSteps !== null ? (
        <View style={{ flexDirection: 'row' }}>
          <StatTile value={formatCount(view.avgSteps)} label="Avg steps a day" tone="pc" />
        </View>
      ) : null}
    </Page>
  );
}

export function ProgressEmptyScreen() {
  const nav = useNavigation<Nav>();
  const t = useTokens();
  return (
    <Page
      top={<TopBar title="Progress" leading="none" />}
      footer={<FilledButton label="Start today's session" leadingIcon="play_arrow" onPress={() => nav.navigate('Main', { screen: 'Workout' })} />}
    >
      <EmptyState
        icon="flag"
        title="Your progress starts with session one"
        body="After your first workout you will see minutes, streaks and steps here. Weight is optional and shown only as a trend."
      />
      <SectionLabel title="What will show up here" />
      {/* Still skeletons: no looping shimmer (loops are for demo illustrations only). */}
      <View style={{ flexDirection: 'row', gap: space.m }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 72, borderRadius: radius.l, backgroundColor: t.c3 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s, height: 80 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[30, 50, 40, 64, 36, 56, 44].map((h, i) => (
          <View key={i} style={{ flex: 1, height: h, borderRadius: radius.s, backgroundColor: t.c3 }} />
        ))}
      </View>
    </Page>
  );
}

export function RecapScreen() {
  const nav = useNavigation<Nav>();
  const { view } = useRecap();
  if (!view) return <Page top={<TopBar leading="close" title="Recap" onLeading={() => nav.goBack()} />}>{null}</Page>;
  return (
    <Page
      top={<TopBar leading="close" title={`Week ${view.weekNumber} recap`} onLeading={() => nav.goBack()} />}
      footer={<FilledButton label="See next week" onPress={() => nav.navigate('WeekPlan')} />}
    >
      <View style={{ gap: space.xs }}>
        <Text variant="headline" accessibilityRole="header">
          {view.headline}
        </Text>
        <Text color="osv">{view.body}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.m }}>
        <StatTile value={view.workouts} label={view.workouts === 1 ? 'Workout' : 'Workouts'} tone="tc" />
        <StatTile value={view.activeMinutes} label="Active minutes" tone="sc" />
        {view.stepsPerDay !== null ? <StatTile value={formatCount(view.stepsPerDay)} label="Steps a day" tone="pc" /> : null}
      </View>
      {view.stepBars ? (
        <View style={{ gap: space.s }}>
          <SectionLabel title="Steps each day" />
          <WeekBars values={view.stepBars.values} labels={view.stepBars.labels} a11yLabels={view.stepBars.a11y} height={96} />
        </View>
      ) : null}
      {view.insights.map((i) => (
        <Card key={i.lead} tone="c3">
          <View style={{ flexDirection: 'row', gap: space.m }} accessible accessibilityLabel={`${i.lead} ${i.text}`}>
            <Icon name={i.icon} color="p" />
            <Text style={{ flex: 1 }}>
              <Text variant="title">{`${i.lead} `}</Text>
              {i.text}
            </Text>
          </View>
        </Card>
      ))}
    </Page>
  );
}
