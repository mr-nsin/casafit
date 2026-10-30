import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError, NetworkError } from '../../api/client';
import { createTestDb } from '../../db/testing/nodeSqliteDriver';
import {
  createExpoNotificationService,
  createFakeNotificationService,
  reminderSlots,
  setNotificationService,
  type FakeNotificationService,
} from '../../services/notifications';
import { useAuth } from '../../state/auth';
import { useConsent } from '../../state/consent';
import { defaultPreferences, usePreferences } from '../../state/preferences';
import { setRepositories } from '../../state/storage';
import { seedPlan } from '../session/browse/testkit';
import { settingsRoutes } from '.';
import { configureSettingsDeps } from './deps';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { EditProfileScreen } from './EditProfileScreen';
import { HelpScreen } from './HelpScreen';
import { LanguageScreen } from './LanguageScreen';
import { FAQ, formatTime, initials, languageFor, parseBirthYear, painSummary } from './model';
import { NotifyScreen } from './NotifyScreen';
import { PrivacyScreen } from './PrivacyScreen';
import { ProfileScreen } from './ProfileScreen';
import { SettingsScreen } from './SettingsScreen';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), reset: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true) };
let mockRoute: { params?: Record<string, unknown> } = {};
jest.mock('@react-navigation/native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useNavigation: () => mockNav,
    useRoute: () => mockRoute,
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(() => cb(), [cb]),
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

// Reduced motion, synchronously: no animation timers or late state updates in the tests.
jest.mock('../../ui/useMotion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Animated } = require('react-native');
  const actual = jest.requireActual('../../ui/useMotion');
  const one = new Animated.Value(1);
  const settle = (v: { setValue(n: number): void }, o?: { toValue?: number }) => v.setValue(o?.toValue ?? 1);
  return {
    ...actual,
    useReducedMotion: () => true,
    useEntrance: () => one,
    useMotion: () => ({
      reduced: true,
      durations: actual.useMotion.durations,
      easing: actual.easing,
      timing: (v: { setValue(n: number): void }, o?: { toValue?: number }) => ({ start: () => settle(v, o), stop() {} }),
      oneShot: settle,
      loop: () => () => undefined,
    }),
  };
});

const glyphs: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');

let db: Awaited<ReturnType<typeof createTestDb>>;
let notif: FakeNotificationService;
const api = jest.fn();
const share = jest.fn(async () => undefined);
const openUrl = jest.fn(async () => undefined);

beforeEach(async () => {
  db = await createTestDb();
  setRepositories(db.repos);
  notif = createFakeNotificationService();
  setNotificationService(notif);
  api.mockReset();
  share.mockClear();
  openUrl.mockClear();
  configureSettingsDeps({ api: api as never, share, openUrl, now: () => Date.UTC(2026, 9, 30) });
  Object.values(mockNav).forEach((f) => f.mockClear());
  mockNav.canGoBack.mockReturnValue(true);
  mockRoute = {};
  usePreferences.setState({ ...defaultPreferences(), hydrated: true });
  useConsent.setState({ latest: {}, hydrated: false });
  useAuth.setState({ session: { accessToken: 'a', refreshToken: 'r', verifiedAt: Date.now() }, freeChecksRemaining: 2, pro: { active: false, expiresAt: null } });
});
afterEach(() => {
  configureSettingsDeps(null);
  setNotificationService(null);
  setRepositories(null);
  db.driver.close();
});

const tap = (label: string | RegExp) => fireEvent.press(screen.getByLabelText(label));
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await act(async () => Promise.resolve());
};

describe('model', () => {
  it('formats times, initials and years', () => {
    expect(formatTime('07:30')).toBe('7:30 am');
    expect(formatTime('18:00')).toBe('6:00 pm');
    expect(formatTime('00:05')).toBe('12:05 am');
    expect(formatTime('12:30')).toBe('12:30 pm');
    expect(initials('Priya Sharma')).toBe('PS');
    expect(initials('  priya ')).toBe('P');
    expect(initials(null)).toBe('Me');
    expect(parseBirthYear('1998', Date.UTC(2026, 9, 1))).toEqual({ value: 1998 });
    expect(parseBirthYear('2015', Date.UTC(2026, 9, 1)).error).toMatch(/18/);
    expect(parseBirthYear('', 0).value).toBeNull();
    expect(languageFor('hi-IN').english).toBe('Hindi');
    expect(languageFor('xx')).toMatchObject({ id: 'en-IN' });
    expect(painSummary([])).toBe('None');
    expect(painSummary(['knees', 'back'])).toBe('Knees, Back');
  });
});

describe('notification service', () => {
  it('puts the recap on Sunday only when it is on', () => {
    const base = { time: '07:30', weekday: { title: 'W', body: 'b' }, recap: { title: 'R', body: 'b' } };
    expect(reminderSlots({ ...base, sundayRecap: true }).map((s) => s.content.title)).toEqual(['R', 'W', 'W', 'W', 'W', 'W', 'W']);
    expect(reminderSlots({ ...base, sundayRecap: false }).every((s) => s.content.title === 'W')).toBe(true);
  });

  it('schedules seven weekly triggers on the daily_reminder channel after clearing the old ones', async () => {
    const calls: { r: Record<string, any> }[] = [];
    let cancelled = 0;
    const lib = {
      getPermissionsAsync: async () => ({ granted: false, status: 'denied' }),
      requestPermissionsAsync: async () => ({ granted: true }),
      setNotificationChannelAsync: jest.fn(async () => undefined),
      scheduleNotificationAsync: async (r: Record<string, unknown>) => {
        calls.push({ r });
        return 'id';
      },
      cancelAllScheduledNotificationsAsync: async () => {
        cancelled += 1;
      },
      AndroidImportance: { DEFAULT: 3 },
      SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
    };
    const svc = createExpoNotificationService(() => lib);
    expect(await svc.getPermission()).toBe('denied');
    await svc.schedule({ time: '18:00', sundayRecap: true, weekday: { title: 'W', body: 'b' }, recap: { title: 'R', body: 'b' } });
    expect(cancelled).toBe(1);
    expect(calls).toHaveLength(7);
    expect(calls[0]!.r.trigger).toMatchObject({ type: 'weekly', weekday: 1, hour: 18, minute: 0, channelId: 'daily_reminder' });
    expect(await svc.requestPermission()).toBe('granted');
  });
});

describe('Settings', () => {
  it('lists the groups and the version', async () => {
    await seedPlan(db);
    await render(<SettingsScreen />);
    expect(await screen.findByText(/4 days a week/)).toBeTruthy();
    for (const l of [/^Edit my plan/, /^Pain areas, Knees/, /^Daily reminder, Off/, /^Free checks, 2 left/, /^Privacy and data/, /^Help and support/, /^Sign out/]) {
      expect(screen.getByLabelText(l)).toBeTruthy();
    }
    expect(screen.getByText(/^CasaFit \d/)).toBeTruthy();
  });

  it('hide calories writes the setting and it survives a reload', async () => {
    await render(<SettingsScreen />);
    const sw = screen.getByRole('switch', { name: 'Hide calories' });
    expect(sw.props.accessibilityState?.checked).toBe(false);
    await fireEvent.press(sw);
    await waitFor(() => expect(usePreferences.getState().showCalories).toBe(false));
    await settle();
    const raw = await db.repos.prefs.get('preferences.v1');
    expect(JSON.parse(raw!).showCalories).toBe(false);
    usePreferences.setState({ showCalories: true });
    await usePreferences.getState().hydrate();
    expect(usePreferences.getState().showCalories).toBe(false);
    expect(screen.getByRole('switch', { name: 'Hide calories' }).props.accessibilityState?.checked).toBe(true);
  });

  it('opens the right screens', async () => {
    await seedPlan(db);
    await render(<SettingsScreen />);
    await screen.findByText(/4 days a week/);
    const go: [RegExp, string][] = [
      [/^Edit my plan/, 'WeekPlan'],
      [/^Pain areas/, 'EditProfile'],
      [/^Daily reminder/, 'Notify'],
      [/^Free checks/, 'Paywall'],
      [/^Language and voice/, 'Language'],
      [/^Privacy and data/, 'Privacy'],
      [/^Help and support/, 'Help'],
      [/^Delete my account/, 'DeleteAccount'],
    ];
    for (const [label, route] of go) {
      mockNav.navigate.mockClear();
      await tap(label);
      expect(mockNav.navigate).toHaveBeenCalledWith(route);
    }
    await tap('Progress');
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Main', { screen: 'Progress' });
  });

  it('saves a new daily steps goal', async () => {
    await seedPlan(db);
    await render(<SettingsScreen />);
    await tap(/^Daily steps goal/);
    await tap('Increase Daily steps goal');
    await fireEvent.press(screen.getByText('Save goal'));
    await waitFor(async () => expect((await db.repos.profile.get())?.stepGoal).toBe(7500));
  });

  it('signs out, keeps local data and returns to Welcome', async () => {
    await seedPlan(db);
    await render(<SettingsScreen />);
    await tap(/^Sign out/);
    await tap('Sign out');
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Welcome' }] }));
    expect(useAuth.getState().session).toBeNull();
    expect((await db.repos.profile.get())?.name).toBe('Priya');
    expect(await db.repos.plan.get()).not.toBeNull();
  });

  it('download my data offline shows a kind message and shares nothing', async () => {
    api.mockRejectedValue(new NetworkError());
    await render(<SettingsScreen />);
    await tap(/^Download my data/);
    expect(await screen.findByText(/You are offline\. Nothing was changed\./)).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
  });

  it('download my data online calls the export endpoint and hands the file to the share sheet', async () => {
    await seedPlan(db);
    api.mockResolvedValue({ account: { id: 'x' } });
    await render(<SettingsScreen />);
    await tap(/^Download my data/);
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/me/export', { method: 'POST' });
    const file = JSON.parse((share.mock.calls[0] as unknown as [{ message: string }])[0].message);
    expect(file.server).toEqual({ account: { id: 'x' } });
    expect(file.onThisPhone.profile.name).toBe('Priya');
  });
});

describe('Notify', () => {
  it('does not ask the OS on arrival, only when Allow is tapped, then saves and schedules', async () => {
    await seedPlan(db);
    await render(<NotifyScreen />);
    await settle();
    expect(notif.prompts).toBe(0);
    expect(screen.getByText(/Core|ready/)).toBeTruthy();
    await tap('6:00 pm');
    await fireEvent.press(screen.getByRole('switch', { name: 'Sunday recap' }));
    await tap('Allow reminders at 6:00 pm');
    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
    expect(notif.prompts).toBe(1);
    expect(usePreferences.getState().notifications).toEqual({ enabled: true, time: '18:00', sundayRecap: false });
    expect(notif.scheduled).toHaveLength(1);
    expect(notif.scheduled[0]).toMatchObject({ time: '18:00', sundayRecap: false });
    expect(JSON.parse((await db.repos.prefs.get('preferences.v1'))!).notifications.time).toBe('18:00');
  });

  it('shows a kind message and a settings link when the OS says no, and does not turn reminders on', async () => {
    notif.promptAnswer = 'denied';
    await render(<NotifyScreen />);
    await tap(/^Allow reminders at 7:30 am/);
    expect(await screen.findByText(/switched off for CasaFit/)).toBeTruthy();
    expect(usePreferences.getState().notifications.enabled).toBe(false);
    expect(notif.scheduled).toHaveLength(0);
    expect(mockNav.goBack).not.toHaveBeenCalled();
    await tap('Open phone settings');
    expect(notif.settingsOpened).toBe(1);
  });

  it('shows the settings link on arrival when permission was already refused', async () => {
    notif.permission = 'denied';
    await render(<NotifyScreen />);
    expect(await screen.findByText(/switched off for CasaFit/)).toBeTruthy();
    expect(notif.prompts).toBe(0);
  });

  it('offers Save without a second prompt once allowed, and can turn reminders off', async () => {
    notif.permission = 'granted';
    usePreferences.setState({ notifications: { enabled: true, time: '12:30', sundayRecap: true } });
    await render(<NotifyScreen />);
    expect(await screen.findByLabelText('Save')).toBeTruthy();
    await tap('Turn reminders off');
    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
    expect(usePreferences.getState().notifications.enabled).toBe(false);
    expect(notif.cancelled).toBe(1);
    expect(notif.prompts).toBe(0);
  });

  it('Not now leaves everything as it was', async () => {
    await render(<NotifyScreen />);
    await tap('Not now');
    expect(mockNav.goBack).toHaveBeenCalled();
    expect(usePreferences.getState().notifications.enabled).toBe(false);
    expect(notif.prompts).toBe(0);
  });

  it('Other opens a time picker and uses the chosen time', async () => {
    notif.permission = 'granted';
    await render(<NotifyScreen />);
    await tap('Other');
    await tap('Increase Hour');
    await tap('Use this time');
    await tap(/^Allow reminders at 8:30 am/);
    await waitFor(() => expect(usePreferences.getState().notifications.time).toBe('08:30'));
  });
});

describe('Language', () => {
  it('persists the locale; English needs no note and other languages are coming soon', async () => {
    await seedPlan(db);
    await render(<LanguageScreen />);
    await settle();
    expect(screen.getAllByText('Coming soon')).toHaveLength(5);
    expect(screen.queryByText(/is coming soon\. CasaFit stays/)).toBeNull();
    await tap(/^हिन्दी/);
    expect(await screen.findByText(/Hindi is coming soon\. CasaFit stays in English/)).toBeTruthy();
    expect(screen.getByText(/Knees out/)).toBeTruthy();
    await waitFor(async () => expect((await db.repos.profile.get())?.locale).toBe('hi-IN'));
    expect(usePreferences.getState().session.lang).toBe('hi-IN');
    await tap(/^English/);
    await waitFor(async () => expect((await db.repos.profile.get())?.locale).toBe('en-IN'));
  });
});

describe('Privacy', () => {
  beforeEach(async () => {
    await seedPlan(db);
    for (const p of ['health_answers', 'steps', 'camera'] as const) await useConsent.getState().record(p, true, 'onboarding');
    useConsent.setState({ latest: {}, hydrated: false });
  });

  it('reads the saved consents', async () => {
    await render(<PrivacyScreen />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Health answers' }).props.accessibilityState?.checked).toBe(true));
    expect(screen.getByRole('switch', { name: 'App improvement' }).props.accessibilityState?.checked).toBe(false);
  });

  it('withdrawing health answers asks first, then records it and deletes what we hold', async () => {
    await render(<PrivacyScreen />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Health answers' }).props.accessibilityState?.checked).toBe(true));
    await fireEvent.press(screen.getByRole('switch', { name: 'Health answers' }));
    expect(await screen.findByText('Turn off health answers?')).toBeTruthy();
    expect((await db.repos.profile.get())?.painAreas).toEqual(['knees']);
    await fireEvent.press(screen.getByText('Turn off'));
    await waitFor(async () => expect((await db.repos.consent.latest()).health_answers?.granted).toBe(false));
    expect((await db.repos.profile.get())?.painAreas).toEqual([]);
    expect((await db.repos.consent.history('health_answers')).at(-1)?.source).toBe('privacy_screen');
  });

  it('keeping a permission on changes nothing', async () => {
    await render(<PrivacyScreen />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Step count' }).props.accessibilityState?.checked).toBe(true));
    await fireEvent.press(screen.getByRole('switch', { name: 'Step count' }));
    await fireEvent.press(await screen.findByText('Keep it on'));
    expect((await db.repos.consent.latest()).steps?.granted).toBe(true);
  });

  it('turning a permission on needs no confirmation', async () => {
    await render(<PrivacyScreen />);
    await settle();
    await fireEvent.press(screen.getByRole('switch', { name: 'App improvement' }));
    await waitFor(async () => expect((await db.repos.consent.latest()).analytics?.granted).toBe(true));
  });

  it('download my data offline is a kind message; the notice opens Help; delete opens the dialog', async () => {
    api.mockRejectedValue(new NetworkError());
    await render(<PrivacyScreen />);
    await tap(/^Download my data/);
    expect(await screen.findByText(/You are offline/)).toBeTruthy();
    await tap('Read the privacy notice');
    expect(mockNav.navigate).toHaveBeenCalledWith('Help', { open: 'privacy' });
    await tap('Delete my account and data');
    expect(mockNav.navigate).toHaveBeenCalledWith('DeleteAccount');
  });
});

describe('Profile', () => {
  it('shows stats from the session log, the plan, and the entitlement chip', async () => {
    await seedPlan(db);
    const now = Date.now();
    for (const [i, d] of [600, 900].entries()) {
      await db.repos.sessionLog.insert({
        id: `s${i}`, planWeek: 1, planDay: 0, style: 'normal', status: 'complete', durationS: d, movesDone: 5, movesPlanned: 5,
        felt: null, rungChanges: [], feelSignals: [], warmupSkipped: false, formChecks: 0, quiet: false, completedAt: now - i * 86_400_000,
      });
    }
    await render(<ProfileScreen />);
    expect(await screen.findByText('Priya')).toBeTruthy();
    expect(screen.getByLabelText('2, Sessions')).toBeTruthy();
    expect(screen.getByLabelText('25, Minutes')).toBeTruthy();
  });

  it('wires the chip, rows and gear', async () => {
    await seedPlan(db);
    await render(<ProfileScreen />);
    await screen.findByText('Priya');
    await tap(/Free · 2 form checks left/);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Paywall');
    await tap('Settings');
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Settings');
    await tap('Change profile photo');
    expect(mockNav.navigate).toHaveBeenLastCalledWith('EditProfile');
    for (const [label, route] of [[/^My goal/, 'Why'], [/^My plan/, 'WeekPlan'], [/^Food plan/, 'NutriPlan'], [/^Language and voice/, 'Language'], [/^Privacy and data/, 'Privacy'], [/^Help and support/, 'Help'], [/^Weekly check-in/, 'CheckIn']] as const) {
      await tap(label);
      expect(mockNav.navigate).toHaveBeenLastCalledWith(route);
    }
  });

  it('shows Pro for subscribers', async () => {
    useAuth.setState({ pro: { active: true, expiresAt: null } });
    await render(<ProfileScreen />);
    await tap(/Pro · Unlimited/);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('ManagePro');
  });
});

describe('EditProfile', () => {
  it('fills from the saved profile and saves every field', async () => {
    await seedPlan(db);
    await render(<EditProfileScreen />);
    await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Priya'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Priya Sharma');
    await fireEvent.changeText(screen.getByLabelText('Born'), '1998');
    await fireEvent.changeText(screen.getByLabelText('Height · cm'), '162');
    await fireEvent.changeText(screen.getByLabelText('Weight · kg'), '58.5');
    await tap('Woman');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Back' }));
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
    expect(await db.repos.profile.get()).toMatchObject({
      name: 'Priya Sharma', birthYear: 1998, heightCm: 162, weightKg: 58.5, sex: 'woman', painAreas: ['knees', 'back'],
    });
  });

  it('None clears pain areas', async () => {
    await seedPlan(db);
    await render(<EditProfileScreen />);
    await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Priya'));
    await tap('None');
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
    expect((await db.repos.profile.get())?.painAreas).toEqual([]);
  });

  it('shows a plain message for a bad height and saves nothing', async () => {
    await seedPlan(db);
    await render(<EditProfileScreen />);
    await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Priya'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Changed');
    await fireEvent.changeText(screen.getByLabelText('Height · cm'), '20');
    await fireEvent.press(screen.getByText('Save changes'));
    expect(await screen.findByText(/Enter a height between/)).toBeTruthy();
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect((await db.repos.profile.get())?.name).toBe('Priya');
  });

  it('the new name shows on Profile', async () => {
    await seedPlan(db);
    await db.repos.profile.save({ name: 'Asha Rao' });
    await render(<ProfileScreen />);
    expect(await screen.findByText('Asha Rao')).toBeTruthy();
  });
});

describe('Help', () => {
  it('opens the first answer, toggles, and searches', async () => {
    await render(<HelpScreen />);
    expect(screen.getByText(/Every account gets 2/)).toBeTruthy();
    await tap(FAQ[1]!.question);
    expect(screen.getByText(/2 minutes of warm-up/)).toBeTruthy();
    expect(screen.queryByText(/Every account gets 2/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search help'), 'subscription');
    expect(screen.getByText('How do I cancel Pro?')).toBeTruthy();
    expect(screen.queryByText('Why are sessions 15 minutes?')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Search help'), 'zzzz');
    expect(screen.getByText(/Nothing matches that yet/)).toBeTruthy();
  });

  it('opens the question asked for by the privacy notice link', async () => {
    mockRoute = { params: { open: 'privacy' } };
    await render(<HelpScreen />);
    expect(screen.getByText(/Camera analysis stays on your phone/)).toBeTruthy();
  });

  it('email opens a mailto link, and a failure shows the address', async () => {
    await render(<HelpScreen />);
    await tap(/^Email support/);
    await waitFor(() => expect(openUrl).toHaveBeenCalled());
    expect((openUrl.mock.calls[0] as unknown as [string])[0]).toMatch(/^mailto:support@casafit\.app\?subject=/);
    openUrl.mockRejectedValueOnce(new Error('no mail app'));
    await tap(/^Chat with us/);
    expect(await screen.findByText(/write to us at support@casafit\.app/)).toBeTruthy();
  });
});

describe('DeleteAccount', () => {
  it('Keep my account goes back and touches nothing', async () => {
    await seedPlan(db);
    await render(<DeleteAccountScreen />);
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    await tap('Keep my account');
    expect(mockNav.goBack).toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it('deletes on the server, wipes this phone, signs out and returns to Welcome', async () => {
    await seedPlan(db);
    await useConsent.getState().record('steps', true, 'onboarding');
    usePreferences.setState({ showCalories: false });
    api.mockResolvedValue(null);
    await render(<DeleteAccountScreen />);
    await tap('Delete everything');
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Welcome' }] }));
    expect(api).toHaveBeenCalledWith('/me', { method: 'DELETE' });
    expect(await db.repos.profile.get()).toBeNull();
    expect(await db.repos.plan.get()).toBeNull();
    expect(await db.repos.consent.latest()).toEqual({});
    expect(useAuth.getState().session).toBeNull();
    expect(usePreferences.getState().showCalories).toBe(true);
    expect(notif.cancelled).toBe(1);
  });

  it('offline: shows a clear retry message and keeps every bit of data', async () => {
    await seedPlan(db);
    api.mockRejectedValue(new NetworkError());
    await render(<DeleteAccountScreen />);
    await tap('Delete everything');
    expect(await screen.findByText(/You are offline\. Nothing was deleted, and your data is still here\./)).toBeTruthy();
    expect(mockNav.reset).not.toHaveBeenCalled();
    expect((await db.repos.profile.get())?.name).toBe('Priya');
    expect(useAuth.getState().session).not.toBeNull();
    // Retry once back online.
    api.mockResolvedValue(null);
    await tap('Try again');
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalled());
    expect(await db.repos.profile.get()).toBeNull();
  });

  it('a server error keeps the data too', async () => {
    await seedPlan(db);
    api.mockRejectedValue(new ApiError(500, null));
    await render(<DeleteAccountScreen />);
    await tap('Delete everything');
    expect(await screen.findByText(/could not reach our servers/)).toBeTruthy();
    expect(await db.repos.plan.get()).not.toBeNull();
    await tap('Keep my account');
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('export first: offline shows the message and the dialog stays', async () => {
    await seedPlan(db);
    api.mockRejectedValue(new NetworkError());
    await render(<DeleteAccountScreen />);
    await tap('Export my data first');
    expect(await screen.findByText(/You are offline\. Nothing was changed\./)).toBeTruthy();
    expect(screen.getByText('Delete your account?')).toBeTruthy();
  });
});

describe('registration and icons', () => {
  it('registers all eight screens', () => {
    expect(Object.keys(settingsRoutes).sort()).toEqual(['DeleteAccount', 'EditProfile', 'Help', 'Language', 'Notify', 'Privacy', 'Profile', 'Settings']);
    expect(settingsRoutes.DeleteAccount.options.presentation).toBe('transparentModal');
  });

  it('every icon used on these screens is a real, allowed glyph', async () => {
    await seedPlan(db);
    const names = new Set<string>();
    for (const Screen of [SettingsScreen, NotifyScreen, LanguageScreen, PrivacyScreen, ProfileScreen, EditProfileScreen, HelpScreen, DeleteAccountScreen]) {
      const { unmount } = await render(<Screen />);
      await settle();
      for (const el of screen.queryAllByText(/^MaterialIcons:/)) names.add(String(el.props.children).replace('MaterialIcons:', ''));
      unmount();
    }
    expect(names.size).toBeGreaterThan(20);
    for (const n of names) expect({ n, ok: n !== 'fitness-center' && n in glyphs }).toEqual({ n, ok: true });
  });
});
