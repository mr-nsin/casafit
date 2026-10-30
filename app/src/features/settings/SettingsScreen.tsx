// Settings (m3-settings): four groups plus language, privacy, help, sign out.

import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { describeSignIn } from '../../services/auth';
import { useAuth } from '../../state/auth';
import { usePreferences } from '../../state/preferences';
import {
  BottomNav,
  BottomSheet,
  ConfirmDialog,
  FilledButton,
  ListRow,
  SectionHeader,
  Stepper,
  StatusBanner,
  Text,
  TextButton,
  ToggleRow,
  space,
  type TabKey,
} from '../../ui';
import { Page } from './Page';
import { appVersion, useDataExport, useProfileData } from './hooks';
import { formatTime, languageFor, painSummary } from './model';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STYLE_LABEL = { normal: 'Normal', yoga: 'Yoga', dance: 'Dance' } as const;
const TAB_ROUTE: Record<TabKey, 'Workout' | 'Nutrition' | 'Progress'> = { workout: 'Workout', nutrition: 'Nutrition', progress: 'Progress' };
const formatCount = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const { profile, plan, save } = useProfileData();
  const showCalories = usePreferences((s) => s.showCalories);
  const setShowCalories = usePreferences((s) => s.setShowCalories);
  const notifications = usePreferences((s) => s.notifications);
  const { freeChecksRemaining, pro, account } = useAuth();
  const exporter = useDataExport();
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState(7000);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const goalValue = profile?.stepGoal ?? 7000;
  const planSub = plan
    ? `${plan.daysPerWeek} days a week · ${plan.styles.map((s) => STYLE_LABEL[s]).join(' and ') || 'Your styles'}`
    : 'Build your plan';
  const reminderSub = notifications.enabled
    ? `${formatTime(notifications.time)} · Sunday recap ${notifications.sundayRecap ? 'on' : 'off'}`
    : 'Off';

  const signOut = async () => {
    setSignOutOpen(false);
    await useAuth.getState().signOut();
    nav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <Page
      topBar={{ title: 'Settings', leading: 'back', onLeading: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main')) }}
      tabRoot
      bottom={<BottomNav current={null} onSelect={(k) => nav.navigate('Main', { screen: TAB_ROUTE[k] })} />}
    >
      <View>
        <SectionHeader title="Plan" />
        <ListRow icon="tune" title="Edit my plan" subtitle={planSub} onPress={() => nav.navigate(plan ? 'WeekPlan' : 'Goals')} />
        <ListRow icon="healing" title="Pain areas" subtitle={painSummary(profile?.painAreas ?? [])} onPress={() => nav.navigate('EditProfile')} />
      </View>

      <View>
        <SectionHeader title="Food and steps" />
        <ToggleRow
          icon="visibility_off"
          title="Hide calories"
          subtitle="Show protein only"
          value={!showCalories}
          onChange={(hide) => void setShowCalories(!hide)}
        />
        <ListRow
          icon="directions_walk"
          title="Daily steps goal"
          subtitle={formatCount(goalValue)}
          onPress={() => {
            setGoal(goalValue);
            setGoalOpen(true);
          }}
        />
        <ListRow icon="notifications" title="Daily reminder" subtitle={reminderSub} onPress={() => nav.navigate('Notify')} />
      </View>

      <View>
        <SectionHeader title="Form camera" />
        <ListRow
          icon="photo_camera"
          title={pro.active ? 'Form checks' : 'Free checks'}
          subtitle={pro.active ? 'Unlimited with Pro' : `${freeChecksRemaining} left · Unlimited in Pro`}
          onPress={() => nav.navigate(pro.active ? 'ManagePro' : 'Paywall')}
        />
      </View>

      <View>
        <SectionHeader title="App" />
        <ListRow icon="translate" title="Language and voice" subtitle={languageFor(profile?.locale).english} onPress={() => nav.navigate('Language')} />
        <ListRow icon="help" title="Help and support" onPress={() => nav.navigate('Help')} />
      </View>

      <View>
        <SectionHeader title="Privacy and account" />
        <ListRow
          icon="account_circle"
          title="Account"
          subtitle={account ? describeSignIn(account.provider, account.emailMasked) : 'Signed in'}
          trailing={null}
        />
        <ListRow icon="verified_user" title="Privacy and data" subtitle="Permissions, notice" onPress={() => nav.navigate('Privacy')} />
        <ListRow
          icon="download"
          title="Download my data"
          subtitle={exporter.busy ? 'Getting your data...' : 'Plan, logs and permissions as a file'}
          trailing={exporter.busy ? null : 'chevron'}
          onPress={exporter.busy ? undefined : () => void exporter.start()}
        />
        {exporter.message ? <StatusBanner variant="info" icon="cloud_off">{exporter.message}</StatusBanner> : null}
        <ListRow
          icon="delete"
          title="Delete my account and data"
          subtitle="Removes your plan, logs and free checks"
          destructive
          onPress={() => nav.navigate('DeleteAccount')}
        />
        <ListRow icon="logout" title="Sign out" subtitle="Your plan and logs stay on this phone" trailing={null} onPress={() => setSignOutOpen(true)} />
      </View>

      <Text variant="bodySmall" color="osv" style={{ textAlign: 'center' }}>
        CasaFit {appVersion()}
      </Text>

      <BottomSheet visible={goalOpen} title="Daily steps goal" onDismiss={() => setGoalOpen(false)}>
        <View style={{ gap: space.l, alignItems: 'center', paddingBottom: space.l }}>
          <Text color="osv">Pick a goal that feels easy to reach. You can change it any time.</Text>
          <Stepper label="Daily steps goal" value={goal} min={2000} max={20000} step={500} unit="steps" onChange={setGoal} />
          <FilledButton
            label="Save goal"
            onPress={() => {
              void save({ stepGoal: goal });
              setGoalOpen(false);
            }}
          />
          <TextButton label="Cancel" onPress={() => setGoalOpen(false)} />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={signOutOpen}
        icon="logout"
        title="Sign out?"
        body="Your plan and logs stay on this phone. Sign in again with your email, Google, Apple or Facebook to pick up where you left off."
        onDismiss={() => setSignOutOpen(false)}
        actions={[
          { label: 'Stay signed in', onPress: () => setSignOutOpen(false), variant: 'tonal' },
          { label: 'Sign out', onPress: () => void signOut(), variant: 'filled' },
        ]}
      />
    </Page>
  );
}
