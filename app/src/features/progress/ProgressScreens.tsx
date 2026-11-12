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
  curve,
  elevation,
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
  const { view, error, retry } = useProgress();
  if (error) return <LoadError title="Progress" onRetry={retry} />;
  if (!view) return <Page top={<TopBar title="Progress" leading="none" />}>{null}</Page>;
  return view.empty ? <ProgressEmptyScreen /> : <ProgressBody view={view} />;
}

/** The phone could not read its own data. Calm, no blame, one way to try again. */
export function LoadError({ title, onRetry, onClose }: { title: string; onRetry: () => void; onClose?: () => void }) {
  return (
    <Page top={onClose ? <TopBar leading="close" title={title} onLeading={onClose} /> : <TopBar title={title} leading="none" />}>
      <EmptyState icon="info" title="We could not load this" body="Your sessions and steps are safe on this phone. Try again in a moment.">
        <FilledButton label="Try again" leadingIcon="refresh" onPress={onRetry} />
      </EmptyState>
    </Page>
  );
}

export function ProgressBody({ view }: { view: ProgressView }) {
  const t = useTokens();
  return (
    <Page top={<TopBar title="Progress" leading="none" />}>
      {/* The streak is the one number that leads; it is the only raised card on the screen. */}
      <View
        accessible
        accessibilityLabel={`${view.streak} day streak. Your best is ${view.best} days.`}
        style={{ backgroundColor: t.pc, borderRadius: radius.xxl, ...curve, ...elevation.card, padding: space.xl, gap: space.s }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.m }}>
          <Text variant="timer" color="opc" tabular style={{ fontSize: 64, lineHeight: 68 }}>
            {view.streak}
          </Text>
          <Text variant="headline" color="opc">
            day streak
          </Text>
        </View>
        <View style={{ gap: 2 }}>
          <Text color="opc" tabular>{`Your best is ${view.best} ${view.best === 1 ? 'day' : 'days'}`}</Text>
          <Text variant="bodySmall" color="opc">
            Rest days never break it.
          </Text>
        </View>
      </View>

      <View style={{ gap: space.m }}>
        <SectionLabel title="This week" />
        <View style={{ backgroundColor: t.c3, borderRadius: radius.xl, ...curve, padding: space.l }}>
          <WeekDots days={view.weekDots.map((d) => ({ label: d.label, done: d.done }))} />
        </View>
      </View>

      <View style={{ gap: space.m }}>
        <SectionLabel title="Last 4 weeks" />
        <Heatmap cells={view.heat} summary={view.heatSummary} />
        <Text variant="bodySmall" color="osv" tabular>
          {view.heatSummary}
        </Text>
        {/* One quiet card for the totals: two figures side by side, steps as a line below. */}
        <View style={{ backgroundColor: t.c3, borderRadius: radius.xl, ...curve, padding: space.l, gap: space.l }}>
          <View style={{ flexDirection: 'row', gap: space.l }}>
            <Figure value={view.sessions28} label={view.sessions28 === 1 ? 'Session' : 'Sessions'} />
            <View style={{ width: 1, backgroundColor: t.olv }} />
            <Figure value={view.minutes28} label="Minutes trained" />
          </View>
          {view.avgSteps !== null ? (
            <View
              accessible
              accessibilityLabel={`${formatCount(view.avgSteps)}, Avg steps a day`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, borderTopWidth: 1, borderTopColor: t.olv, paddingTop: space.l }}
            >
              <Icon name="directions_walk" size={20} color="osv" />
              <Text variant="bodySmall" color="osv" style={{ flex: 1 }}>
                Avg steps a day
              </Text>
              <Text variant="title" tabular>
                {formatCount(view.avgSteps)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

/** A large tabular figure over its name. Spoken as "value, label". */
function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value}, ${label}`} style={{ flex: 1, gap: 2 }}>
      <Text variant="title" tabular style={{ fontSize: 32, lineHeight: 38 }}>
        {value}
      </Text>
      <Text variant="bodySmall" color="osv">
        {label}
      </Text>
    </View>
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
      {/* Still skeletons in the shape of the real screen: no looping shimmer (loops are for demo illustrations only). */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: space.m }}>
        <View style={{ height: 96, borderRadius: radius.xxl, ...curve, backgroundColor: t.c3 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.l }}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={{ width: 36, height: 36, borderRadius: radius.round, backgroundColor: t.c3 }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.s, height: 80 }}>
          {[30, 50, 40, 64, 36, 56, 44].map((h, i) => (
            <View key={i} style={{ flex: 1, height: h, borderRadius: radius.s, backgroundColor: t.c3 }} />
          ))}
        </View>
      </View>
    </Page>
  );
}

export function RecapScreen() {
  const nav = useNavigation<Nav>();
  const { view, error, retry } = useRecap();
  if (error) return <LoadError title="Recap" onRetry={retry} onClose={() => nav.goBack()} />;
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
