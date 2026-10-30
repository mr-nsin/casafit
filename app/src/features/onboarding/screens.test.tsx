import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { fakeSession } from '../../services/auth';
import { useAuth } from '../../state/auth';
import { useConsent } from '../../state/consent';
import { useOnboarding } from '../../state/onboardingDraft';
import { getRepositories } from '../../state/storage';
import { AgeScreen, SplashScreen, WelcomeScreen } from './screens/Entry';
import { AboutScreen, GoalsScreen, HealthScreen, MixScreen } from './screens/Plan';
import { BuildingScreen, WeekOneScreen } from './screens/Finish';
import { OfflineScreen, WelcomeBackScreen } from './screens/Verify';
import { useVerifyOutcome } from './flowState';
import { configureOnboardingDeps } from './deps';
import { mockNav, setupDb } from './testkit';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => require('./testkit').mockNav }));

let close: () => void;
beforeEach(async () => {
  ({ close } = await setupDb());
});
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
  close();
});

const draft = () => useOnboarding.getState().draft;
const press = async (label: string | RegExp) => {
  await fireEvent.press(screen.getByLabelText(label));
};

describe('Splash', () => {
  it('goes to Welcome with no session', async () => {
    jest.useFakeTimers();
    await render(<SplashScreen />);
    await act(async () => void jest.advanceTimersByTime(1500));
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Welcome' }] });
  });
  it('goes to Goals with a session and no plan', async () => {
    jest.useFakeTimers();
    useAuth.setState({ session: fakeSession() });
    await render(<SplashScreen />);
    await act(async () => void jest.advanceTimersByTime(1500));
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Goals' }] });
  });
});

describe('Welcome', () => {
  it('starts onboarding at Age and logs in at Verify', async () => {
    await render(<WelcomeScreen />);
    await press('Get my 15-minute plan');
    expect(mockNav.navigate).toHaveBeenCalledWith('Age');
    await press('Log in');
    expect(mockNav.navigate).toHaveBeenCalledWith('Verify');
  });
});

describe('Age', () => {
  it('blocks Continue until an adult year is picked and 18+ is confirmed', async () => {
    await render(<AgeScreen />);
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
    await act(async () => void (await useOnboarding.getState().update({ birthYear: 1998 })));
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
    await press('I confirm I am 18 or older.');
    await waitFor(() => expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(false));
    await press('Continue');
    expect(mockNav.navigate).toHaveBeenCalledWith('Verify');
  });
  it('shows the under-18 message and keeps Continue off', async () => {
    await useOnboarding.getState().update({ birthYear: 2015, confirmed18: true });
    await render(<AgeScreen />);
    expect(screen.getByText(/we cannot make an account/)).toBeTruthy();
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
  });
  it('skips Verify when already signed in', async () => {
    useAuth.setState({ session: fakeSession() });
    await useOnboarding.getState().update({ birthYear: 1990, confirmed18: true });
    await render(<AgeScreen />);
    await press('Continue');
    expect(mockNav.navigate).toHaveBeenCalledWith('Goals');
  });
});

describe('Offline', () => {
  it('stays when still offline and advances when online', async () => {
    let online = false;
    configureOnboardingDeps({ isOnline: async () => online });
    await render(<OfflineScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    expect(screen.getByText(/Still no internet/)).toBeTruthy();
    expect(mockNav.navigate).not.toHaveBeenCalled();
    online = true;
    await act(async () => fireEvent.press(screen.getByLabelText('Try again')));
    expect(mockNav.navigate).toHaveBeenCalledWith('Verify');
  });
});

describe('WelcomeBack', () => {
  it('shows how you signed in, free checks and resets to Main', async () => {
    useVerifyOutcome.getState().set({ masked: 'p***@x.com', provider: 'google' });
    useAuth.setState({ freeChecksRemaining: 1 });
    await getRepositories().profile.save({ name: 'Priya' });
    await render(<WelcomeBackScreen />);
    await waitFor(() => expect(screen.getByText('Welcome back, Priya')).toBeTruthy());
    expect(screen.getByText('Signed in with Google as p***@x.com')).toBeTruthy();
    expect(screen.getByLabelText(/1 of 2 free form check left/)).toBeTruthy();
    await press('Go to my home screen');
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });
  it('has a no-name fallback', async () => {
    await render(<WelcomeBackScreen />);
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });
});

describe('Goals', () => {
  it('needs a goal and a style, hides parts until specific, caps parts at two', async () => {
    await render(<GoalsScreen />);
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.queryByLabelText('Arms')).toBeNull();
    await press('Train specific body parts');
    await press('Normal');
    await waitFor(() => expect(screen.getByLabelText('Arms')).toBeTruthy());
    expect(screen.getByLabelText('Next: about you').props.accessibilityState.disabled).toBe(true);
    await press('Arms');
    await press('Core');
    await press('Glutes');
    expect(draft().bodyParts).toEqual(['arms', 'core']);
    await waitFor(() => expect(screen.getByLabelText('Next: about you').props.accessibilityState.disabled).toBe(false));
    await press('Next: about you');
    expect(mockNav.navigate).toHaveBeenCalledWith('About');
  });
  it('drops body parts when switching to stay fit', async () => {
    await useOnboarding.getState().update({ goal: 'body_part', bodyParts: ['core'], styles: ['yoga'] });
    await render(<GoalsScreen />);
    await press('Stay fit, full body');
    await waitFor(() => expect(draft().bodyParts).toEqual([]));
  });
});

describe('About', () => {
  it('goes to Building with no flags and Health with a flag, and no consent tick here', async () => {
    await useOnboarding.getState().update({ styles: ['normal'] });
    await render(<AboutScreen />);
    expect(screen.getByText('2 of 2')).toBeTruthy();
    expect(screen.queryByLabelText(/health data consent/i)).toBeNull();
    await press('Build my plan');
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('Building'));
  });
  it('routes to Health when a flag is chosen', async () => {
    await useOnboarding.getState().update({ styles: ['normal'] });
    await render(<AboutScreen />);
    await press('Heart or BP');
    await waitFor(() => expect(draft().healthFlags).toEqual(['heart_bp']));
    await press('Continue');
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('Health'));
  });
  it('routes to Mix for three styles', async () => {
    await useOnboarding.getState().update({ styles: ['normal', 'yoga', 'dance'] });
    await render(<AboutScreen />);
    await press('Continue');
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('Mix'));
  });
  it('lets height and weight be skipped, and flags out-of-range values', async () => {
    await render(<AboutScreen />);
    await fireEvent.changeText(screen.getByTestId('about-height'), '20');
    expect(screen.getByText(/between 80 and 260/)).toBeTruthy();
    expect(screen.getByLabelText('Build my plan').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('about-height'), '');
    expect(screen.getByLabelText('Build my plan').props.accessibilityState.disabled).toBe(false);
  });
  it('keeps None exclusive in pain and shows the knee note', async () => {
    await render(<AboutScreen />);
    await press('Knees');
    await waitFor(() => expect(draft().painAreas).toEqual(['knees']));
    expect(screen.getByText("We'll skip lunges and tell you why.")).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('None')[0]!);
    await waitFor(() => expect(draft().painAreas).toEqual([]));
  });
  it('shows saved answers when coming back (Back keeps every answer)', async () => {
    await useOnboarding.getState().update({ heightCm: 165, daysPerWeek: 5 });
    await render(<AboutScreen />);
    expect(screen.getByTestId('about-height').props.value).toBe('165');
    expect(screen.getByLabelText('Days a week').props.accessibilityValue.now).toBe(5);
  });
});

describe('Mix', () => {
  it('starts even, enforces the day total and continues to Building', async () => {
    await useOnboarding.getState().update({ styles: ['normal', 'dance', 'yoga'], daysPerWeek: 4 });
    await render(<MixScreen />);
    await waitFor(() => expect(draft().mix).toEqual({ normal: 2, dance: 1, yoga: 1 }));
    expect(screen.getByText('4 of 4 days assigned')).toBeTruthy();
    await press('Decrease Normal days');
    await waitFor(() => expect(screen.getByText('3 of 4 days assigned')).toBeTruthy());
    expect(screen.getByLabelText('Use this mix').props.accessibilityState.disabled).toBe(true);
    await press('Increase Yoga days');
    await waitFor(() => expect(screen.getByLabelText('Use this mix').props.accessibilityState.disabled).toBe(false));
    await press('Use this mix');
    expect(mockNav.navigate).toHaveBeenCalledWith('Building');
  });
  it('goes to Health when a flag is set', async () => {
    await useOnboarding.getState().update({ styles: ['normal', 'dance', 'yoga'], daysPerWeek: 3, healthFlags: ['pregnancy'] });
    await render(<MixScreen />);
    await waitFor(() => expect(screen.getByText('3 of 3 days assigned')).toBeTruthy());
    await press('Use this mix');
    expect(mockNav.navigate).toHaveBeenCalledWith('Health');
  });
});

describe('Health', () => {
  beforeEach(async () => {
    await useOnboarding.getState().update({ healthFlags: ['heart_bp'] });
  });
  it('is unticked by default and still lets the user continue, recording a decline', async () => {
    await render(<HealthScreen />);
    expect(screen.getByLabelText(/I agree CasaFit uses my health answers/).props.accessibilityState.checked).toBe(false);
    await press('Build my gentler plan');
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('Building'));
    expect(useConsent.getState().latest.health_answers?.granted).toBe(false);
    expect(draft().healthConsent?.granted).toBe(false);
  });
  it('records consent only after the user ticks', async () => {
    await render(<HealthScreen />);
    await press(/I agree CasaFit uses my health answers/);
    await press('Build my gentler plan');
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('Building'));
    expect(useConsent.getState().latest.health_answers?.granted).toBe(true);
    expect(await getRepositories().consent.history('health_answers')).toHaveLength(1);
  });
});

async function finishBuilding() {
  // Stages advance one timer at a time, each needing a render in between.
  for (let i = 0; i < 12; i += 1) await act(async () => void jest.advanceTimersByTime(700));
}

describe('Building and WeekOne', () => {
  it('builds on the phone, saves the plan, clears the draft and goes to WeekOne', async () => {
    jest.useFakeTimers();
    const sync = jest.fn(async () => undefined);
    configureOnboardingDeps({ syncPlan: sync });
    await useOnboarding.getState().update({
      goal: 'body_part', bodyParts: ['core', 'glutes'], styles: ['normal'], daysPerWeek: 4, experience: 'on_and_off',
      painAreas: ['knees'], birthYear: 1998, confirmed18: true,
    });
    await render(<BuildingScreen />);
    await finishBuilding();
    expect(mockNav.replace).toHaveBeenCalledWith('WeekOne');
    const repos = getRepositories();
    expect((await repos.plan.get())?.daysPerWeek).toBe(4);
    expect(await repos.plan.days(1)).toHaveLength(7);
    expect((await repos.profile.get())?.onboarded).toBe(true);
    expect(await repos.onboardingDraft.load()).toBeNull();
    // D3: nothing about health or pain reaches the server.
    expect(sync).toHaveBeenCalledWith({ goal: 'body_part', styles: 1, days: 4, experience: 'on_and_off', variant: 'standard' });
    expect(JSON.stringify(sync.mock.calls)).not.toMatch(/knee|pain|health/i);
  });

  it('uses the gentler variant for a health flag', async () => {
    jest.useFakeTimers();
    const sync = jest.fn(async () => undefined);
    configureOnboardingDeps({ syncPlan: sync });
    await useOnboarding.getState().update({ goal: 'stay_fit', styles: ['normal'], healthFlags: ['heart_bp'], experience: 'new' });
    await render(<BuildingScreen />);
    await finishBuilding();
    expect((await getRepositories().plan.get())?.variant).toBe('gentler');
    expect(sync.mock.calls[0]).toEqual([expect.objectContaining({ variant: 'gentler', goal: 'gentler' })]);
  });

  it('WeekOne shows a rolling week starting today and the session hand-off', async () => {
    jest.useFakeTimers();
    const startToday = jest.fn(() => 'Player' as const);
    configureOnboardingDeps({ startToday });
    await useOnboarding.getState().update({ goal: 'stay_fit', styles: ['normal'], daysPerWeek: 4, experience: 'on_and_off' });
    const b = await render(<BuildingScreen />);
    await finishBuilding();
    await b.unmount();
    await render(<WeekOneScreen />);
    await act(async () => void jest.advanceTimersByTime(10));
    expect(screen.getByText('Week one')).toBeTruthy();
    // 27 Oct 2026 is a Tuesday: the strip starts on Tue and ends on Mon.
    expect(screen.getByLabelText('Tue, Today, today')).toBeTruthy();
    expect(screen.getByLabelText(/^Mon/)).toBeTruthy();
    await press("Start today's session");
    expect(startToday).toHaveBeenCalled();
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'Main' }, { name: 'Player' }] });
    await press('Look around first');
    expect(mockNav.reset).toHaveBeenLastCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });
});
