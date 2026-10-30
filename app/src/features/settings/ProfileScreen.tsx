// Profile (m3-profile): account hub. Stats come from the session log on this phone.

import { Animated, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import type { PlanRow } from '../../db/repositories';
import { describeSignIn } from '../../services/auth';
import { useAuth } from '../../state/auth';
import { Avatar, Chip, ListRow, StatTile, Text, space, useEntrance } from '../../ui';
import { Page } from './Page';
import { useProfileData, useProfileStats } from './hooks';
import { initials, languageFor } from './model';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STYLE_LABEL = { normal: 'Normal', yoga: 'Yoga', dance: 'Dance' } as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function goalSummary(plan: PlanRow | null): string {
  if (!plan) return 'Build your plan';
  const goal =
    plan.goal === 'body_part' && plan.bodyParts.length
      ? plan.bodyParts.map(cap).join(' and ')
      : plan.goal === 'gentler'
        ? 'A gentler start'
        : 'Stay fit';
  const styles = plan.styles.map((s) => STYLE_LABEL[s]).join(' + ');
  return `${goal} · ${plan.daysPerWeek} days${styles ? ` · ${styles}` : ''}`;
}

export function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const { profile, plan } = useProfileData();
  const stats = useProfileStats();
  const { freeChecksRemaining, pro, account } = useAuth();
  const pop = useEntrance();
  const name = profile?.name?.trim();

  return (
    <Page
      topBar={{
        title: 'Profile',
        leading: 'back',
        onLeading: () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main')),
        trailing: [{ icon: 'settings', label: 'Settings', onPress: () => nav.navigate('Settings') }],
      }}
    >
      <Animated.View style={{ alignItems: 'center', gap: space.s, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
        <Avatar initials={initials(name)} size={88} onEdit={() => nav.navigate('EditProfile')} />
        <Text variant="headline" accessibilityRole="header">
          {name || 'Your profile'}
        </Text>
        {account ? (
          <Text variant="bodySmall" color="osv" style={{ textAlign: 'center' }}>
            {describeSignIn(account.provider, account.emailMasked)}
          </Text>
        ) : null}
        <Chip
          role="button"
          icon="photo_camera"
          tone="tc"
          label={pro.active ? 'Pro · Unlimited form checks' : `Free · ${freeChecksRemaining} form checks left`}
          onPress={() => nav.navigate(pro.active ? 'ManagePro' : 'Paywall')}
        />
      </Animated.View>

      <View style={{ flexDirection: 'row', gap: space.m }}>
        <StatTile tone="tc" value={stats?.streak ?? 0} label="Day streak" />
        <StatTile tone="sc" value={stats?.sessions ?? 0} label="Sessions" />
        <StatTile tone="pc" value={stats?.minutes ?? 0} label="Minutes" />
      </View>

      <View style={{ gap: space.s }}>
        <ListRow tone="c3" icon="gps_fixed" title="My goal" subtitle={goalSummary(plan)} onPress={() => nav.navigate(plan ? 'Why' : 'Goals')} />
        <ListRow tone="c3" icon="monitor_weight" title="Weekly check-in" subtitle="Only you see this" trailing="Due Sunday" onPress={() => nav.navigate('CheckIn')} />
      </View>

      <View>
        <ListRow icon="edit" title="Edit profile" onPress={() => nav.navigate('EditProfile')} />
        <ListRow icon="event_note" title="My plan" onPress={() => nav.navigate('WeekPlan')} />
        <ListRow icon="restaurant_menu" title="Food plan" onPress={() => nav.navigate('NutriPlan')} />
        <ListRow icon="translate" title="Language and voice" trailing={languageFor(profile?.locale).english} onPress={() => nav.navigate('Language')} />
        <ListRow icon="shield" title="Privacy and data" onPress={() => nav.navigate('Privacy')} />
        <ListRow icon="help" title="Help and support" onPress={() => nav.navigate('Help')} />
      </View>
    </Page>
  );
}
