// Library (ready-made plans), BodyPart (moves for one part, and a session on the spot) and
// Exercise (one move in detail). All read the bundled content; none needs a network.

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '../../../app/types';
import { loadContent } from '../../../content';
import { getRepositories, hasRepositories } from '../../../state/storage';
import {
  Badge,
  Chip,
  ChipGroup,
  EmptyState,
  ExerciseRow,
  FilledButton,
  HiddenByFlagRow,
  Icon,
  IconBadge,
  InfoNote,
  ListRow,
  Card,
  SessionSegmentBar,
  TonalButton,
  Text,
  Touchable,
  radius,
  space,
  useTokens,
} from '../../../ui';
import { openReadyMade, startPartSession, startReadyMadePlan } from './actions';
import { persistSession } from './editing';
import type { PlanData } from './hooks';
import { usePlanData } from './hooks';
import {
  DIFFICULTY_LABEL,
  LIBRARY_FILTERS,
  contentFlags,
  exerciseName,
  flagPhrase,
  libraryPlans,
  moveMeta,
  partInfo,
  partMoves,
  partsLabel,
  planIcon,
  planMeta,
  isSafePlan,
  LEVEL_LABEL,
  planMinutes,
  planTitle,
  restrictionsOf,
  sessionFromReadyMade,
  type LibraryFilter,
  type PartStyle,
} from './library';
import { exerciseIcon } from '../icons';
import { cap, phaseMinutes, workSteps } from './model';
import { Page, useBrowseNav, useBackOrHome } from './Page';
import { getSessionDeps } from '../deps';

// ---- Library ----

function PlanListRow({ icon, title, meta, tone, onPress }: { icon: string; title: string; meta: string; tone: 'sc' | 'tc' | 'pc'; onPress: () => void }) {
  const t = useTokens();
  const fg = tone === 'sc' ? 'osc' : tone === 'tc' ? 'otc' : 'opc';
  return (
    <Touchable
      label={`${title}, ${meta}`}
      onPress={onPress}
      minSize={80}
      style={{ minHeight: 80, borderRadius: radius.xl, backgroundColor: t.c3, flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.s }}
    >
      <View style={{ width: 64, height: 64, borderRadius: radius.m, backgroundColor: t[tone], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={32} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{title}</Text>
        <Text variant="bodySmall" color="osv">
          {meta}
        </Text>
      </View>
      <View style={{ width: 48, alignItems: 'center' }}>
        <Icon name="chevron_right" color="osv" />
      </View>
    </Touchable>
  );
}

export function LibraryScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const data = usePlanData();
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const content = loadContent();
  if (data.loading) return <Page topBar={{ title: 'Ready-made plans', leading: 'back', onLeading: back }}><View /></Page>;

  const flags = contentFlags(data.profile);
  const { shown, hiddenCount } = libraryPlans(content, flags, filter);
  const tones = { normal: 'sc', yoga: 'tc', dance: 'pc' } as const;

  return (
    <Page topBar={{ title: 'Ready-made plans', leading: 'back', onLeading: back }}>
      <ChipGroup
        label="Filter by style"
        scrollable
        options={LIBRARY_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        selected={[filter]}
        onChange={(next) => setFilter(next[0] ?? 'all')}
      />
      {shown.length ? (
        <View style={{ gap: space.s }}>
          {shown.map((p) => (
            <PlanListRow
              key={p.id}
              icon={planIcon(p)}
              title={planTitle(content, p)}
              meta={planMeta(p)}
              tone={p.kind === 'micro' ? 'sc' : tones[p.style]}
              onPress={() => openReadyMade(nav, p.id, data)}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon="event" title="No plans here yet" body="Try another style, or pick All." />
      )}
      {hiddenCount > 0 ? (
        <Text variant="bodySmall" color="osv">
          {hiddenCount} {hiddenCount === 1 ? 'plan is' : 'plans are'} hidden because of your {flagPhrase(flags)}.
        </Text>
      ) : null}
    </Page>
  );
}

// ---- BodyPart ----

type PartRoute = RouteProp<RootStackParamList, 'BodyPart'>;

export function BodyPartScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const route = useRoute<PartRoute>();
  const data = usePlanData();
  const content = loadContent();
  const [style, setStyle] = useState<PartStyle>('normal');
  const [easyFirst, setEasyFirst] = useState(false);
  const [failed, setFailed] = useState(false);
  const info = partInfo(route.params?.part ?? 'core');
  if (data.loading) return <Page topBar={{ title: info.title, leading: 'back', onLeading: back }}><View /></Page>;

  const flags = contentFlags(data.profile);
  const { shown, hidden } = partMoves(content, info.id, style, flags, easyFirst);
  const kneeFriendly = flags.includes('knee');
  const n = shown.length;

  const start = () => {
    setFailed(false);
    if (!startPartSession(nav, info.id, style, data)) setFailed(true);
  };

  return (
    <Page
      topBar={{ title: info.title, leading: 'back', onLeading: back }}
      footer={<FilledButton label={`Start a 15-minute ${info.title.toLowerCase()} session`} leadingIcon="play_arrow" onPress={start} />}
    >
      <Card tone="sc" radiusSize={28} style={{ flexDirection: 'row', alignItems: 'center', gap: space.l }}>
        <IconBadge icon="accessibility_new" size={64} tone="pc" />
        <View style={{ flex: 1 }}>
          <Text variant="headline" color="osc" accessibilityRole="header">
            {info.title}
          </Text>
          <Text variant="bodySmall" color="osc">
            {n} {n === 1 ? 'move' : 'moves'} for {info.blurb}.{kneeFriendly ? ' All knee-friendly.' : ''}
          </Text>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityLabel="Filters">
        <Chip label="Normal" role="radio" selected={style === 'normal'} onPress={() => setStyle('normal')} />
        <Chip label="Yoga" role="radio" selected={style === 'yoga'} onPress={() => setStyle('yoga')} />
        <Chip label="Easy first" role="checkbox" selected={easyFirst} onPress={() => setEasyFirst((v) => !v)} />
      </View>
      {failed ? <InfoNote icon="info" tone="erc" text="We could not build that session with your answers. Try another body part or style." /> : null}
      {n ? (
        <View style={{ gap: space.s }}>
          {shown.map((ex) => (
            <ExerciseRow
              key={ex.id}
              title={exerciseName(content, ex)}
              meta={moveMeta(ex)}
              onPress={() => nav.navigate('Exercise', { exerciseId: ex.id })}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon="event" title="No moves here yet" body={style === 'yoga' ? 'Try Normal for this one.' : 'Try another body part.'} />
      )}
      {hidden.slice(0, 3).map((h) => (
        <HiddenByFlagRow key={h.exercise.id} exerciseName={exerciseName(content, h.exercise)} reason={`hidden for your ${flagPhrase(h.flags)}.`} />
      ))}
      {hidden.length > 3 ? (
        <Text variant="bodySmall" color="osv">
          And {hidden.length - 3} more hidden for your answers.
        </Text>
      ) : null}
    </Page>
  );
}

// ---- Exercise ----

type ExerciseRoute = RouteProp<RootStackParamList, 'Exercise'>;

export function ExerciseScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const route = useRoute<ExerciseRoute>();
  const data = usePlanData();
  const t = useTokens();
  const content = loadContent();
  const ex = content.exercise(route.params?.exerciseId ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ex || !hasRepositories()) return undefined;
    let live = true;
    void getRepositories()
      .favourites.all()
      .then((ids) => {
        if (live) setSaved(ids.includes(ex.id));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [ex?.id]);

  if (!ex) {
    return (
      <Page topBar={{ leading: 'back', onLeading: back }}>
        <EmptyState icon="event" title="We could not find that move" body="Open it again from your plan." />
      </Page>
    );
  }

  const flags = contentFlags(data.profile);
  const blocked = content.blockingFlags(ex, flags);
  const caution = content.cautionFlagsFor(ex, flags);
  const easier = content.easier(ex.id);
  const harder = content.harder(ex.id);
  const kneeFriendly = !ex.excludedByFlags.includes('knee');
  const canAdd = blocked.length === 0 && ex.phases.includes('work');

  const toggle = () => {
    setSaved((v) => !v);
    if (hasRepositories()) {
      void getRepositories()
        .favourites.toggle(ex.id, Date.now())
        .then((now) => setSaved(now))
        .catch(() => undefined);
    }
  };

  const rung = (label: string, icon: string, target: typeof easier, none: string) => (
    <Touchable
      label={target ? `${label}: ${exerciseName(content, target)}` : `${label}: ${none}`}
      onPress={target ? () => nav.navigate('Exercise', { exerciseId: target.id }) : undefined}
      disabled={!target}
      minSize={72}
      style={{ flex: 1, minHeight: 72, borderRadius: radius.l, backgroundColor: t.c3, padding: space.m, gap: space.xs }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Icon name={icon} size={18} color="osv" />
        <Text variant="label" color="osv">
          {label}
        </Text>
      </View>
      <Text variant="bodySmall" style={{ fontWeight: '600' }}>
        {target ? exerciseName(content, target) : none}
      </Text>
    </Touchable>
  );

  return (
    <Page
      topBar={{
        leading: 'back',
        onLeading: back,
        trailing: [{ icon: saved ? 'bookmark' : 'bookmark_border', label: saved ? 'Remove from favourites' : 'Save to favourites', onPress: toggle }],
      }}
      footer={<FilledButton label="Add to today" leadingIcon="add" disabled={!canAdd} onPress={() => nav.navigate('Editor', { addExerciseId: ex.id })} />}
    >
      <Card tone="tc" radiusSize={28} style={{ alignItems: 'center', gap: space.m }}>
        <View accessible accessibilityRole="image" accessibilityLabel={content.t(ex.demo.altKey)} style={{ alignItems: 'center', gap: space.s }}>
          <Icon name={exerciseIcon(ex)} size={72} color="otc" />
          <Text variant="bodySmall" color="otc" style={{ textAlign: 'center' }}>
            {content.t(ex.demo.altKey)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon name="repeat" size={16} color="otc" />
          <Text variant="label" color="otc">
            Demo loop
          </Text>
        </View>
      </Card>
      <Text variant="headline" accessibilityRole="header">
        {exerciseName(content, ex)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
        <Badge label={DIFFICULTY_LABEL[ex.difficulty]} tone="sc" />
        <Badge label={partsLabel(ex, content)} tone="c4" />
        <Badge label="No equipment" tone="c4" />
        {kneeFriendly ? <Badge label="Knee-friendly" tone="tc" /> : null}
      </View>
      {blocked.length ? <InfoNote icon="block" tone="erc" text={`Hidden from your plan for your ${flagPhrase(blocked)}.`} /> : null}
      {caution.length ? <InfoNote icon="info" text={`Go gently if your ${flagPhrase(caution)} bother you. Stop if a move hurts.`} /> : null}
      <View style={{ gap: space.s }}>
        {ex.stepKeys.map((k, i) => (
          <View key={k} style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.pc, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="labelStrong" color="opc" tabular>
                {i + 1}
              </Text>
            </View>
            <Text style={{ flex: 1 }}>{content.t(k)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.s }}>
        {rung('Easier', 'arrow_downward', easier, 'This is the easiest')}
        {rung('Harder', 'arrow_upward', harder, 'This is the hardest')}
      </View>
      <InfoNote
        icon={ex.formCheckable ? 'videocam' : 'videocam_off'}
        text={
          ex.formCheckable
            ? 'Form check works for this move. The camera view stays on your phone.'
            : 'No camera check for this move. Form checks work on squat, push-up, plank and lunge.'
        }
      />
    </Page>
  );
}

// ---- A ready-made plan, as shown by the Plan route ----

export function ReadyMadePlanView({ id, data, back }: { id: string; data: PlanData; back: () => void }) {
  const nav = useBrowseNav();
  const content = loadContent();
  const plan = content.plan(id);
  const [added, setAdded] = useState(false);
  const [failed, setFailed] = useState(false);
  const bar = { leading: 'back' as const, onLeading: back };
  if (data.loading) return <Page topBar={bar}><View /></Page>;
  if (!plan) {
    return (
      <Page topBar={bar}>
        <EmptyState icon="event" title="We could not find that plan" body="Open it again from the plan library.">
          <FilledButton label="See all plans" onPress={() => nav.navigate('Library')} />
        </EmptyState>
      </Page>
    );
  }

  const flags = contentFlags(data.profile);
  const safe = isSafePlan(content, plan.id, flags);
  const micro = plan.kind === 'micro';
  const session = micro ? null : sessionFromReadyMade(plan, content, restrictionsOf(data.profile), 'preview');
  const mins = phaseMinutes(session);
  const moves = micro ? plan.work.map((m, i) => ({ id: `${m.exerciseId}-${i}`, exerciseId: m.exerciseId, name: '', sets: m.sets, workS: m.workS })) : workSteps(session);
  const today = data.rows.find((r) => r.dayIndex === data.clock?.dayIndex);

  const addToPlan = async () => {
    const live = sessionFromReadyMade(plan, content, restrictionsOf(data.profile), getSessionDeps().newId());
    if (!live || !today) return;
    try {
      await persistSession(getRepositories(), today.planWeek, today.dayIndex, live);
      setAdded(true);
      void data.reload();
    } catch {
      setFailed(true);
    }
  };

  return (
    <Page
      topBar={bar}
      footer={
        micro ? (
          <FilledButton label="Start desk reset" leadingIcon="play_arrow" onPress={() => nav.navigate('Desk')} disabled={!safe} />
        ) : (
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <TonalButton label="Add to my plan" onPress={() => void addToPlan()} disabled={!safe || !today || added} style={{ flex: 1 }} />
            <FilledButton label="Start now" leadingIcon="play_arrow" onPress={() => startReadyMadePlan(nav, plan.id, data)} disabled={!safe} style={{ flex: 1 }} />
          </View>
        )
      }
    >
      <Card tone="pc" style={{ gap: space.s }}>
        <Text variant="label" color="opc">
          Ready-made plan
        </Text>
        <Text variant="display" color="opc" accessibilityRole="header">
          {planTitle(content, plan)}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.s, flexWrap: 'wrap' }}>
          <Badge label={`${micro ? planMinutes(plan) : mins.total} min`} tone="sc" />
          <Badge label="No equipment" tone="sc" />
          <Badge label={cap(plan.style)} tone="sc" />
          <Badge label={LEVEL_LABEL[plan.level]} tone="sc" />
        </View>
      </Card>
      <Text color="osv">{content.t(plan.blurbKey)}</Text>
      {!safe ? <InfoNote icon="block" tone="erc" text={`This plan is hidden for your ${flagPhrase(flags)}.`} /> : null}
      {added ? <InfoNote icon="check_circle" tone="tc" text="Added. This is now today's session." /> : null}
      {failed ? <InfoNote icon="info" tone="erc" text="We could not add that. Try again in a moment." /> : null}
      {session ? <SessionSegmentBar warm={mins.warm} work={mins.work} cool={mins.cool} height={32} /> : null}
      <Text variant="title" tabular accessibilityRole="header">
        {moves.length} {moves.length === 1 ? 'move' : 'moves'}
      </Text>
      <View style={{ gap: space.s }}>
        {moves.map((m) => {
          const ex = content.exercise(m.exerciseId);
          return (
            <ListRow
              key={m.id}
              icon="sports_gymnastics"
              title={ex ? exerciseName(content, ex) : m.name}
              subtitle={ex ? content.t(ex.cueKey) : undefined}
              trailing={`${m.sets} × ${m.workS}s`}
              tone="c3"
              onPress={() => nav.navigate('Exercise', { exerciseId: m.exerciseId })}
            />
          );
        })}
      </View>
      {!micro ? (
        <Text variant="bodySmall" color="osv">
          Warm-up and cool-down are included.
        </Text>
      ) : null}
    </Page>
  );
}
