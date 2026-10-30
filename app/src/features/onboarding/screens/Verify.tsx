// Sign in (Verify route, with the otperror states), Offline, WelcomeBack.
// Sign-in is Supabase Auth: an emailed 6-digit code, or Google, Apple or Facebook. See ../authFlow.ts.

import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { maskEmail } from '@casafit/shared';

import { getAuth, describeSignIn, EMAIL_CODE_LENGTH, type SocialProvider } from '../../../services/auth';
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
  OutlinedButton,
  StatusBanner,
  Text,
  TextButton,
  TextField,
  TonalButton,
  space,
} from '../../../ui';
import { Layout, useBack, useOnboardingNav } from '../Layout';
import { getOnboardingDeps } from '../deps';
import { useVerifyOutcome } from '../flowState';
import { formatClock } from '../logic';
import {
  PROVIDER_LABEL,
  sendCode,
  signInAsDev,
  signInWithSocial,
  socialProvidersFor,
  validateEmail,
  verifyCode,
  type SignedIn,
  type VerifyFailure,
} from '../authFlow';

const MAX_TRIES = 3;

type Props = { route?: { params?: { email?: string } } };
type Working = 'email' | SocialProvider | 'dev' | null;

export function VerifyScreen({ route }: Props) {
  const nav = useOnboardingNav();
  const back = useBack('Welcome');
  const auth = getAuth();
  const [raw, setRaw] = useState(route?.params?.email ?? '');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [email, setEmail] = useState<string | null>(null); // set once a code has been sent
  const [sentAt, setSentAt] = useState(0);
  const [working, setWorking] = useState<Working>(null);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<VerifyFailure | null>(null);
  const [tries, setTries] = useState(0);
  const [notice, setNotice] = useState<{ text: string; tone: 'warning' | 'neutral' } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const goOffline = () => nav.navigate('Offline');
  const warn = (text: string) => setNotice({ text, tone: 'warning' });

  function backToEmail() {
    setEmail(null);
    setCode('');
    setFailure(null);
    setTries(0);
    setNotice(null);
  }

  /** Remember what we learned and route: new accounts to the questions, returning ones to Welcome back. */
  async function proceed(r: SignedIn) {
    useVerifyOutcome.getState().set({
      masked: r.masked,
      provider: r.provider,
      isNewAccount: r.isNewAccount,
      freeChecksRemaining: r.freeChecksRemaining,
    });
    // The stack is reset so Back never returns to sign-in (D4).
    const hasPlan = hasRepositories() && !!(await getRepositories().plan.get());
    const adult = useOnboarding.getState().draft.confirmed18;
    const name = r.isNewAccount ? (adult ? 'Goals' : 'Age') : hasPlan ? 'WelcomeBack' : adult ? 'Goals' : 'Age';
    nav.reset({ index: 0, routes: [{ name }] });
  }

  async function send(target: string) {
    if (busy.current) return;
    busy.current = true;
    setWorking('email');
    setNotice(null);
    try {
      if (!(await getOnboardingDeps().isOnline())) return goOffline();
      const r = await sendCode(target);
      switch (r.kind) {
        case 'sent':
          setEmail(target);
          setSentAt(getOnboardingDeps().now());
          setCode('');
          setFailure(null);
          setTries(0);
          setCooldown(r.resendInSeconds);
          break;
        case 'throttled':
          setEmail(target);
          setCooldown(r.resendInSeconds);
          setNotice({
            text: `A code was sent a moment ago. You can ask again in ${formatClock(r.resendInSeconds)}.`,
            tone: 'warning',
          });
          break;
        case 'invalid':
          setFieldError('Enter a valid email address.');
          break;
        case 'unavailable':
          warn('Email sign-in is not available right now. Please try again later.');
          break;
        case 'offline':
          return goOffline();
        default:
          warn('Something went wrong sending the code. Try again in a moment.');
      }
    } finally {
      busy.current = false;
      setWorking(null);
    }
  }

  function onSendPress() {
    const n = validateEmail(raw);
    if (!n.ok) return setFieldError(n.error);
    setFieldError(undefined);
    void send(n.value);
  }

  async function onCode(v: string) {
    setCode(v);
    if (failure === 'wrong') setFailure(null);
    if (v.length !== EMAIL_CODE_LENGTH || !email || verifying) return;
    setVerifying(true);
    const r = await verifyCode(email, v, sentAt, getOnboardingDeps().now());
    setVerifying(false);
    if (r.kind === 'ok') return proceed(r);
    if (r.kind === 'failed') {
      if (r.reason === 'rate_limited') warn('Too many tries. Wait a minute, then try again.');
      else {
        setFailure(r.reason);
        if (r.reason === 'wrong') setTries((n) => n + 1);
      }
    } else if (r.kind === 'offline') goOffline();
    else if (r.kind === 'unavailable') warn('Email sign-in is not available right now. Please try again later.');
    else warn('Something went wrong checking the code. Try again.');
  }

  async function onSocial(provider: SocialProvider | 'dev') {
    if (busy.current) return;
    busy.current = true;
    setWorking(provider);
    setNotice(null);
    try {
      if (provider !== 'dev' && !(await getOnboardingDeps().isOnline())) return goOffline();
      const r = provider === 'dev' ? await signInAsDev() : await signInWithSocial(provider);
      if (r.kind === 'ok') return await proceed(r);
      const label = provider === 'dev' ? 'the dev account' : PROVIDER_LABEL[provider];
      if (r.kind === 'cancelled') setNotice({ text: 'Sign-in was cancelled. Nothing was changed.', tone: 'neutral' });
      else if (r.kind === 'offline') goOffline();
      else if (r.kind === 'unavailable') warn(`Signing in with ${label} is not available right now. Try email instead.`);
      else warn(`We could not finish signing in with ${label}. Try again, or use email.`);
    } finally {
      busy.current = false;
      setWorking(null);
    }
  }

  const triesLeft = Math.max(0, MAX_TRIES - tries);
  const locked = failure === 'wrong' && triesLeft === 0;
  const otpState = failure === 'wrong' || failure === 'expired' ? 'error' : 'idle';
  const providers = socialProvidersFor(Platform.OS);
  const anyBusy = working !== null || verifying;

  return (
    <Layout
      topBar={{ leading: 'back', onLeading: email ? backToEmail : back }}
      footer={
        !auth.configured ? undefined : email ? (
          <FilledButton
            label="Verify and continue"
            loading={verifying}
            disabled={code.length !== EMAIL_CODE_LENGTH || locked}
            onPress={() => void onCode(code)}
          />
        ) : (
          <FilledButton
            label="Continue with email"
            leadingIcon="mail"
            loading={working === 'email'}
            disabled={!raw.trim() || (anyBusy && working !== 'email')}
            onPress={onSendPress}
          />
        )
      }
    >
      <Text variant="headline" accessibilityRole="header">
        {email ? 'Check your email' : 'Sign in or create an account'}
      </Text>

      {!auth.configured ? (
        <StatusBanner variant="info" icon="info">
          Sign in is not set up on this build. Nothing is wrong with your phone. Try again with an updated version of CasaFit.
        </StatusBanner>
      ) : !email ? (
        <>
          <Text color="osv">We email you a 6-digit code. There is no password to remember.</Text>
          <TextField
            label="Email address"
            value={raw}
            onChange={(v) => {
              setRaw(v);
              setFieldError(undefined);
            }}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={onSendPress}
            error={fieldError}
            testID="verify-email"
          />

          <View style={{ gap: space.s }}>
            <Text color="osv" style={{ textAlign: 'center' }}>or</Text>
            {providers.map((p) => (
              <OutlinedButton
                key={p}
                label={`Continue with ${PROVIDER_LABEL[p]}`}
                loading={working === p}
                disabled={anyBusy && working !== p}
                onPress={() => void onSocial(p)}
                testID={`verify-${p}`}
              />
            ))}
            {auth.signInAsDev ? (
              <TonalButton
                label="Continue as the local dev user"
                loading={working === 'dev'}
                disabled={anyBusy && working !== 'dev'}
                onPress={() => void onSocial('dev')}
                testID="verify-dev"
              />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: space.s, alignItems: 'center' }}>
            <Icon name="verified_user" color="osv" />
            <Text variant="bodySmall" color="osv" style={{ flex: 1 }}>
              We use your email only to sign you in and keep your free form checks yours.
            </Text>
            <TextButton label="Privacy notice" onPress={() => getOnboardingDeps().openPrivacyNotice()} />
          </View>
        </>
      ) : (
        <>
          <Text color="osv">We sent a code to {maskEmail(email)}</Text>
          <OtpField
            length={EMAIL_CODE_LENGTH}
            value={code}
            onChange={(v) => void onCode(v)}
            state={otpState}
            errorText={null}
            autoFocus
          />
          {failure === 'wrong' && !locked ? (
            <StatusBanner variant="error">
              That code is not right, or it has expired. {triesLeft} {triesLeft === 1 ? 'try' : 'tries'} left.
            </StatusBanner>
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
            <TextButton label="Resend code" loading={working === 'email'} onPress={() => void send(email)} />
          )}
          <TextButton label="Wrong email? Change it" onPress={backToEmail} />
        </>
      )}
      {notice ? <StatusBanner variant={notice.tone === 'warning' ? 'warning' : 'neutral'}>{notice.text}</StatusBanner> : null}
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
          CasaFit signs you in once, with a code sent to your email or with Google, Apple or Facebook. After that your workouts run
          with no connection.
        </Text>
      </View>
      <StatusBanner variant="neutral" icon="wifi_off">
        {still ? 'Still no internet connection. Try again when you are back online.' : 'No internet connection right now.'}
      </StatusBanner>
      <BottomSheet visible={why} title="Why we ask you to sign in" onDismiss={() => setWhy(false)}>
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
        {outcome.masked || outcome.provider ? <Text color="osv">{describeSignIn(outcome.provider, outcome.masked)}</Text> : null}
      </View>
      <ChecklistItem state="done" label="Your plan and progress are on this phone" />
      <ChecklistItem state="done" label="Your saved meals and food log are here" />
      <ChecklistItem state="done" label={third} tone="tc" />
      <StatusBanner variant="plain">Free form checks belong to your account, not this phone.</StatusBanner>
    </Layout>
  );
}
