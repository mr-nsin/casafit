// WeekPlan, Why and Plan (plan detail). All read the local plan; none writes.

import React from 'react';
import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '../../../app/types';
import type { PlanDayRow } from '../../../db/repositories';
import {
  Badge,
  Card,
  EmptyState,
  FilledButton,
  Icon,
  IconButton,
  InfoNote,
  ListRow,
  SectionLabel,
  SessionSegmentBar,
  StatTile,
  Text,
  TextButton,
  TonalButton,
  Touchable,
  radius,
  space,
  useTokens,
} from '../../../ui';
import { getSessionDeps } from '../deps';
import { startSession } from '../index';
import { usePlanData, useSkipped } from './hooks';
import {
  DOT,
  READY_MADE,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  answerRows,
  dayTitle,
  daySub,
  parsePlanDayKey,
  parseSession,
  phaseMinutes,
  planDayKey,
  reasonSentence,
  styleLabel,
  weekSummary,
  weekdayIndex,
  workSteps,
} from './model';
import { Page, useBackOrHome, useBrowseNav, type Nav } from './Page';

function useStartDay(nav: Nav) {
  return (row: PlanDayRow | undefined) => {
    const session = parseSession(row);
    if (!row) return;
    if (!session) {
      nav.navigate('Plan', { planDayId: planDayKey(row.planWeek, row.dayIndex) });
      return;
    }
    nav.navigate(startSession(session, { planWeek: row.planWeek, planDay: row.dayIndex }));
  };
}

function NoPlan({ back }: { back: () => void }) {
  const nav = useBrowseNav();
  return (
    <Page topBar={{ leading: 'back', onLeading: back }}>
      <EmptyState icon="event" title="No plan yet" body="Answer a few questions and we build your week on this phone.">
        <FilledButton label="Build my plan" onPress={() => nav.navigate('Goals')} />
      </EmptyState>
    </Page>
  );
}

// ---- WeekPlan ----

export function WeekPlanScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const t = useTokens();
  const data = usePlanData();
  const startDay = useStartDay(nav);
  if (data.loading) return <Page topBar={{ leading: 'back', onLeading: back }}><View /></Page>;
  if (!data.plan || !data.clock) return <NoPlan back={back} />;

  const { clock, plan, rows } = data;
  const summary = weekSummary(rows);
  const stepGoal = data.profile?.stepGoal ?? 7000;
  const todayRow = rows.find((r) => r.dayIndex === clock.dayIndex);

  return (
    <Page
      topBar={{ title: 'My plan', leading: 'back', onLeading: back, trailingText: { label: 'Why this plan', onPress: () => nav.navigate('Why') } }}
      footer={
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <TonalButton label="Change mix" onPress={() => nav.navigate('Mix')} style={{ flex: 1 }} />
          <FilledButton label="Start today" leadingIcon="play_arrow" onPress={() => startDay(todayRow)} style={{ flex: 1 }} disabled={!parseSession(todayRow)} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Badge label={`Week ${plan.weekNumber}`} tone="pc" />
      </View>
      <Text color="osv" tabular>
        {summary.workouts} workouts {DOT} {summary.minutes} minutes{summary.mix ? ` ${DOT} ${summary.mix}` : ''}
      </Text>
      <View style={{ gap: space.s }}>
        {clock.dates.map((date, i) => {
          const row = rows.find((r) => r.dayIndex === i);
          const isToday = i === clock.dayIndex;
          const rest = !row || row.kind === 'rest';
          const day = WEEKDAY_SHORT[weekdayIndex(date)]!;
          const full = WEEKDAY_LONG[weekdayIndex(date)]!;
          const title = dayTitle(row);
          const sub = daySub(row, isToday, stepGoal);
          const open = () => (rest ? nav.navigate('HomeRest') : nav.navigate('Plan', { planDayId: planDayKey(row!.planWeek, row!.dayIndex) }));
          return (
            <View
              key={date}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 68, borderRadius: radius.l, backgroundColor: isToday ? t.pc : t.c3, paddingLeft: space.l, paddingRight: space.xs, gap: space.m }}
            >
              <Text variant="labelStrong" color={isToday ? 'opc' : 'osv'} style={{ width: 32 }}>
                {day}
              </Text>
              <Touchable label={`${full}: ${title}, ${sub}`} onPress={open} minSize={68} style={{ flex: 1, justifyContent: 'center' }}>
                <Text color={isToday ? 'opc' : 'on'} style={{ fontWeight: '600' }}>
                  {title}
                </Text>
                <Text variant="bodySmall" color={isToday ? 'opc' : 'osv'}>
                  {sub}
                </Text>
              </Touchable>
              {rest || isToday ? (
                <View style={{ width: 48, alignItems: 'center' }}>
                  <Icon name={rest ? 'bedtime' : 'chevron_right'} color={isToday ? 'opc' : 'osv'} />
                </View>
              ) : (
                <IconButton icon="swap_horiz" label={`Swap ${full}`} onPress={() => nav.navigate('Editor')} />
              )}
            </View>
          );
        })}
      </View>
      <Text variant="bodySmall" color="osv">
        Weeks 2 and 3 are built when you get there, from how week {plan.weekNumber} felt.
      </Text>
    </Page>
  );
}

// ---- Why ----

export function WhyScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const t = useTokens();
  const data = usePlanData();
  const skipped = useSkipped(data.plan, data.profile);
  if (data.loading) return <Page topBar={{ title: 'Why this plan', leading: 'back', onLeading: back }}><View /></Page>;
  if (!data.plan) return <NoPlan back={back} />;
  const rows = answerRows(data.plan);

  return (
    <Page
      topBar={{ title: 'Why this plan', leading: 'back', onLeading: back }}
      footer={<FilledButton label="Got it" onPress={() => nav.navigate('WeekPlan')} />}
    >
      <Text color="osv">Rules on your phone built this week from your answers. Nothing is guessed.</Text>
      <SectionLabel title="What we used" />
      <View style={{ gap: space.s }}>
        {rows.map((r) => (
          <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, borderRadius: radius.l, backgroundColor: t.c3, paddingLeft: space.l, paddingRight: space.xs, gap: space.m }}>
            <Icon name={r.icon} color="osv" />
            <View style={{ flex: 1, paddingVertical: space.s }} accessible accessibilityLabel={`${r.label}: ${r.value}`}>
              <Text variant="label" color="osv">
                {r.label}
              </Text>
              <Text>{r.value}</Text>
            </View>
            <TextButton label="Change" onPress={() => nav.navigate(r.to)} accessibilityHint={`Change ${r.label.toLowerCase()}`} />
          </View>
        ))}
      </View>
      {skipped.length ? (
        <>
          <SectionLabel title="What we left out, and why" />
          <View style={{ gap: space.s }}>
            {skipped.map((s) => (
              <ListRow
                key={s.exerciseId}
                icon="block"
                title={s.name}
                subtitle={`${reasonSentence(s.reason)} We left it out.`}
                tone="c3"
                onPress={() => nav.navigate('Lunge', { excludedExerciseId: s.exerciseId })}
              />
            ))}
          </View>
        </>
      ) : null}
      <SectionLabel title="How it changes" />
      <InfoNote
        icon="autorenew"
        text="After each session you tell us how it felt. Too easy adds reps or a harder move next week. Too hard does the opposite."
      />
    </Page>
  );
}

// ---- Plan (plan detail) ----

type PlanRoute = RouteProp<RootStackParamList, 'Plan'>;

export function PlanScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const route = useRoute<PlanRoute>();
  const data = usePlanData();
  const startDay = useStartDay(nav);
  const skipped = useSkipped(data.plan, data.profile);
  const params = route.params;

  // Ready-made plans are labels until the Library lane ships their moves.
  if (params?.readyMadeId) {
    const rm = READY_MADE.find((p) => p.id === params.readyMadeId);
    return (
      <Page topBar={{ leading: 'back', onLeading: back }}>
        <Card tone="pc" style={{ gap: space.s }}>
          <Text variant="label" color="opc">
            Ready-made plan
          </Text>
          <Text variant="display" color="opc">
            {rm?.title ?? 'Ready-made plan'}
          </Text>
          {rm ? <Text color="opc">{rm.meta}</Text> : null}
        </Card>
        {/* TODO(library): list the moves and offer "Add to my plan" once the Library lane has the catalogue of ready-made plans. */}
        <InfoNote icon="info" text="The moves for this plan are on their way. Today's plan is ready on Home." />
        <FilledButton label="Back to home" onPress={() => nav.navigate('Main')} />
      </Page>
    );
  }

  if (data.loading) return <Page topBar={{ leading: 'back', onLeading: back }}><View /></Page>;
  if (!data.plan || !data.clock) return <NoPlan back={back} />;

  const key = parsePlanDayKey(params?.planDayId);
  const row = key
    ? data.rows.find((r) => r.planWeek === key.week && r.dayIndex === key.dayIndex)
    : data.rows.find((r) => r.dayIndex === data.clock!.dayIndex);
  if (!row) {
    return (
      <Page topBar={{ leading: 'back', onLeading: back }}>
        <EmptyState icon="event" title="We could not find that day" body="Open it again from your week." />
      </Page>
    );
  }

  const session = parseSession(row);
  const isToday = row.dayIndex === data.clock.dayIndex;
  const moves = workSteps(session);
  const mins = phaseMinutes(session);
  const date = data.clock.dates[row.dayIndex];
  const label = isToday ? "Today's plan" : `${date ? WEEKDAY_LONG[weekdayIndex(date)] : 'Planned'}'s plan`;
  const content = getSessionDeps().content;
  const skip = skipped[0];

  return (
    <Page
      topBar={{ leading: 'back', onLeading: back }}
      footer={
        session ? (
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <TonalButton label="Edit" onPress={() => nav.navigate('Editor')} style={{ flex: 1 }} />
            <FilledButton label="Start session" leadingIcon="play_arrow" onPress={() => startDay(row)} style={{ flex: 2 }} />
          </View>
        ) : undefined
      }
    >
      <Card tone="pc" style={{ gap: space.s }}>
        <Text variant="label" color="opc">
          {label}
        </Text>
        <Text variant="display" color="opc" accessibilityRole="header">
          {dayTitle(row)}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
          {session ? <Badge label={`${mins.total} min`} tone="sc" /> : null}
          <Badge label="No equipment" tone="sc" />
          <Badge label={styleLabel(row.style ?? session?.style)} tone="sc" />
        </View>
      </Card>

      {session ? (
        <>
          <SessionSegmentBar warm={mins.warm} work={mins.work} cool={mins.cool} height={32} />
          <Text variant="title" tabular accessibilityRole="header">
            {moves.length} {moves.length === 1 ? 'move' : 'moves'}
          </Text>
          <View style={{ gap: space.s }}>
            {moves.map((m) => {
              const cue = content.exercise(m.exerciseId)?.cue;
              return (
                <ListRow
                  key={m.id}
                  icon={m.mode === 'hold' ? 'horizontal_rule' : 'sports_gymnastics'}
                  title={m.name}
                  subtitle={cue ?? undefined}
                  trailing={`${m.sets} × ${m.workS}s`}
                  tone="c3"
                  onPress={() => nav.navigate('Exercise', { exerciseId: m.exerciseId })}
                />
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            {skip ? (
              <>
                <Text variant="bodySmall" color="osv">
                  {skip.name} {skip.name.endsWith('s') ? 'are' : 'is'} skipped for you.
                </Text>
                <TextButton label="See why" onPress={() => nav.navigate('Lunge', { excludedExerciseId: skip.exerciseId })} />
              </>
            ) : null}
            <TextButton label="Why this plan" onPress={() => nav.navigate('Why')} />
            <TextButton label="Warm-up and cool-down" onPress={() => nav.navigate('Parts')} />
          </View>
        </>
      ) : (
        <>
          <StatTile value={row.kind === 'walk' ? 'Easy walk' : row.kind === 'stretch' ? 'Gentle stretch' : 'Rest day'} label={daySub(row, isToday, data.profile?.stepGoal ?? 7000)} />
          <Text color="osv">{row.kind === 'rest' ? 'Your muscles get stronger while you rest. Keep it easy.' : 'This one is optional. Do as much as feels good.'}</Text>
          {row.kind === 'walk' ? <FilledButton label="See steps" leadingIcon="directions_walk" onPress={() => nav.navigate('Steps')} /> : null}
          <TextButton label="Why this plan" onPress={() => nav.navigate('Why')} />
        </>
      )}
    </Page>
  );
}
