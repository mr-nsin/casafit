// Splash, Welcome, Age.

import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '../../../state/auth';
import { useOnboarding } from '../../../state/onboardingDraft';
import { getRepositories, hasRepositories } from '../../../state/storage';
import {
  BlobBackground,
  BottomSheet,
  CheckboxRow,
  FilledButton,
  IconBadge,
  ProgressBar,
  RadioList,
  SelectField,
  SessionSegmentBar,
  StatusBanner,
  Text,
  TextButton,
  space,
  useReducedMotion,
  useTokens,
} from '../../../ui';
import { Layout, useBack, useOnboardingNav } from '../Layout';
import { getOnboardingDeps } from '../deps';
import { birthYearOptions, canContinueAge, isAdult } from '../logic';

export function SplashScreen() {
  const nav = useOnboardingNav();
  const t = useTokens();
  const reduced = useReducedMotion();
  useEffect(() => {
    let alive = true;
    const go = async () => {
      const session = useAuth.getState().session;
      let hasPlan = false;
      if (hasRepositories()) hasPlan = !!(await getRepositories().plan.get().catch(() => null));
      if (!alive) return;
      const name = !session ? 'Welcome' : hasPlan ? 'Main' : 'Goals';
      nav.reset({ index: 0, routes: [{ name }] });
    };
    const id = setTimeout(go, reduced ? 300 : 1200);
    return () => {
      alive = false;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: t.p, alignItems: 'center', justifyContent: 'center', gap: space.l, padding: space.xxl }}>
      <View accessible accessibilityLabel="CasaFit, loading" style={{ alignItems: 'center', gap: space.l }}>
        <IconBadge icon="home" size={112} shape="squircle" tone="pc" />
        <Text variant="headline" color="op">casafit</Text>
        <Text color="op">15 minutes, at home</Text>
      </View>
      <View style={{ width: 160 }}>
        <ProgressBar label="Loading" />
      </View>
    </View>
  );
}

export function WelcomeScreen() {
  const nav = useOnboardingNav();
  const ended = useAuth((s) => s.sessionEnded);
  const go = (to: 'Age' | 'Verify') => {
    useAuth.getState().clearSessionEnded();
    nav.navigate(to);
  };
  return (
    <Layout
      scroll={false}
      background={<BlobBackground variant="a" />}
      footer={
        <>
          {ended ? (
            <StatusBanner variant="info" icon="info">
              Your sign-in ended, so please sign in again. Your plan and logs are still on this phone.
            </StatusBanner>
          ) : null}
          <FilledButton label="Get my 15-minute plan" trailingIcon="arrow_forward" onPress={() => go('Age')} />
          <TextButton label="Log in" onPress={() => go('Verify')} />
        </>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: space.l }}>
        <Text variant="display" accessibilityLabel="15 minutes">
          15 minutes
        </Text>
        <Text variant="headline">A whole workout, at home, with nothing but you.</Text>
        <Text color="osv">Every session starts with a matched warm-up and ends with a cool-down.</Text>
        <SessionSegmentBar warm={2} work={11} cool={2} />
      </View>
    </Layout>
  );
}

export function AgeScreen() {
  const nav = useOnboardingNav();
  const back = useBack('Welcome');
  const { draft, update } = useOnboarding();
  const [open, setOpen] = useState(false);
  const thisYear = new Date(getOnboardingDeps().now()).getFullYear();
  const under = draft.birthYear !== null && !isAdult(draft.birthYear, thisYear);
  const ok = canContinueAge(draft, thisYear);
  return (
    <Layout
      topBar={{ leading: 'back', onLeading: back }}
      footer={
        <FilledButton
          label="Continue"
          disabled={!ok}
          onPress={() => nav.navigate(useAuth.getState().session ? 'Goals' : 'Verify')}
        />
      }
    >
      <Text variant="headline">CasaFit is for adults</Text>
      <Text color="osv">We need to confirm your age before we make your account.</Text>
      <SelectField label="Year of birth" valueLabel={draft.birthYear ? String(draft.birthYear) : undefined} onPress={() => setOpen(true)} />
      <CheckboxRow checked={draft.confirmed18} onChange={(v) => void update({ confirmed18: v })} label="I confirm I am 18 or older." />
      {under ? (
        <StatusBanner variant="error">
          CasaFit is for people 18 and over, so we cannot make an account. Ask a parent or a doctor about safe exercise for your age.
        </StatusBanner>
      ) : (
        <StatusBanner variant="info">
          If you are under 18 we cannot make an account. Ask a parent or a doctor about safe exercise for your age.
        </StatusBanner>
      )}
      <BottomSheet visible={open} title="Year of birth" onDismiss={() => setOpen(false)}>
        <RadioList
          options={birthYearOptions(thisYear).map((y) => ({ id: String(y), label: String(y) }))}
          value={draft.birthYear ? String(draft.birthYear) : ''}
          onChange={(id) => {
            void update({ birthYear: Number(id) });
            setOpen(false);
          }}
        />
      </BottomSheet>
    </Layout>
  );
}
