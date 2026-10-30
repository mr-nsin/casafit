// Daily reminder (m3-notify). Also the notification permission primer: the OS prompt appears
// only after the user taps "Allow reminders", never on arrival.

import { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { getNotificationService, type OsPermission } from '../../services/notifications';
import { usePreferences } from '../../state/preferences';
import {
  BottomSheet,
  ChipGroup,
  FilledButton,
  NotificationPreview,
  StatusBanner,
  Stepper,
  Text,
  TextButton,
  ToggleRow,
  space,
  useEntrance,
} from '../../ui';
import { Page } from './Page';
import { useBusy, useProfileData } from './hooks';
import { TIME_CHIPS, formatTime, pad2 } from './model';
import { REMINDER_BODY, applyReminders } from './reminders';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function NotifyScreen() {
  const nav = useNavigation<Nav>();
  const saved = usePreferences((s) => s.notifications);
  const setNotifications = usePreferences((s) => s.setNotifications);
  const { workoutTitle } = useProfileData();
  const [time, setTime] = useState(saved.time);
  const [sunday, setSunday] = useState(saved.sundayRecap);
  const [perm, setPerm] = useState<OsPermission>('undetermined');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pick, setPick] = useState({ h: 9, m: 0 });
  const [busy, run] = useBusy();
  const [error, setError] = useState<string | null>(null);
  const rise = useEntrance();

  const recheck = useCallback(async () => setPerm(await getNotificationService().getPermission()), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recheck();
    // Coming back from system settings: read the OS again.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  const done = () => (nav.canGoBack() ? nav.goBack() : nav.navigate('Main'));
  const alreadyOn = saved.enabled && perm === 'granted';
  const title = `${workoutTitle ?? 'Your workout'} is ready`;

  const allow = () =>
    run(async () => {
      setError(null);
      const svc = getNotificationService();
      let state = perm;
      // The OS prompt is shown here, on the tap, and only when not already granted.
      if (state !== 'granted') state = await svc.requestPermission();
      setPerm(state);
      if (state !== 'granted') {
        // Keep their choices for later, but do not turn reminders on.
        await setNotifications({ enabled: false, time, sundayRecap: sunday });
        return;
      }
      await setNotifications({ enabled: true, time, sundayRecap: sunday });
      try {
        await applyReminders(workoutTitle);
      } catch {
        setError('We saved your time but could not set the reminder on this phone. Please try again.');
        return;
      }
      done();
    });

  const turnOff = () =>
    run(async () => {
      await setNotifications({ enabled: false });
      await applyReminders(workoutTitle);
      done();
    });

  const chips = [
    ...TIME_CHIPS.map((v) => ({ value: v as string, label: formatTime(v) })),
    ...((TIME_CHIPS as readonly string[]).includes(time) ? [] : [{ value: time, label: formatTime(time) }]),
    { value: 'other', label: 'Other', icon: 'schedule' },
  ];

  const openPicker = () => {
    const [h = 9, m = 0] = time.split(':').map((n) => Number.parseInt(n, 10));
    setPick({ h, m: Math.min(55, Math.round(m / 5) * 5) });
    setPickerOpen(true);
  };

  return (
    <Page topBar={{ title: 'Daily reminder', leading: 'back', onLeading: done }}>
      <Text color="osv">One friendly nudge a day, at the time you choose. That is all we send. No guilt, no streak warnings.</Text>

      <ChipGroup
        label="Reminder time"
        options={chips}
        selected={[time]}
        onChange={([v]) => {
          if (v === 'other') openPicker();
          else if (v) setTime(v);
        }}
      />

      <View style={{ gap: space.s }}>
        <Text variant="label" color="osv">
          Preview
        </Text>
        <Animated.View style={{ opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }}>
          <NotificationPreview appName="CasaFit" time={formatTime(time)} title={title} body={REMINDER_BODY} />
        </Animated.View>
      </View>

      <ToggleRow icon="insights" title="Sunday recap" subtitle="Your week in one card, inside this nudge" value={sunday} onChange={setSunday} />

      {perm === 'denied' ? (
        <StatusBanner variant="info" icon="notifications_off">
          <View style={{ gap: space.xs }}>
            <Text>Notifications are switched off for CasaFit on this phone. That is fine. You can turn them on in your phone settings whenever you like.</Text>
            <TextButton label="Open phone settings" onPress={() => void getNotificationService().openSystemSettings()} />
          </View>
        </StatusBanner>
      ) : null}
      {error ? <StatusBanner variant="error">{error}</StatusBanner> : null}

      <View style={{ gap: space.s, paddingTop: space.s }}>
        <FilledButton
          label={alreadyOn ? 'Save' : `Allow reminders at ${formatTime(time)}`}
          leadingIcon={alreadyOn ? 'check' : 'notifications_active'}
          loading={busy}
          onPress={() => void allow()}
        />
        {alreadyOn ? <TextButton label="Turn reminders off" onPress={() => void turnOff()} /> : null}
        <TextButton label="Not now" onPress={done} />
      </View>

      <BottomSheet visible={pickerOpen} title="Pick a time" onDismiss={() => setPickerOpen(false)}>
        <View style={{ gap: space.l, alignItems: 'center', paddingBottom: space.l }}>
          <Text variant="headline" tabular>
            {formatTime(`${pad2(pick.h)}:${pad2(pick.m)}`)}
          </Text>
          <Stepper label="Hour" value={pick.h} min={0} max={23} onChange={(h) => setPick((p) => ({ ...p, h }))} />
          <Stepper label="Minutes" value={pick.m} min={0} max={55} step={5} onChange={(m) => setPick((p) => ({ ...p, m }))} />
          <FilledButton
            label="Use this time"
            onPress={() => {
              setTime(`${pad2(pick.h)}:${pad2(pick.m)}`);
              setPickerOpen(false);
            }}
          />
          <TextButton label="Cancel" onPress={() => setPickerOpen(false)} />
        </View>
      </BottomSheet>
    </Page>
  );
}
