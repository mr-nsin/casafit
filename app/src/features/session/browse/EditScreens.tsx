// Editor, Picker (a sheet over the editor), SessionParts and the "why was this skipped" explainer.
// The editor and picker share one working copy (editing.ts). Saving writes it to the plan day
// through the plan repository, so Plan, Home and Start show the change.

import React, { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '../../../app/types';
import { loadContent } from '../../../content';
import { getRepositories } from '../../../state/storage';
import {
  Badge,
  Card,
  ChipGroup,
  ConfirmDialog,
  EmptyState,
  FilledButton,
  Icon,
  IconButton,
  InfoNote,
  OutlinedButton,
  SearchField,
  SegmentedControl,
  SegmentedProgress,
  Text,
  TonalButton,
  Touchable,
  fixed,
  radius,
  space,
  useTokens,
} from '../../../ui';
import {
  SLOT_S,
  addExercise,
  budgetStatus,
  currentIntensity,
  exclusionReason,
  familyOf,
  intensityTiming,
  isEligible,
  musclesWorked,
  phaseS,
  pickerOptions,
  removeExercise,
  shortenRestToFit,
  swapExercise,
  withBudget,
  BODY_PARTS,
  type BodyPart,
  type EditResult,
  type PlanStep,
  type SessionPlan,
} from '../../../engine';
import { startSession } from '../start';
import { usePlanData, type PlanData } from './hooks';
import { EDIT_MESSAGES, clock, isDirty, moveWork, persistSession, useEditDraft } from './editing';
import { contentFlags, exerciseName, getCatalogueIndex } from './library';
import { DOT, WEEKDAY_LONG, cap, parsePlanDayKey, parseSession, planDayKey, stepSeconds, weekdayIndex, workSteps } from './model';
import { Page, useBackOrHome, useBrowseNav } from './Page';

const wordList = (items: string[]): string =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** The plan day a screen edits: the one named by `planDayId`, else today. */
function targetRow(data: PlanData, planDayId: string | undefined) {
  const key = parsePlanDayKey(planDayId);
  if (!data.clock) return undefined;
  return key ? data.rows.find((r) => r.planWeek === key.week && r.dayIndex === key.dayIndex) : data.rows.find((r) => r.dayIndex === data.clock!.dayIndex);
}

// ---- Editor ----

type EditorRoute = RouteProp<RootStackParamList, 'Editor'>;

function MoveRow({
  step,
  first,
  last,
  isNew,
  onUp,
  onDown,
  onSwap,
  onRemove,
}: {
  step: PlanStep;
  first: boolean;
  last: boolean;
  isNew: boolean;
  onUp: () => void;
  onDown: () => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const t = useTokens();
  const small = (icon: string, label: string, onPress: () => void, off: boolean) => (
    <Touchable label={label} onPress={onPress} disabled={off} minSize={44} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.35 : 1 }}>
      <Icon name={icon} size={22} color="osv" />
    </Touchable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 88, borderRadius: radius.l, backgroundColor: t.c3, paddingLeft: space.xs, paddingRight: space.xs, gap: space.xs }}>
      <View>
        {small('keyboard_arrow_up', `Move ${step.name} earlier`, onUp, first)}
        {small('keyboard_arrow_down', `Move ${step.name} later`, onDown, last)}
      </View>
      <View style={{ flex: 1, paddingVertical: space.s, gap: space.xs }}>
        <Text style={{ fontWeight: '600' }}>{step.name}</Text>
        {isNew ? <Badge label={`New +${clock(SLOT_S)}`} tone="tc" /> : null}
      </View>
      <Text color="osv" tabular>
        {clock(stepSeconds(step))}
      </Text>
      <IconButton icon="swap_horiz" label={`Swap ${step.name}`} onPress={onSwap} />
      <IconButton icon="close" label={`Remove ${step.name}`} onPress={onRemove} />
    </View>
  );
}

function FixedRow({ icon, title, seconds, onPress }: { icon: string; title: string; seconds: number; onPress: () => void }) {
  const t = useTokens();
  return (
    <Touchable
      label={`${title}, ${clock(seconds)}`}
      onPress={onPress}
      minSize={56}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.m, borderRadius: radius.l, backgroundColor: t.tc, paddingHorizontal: space.l }}
    >
      <Icon name={icon} color="otc" />
      <Text color="otc" style={{ flex: 1 }}>
        {title}
      </Text>
      <Text color="otc" tabular>
        {clock(seconds)}
      </Text>
    </Touchable>
  );
}

export function EditorScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const route = useRoute<EditorRoute>();
  const data = usePlanData();
  const draft = useEditDraft((s) => s.draft);
  const notice = useEditDraft((s) => s.notice);
  const setNotice = useEditDraft.getState().setNotice;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saving, setSaving] = useState(false);
  const applied = useRef<string | null>(null);
  const params = route.params;
  const index = getCatalogueIndex();
  const row = data.loading ? undefined : targetRow(data, params?.planDayId);
  const key = row ? planDayKey(row.planWeek, row.dayIndex) : null;

  useEffect(
    () => () => {
      useEditDraft.getState().clear();
    },
    [],
  );

  useEffect(() => {
    if (!row || !key) return;
    const session = parseSession(row);
    if (!session) return;
    const store = useEditDraft.getState();
    if (store.draft?.key !== key) store.init({ key, week: row.planWeek, dayIndex: row.dayIndex, session });
    const add = params?.addExerciseId;
    if (add && applied.current !== add) {
      applied.current = add;
      const r = addExercise(useEditDraft.getState().draft!.session, add, index);
      if (r.ok) {
        useEditDraft.getState().set(r.session);
        const ex = loadContent().exercise(add);
        useEditDraft.getState().setNotice(`Added ${ex ? exerciseName(loadContent(), ex) : 'the move'}.`);
      } else useEditDraft.getState().setNotice(EDIT_MESSAGES[r.reason]);
    }
    // The saved session text is the key to reload on; the row object changes on every focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, row?.sessionJson, params?.addExerciseId]);

  const title = !data.clock || !row || row.dayIndex === data.clock.dayIndex ? 'Edit today' : `Edit ${WEEKDAY_LONG[weekdayIndex(data.clock.dates[row.dayIndex]!)]}`;
  const bar = { title, leading: 'back' as const, onLeading: () => (isDirty(useEditDraft.getState().draft) ? setConfirmLeave(true) : back()) };

  if (data.loading) return <Page topBar={bar}><View /></Page>;
  if (!row || !parseSession(row)) {
    return (
      <Page topBar={{ title: 'Edit session', leading: 'back', onLeading: back }}>
        <EmptyState icon="event" title="Nothing to edit here" body="This day has no session. Pick a training day from your week." />
      </Page>
    );
  }
  if (!draft || draft.key !== key) return <Page topBar={bar}><View /></Page>;

  const session = draft.session;
  const status = budgetStatus(session);
  const warmS = phaseS(session, 'warmup');
  const coolS = phaseS(session, 'cooldown');
  const workS = phaseS(session, 'work');
  const moves = workSteps(session);
  const baseIds = new Set(workSteps(draft.baseline).map((s) => s.exerciseId));
  const over = status.overByS > 0;
  const setDraft = (s: SessionPlan) => useEditDraft.getState().set(s);
  const apply = (r: EditResult, ok: string) => {
    if (r.ok) {
      setDraft(r.session);
      setNotice(ok);
    } else setNotice(EDIT_MESSAGES[r.reason]);
  };

  const shorten = () => {
    const r = shortenRestToFit(session);
    if (r.ok) {
      setDraft(r.session);
      setNotice('Rests are shorter now.');
    } else setNotice('Rests are already as short as they go. Try removing one move.');
  };
  const goLonger = () => {
    const mins = Math.ceil(status.totalS / 60);
    setDraft(withBudget(session, mins * 60));
    setNotice(`Today is ${mins} minutes.`);
  };
  const removeLast = () => {
    const last = moves[moves.length - 1];
    if (last) apply(removeExercise(session, last.id, index), `Removed ${last.name}.`);
  };

  const justToday = () => {
    const stage = startSession(session, { planWeek: draft.week, planDay: draft.dayIndex });
    useEditDraft.getState().clear();
    nav.replace(stage);
  };
  const save = async () => {
    setSaving(true);
    try {
      await persistSession(getRepositories(), draft.week, draft.dayIndex, session);
      useEditDraft.getState().clear();
      // Opened from plan detail: land there again, whatever sits between (Picker, Exercise, Lunge).
      if (params?.from === 'plan' && key) nav.popTo('Plan', { planDayId: key });
      else back();
    } catch {
      setNotice('We could not save that. Your changes are still here.');
      setSaving(false);
    }
  };

  return (
    <>
      <Page
        topBar={bar}
        footer={
          <View style={{ flexDirection: 'row', gap: space.s }}>
            <TonalButton label="Just today" onPress={justToday} style={{ flex: 1 }} />
            <FilledButton label="Save to my plan" onPress={() => void save()} disabled={!isDirty(draft) || saving} style={{ flex: 1 }} />
          </View>
        }
      >
        <Card tone="c3" style={{ gap: space.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }} accessible accessibilityLabel={`${clock(status.totalS)} of ${clock(status.budgetS)}`}>
              <Text variant="display" color={over ? 'er' : 'on'} tabular>
                {clock(status.totalS)}
              </Text>
              <Text color="osv" tabular>
                / {clock(status.budgetS)}
              </Text>
            </View>
            {over ? (
              <Badge label={`Over by ${clock(status.overByS)}`} tone="erc" />
            ) : status.underByS > 0 ? (
              <Badge label={`${clock(status.underByS)} to spare`} tone="sc" />
            ) : (
              <Badge label="Right on time" tone="tc" />
            )}
          </View>
          <SegmentedProgress
            label={`Warm-up ${clock(warmS)}, work ${clock(workS)}, cool-down ${clock(coolS)}`}
            segments={[
              { weight: warmS, state: 'done', tone: 'tc' },
              { weight: workS, state: 'done', tone: over ? 'er' : 'p' },
              { weight: coolS, state: 'done', tone: 'sc' },
            ]}
          />
          <Text variant="bodySmall" color="osv" tabular>
            Warm-up {clock(warmS)} {DOT} {moves.length} moves {clock(workS)} {DOT} Cool-down {clock(coolS)}
          </Text>
        </Card>

        {notice ? <InfoNote icon="info" text={notice} /> : null}

        <View style={{ gap: space.s }}>
          <FixedRow icon="self_improvement" title="Warm-up, matched to your moves" seconds={warmS} onPress={() => nav.navigate('Parts', { part: 'warmup' })} />
          {moves.map((s, i) => (
            <MoveRow
              key={s.id}
              step={s}
              first={i === 0}
              last={i === moves.length - 1}
              isNew={!baseIds.has(s.exerciseId)}
              onUp={() => setDraft(moveWork(session, s.id, -1))}
              onDown={() => setDraft(moveWork(session, s.id, 1))}
              onSwap={() => nav.navigate('Picker', { stepId: s.id })}
              onRemove={() => apply(removeExercise(session, s.id, index), `Removed ${s.name}.`)}
            />
          ))}
          <FixedRow icon="spa" title="Cool-down, rebuilt for your moves" seconds={coolS} onPress={() => nav.navigate('Parts', { part: 'cooldown' })} />
        </View>

        <OutlinedButton label="Add an exercise" leadingIcon="add" onPress={() => nav.navigate('Picker')} />

        {over ? (
          <View style={{ gap: space.s }}>
            <Text variant="title" accessibilityRole="header">
              Fix the extra {status.overByS < 60 ? 'minute' : 'time'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
              <TonalButton label="Shorter rests" height={48} onPress={shorten} />
              <TonalButton label="Remove one" height={48} onPress={removeLast} />
              <TonalButton label={`Go ${Math.ceil(status.totalS / 60)} min today`} height={48} onPress={goLonger} />
            </View>
          </View>
        ) : null}
      </Page>
      <ConfirmDialog
        visible={confirmLeave}
        icon="edit"
        title="Leave without saving?"
        body="Your changes to this session will not be kept."
        onDismiss={() => setConfirmLeave(false)}
        actions={[
          { label: 'Keep editing', variant: 'filled', onPress: () => setConfirmLeave(false) },
          {
            label: 'Leave without saving',
            variant: 'text',
            onPress: () => {
              setConfirmLeave(false);
              back();
            },
          },
        ]}
      />
    </>
  );
}

// ---- Picker ----

type PickerRoute = RouteProp<RootStackParamList, 'Picker'>;

const reasonWord = (reason: string): string =>
  reason === 'gentler' ? 'gentler plan' : reason === 'quiet' ? 'quiet mode' : ['knees', 'back', 'shoulders', 'wrists'].includes(reason) ? reason : 'health answers';

export function PickerScreen() {
  const nav = useBrowseNav();
  const route = useRoute<PickerRoute>();
  const t = useTokens();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const draft = useEditDraft((s) => s.draft);
  const stepId = route.params?.stepId;
  const session = draft?.session;
  const replacing = session?.steps.find((s) => s.id === stepId);
  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<BodyPart[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const index = getCatalogueIndex();
  const content = loadContent();
  const close = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Editor'));

  const shell = (body: React.ReactNode) => (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: fixed.scrim }} />
      <View
        accessibilityViewIsModal
        accessibilityLabel={replacing ? 'Swap a move' : 'Add an exercise'}
        style={{ maxHeight: '88%', backgroundColor: t.c2, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingTop: space.m, paddingHorizontal: space.xl, paddingBottom: Math.max(insets.bottom, space.l), gap: space.m }}
      >
        <View style={{ alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: t.olv }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="headline" accessibilityRole="header">
            {replacing ? `Swap ${replacing.name}` : 'Add an exercise'}
          </Text>
          <IconButton icon="close" label="Close" onPress={close} />
        </View>
        {body}
      </View>
    </View>
  );

  if (!session) {
    return shell(<EmptyState icon="event" title="Open the editor first" body="Pick a session to edit, then add a move from there." />);
  }

  // Default filter: the part of the move being swapped, or the day's focus.
  const active: BodyPart[] = parts ?? (replacing ? replacing.muscles.slice(0, 1) : session.parts);
  const status = budgetStatus(session);
  const rung = currentIntensity(session);
  const q = query.trim().toLowerCase();
  const options = pickerOptions(session, index, { parts: active, style: session.style }).filter((o) => !q || o.exercise.name.toLowerCase().includes(q));
  const hiddenFamilies = new Map<string, { name: string; reason: string }>();
  if (active.length) {
    for (const ex of index.all) {
      if (ex.phase !== 'work' || ex.style !== session.style || !ex.muscles.some((m) => active.includes(m))) continue;
      if (isEligible(ex, session.restrictions)) continue;
      const fam = familyOf(ex);
      const reason = exclusionReason(ex, session.restrictions);
      if (reason && !hiddenFamilies.has(fam)) hiddenFamilies.set(fam, { name: ex.name, reason });
    }
  }
  const hidden = [...hiddenFamilies.values()].filter((h) => !q || h.name.toLowerCase().includes(q)).slice(0, 2);

  const info = replacing
    ? `Swapping keeps the session at ${clock(status.totalS)}.`
    : status.underByS >= SLOT_S
      ? `${clock(status.totalS)} now. Room for one more move (+${clock(SLOT_S)}) inside ${clock(status.budgetS)}.`
      : `${clock(status.totalS)} now. Another move goes over ${clock(status.budgetS)}, and you can fix that in the editor.`;

  const pick = (exerciseId: string) => {
    const r = replacing ? swapExercise(session, replacing.id, exerciseId, index) : addExercise(session, exerciseId, index);
    if (r.ok) {
      useEditDraft.getState().set(r.session);
      close();
    } else setError(EDIT_MESSAGES[r.reason]);
  };

  return shell(
    <>
      <InfoNote icon="schedule" text={info} />
      <SearchField value={query} onChange={setQuery} placeholder="Search moves" label="Search moves" />
      <ChipGroup
        label="Body parts"
        scrollable
        multi
        options={BODY_PARTS.map((p) => ({ value: p, label: cap(p) }))}
        selected={active}
        onChange={(next) => setParts(next)}
      />
      {error ? <InfoNote icon="info" tone="erc" text={error} /> : null}
      <View style={{ gap: space.s, paddingBottom: space.s }}>
        {options.map(({ exercise: ex, addsS }) => {
          const meta = [cap(ex.muscles[0] ?? 'full body'), content.exercise(ex.id)?.difficulty ? cap(content.exercise(ex.id)!.difficulty) : null, `2 × ${intensityTiming(ex.mode, rung).workS}s`]
            .filter(Boolean)
            .join(` ${DOT} `);
          const verb = replacing ? 'Swap in' : 'Add';
          return (
            <Touchable
              key={ex.id}
              label={`${verb} ${ex.name}, ${meta}`}
              onPress={() => pick(ex.id)}
              minSize={68}
              style={{ minHeight: 68, borderRadius: radius.l, backgroundColor: t.c3, flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.s }}
            >
              <View style={{ width: 48, height: 48, borderRadius: radius.m, backgroundColor: t.tc, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="sports_gymnastics" color="otc" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{ex.name}</Text>
                <Text variant="bodySmall" color="osv">
                  {meta}
                </Text>
              </View>
              <View style={{ minHeight: 40, borderRadius: radius.m, backgroundColor: t.sc, paddingHorizontal: space.m, justifyContent: 'center' }}>
                <Text variant="labelStrong" color="osc" tabular>
                  {replacing ? 'Swap in' : `Add +${clock(addsS)}`}
                </Text>
              </View>
            </Touchable>
          );
        })}
        {options.length === 0 ? <Text color="osv">No moves match. Try another body part.</Text> : null}
        {hidden.map((h) => (
          <View key={h.name} accessible accessibilityLabel={`${h.name}. Hidden for your ${reasonWord(h.reason)}`} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.m, borderRadius: radius.l, borderWidth: 1, borderStyle: 'dashed', borderColor: t.ol, paddingHorizontal: space.l, opacity: 0.8 }}>
            <Icon name="block" color="osv" />
            <View style={{ flex: 1 }}>
              <Text>{h.name}</Text>
              <Text variant="bodySmall" color="osv">
                Hidden for your {reasonWord(h.reason)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </>,
  );
}

// ---- SessionParts ----

type PartsRoute = RouteProp<RootStackParamList, 'Parts'>;
type PartKey = 'warmup' | 'work' | 'cooldown';

export function PartsScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const route = useRoute<PartsRoute>();
  const data = usePlanData();
  const draft = useEditDraft((s) => s.draft);
  const [part, setPart] = useState<PartKey>(route.params?.part ?? 'cooldown');
  const bar = { title: 'Session parts', leading: 'back' as const, onLeading: back };
  if (data.loading) return <Page topBar={bar}><View /></Page>;

  const row = targetRow(data, undefined);
  const session = draft?.session ?? parseSession(row);
  if (!session) {
    return (
      <Page topBar={bar}>
        <EmptyState icon="event" title="No session today" body="Warm-up and cool-down show up on a training day." />
      </Page>
    );
  }

  const steps = session.steps.filter((s) => s.phase === part);
  const total = phaseS(session, part);
  const worked = wordList(musclesWorked(session).map((m) => m));
  const label = part === 'warmup' ? 'Warm-up' : part === 'cooldown' ? 'Cool-down' : 'Work';
  const note =
    part === 'warmup'
      ? `Matched to today. You are working ${worked}, so we warm those up.`
      : part === 'cooldown'
        ? `Rebuilt for today. You trained ${worked}, so we stretch those.`
        : `Your ${steps.length} moves for today. Swap or add moves in the editor.`;

  return (
    <Page topBar={bar} footer={<FilledButton label="Back to my session" onPress={back} />}>
      <SegmentedControl
        label="Session part"
        height={48}
        value={part}
        onChange={setPart}
        options={[
          { value: 'warmup', label: 'Warm-up' },
          { value: 'work', label: 'Work' },
          { value: 'cooldown', label: 'Cool-down' },
        ]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text variant="headline" accessibilityRole="header">
          {label}
        </Text>
        <Text variant="headline" color="p" tabular>
          {clock(total)}
        </Text>
      </View>
      <InfoNote icon="autorenew" tone="tc" text={note} />
      <View style={{ gap: space.s }}>
        {steps.map((s, i) => (
          <PartRow key={s.id} n={i + 1} name={s.name} time={s.phase === 'work' ? `${s.sets} × ${s.workS}s` : `${s.workS}s`} />
        ))}
      </View>
      {part !== 'work' && session.budgetS === 900 ? (
        <Text variant="bodySmall" color="osv">
          Warm-up and cool-down are always 2 minutes each, so a 15-minute session stays 15 minutes.
        </Text>
      ) : null}
      <TonalButton label="Swap a move" leadingIcon="swap_horiz" onPress={() => nav.navigate('Editor')} />
    </Page>
  );
}

function PartRow({ n, name, time }: { n: number; name: string; time: string }) {
  const t = useTokens();
  return (
    <View accessible accessibilityLabel={`${n}. ${name}, ${time}`} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: space.m, borderRadius: radius.l, backgroundColor: t.c3, paddingHorizontal: space.l }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.pc, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="labelStrong" color="opc" tabular>
          {n}
        </Text>
      </View>
      <Text style={{ flex: 1 }}>{name}</Text>
      <Text color="osv" tabular>
        {time}
      </Text>
    </View>
  );
}

// ---- Lunge (why was this skipped) ----

type LungeRoute = RouteProp<RootStackParamList, 'Lunge'>;

const LEAD: Record<string, string> = {
  knee: 'You told us your knees hurt, so we skip moves that load them.',
  back: 'You told us your back hurts, so we skip moves that load it.',
  shoulder: 'You told us your shoulders hurt, so we skip moves that load them.',
  wrist: 'You told us your wrists hurt, so we skip moves that load them.',
  other_pain: 'You told us something hurts, so we skip moves that could load it.',
  heart_bp: 'Your heart or blood pressure answer rules this move out for now.',
  pregnancy: 'Your pregnancy or postpartum answer rules this move out for now.',
  recent_surgery: 'Your recent surgery answer rules this move out for now.',
};
const HEAD: Record<string, string> = {
  knee: 'We swapped a move for your knees',
  back: 'We swapped a move for your back',
  shoulder: 'We swapped a move for your shoulders',
  wrist: 'We swapped a move for your wrists',
  other_pain: 'We swapped a move for you',
};

export function LungeScreen() {
  const nav = useBrowseNav();
  const back = useBackOrHome();
  const route = useRoute<LungeRoute>();
  const data = usePlanData();
  const t = useTokens();
  const content = loadContent();
  const bar = { leading: 'back' as const, onLeading: back };
  if (data.loading) return <Page topBar={bar}><View /></Page>;

  const flags = contentFlags(data.profile);
  const skipped = content.exercise(route.params?.excludedExerciseId ?? 'lunge');
  if (!skipped) {
    return (
      <Page topBar={bar}>
        <EmptyState icon="event" title="Nothing was swapped" body="Every move in your plan suits your answers." />
      </Page>
    );
  }
  const blocking = content.blockingFlags(skipped, flags)[0];
  const gentler = !blocking && data.plan?.variant === 'gentler';
  const head = blocking ? (HEAD[blocking] ?? 'We swapped a move for your safety') : gentler ? 'We swapped a move to keep it gentle' : 'We swapped a move for you';
  const lead = blocking ? LEAD[blocking] : gentler ? 'Your plan is the gentler one, so we skip jumping and high-impact moves.' : 'This move does not fit your answers, so we left it out.';
  const replacement = content.replacementFor(skipped.id, flags);
  const swap = replacement && replacement.id !== skipped.id ? content.substitutionsFor(skipped.id, 'flag_swap').find((s) => s.toExerciseId === replacement.id) : undefined;
  const why = swap ? content.t(swap.reasonKey) : 'Works the same muscles and suits your answers.';
  const name = exerciseName(content, skipped);

  return (
    <Page
      topBar={bar}
      footer={
        <View style={{ gap: space.s }}>
          <FilledButton label="Got it" onPress={back} />
          <OutlinedButton label="Change pain areas" onPress={() => nav.navigate('About')} />
        </View>
      }
    >
      <Text variant="headline" accessibilityRole="header">
        {head}
      </Text>
      <Text color="osv">{lead}</Text>
      <Card tone="c3" style={{ gap: space.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.erc, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="block" color="eoc" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600' }}>{name}</Text>
            <Text variant="bodySmall" color="osv">
              Skipped
            </Text>
          </View>
        </View>
        {replacement && replacement.id !== skipped.id ? (
          <>
            <View style={{ alignItems: 'center' }}>
              <Icon name="arrow_downward" color="osv" />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.tc, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="arrow_upward" color="otc" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{exerciseName(content, replacement)}</Text>
                <Text variant="bodySmall" color="osv">
                  {why}
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </Card>
      <InfoNote
        icon="info"
        text={`If a move hurts at any point, stop. For ongoing pain, check with a doctor.${skipped.formCheckable ? ` ${name} is also hidden in the form camera.` : ''}`}
      />
    </Page>
  );
}
