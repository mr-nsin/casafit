// Workout tab: Home (training day, resume, comeback) and HomeRest (rest day).
// One decision for today, then optional paths. Everything is read locally.

import React, { useCallback, useState } from 'react';
import { Animated, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { PlanDayRow } from '../../../db/repositories';
import { useAuth } from '../../../state/auth';
import { usePreferences, useShowCalories } from '../../../state/preferences';
import {
  Card,
  EmptyState,
  FilledButton,
  FormCheckChip,
  Icon,
  IconButton,
  ListRow,
  ProgressBar,
  ProgressRing,
  SessionSegmentBar,
  Text,
  TextButton,
  Touchable,
  WeekStrip,
  radius,
  space,
  useEntrance,
  useTokens,
} from '../../../ui';
import { addDays, localDateKey } from '../../../engine';
import { startSession, loadResumableSession } from '../start';
import { isFinished, useSessionStore } from '../store';
import { mythOfTheWeek } from '../../learn/model';
import { usePlanData, useTodayExtras, type PlanData } from './hooks';
import {
  BODY_PART_TILES,
  DOT,
  READY_MADE,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  completedDates,
  dayIcon,
  dayKindFor,
  dayTitle,
  formatCount,
  isComeback,
  isKneeFriendly,
  localDate,
  parseSession,
  phaseMinutes,
  planDayKey,
  sessionMeta,
  weekdayIndex,
} from './model';
import { Page, useBackOrHome, useBrowseNav, type Nav } from './Page';
import { openReadyMade } from './actions';
import { contentFlags, isSafePlan } from './library';
import { loadContent } from '../../../content';
import { getSessionDeps } from '../deps';

const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] ?? '';

interface Resume {
  title: string;
  minutesDone: number;
  budgetMin: number;
  /** Nothing left to play, but never saved to the week. Offer to save it instead of resuming. */
  finished: boolean;
}

/** A saved session inside its 24 hour window, or null. Re-read each time Home gets focus. */
function useResume(): [Resume | null, () => void] {
  const [resume, setResume] = useState<Resume | null>(null);
  const [tick, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const st = useSessionStore.getState();
        // A session that is already live in memory is shown as it is; never overwrite it from disk.
        const inMemory = st.plan && !st.trial && !st.logged && (st.status === 'paused' || st.status === 'complete');
        const r = inMemory ? { title: st.plan!.title, minutesDone: Math.floor(st.activeMs / 60000), finished: isFinished(st) } : await loadResumableSession();
        if (!live) return;
        const plan = useSessionStore.getState().plan;
        setResume(r ? { ...r, budgetMin: Math.max(1, Math.round((plan?.budgetS ?? 900) / 60)) } : null);
      })().catch(() => undefined);
      return () => {
        live = false;
      };
    }, [tick]),
  );
  return [resume, () => setTick((n) => n + 1)];
}

function useFormChecks() {
  const left = useAuth((s) => s.freeChecksRemaining);
  const pro = useAuth((s) => s.pro.active);
  return { left, pro };
}

function Header({ today, week, title, onPaywall, onProfile, back }: { today: string; week: number; title: string; onPaywall: () => void; onProfile: () => void; back?: () => void }) {
  const { left, pro } = useFormChecks();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, paddingTop: space.s }}>
      {back ? <IconButton icon="arrow_back" label="Back" onPress={back} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodySmall" color="osv">
          {WEEKDAY_LONG[weekdayIndex(today)]} {DOT} Week {week}
        </Text>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {!pro ? <FormCheckChip remaining={left} onPress={onPaywall} /> : null}
      <IconButton icon="person" label="Profile" onPress={onProfile} />
    </View>
  );
}

function strip(opts: {
  data: PlanData;
  nav: Nav;
  done: Set<string>;
}) {
  const { data, nav, done } = opts;
  const clock = data.clock!;
  return (
    <WeekStrip
      days={clock.dates.map((date, i) => {
        const row = data.rows.find((r) => r.dayIndex === i);
        const isToday = i === clock.dayIndex;
        const isDone = done.has(date);
        const kind = dayKindFor(row, { today: isToday, done: isDone });
        const day = WEEKDAY_SHORT[weekdayIndex(date)]!;
        const full = WEEKDAY_LONG[weekdayIndex(date)]!;
        const what = isDone ? 'done' : dayTitle(row);
        return {
          day,
          kind,
          icon: isDone && !isToday ? 'check' : dayIcon(row),
          a11yLabel: `${full}${isToday ? ', today' : ''}: ${what}`,
          onPress: () => {
            if (row && isToday && row.kind !== 'rest') nav.navigate('Plan', { planDayId: planDayKey(row.planWeek, row.dayIndex) });
            else if (!row || row.kind === 'rest') nav.navigate('HomeRest');
            else nav.navigate('WeekPlan');
          },
        };
      })}
    />
  );
}

// ---- Training day ----

function TodayCard({ row, doneToday, resumeShown, onStart }: { row: PlanDayRow; doneToday: boolean; resumeShown: boolean; onStart: () => void }) {
  const nav = useBrowseNav();
  const enter = useEntrance({ duration: 400 });
  const session = parseSession(row);
  const mins = phaseMinutes(session);
  const hasSession = !!session;
  const label = doneToday ? 'Done today' : resumeShown ? 'Today, or start fresh' : 'Today';
  const buttonLabel = doneToday ? 'Go again' : resumeShown ? 'Start fresh' : row.kind === 'walk' ? 'See steps' : 'Start';
  const press = () => {
    if (hasSession) onStart();
    else if (row.kind === 'walk') nav.navigate('Steps');
    else nav.navigate('Plan', { planDayId: planDayKey(row.planWeek, row.dayIndex) });
  };
  return (
    <Animated.View
      style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}
    >
      <Card tone="pc" style={{ gap: space.m }} radiusSize={radius.xl}>
        <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
          <Icon name={doneToday ? 'check_circle' : 'today'} size={20} color="opc" />
          <Text variant="label" color="opc">
            {label}
          </Text>
        </View>
        <Text variant="display" color="opc" accessibilityLabel={`Today's session: ${dayTitle(row)}`}>
          {dayTitle(row)}
        </Text>
        <Text color="opc">{hasSession ? sessionMeta(session, row.style) : row.kind === 'walk' ? 'Easy pace, no equipment' : 'Optional, no equipment'}</Text>
        {hasSession ? (
          <>
            <SessionSegmentBar warm={mins.warm} work={mins.work} cool={mins.cool} height={32} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TextButton label="Warm-up" onPress={() => nav.navigate('Parts', { part: 'warmup' })} />
              <Text variant="bodySmall" color="opc" tabular>
                {mins.total} min total
              </Text>
              <TextButton label="Cool-down" onPress={() => nav.navigate('Parts', { part: 'cooldown' })} />
            </View>
          </>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
          <FilledButton label={buttonLabel} leadingIcon={row.kind === 'walk' ? 'directions_walk' : 'play_arrow'} onPress={press} style={{ flex: 1 }} />
          {hasSession ? (
            <>
              <IconButton icon="swap_horiz" label="Swap today's session" tone="tonal" size={56} onPress={() => nav.navigate('Editor')} />
              <IconButton icon="tune" label="Edit today's session" tone="tonal" size={56} onPress={() => nav.navigate('Editor')} />
            </>
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

function ResumeCard({ resume, onResume, onDiscard }: { resume: Resume; onResume: () => void; onDiscard: () => void }) {
  const pct = Math.min(100, Math.round((resume.minutesDone / resume.budgetMin) * 100));
  return (
    <Card tone="sc" style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Icon name="pause_circle" size={20} color="osc" />
        <Text variant="label" color="osc">
          Paused session
        </Text>
      </View>
      <Text variant="title" color="osc" accessibilityRole="header">
        Resume your session
      </Text>
      <Text color="osc" tabular>
        {resume.title} {DOT} {resume.minutesDone} of {resume.budgetMin} min done
      </Text>
      <ProgressBar value={pct} label="Session progress" />
      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
        <FilledButton label="Resume" leadingIcon="play_arrow" onPress={onResume} style={{ flex: 1 }} />
        <TextButton label="Discard" onPress={onDiscard} />
      </View>
      <Text variant="bodySmall" color="osc">
        We keep it for 24 hours. Discarding does not affect your week.
      </Text>
    </Card>
  );
}

function SaveCard({ resume, onSave, onDiscard, busy }: { resume: Resume; onSave: () => void; onDiscard: () => void; busy: boolean }) {
  return (
    <Card tone="sc" style={{ gap: space.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <Icon name="check_circle" size={20} color="osc" />
        <Text variant="label" color="osc">
          Finished session
        </Text>
      </View>
      <Text variant="title" color="osc" accessibilityRole="header">
        Save your session
      </Text>
      <Text color="osc" tabular>
        {resume.title} {DOT} {resume.minutesDone} min done
      </Text>
      <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
        <FilledButton label="Save session" leadingIcon="check" onPress={onSave} disabled={busy} style={{ flex: 1 }} />
        <TextButton label="Discard" onPress={onDiscard} disabled={busy} />
      </View>
      <Text variant="bodySmall" color="osc">
        You finished this one, so it can count toward your week. Discarding is fine too.
      </Text>
    </Card>
  );
}

function MythCard() {
  const nav = useBrowseNav();
  const t = useTokens();
  const today = localDate(getSessionDeps().clock.wall());
  let content: ReturnType<typeof loadContent> | null = null;
  try {
    content = loadContent();
  } catch {
    content = null;
  }
  const myth = content ? mythOfTheWeek(content.myths ?? [], today) : null;
  if (!content || !myth) return null;
  const title = content.t(myth.titleKey);
  return (
    <Touchable
      label={`Myth of the week: ${title}`}
      onPress={() => nav.navigate('Myth', { mythId: myth.id })}
      minSize={64}
      style={{ minHeight: 64, borderRadius: radius.l, backgroundColor: t.c3, padding: space.m, flexDirection: 'row', alignItems: 'center', gap: space.m }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.tc, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lightbulb" size={22} color="otc" />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" color="osv">
          Myth of the week
        </Text>
        <Text variant="labelStrong" numberOfLines={2}>
          {title}
        </Text>
      </View>
      <Icon name="chevron_right" color="osv" />
    </Touchable>
  );
}

function Tile({ icon, title, meta, onPress, width }: { icon: string; title: string; meta: string; onPress: () => void; width: number }) {
  const t = useTokens();
  return (
    <Touchable
      label={`${title}, ${meta}`}
      onPress={onPress}
      minSize={44}
      style={{ width, minHeight: 96, borderRadius: radius.l, backgroundColor: t.c3, padding: space.m, gap: space.s, justifyContent: 'space-between' }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.tc, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color="otc" />
      </View>
      <View>
        <Text variant="labelStrong" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="label" color="osv" numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Touchable>
  );
}

function SectionRow({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.s }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {action ? <TextButton label={action} onPress={onAction} /> : null}
    </View>
  );
}

function BodyPartGrid({ focus }: { focus: string[] }) {
  const t = useTokens();
  const nav = useBrowseNav();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
      {BODY_PART_TILES.map((p) => {
        const on = focus.includes(p.id);
        return (
          <Touchable
            key={p.id}
            label={on ? `${p.label}, your focus` : p.label}
            onPress={() => nav.navigate('BodyPart', { part: p.id })}
            minSize={56}
            style={{
              flexBasis: '31.5%',
              flexGrow: 1,
              height: 64,
              borderRadius: radius.l,
              backgroundColor: on ? t.pc : t.c3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="labelStrong" color={on ? 'opc' : 'on'}>
              {p.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

function TodaySoFar({ today, stepGoal }: { today: string; stepGoal: number }) {
  const t = useTokens();
  const nav = useBrowseNav();
  const showCalories = useShowCalories();
  const extras = useTodayExtras(today);
  const { steps, food } = extras;
  return (
    <View style={{ gap: space.s }}>
      <SectionRow title="Today so far" />
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {steps ? (
          <Touchable
            label={`${formatCount(steps.steps)} of ${formatCount(stepGoal)} steps, ${steps.briskMinutes} brisk minutes`}
            onPress={() => nav.navigate('Steps')}
            minSize={104}
            style={{ flex: 1, minHeight: 104, borderRadius: radius.xl, backgroundColor: t.tc, padding: space.m, flexDirection: 'row', alignItems: 'center', gap: space.m }}
          >
            <ProgressRing value={steps.steps} max={stepGoal} size={56} stroke={6} tone="otc" a11yLabel={`${formatCount(steps.steps)} of ${formatCount(stepGoal)} steps`} />
            <View style={{ flex: 1 }}>
              <Text variant="headline" color="otc" tabular>
                {formatCount(steps.steps)}
              </Text>
              <Text variant="label" color="otc">
                of {formatCount(stepGoal)} steps
              </Text>
              <Text variant="label" color="otc" tabular>
                {steps.briskMinutes} brisk min
              </Text>
            </View>
          </Touchable>
        ) : (
          <Touchable
            label="Count your steps"
            onPress={() => nav.navigate('Steps')}
            minSize={104}
            style={{ flex: 1, minHeight: 104, borderRadius: radius.xl, backgroundColor: t.tc, padding: space.m, gap: space.s, justifyContent: 'center' }}
          >
            <Icon name="directions_walk" color="otc" />
            <Text variant="labelStrong" color="otc">
              Count your steps
            </Text>
          </Touchable>
        )}
        <Touchable
          label={food ? `Food, ${Math.round(food.proteinG)} grams protein` : 'Food, log a meal'}
          onPress={() => nav.navigate('Main', { screen: 'Nutrition' })}
          minSize={104}
          style={{ flex: 1, minHeight: 104, borderRadius: radius.xl, backgroundColor: t.c3, padding: space.m, justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="label" color="osv">
              Food
            </Text>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: t.p, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="add" size={20} color="op" />
            </View>
          </View>
          {food ? (
            <View style={{ gap: 4 }}>
              {showCalories ? (
                <Text variant="headline" tabular>
                  {formatCount(food.kcal)}
                  <Text variant="label" color="osv"> kcal</Text>
                </Text>
              ) : (
                <Text variant="headline" tabular>
                  {Math.round(food.proteinG)}
                  <Text variant="label" color="osv">{extras.proteinTargetG ? ` of ${extras.proteinTargetG} g protein` : ' g protein'}</Text>
                </Text>
              )}
              {showCalories ? (
                <Text variant="label" color="osv" tabular>
                  {Math.round(food.proteinG)}
                  {extras.proteinTargetG ? ` of ${extras.proteinTargetG}` : ''} g protein
                </Text>
              ) : (
                <Text variant="label" color="osv">
                  Calories hidden
                </Text>
              )}
            </View>
          ) : (
            <Text variant="labelStrong">Log a meal</Text>
          )}
        </Touchable>
      </View>
      {!showCalories ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, backgroundColor: t.sc, borderRadius: radius.l, paddingLeft: space.l, minHeight: 48 }}>
          <Icon name="visibility_off" size={20} color="osc" />
          <Text variant="bodySmall" color="osc" style={{ flex: 1 }}>
            Calories are hidden everywhere in CasaFit. Protein still counts.
          </Text>
          <TextButton label="Show" onPress={() => void usePreferences.getState().setShowCalories(true)} />
        </View>
      ) : null}
    </View>
  );
}

function TrainingHome({ data, standalone }: { data: PlanData; standalone?: boolean }) {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const clock = data.clock!;
  const plan = data.plan!;
  const [resume, refreshResume] = useResume();
  const [saving, setSaving] = useState(false);
  const done = completedDates(data.logs, data.tz);
  const row = data.rows.find((r) => r.dayIndex === clock.dayIndex)!;
  const comeback = isComeback(data.logs, clock.today, data.tz);
  const doneToday = done.has(clock.today) && !resume;
  const resumeOffered = !!resume && !resume.finished;
  const workouts = data.rows.filter((r) => r.kind === 'workout');
  const nth = workouts.filter((r) => r.dayIndex <= row.dayIndex).length;
  const name = firstName(data.profile?.name);
  const title = comeback ? (name ? `Welcome back, ${name}` : 'Welcome back') : name ? `Let's move, ${name}` : "Let's move";

  const start = () => {
    const session = parseSession(row);
    if (!session) return;
    nav.navigate(startSession(session, { planWeek: row.planWeek, planDay: row.dayIndex }));
  };

  return (
    <Page
      tabRoot={!standalone}
      header={
        <Header
          today={clock.today}
          week={plan.weekNumber}
          title={title}
          back={standalone ? back : undefined}
          onPaywall={() => nav.navigate('Paywall')}
          onProfile={() => nav.navigate('Profile')}
        />
      }
    >
      {strip({ data, nav, done })}
      {comeback ? (
        <Card tone="tc" style={{ gap: space.xs }}>
          <Text variant="title" color="otc" accessibilityRole="header">
            Good to see you
          </Text>
          <Text color="otc">Start where you are. One session today is plenty.</Text>
        </Card>
      ) : null}
      {/* TODO(comeback): rebuild the week one rung easier with engine comebackInput() once the plan lane exposes a rebuild call. */}
      {row.kind === 'workout' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text tabular>
            Today is session {nth} of {workouts.length}
          </Text>
          <TextButton label="Full plan" onPress={() => nav.navigate('WeekPlan')} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TextButton label="Full plan" onPress={() => nav.navigate('WeekPlan')} />
        </View>
      )}
      {resume?.finished ? (
        <SaveCard
          resume={resume}
          busy={saving}
          onSave={() => {
            setSaving(true);
            void useSessionStore
              .getState()
              .saveFinished()
              .then(() => {
                useSessionStore.getState().reset();
                refreshResume();
                void data.reload();
              })
              .finally(() => setSaving(false));
          }}
          onDiscard={() => {
            setSaving(true);
            void useSessionStore
              .getState()
              .discardFinished()
              .then(() => {
                useSessionStore.getState().reset();
                refreshResume();
              })
              .finally(() => setSaving(false));
          }}
        />
      ) : resume ? (
        <ResumeCard
          resume={resume}
          onResume={() => nav.navigate('Paused')}
          onDiscard={() => {
            void useSessionStore
              .getState()
              .endWithoutSaving()
              .then(() => {
                useSessionStore.getState().reset();
                refreshResume();
              });
          }}
        />
      ) : null}
      <TodayCard row={row} doneToday={doneToday} resumeShown={resumeOffered} onStart={start} />
      <SectionRow title="Ready-made plans" action="See all" onAction={() => nav.navigate('Library')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }} style={{ marginHorizontal: -space.l }} testID="ready-made">
        <View style={{ width: space.s }} />
        {READY_MADE.filter((p) => isSafePlan(loadContent(), p.id, contentFlags(data.profile))).map((p) => (
          <Tile
            key={p.id}
            icon={p.icon}
            title={p.title}
            meta={p.meta}
            width={148}
            onPress={() => openReadyMade(nav, p.id, data)}
          />
        ))}
        <View style={{ width: space.s }} />
      </ScrollView>
      <SectionRow title="Train a body part" />
      <Text variant="bodySmall" color="osv">
        {plan.bodyParts.length ? 'Shaded: your focus' : 'Pick one for a quick session'}
      </Text>
      <BodyPartGrid focus={plan.bodyParts} />
      <TodaySoFar today={clock.today} stepGoal={data.profile?.stepGoal ?? 7000} />
      <MythCard />
    </Page>
  );
}

// ---- Rest day ----

function RestHome({ data, standalone }: { data: PlanData; standalone?: boolean }) {
  const t = useTokens();
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const clock = data.clock!;
  const plan = data.plan!;
  const done = completedDates(data.logs, data.tz);
  const doneThisWeek = clock.dates.filter((d) => done.has(d)).length;
  const planned = data.rows.filter((r) => r.kind === 'workout').length;
  const name = firstName(data.profile?.name);
  const tomorrow = data.rows.find((r) => r.dayIndex === (clock.dayIndex + 1) % 7);
  const tomorrowDate = addDays(clock.today, 1);
  const stretch = data.rows.find((r) => r.kind === 'stretch');
  const minutes = data.logs
    .filter((l) => l.status === 'complete' && clock.dates.includes(localDateKey(l.completedAt, data.tz)))
    .reduce((a, l) => a + Math.round(l.durationS / 60), 0);
  const goal = data.profile?.stepGoal ?? 7000;

  return (
    <Page
      tabRoot={!standalone}
      header={
        <Header
          today={clock.today}
          week={plan.weekNumber}
          title={name ? `Rest well, ${name}` : 'Rest well'}
          back={standalone ? back : undefined}
          onPaywall={() => nav.navigate('Paywall')}
          onProfile={() => nav.navigate('Profile')}
        />
      }
    >
      {strip({ data, nav, done })}
      <Text color="osv" tabular>
        {doneThisWeek} of {planned} workouts done this week. Nicely paced.
      </Text>
      <Card tone="c3" style={{ gap: space.s, alignItems: 'center' }}>
        <View accessible accessibilityLabel="Rest day" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.pc, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bedtime" size={36} color="opc" />
        </View>
        <Text variant="label" color="osv">
          Today
        </Text>
        <Text variant="headline" accessibilityRole="header">
          Rest day
        </Text>
        <Text color="osv" style={{ textAlign: 'center' }}>
          Your muscles get stronger while you rest. Keep it easy today.
        </Text>
      </Card>
      <View style={{ gap: space.s }}>
        <ListRow icon="directions_walk" title="10-minute easy walk" subtitle={`A little movement toward ${formatCount(goal)} steps`} tone="c3" onPress={() => nav.navigate('Steps')} />
        <ListRow
          icon="spa"
          title="Gentle stretch"
          subtitle={`8 min ${DOT} Easy ${DOT} optional`}
          tone="c3"
          onPress={() => nav.navigate('Plan', stretch ? { planDayId: planDayKey(stretch.planWeek, stretch.dayIndex) } : { readyMadeId: 'morning-stretch' })}
        />
        {doneThisWeek > 0 ? (
          <ListRow
            icon="auto_awesome"
            title={`Week ${plan.weekNumber} recap`}
            subtitle={`${doneThisWeek} ${doneThisWeek === 1 ? 'session' : 'sessions'}, ${minutes} minutes`}
            tone="tc"
            onPress={() => nav.navigate('Recap')}
          />
        ) : null}
      </View>
      {tomorrow ? (
        <View style={{ gap: space.s }}>
          <Text variant="title" accessibilityRole="header">
            Tomorrow
          </Text>
          <ListRow
            icon={dayIcon(tomorrow)}
            title={dayTitle(tomorrow)}
            subtitle={[
              WEEKDAY_LONG[weekdayIndex(tomorrowDate)],
              tomorrow.kind === 'workout' ? `${phaseMinutes(parseSession(tomorrow)).total} min` : 'optional',
              isKneeFriendly(parseSession(tomorrow)) ? 'knee-friendly' : null,
            ]
              .filter(Boolean)
              .join(` ${DOT} `)}
            tone="c3"
            onPress={() => nav.navigate('Plan', { planDayId: planDayKey(tomorrow.planWeek, tomorrow.dayIndex) })}
          />
        </View>
      ) : null}
    </Page>
  );
}

// ---- Screens ----

function Empty() {
  const nav = useBrowseNav();
  return (
    <Page tabRoot>
      <EmptyState icon="event" title="Your plan is on its way" body="Answer a few questions and we build your first week on this phone.">
        <FilledButton label="Build my plan" onPress={() => nav.navigate('Goals')} />
      </EmptyState>
    </Page>
  );
}

/** Workout tab root. Shows the rest-day layout when today is a rest day. */
export function HomeScreen({ standalone }: { standalone?: boolean } = {}) {
  const data = usePlanData();
  if (data.loading) return <Page tabRoot><View /></Page>;
  if (!data.plan || !data.clock) return <Empty />;
  const row = data.rows.find((r) => r.dayIndex === data.clock!.dayIndex);
  // The engine writes rest days as 'walk' or 'stretch' (the suggestion), so anything but a workout is a rest day.
  if (!row || row.kind !== 'workout') return <RestHome data={data} standalone={standalone} />;
  return <TrainingHome data={data} standalone={standalone} />;
}

/** Route `HomeRest`: the rest-day layout, reached from a rest day pill. */
export function HomeRestScreen() {
  const data = usePlanData();
  if (data.loading) return <Page><View /></Page>;
  if (!data.plan || !data.clock) return <Empty />;
  return <RestHome data={data} standalone />;
}
