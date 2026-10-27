// Verify (with the otperror states), Offline, WelcomeBack.

import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../../../state/auth';
import { useOnboarding } from '../../../state/onboardingDraft';
import { getRepositories, hasRepositories } from '../../../state/storage';
import {
  BottomSheet,
  ChecklistItem,
  FilledButton,
  IconBadge,
  Icon,
  OtpField,
  StatusBanner,
  Tabs,
  Text,
  TextButton,
  TextField,
  space,
} from '../../../ui';
import { Layout, useBack, useOnboardingNav } from '../Layout';
import { getOnboardingDeps } from '../deps';
import { useVerifyOutcome } from '../flowState';
import { formatClock, maskIdentifier } from '../logic';
import {
  normaliseIdentifier,
  sendCode,
  verifyCode,
  type Channel,
  type Identifier,
  type VerifyFailure,
} from '../authFlow';

const MAX_TRIES = 3;

type Props = { route?: { params?: { phone?: string; email?: string } } };

export function VerifyScreen({ route }: Props) {
  const nav = useOnboardingNav();
  const back = useBack('Welcome');
  const params = route?.params;
  const [channel, setChannel] = useState<Channel>(params?.email ? 'email' : 'phone');
  const [raw, setRaw] = useState(params?.phone ?? params?.email ?? '');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [id, setId] = useState<Identifier | null>(null); // set once a code has been sent
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<VerifyFailure | null>(null);
  const [tries, setTries] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const goOffline = () => nav.navigate('Offline');

  async function send(target: Identifier) {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setNotice(null);
    try {
      if (!(await getOnboardingDeps().isOnline())) return goOffline();
      const r = await sendCode(target);
      switch (r.kind) {
        case 'sent':
          setId(target);
          setCode('');
          setFailure(null);
          setTries(0);
          setCooldown(r.resendInSeconds);
          break;
        case 'throttled':
          setId(target);
          setCooldown(r.resendInSeconds);
          setNotice(
            r.limitReached
              ? `You have asked for 5 codes this hour. Try again in ${Math.ceil(r.resendInSeconds / 60)} min.`
              : `A code was sent a moment ago. You can ask again in ${formatClock(r.resendInSeconds)}.`,
          );
          break;
        case 'invalid':
          setFieldError(channel === 'phone' ? 'Enter a valid mobile number.' : 'Enter a valid email address.');
          break;
        case 'attestation_failed':
          setNotice('We could not check this device. Update CasaFit from the store and try again.');
          break;
        case 'offline':
          return goOffline();
        default:
          setNotice('Something went wrong sending the code. Try again in a moment.');
      }
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  function onSendPress() {
    const n = normaliseIdentifier(channel, raw);
    if (!n.ok) return setFieldError(n.error);
    setFieldError(undefined);
    void send({ channel, value: n.value });
  }

  async function onCode(v: string) {
    setCode(v);
    if (failure === 'wrong') setFailure(null);
    if (v.length !== 6 || !id || verifying) return;
    setVerifying(true);
    const r = await verifyCode(id, v);
    setVerifying(false);
    if (r.kind === 'ok') {
      useVerifyOutcome.getState().set({
        masked: maskIdentifier(id.channel, id.value),
        isNewAccount: r.isNewAccount,
        freeChecksRemaining: r.freeChecksRemaining,
      });
      // The stack is reset so Back never returns to Verify (D4).
      const hasPlan = hasRepositories() && !!(await getRepositories().plan.get());
      const adult = useOnboarding.getState().draft.confirmed18;
      const name = r.isNewAccount ? (adult ? 'Goals' : 'Age') : hasPlan ? 'WelcomeBack' : adult ? 'Goals' : 'Age';
      nav.reset({ index: 0, routes: [{ name }] });
    } else if (r.kind === 'failed') {
      setFailure(r.reason);
      if (r.reason === 'wrong') setTries((n) => n + 1);
    } else if (r.kind === 'offline') {
      goOffline();
    } else {
      setNotice('Something went wrong checking the code. Try again.');
    }
  }

  const triesLeft = Math.max(0, MAX_TRIES - tries);
  const locked = failure === 'no_tries_left' || (failure === 'wrong' && triesLeft === 0);
  const otpState = failure === 'wrong' || failure === 'expired' || locked ? 'error' : 'idle';
  const label = id ? (id.channel === 'phone' ? id.value : id.value) : '';

  return (
    <Layout
      topBar={{ leading: 'back', onLeading: id ? () => { setId(null); setCode(''); setFailure(null); setNotice(null); } : back }}
      footer={
        id ? (
          <FilledButton label="Verify and continue" loading={verifying} disabled={code.length !== 6 || locked} onPress={() => void onCode(code)} />
        ) : (
          <FilledButton label="Send code" loading={sending} disabled={!raw.trim()} onPress={onSendPress} />
        )
      }
    >
      <Text variant="headline">{id ? 'Enter the code' : channel === 'phone' ? 'Verify your number' : 'Verify your email'}</Text>
      {!id ? (
        <>
          <Tabs
            items={[
              { value: 'phone', label: 'Phone' },
              { value: 'email', label: 'Email' },
            ]}
            selected={channel}
            onSelect={(c) => {
              setChannel(c as Channel);
              setRaw('');
              setFieldError(undefined);
            }}
          />
          <TextField
            label={channel === 'phone' ? 'Mobile number' : 'Email address'}
            value={raw}
            onChange={setRaw}
            keyboardType={channel === 'phone' ? 'phone-pad' : 'email-address'}
            autoComplete={channel === 'phone' ? 'tel' : 'email'}
            error={fieldError}
            helper={channel === 'phone' ? '+91 is added if you leave the country code off' : undefined}
            testID="verify-identifier"
          />
          <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
            <Icon name="verified_user" color="osv" />
            <Text variant="bodySmall" color="osv" style={{ flex: 1 }}>
              We use this only to verify you and keep your free form checks yours.
            </Text>
            <TextButton label="Privacy notice" onPress={() => getOnboardingDeps().openPrivacyNotice()} />
          </View>
        </>
      ) : (
        <>
          <Text color="osv">Code sent to {label}</Text>
          <OtpField length={6} value={code} onChange={(v) => void onCode(v)} state={otpState} autoRead />
          {failure === 'wrong' && !locked ? (
            <StatusBanner variant="error">That code is not right. {triesLeft} {triesLeft === 1 ? 'try' : 'tries'} left.</StatusBanner>
          ) : null}
          {failure === 'expired' ? <StatusBanner variant="error">That code has expired. Ask for a new one.</StatusBanner> : null}
          {locked ? (
            <StatusBanner variant="error" icon="lock">
              Too many wrong codes. Ask for a new code to try again.
            </StatusBanner>
          ) : null}
          {cooldown > 0 ? (
            <Text color="osv" tabular accessibilityLabel={`Resend code in ${formatClock(cooldown)}`}>
              Resend code in {formatClock(cooldown)}
            </Text>
          ) : (
            <TextButton label="Resend code" onPress={() => void send(id)} />
          )}
          <TextButton
            label="Wrong number? Change it"
            onPress={() => {
              setId(null);
              setCode('');
              setFailure(null);
              setNotice(null);
            }}
          />
        </>
      )}
      {notice ? <StatusBanner variant="warning">{notice}</StatusBanner> : null}
    </Layout>
  );
}

export function OfflineScreen() {
  const nav = useOnboardingNav();
  const [checking, setChecking] = useState(false);
  const [still, setStill] = useState(false);
  const [why, setWhy] = useState(false);

  const retry = async () => {
    setChecking(true);
    const on = await getOnboardingDeps().isOnline();
    setChecking(false);
    if (on) nav.navigate('Verify');
    else setStill(true);
  };
  useEffect(() => {
    const t = setInterval(() => {
      void getOnboardingDeps().isOnline().then((on) => on && nav.navigate('Verify'));
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout
      footer={
        <>
          <FilledButton label="Try again" leadingIcon="refresh" loading={checking} onPress={() => void retry()} />
          <TextButton label="Why do you need this?" onPress={() => setWhy(true)} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.l, paddingTop: space.xxxl }}>
        <IconBadge icon="cloud_off" size={160} />
        <Text variant="headline" accessibilityRole="header">Connect to start</Text>
        <Text color="osv" style={{ textAlign: 'center' }}>
          CasaFit checks your number once. After that your workouts run with no connection.
        </Text>
      </View>
      <StatusBanner variant="neutral" icon="wifi_off">
        {still ? 'Still no internet connection. Try again when you are back online.' : 'No internet connection right now.'}
      </StatusBanner>
      <BottomSheet visible={why} title="Why we verify once" onDismiss={() => setWhy(false)}>
        <Text>
          Your free form checks and your plan belong to your account, so a new phone or a reinstall brings them back. We only need the
          internet for this one step.
        </Text>
      </BottomSheet>
    </Layout>
  );
}

export function WelcomeBackScreen() {
  const nav = useOnboardingNav();
  const outcome = useVerifyOutcome();
  const pro = useAuth((s) => s.pro);
  const checks = useAuth((s) => s.freeChecksRemaining);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (hasRepositories()) void getRepositories().profile.get().then((p) => setName(p?.name ?? null));
  }, []);
  const third = pro.active ? 'Pro is active: unlimited form checks' : `${checks} of 2 free form ${checks === 1 ? 'check' : 'checks'} left`;
  return (
    <Layout footer={<FilledButton label="Go to my home screen" onPress={() => nav.reset({ index: 0, routes: [{ name: 'Main' }] })} />}>
      <View style={{ alignItems: 'center', gap: space.m, paddingTop: space.xxxl }}>
        <IconBadge icon="waving_hand" size={96} shape="squircle" />
        <Text variant="headline" accessibilityRole="header">{name ? `Welcome back, ${name}` : 'Welcome back'}</Text>
        {outcome.masked ? <Text color="osv">{outcome.masked}</Text> : null}
      </View>
      <ChecklistItem state="done" label="Your plan and progress are on this phone" />
      <ChecklistItem state="done" label="Your saved meals and food log are here" />
      <ChecklistItem state="done" label={third} tone="tc" />
      <StatusBanner variant="plain">Free form checks belong to your account, not this phone.</StatusBanner>
    </Layout>
  );
}
