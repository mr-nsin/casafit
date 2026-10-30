// Camera permission, denied, no credits, framing, live check and result (m3-camera, m3-camdenied,
// m3-nocredits, m3-form, m3-live, m3-formresult).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';

import {
  BenefitRow,
  Card,
  Chip,
  CreditBadge,
  FilledButton,
  HeroIllustration,
  Icon,
  InfoRow,
  OutlinedButton,
  PrivacyNote,
  ScoreRing,
  SectionHeader,
  StatusBanner,
  TextButton,
  TipCard,
  radius,
  space,
  Text,
  useTokens,
} from '../../ui';
import { useConsent } from '../../state/consent';
import { getRepositories, hasRepositories } from '../../state/storage';
import type { PainArea } from '../../db/repositories';
import type { FormExercise } from '../../services/pose';
import { DarkScope } from '../session/components';
import { CameraSurface, FindingRow, FramingChip, NotReady, Page, SkeletonOverlay } from './components';
import { getFormCheckDeps } from './deps';
import { useProStatus } from './entitlements';
import { resolveCredits } from './gate';
import { useFormCheck } from './controller';
import { useBackOrHome, useEntitlementsLoaded, useFormNav, useFramingPreview, usePlayerOrHome } from './hooks';
import { AREA_LABEL, EXERCISE_LABEL, PRIVACY_LINE, RATING_LABEL, exerciseChoices, isHold } from './model';

const Dark = ({ children }: { children: React.ReactNode }) => <DarkScope>{children}</DarkScope>;

// --- CameraPermission ---------------------------------------------------------------------

export function CameraPermissionScreen() {
  const nav = useFormNav();
  const back = useBackOrHome();
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    setBusy(true);
    try {
      const result = await getFormCheckDeps().permission().request();
      if (result === 'granted') {
        // A separate consent line, kept as a record (it is also what Privacy shows and can withdraw).
        await useConsent.getState().record('camera', true, 'permission_primer').catch(() => undefined);
        nav.replace(await resolveCredits());
      } else if (result === 'denied') nav.replace('CameraDenied');
      else nav.replace('FormCheck');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      topBar={{ leading: 'back', onLeading: back }}
      footer={
        <>
          <Text variant="bodySmall" color="osv" style={{ textAlign: 'center' }}>
            You can change this any time in Settings.
          </Text>
          <FilledButton label="Allow camera" leadingIcon="photo_camera" loading={busy} onPress={() => void allow()} />
          <OutlinedButton label="Not now" onPress={back} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.m, paddingTop: space.l }}>
        <HeroIllustration>
          <Icon name="videocam" size={64} color="opc" />
        </HeroIllustration>
        <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Your camera stays on this phone
        </Text>
        <Text color="osv" style={{ textAlign: 'center' }}>
          We only need it to watch your form during a squat, push-up, plank or lunge.
        </Text>
      </View>
      <View style={{ gap: space.l }}>
        <BenefitRow icon="videocam_off" title="Nothing is recorded" body="No photos, no video, no audio." />
        <BenefitRow icon="cloud_off" title="Nothing is uploaded" body="Your body is analysed on the phone itself." />
        <BenefitRow icon="power_settings_new" title="Off when you leave" body="The camera closes as soon as the check ends." />
      </View>
    </Page>
  );
}

// --- CameraDenied -------------------------------------------------------------------------

export function CameraDeniedScreen() {
  const nav = useFormNav();
  const back = useBackOrHome();
  const toPlayer = usePlayerOrHome();

  // Back from system settings: if the camera is on now, carry on.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && getFormCheckDeps().permission().status() === 'granted') {
        void resolveCredits().then((r) => nav.replace(r));
      }
    });
    return () => sub.remove();
  }, [nav]);

  const how =
    Platform.OS === 'ios'
      ? 'Open Settings, find CasaFit, and turn on Camera.'
      : 'Open Settings, then Permissions, then Camera, and choose "Allow only while using the app".';

  return (
    <Page
      topBar={{ leading: 'back', onLeading: back }}
      footer={
        <>
          <FilledButton label="Open Settings" leadingIcon="settings" onPress={() => void getFormCheckDeps().openSettings()} />
          <TextButton label="Continue with voice cues only" onPress={toPlayer} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.m, paddingTop: space.l }}>
        <HeroIllustration>
          <Icon name="videocam_off" size={64} color="opc" />
        </HeroIllustration>
        <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          The camera is off for CasaFit
        </Text>
        <Text color="osv" style={{ textAlign: 'center' }}>
          Form checks need the camera. It watches only while a check runs. Nothing is recorded, saved or uploaded.
        </Text>
      </View>
      <InfoRow icon="settings" text={how} />
      <InfoRow icon="check_circle" text="This did not use one of your free checks." tone="success" />
    </Page>
  );
}

// --- NoCredits ----------------------------------------------------------------------------

export function NoCreditsScreen() {
  const nav = useFormNav();
  const toPlayer = usePlayerOrHome();
  useEntitlementsLoaded();
  const t = useTokens();
  return (
    <Page
      topBar={{ leading: 'close', onLeading: toPlayer }}
      footer={
        <>
          <FilledButton label="See Pro" onPress={() => nav.navigate('Paywall')} />
          <TextButton label="Keep training with voice cues" onPress={toPlayer} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.m }}>
        <CreditBadge remaining={0} variant="tiles" />
        <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          You have used both free form checks
        </Text>
        <Text color="osv" style={{ textAlign: 'center' }}>
          Free checks are for the whole life of your account. They do not come back on a new day or after a reinstall.
        </Text>
      </View>
      <View style={{ backgroundColor: t.pc, borderRadius: radius.xxl, padding: space.xl, gap: space.m }}>
        <Text variant="labelStrong" color="opc">
          CasaFit Pro
        </Text>
        <Text variant="title" color="opc">
          Check your form as often as you like
        </Text>
        {['Squat, push-up, plank and lunge', 'Still on this phone. Nothing is recorded.', 'Restores on any phone once you verify'].map((s) => (
          <View key={s} style={{ flexDirection: 'row', gap: space.m }}>
            <Icon name="check_circle" size={20} color="opc" />
            <Text variant="bodySmall" color="opc" style={{ flex: 1 }}>
              {s}
            </Text>
          </View>
        ))}
      </View>
      <InfoRow icon="info" text="Using a new phone? Verify the same number or email and your account, plan and Pro come back." />
    </Page>
  );
}

// --- FormCheck ----------------------------------------------------------------------------

function usePainAreas(): PainArea[] {
  const [areas, setAreas] = useState<PainArea[]>([]);
  useEffect(() => {
    if (!hasRepositories()) return;
    let live = true;
    void getRepositories()
      .profile.get()
      .then((p) => live && setAreas(p?.painAreas ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return areas;
}

/** "3 analysed reps" or "a 10 second hold". */
const spendAfter = (e: FormExercise): string => (isHold(e) ? 'a 10 second hold' : '3 analysed reps');

export function FormCheckScreen() {
  const nav = useFormNav();
  const toPlayer = usePlayerOrHome();
  const ent = useEntitlementsLoaded();
  const pro = useProStatus().active;
  const painAreas = usePainAreas();
  const exercise = useFormCheck((s) => s.exercise);
  const select = useFormCheck((s) => s.select);
  const start = useFormCheck((s) => s.start);
  const phase = useFormCheck((s) => s.phase);
  const [starting, setStarting] = useState(false);

  const source = getFormCheckDeps().poseSource(exercise);
  const framing = useFramingPreview(exercise, source.available);
  const choices = exerciseChoices(painAreas);

  // A fresh visit starts clean: nothing from an earlier check is kept.
  useEffect(() => {
    useFormCheck.getState().reset();
  }, []);

  // Pain flags can switch the chosen exercise off: move to the first one that is allowed.
  useEffect(() => {
    if (choices.find((c) => c.id === exercise)?.disabled) {
      const first = choices.find((c) => !c.disabled);
      if (first) select(first.id);
    }
  }, [choices, exercise, select]);

  // No free checks and not Pro: the gate comes before the camera opens.
  useEffect(() => {
    if (ent.hydrated && !pro && ent.freeChecks <= 0) nav.replace('NoCredits');
  }, [ent.hydrated, ent.freeChecks, pro, nav]);

  const go = async () => {
    setStarting(true);
    try {
      const r = await start();
      if (r === 'started') nav.navigate('LiveCheck');
    } finally {
      setStarting(false);
    }
  };

  const unavailable = !source.available || phase === 'unavailable';
  if (unavailable) {
    return (
      <Dark>
        <NotReady onBack={toPlayer} />
      </Dark>
    );
  }

  const disabled = choices.filter((c) => c.disabled);
  const bodyChip = framing.body
    ? framing.body.ok
      ? { kind: 'ok' as const, text: 'Whole body in frame' }
      : { kind: 'hint' as const, text: framing.body.hint === 'closer' ? 'Step a little closer' : 'Step back a little' }
    : { kind: 'hint' as const, text: 'Stand side-on, whole body in view' };

  return (
    <Dark>
      <Page
        topBar={{ title: 'Form check', leading: 'back', onLeading: toPlayer, right: <View style={{ marginRight: space.s }}><CreditBadge remaining={pro ? 'unlimited' : ent.freeChecks} /></View> }}
        footer={
          <>
            {pro ? null : (
              <View accessible style={{ gap: space.xs }}>
                <Text variant="body" accessibilityRole="text">
                  {ent.freeChecks <= 1 ? 'This will use your last free form check.' : `This will use 1 of your ${ent.freeChecks} free form checks.`}
                </Text>
                <Text variant="bodySmall" color="osv">
                  {`It's only spent after ${spendAfter(exercise)}. Stop before that and it's free.`}
                </Text>
              </View>
            )}
            <OutlinedButton label={framing.running ? 'Stop framing check' : 'Check framing (free)'} leadingIcon="center_focus_strong" onPress={framing.toggle} />
            <FilledButton label="Start analysis" leadingIcon="play_arrow" loading={starting} onPress={() => void go()} />
          </>
        }
      >
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {choices.map((c) => (
            <Chip key={c.id} role="radio" label={c.label} icon={c.disabled ? 'block' : undefined} selected={c.id === exercise} disabled={c.disabled} onPress={() => select(c.id)} />
          ))}
        </View>
        {disabled.map((c) => (
          <Text key={c.id} variant="bodySmall" color="osv">
            {c.reason}
          </Text>
        ))}
        <CameraSurface style={{ minHeight: 320 }}>
          <View style={{ width: '70%', maxWidth: 280, paddingVertical: space.l }}>
            <SkeletonOverlay mode="guide" label="Guide: stand side-on so your whole body, head to feet, fits inside the corners" />
          </View>
        </CameraSurface>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          <FramingChip kind={bodyChip.kind} text={bodyChip.text} />
          {framing.lightOk !== null ? <FramingChip kind={framing.lightOk ? 'ok' : 'hint'} text={framing.lightOk ? 'Light OK' : 'More light helps'} /> : null}
        </View>
        <PrivacyNote text={PRIVACY_LINE} />
      </Page>
    </Dark>
  );
}

// --- LiveCheck ----------------------------------------------------------------------------

const FRAMING_TEXT = {
  lost: 'We lost you. Step back into view.',
  closer: 'Step a little closer',
  back: 'Step back a little',
  position: 'Get into position',
} as const;

export function LiveCheckScreen() {
  const nav = useFormNav();
  const t = useTokens();
  useEntitlementsLoaded();
  const s = useFormCheck();
  const finish = useFormCheck((x) => x.finish);
  const cancel = useFormCheck((x) => x.cancel);
  const label = s.startedAs ? (s.startedAs.pro ? `${EXERCISE_LABEL[s.exercise]} · Pro` : `${EXERCISE_LABEL[s.exercise]} · free check ${s.startedAs.number} of 2`) : EXERCISE_LABEL[s.exercise];

  // Opened without a running attempt (cold link, or the app was restarted): back to the picker.
  const hadAttempt = useRef(false);
  useEffect(() => {
    if (s.phase === 'running' || s.phase === 'counted') hadAttempt.current = true;
    else if (s.phase === 'idle' && !hadAttempt.current) nav.replace('FormCheck');
  }, [s.phase, nav]);

  const close = useCallback(async () => {
    if (useFormCheck.getState().phase === 'counted') {
      await finish();
      nav.replace('FormResult');
    } else {
      // Before the count point: discard, spend nothing, back to the picker (flag A5).
      await cancel();
      nav.goBack();
    }
  }, [finish, cancel, nav]);

  // The camera closes on background and on leaving the screen.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') void closeRef.current();
    });
    return () => sub.remove();
  }, []);
  useEffect(
    () => () => {
      if (useFormCheck.getState().phase === 'running') void useFormCheck.getState().cancel();
    },
    [],
  );

  if (s.phase === 'unavailable') {
    return (
      <Dark>
        <NotReady onBack={() => nav.goBack()} />
      </Dark>
    );
  }

  const hold = isHold(s.exercise);
  const counted = s.phase === 'counted';
  const need = Math.max(0, 3 - s.reps);
  const framingText = s.framing && !s.framing.ok && s.framing.hint ? FRAMING_TEXT[s.framing.hint] : null;
  const flagged = !!s.cue;

  return (
    <Dark>
      <Page
        gap={space.m}
        topBar={{
          title: label,
          leading: 'close',
          onLeading: () => void close(),
        }}
        footer={
          <>
            {counted ? <FilledButton label="See result" trailingIcon="arrow_forward" onPress={() => void close()} /> : null}
            <View style={{ flexDirection: 'row', gap: space.s, justifyContent: 'center', alignItems: 'center', minHeight: 24 }}>
              <Icon name="videocam_off" size={16} color="osv" />
              <Text variant="label" color="osv">
                Nothing is recorded or saved
              </Text>
            </View>
          </>
        }
      >
        <CameraSurface style={{ minHeight: 360 }}>
          <View style={{ width: '70%', maxWidth: 280, paddingVertical: space.l }}>
            <SkeletonOverlay mode="live" flagged={flagged} label={flagged ? `Your body outline. Check your ${s.cue?.toLowerCase()}` : 'Your body outline. Joints look steady'} />
          </View>
        </CameraSurface>

        <View accessibilityRole="text" accessibilityLiveRegion="polite" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          {framingText ? (
            <StatusBanner variant="plain">{framingText}</StatusBanner>
          ) : s.cue ? (
            <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center', backgroundColor: t.erc, borderRadius: radius.l, paddingHorizontal: space.l, minHeight: 44 }}>
              <Icon name="priority_high" size={20} color="eoc" />
              <Text variant="title" color="eoc">
                {s.cue}
              </Text>
            </View>
          ) : null}
        </View>

        <Card tone="c3">
          <View style={{ gap: space.xs, alignItems: 'center' }}>
            {hold ? (
              <>
                <Text variant="label" color="osv">
                  Hold time
                </Text>
                <Text variant="display" tabular>{`${Math.floor(s.holdMs / 1000)}`}</Text>
                <Text variant="bodySmall" color="osv">
                  {counted ? '10 seconds held. This check now counts.' : 'of 10 seconds to count'}
                </Text>
              </>
            ) : (
              <>
                <Text variant="label" color="osv">
                  Reps analysed
                </Text>
                <Text variant="display" tabular>{`${s.reps}`}</Text>
                <Text variant="bodySmall" color="osv">
                  {counted ? '3 reps done. This check now counts.' : `${need} more to count`}
                </Text>
              </>
            )}
          </View>
        </Card>
      </Page>
    </Dark>
  );
}

// --- FormResult ---------------------------------------------------------------------------

export function FormResultScreen() {
  const nav = useFormNav();
  const toPlayer = usePlayerOrHome();
  const result = useFormCheck((s) => s.result);
  const reset = useFormCheck((s) => s.reset);

  const done = () => {
    reset();
    toPlayer();
  };

  if (!result) {
    return (
      <Page topBar={{ title: 'Form check', leading: 'back', onLeading: toPlayer }} footer={<FilledButton label="Done" onPress={toPlayer} />}>
        <Text color="osv">There is no result to show. A result is only kept while you are on this screen.</Text>
      </Page>
    );
  }

  const hold = result.exercise === 'plank';
  const unlimited = result.creditsLeft === 'unlimited';
  const left = unlimited ? 0 : (result.creditsLeft as number);
  const sentence = hold
    ? `You held a plank for ${result.holdSeconds ?? 0} seconds. Nothing was recorded or saved.`
    : `${result.repsClean} of ${result.repsAnalysed} reps were clean. Nothing was recorded or saved.`;
  const note =
    result.spend === 'overdrawn'
      ? 'Your free checks were already used on another phone, so this one was on us.'
      : result.spend === 'local'
        ? "You're offline. We'll update your count when you are back online."
        : null;

  return (
    <Page
      topBar={{
        title: `${EXERCISE_LABEL[result.exercise]} check`,
        leading: 'back',
        onLeading: done,
        right: unlimited ? undefined : <View style={{ marginRight: space.s }}><CreditBadge remaining={left} /></View>,
      }}
      footer={
        unlimited ? (
          <FilledButton label="Done" onPress={done} />
        ) : left > 0 ? (
          <>
            <OutlinedButton label="Unlimited in Pro" onPress={() => nav.navigate('Paywall')} />
            <FilledButton label="Done" onPress={done} />
          </>
        ) : (
          <>
            <FilledButton label="Unlimited in Pro" onPress={() => nav.navigate('Paywall')} />
            <TextButton label="Done" onPress={done} />
          </>
        )
      }
    >
      <View style={{ alignItems: 'center', gap: space.m }}>
        <ScoreRing
          value={result.repsClean}
          max={Math.max(1, result.repsAnalysed)}
          size={176}
          stroke={14}
          tone={result.rating === 'needs_work' ? 's' : 'p'}
          a11yLabel={`Form rating: ${RATING_LABEL[result.rating].toLowerCase()}. ${hold ? `${result.holdSeconds ?? 0} seconds held` : `${result.repsClean} of ${result.repsAnalysed} reps clean`}`}
          center={
            <Text variant="display" tabular>
              {hold ? `${result.holdSeconds ?? 0}s` : `${result.repsClean}/${result.repsAnalysed}`}
            </Text>
          }
        />
        <Text variant="headline" accessibilityRole="header">
          {RATING_LABEL[result.rating]}
        </Text>
        <Text color="osv" style={{ textAlign: 'center' }}>
          {sentence}
        </Text>
      </View>

      {note ? <InfoRow icon="info" text={note} /> : null}

      <View style={{ gap: space.s }}>
        <SectionHeader title={hold ? 'Every 5 seconds' : 'Rep by rep'} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
          {result.perRep.map((r) => (
            <RepChip key={r.index} index={r.index} ok={r.ok} issue={r.issue} hold={hold} />
          ))}
        </View>
      </View>

      <View style={{ gap: space.s }}>
        {result.findings.map((f) => (
          <FindingRow key={f.area} status={f.status} title={AREA_LABEL[f.area]} text={f.text} />
        ))}
      </View>

      <TipCard text={result.tip} />
    </Page>
  );
}

function RepChip({ index, ok, issue, hold }: { index: number; ok: boolean; issue?: keyof typeof AREA_LABEL; hold: boolean }) {
  const t = useTokens();
  const what = hold ? 'Block' : 'Rep';
  return (
    <View
      accessible
      accessibilityLabel={ok ? `${what} ${index}, clean` : `${what} ${index}, ${issue ? `${AREA_LABEL[issue].toLowerCase()} needs attention` : 'needs attention'}`}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? t.tc : t.erc }}
    >
      <Icon name={ok ? 'check' : 'priority_high'} size={20} color={ok ? 'otc' : 'eoc'} />
    </View>
  );
}

