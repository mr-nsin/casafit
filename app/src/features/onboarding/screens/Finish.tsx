// Building and WeekOne.

import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { OnboardingDraft, PlanDayRow } from '../../../db/repositories';
import type { PlanDay, SessionPlan } from '../../../engine';
import { addDays, parseDate } from '../../../engine';
import { useOnboarding } from '../../../state/onboardingDraft';
import { getRepositories } from '../../../state/storage';
import {
  Badge,
  BlobBackground,
  Card,
  ChecklistItem,
  FilledButton,
  ProgressRing,
  SessionSegmentBar,
  StatusBanner,
  Text,
  TextButton,
  TonalButton,
  WeekStrip,
  space,
  useReducedMotion,
} from '../../../ui';
import { Layout, useOnboardingNav } from '../Layout';
import { buildAndSavePlan } from '../buildAndSave';
import { getOnboardingDeps, todayKey } from '../deps';
import { useVerifyOutcome } from '../flowState';
import { formatClock } from '../logic';

const STAGE_MS = 450;
const STAGES = 4;

export function buildingRows(d: OnboardingDraft): string[] {
  const styleText = d.styles.length ? d.styles.map((s) => s[0]!.toUpperCase() + s.slice(1)).join(', ') : 'Normal';
  const rows = [`${d.daysPerWeek} days a week: ${styleText}`];
  if (d.painAreas.includes('knees')) rows.push('Skipping lunges because of your knee');
  else if (d.painAreas.length) rows.push('Leaving out moves that could hurt');
  else rows.push(d.healthFlags.length ? 'Choosing a gentler start' : 'Choosing moves for your level');
  rows.push(d.goal === 'body_part' && d.bodyParts.length ? `Matching warm-ups to ${d.bodyParts.join(' and ')}` : 'Matching warm-ups to your week');
  rows.push('Building matching cool-downs');
  return rows;
}

export function BuildingScreen() {
  const nav = useOnboardingNav();
  const reduced = useReducedMotion();
  const [snapshot] = useState(() => useOnboarding.getState().draft);
  const [stage, setStage] = useState(0);
  const [built, setBuilt] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const rows = buildingRows(snapshot);

  useEffect(() => {
    let alive = true;
    buildAndSavePlan(snapshot)
      .then(() => alive && setBuilt(true))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (stage >= STAGES) return undefined;
    const id = setTimeout(() => setStage((s) => s + 1), reduced ? 0 : STAGE_MS);
    return () => clearTimeout(id);
  }, [stage, reduced]);

  const done = built && stage >= STAGES;
  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(() => nav.replace('WeekOne'), reduced ? 0 : 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const pct = failed ? 0 : Math.round((Math.min(stage, built ? STAGES : STAGES - 1) / STAGES) * 100);
  return (
    <Layout
      background={<BlobBackground variant="b" />}
      footer={<TonalButton label="See my plan" disabled={!done} onPress={() => nav.replace('WeekOne')} />}
    >
      <View style={{ alignItems: 'center', gap: space.l, paddingTop: space.xxl }}>
        <ProgressRing value={pct} max={100} size={224} stroke={12} a11yLabel={`Plan ${pct} percent built`} center={<Text variant="headline" tabular>{pct}</Text>} />
        <Text variant="headline">Cooking up your week one</Text>
        <Text color="osv">Rules on your phone build this, so it works offline.</Text>
      </View>
      {failed ? (
        <>
          <StatusBanner variant="error">We could not save your plan. Your answers are safe. Try again.</StatusBanner>
          <FilledButton label="Try again" onPress={() => {
            setFailed(false);
            setBuilt(false);
            setAttempt((a) => a + 1);
          }} />
        </>
      ) : (
        rows.map((r, i) => <ChecklistItem key={r} label={r} state={i < stage ? 'done' : i === stage ? 'active' : 'pending'} />)
      )}
    </Layout>
  );
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function WeekOneScreen() {
  const nav = useOnboardingNav();
  const plan = useVerifyOutcome((s) => s.plan);
  const fellBack = useVerifyOutcome((s) => s.fellBackToNormal);
  const [rows, setRows] = useState<PlanDayRow[]>([]);
  const deps = getOnboardingDeps();
  const start = todayKey(deps.now());

  useEffect(() => {
    void getRepositories().plan.days(plan?.weekNumber ?? 1).then(setRows);
  }, [plan]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const row = rows.find((r) => r.dayIndex === i);
    const label = WEEKDAY[new Date(parseDate(addDays(start, i))).getUTCDay()]!;
    const kind = i === 0 ? ('today' as const) : row?.kind === 'workout' ? ('planned' as const) : row && row.kind !== 'rest' ? ('active-rest' as const) : ('rest' as const);
    const caption = i === 0 ? 'Today' : row?.kind === 'workout' ? cap(row.style ?? 'Session') : row ? cap(row.kind) : '';
    return { day: label, kind, caption };
  });

  const todayRow = rows.find((r) => r.dayIndex === 0);
  const session: SessionPlan | null = todayRow?.sessionJson ? (JSON.parse(todayRow.sessionJson) as SessionPlan) : null;
  const moves = session ? session.steps.filter((s) => s.phase === 'work') : [];
  const totalS = session ? session.steps.reduce((a, s) => a + (s.workS + s.restS) * s.sets + s.transitionS, 0) : 900;
  const skipped = plan?.skipped ?? [];
  const why = plan?.why.map((w) => w.text).join(' ') ?? 'Built from your answers, on this phone.';

  const startToday = () => {
    const day = plan?.days[0] as PlanDay | undefined;
    const route = day?.session ? deps.startToday(day) : null;
    nav.reset({ index: route ? 1 : 0, routes: route ? [{ name: 'Main' }, { name: route }] : [{ name: 'Main' }] });
  };

  return (
    <Layout
      topBar={{ leading: 'none' }}
      footer={
        <>
          <FilledButton label="Start today's session" leadingIcon="play_arrow" onPress={startToday} />
          <TextButton label="Look around first" onPress={() => nav.reset({ index: 0, routes: [{ name: 'Main' }] })} />
        </>
      }
    >
      <Badge label="Your plan is ready" />
      <Text variant="headline" accessibilityRole="header">Week one</Text>
      <Text color="osv">Why this plan: {why}</Text>
      {fellBack ? (
        <StatusBanner variant="info">We started you with Normal sessions while we add more moves for your other styles. You can change styles in My plan.</StatusBanner>
      ) : null}
      <Text variant="bodySmall" color="osv">Your week starts today and runs seven days.</Text>
      <WeekStrip days={days} />
      <Card tone="pc">
        <Text variant="title" color="opc">{session?.title ?? 'Today'}</Text>
        <Text color="opc" tabular>{formatClock(totalS)}</Text>
        <SessionSegmentBar warm={2} work={11} cool={2} height={32} />
        <Text variant="bodySmall" color="opc" tabular>{moves.length} moves</Text>
        {moves.map((m, i) => (
          <Text key={m.id} color="opc">{i + 1}. {m.name}</Text>
        ))}
        {skipped.length ? <Text variant="bodySmall" color="opc">{skipped.map((s) => s.name).join(', ')} skipped: {skipped[0]!.reason}</Text> : null}
      </Card>
    </Layout>
  );
}
