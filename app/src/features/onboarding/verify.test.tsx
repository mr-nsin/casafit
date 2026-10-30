import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { createUnconfiguredAuth, setAuth, type FakeAuth } from '../../services/auth';
import { useAuth } from '../../state/auth';
import { useOnboarding } from '../../state/onboardingDraft';
import { configureOnboardingDeps } from './deps';
import { useVerifyOutcome } from './flowState';
import { VerifyScreen } from './screens/Verify';
import { jsonResponse, mockNav, setupDb } from './testkit';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => require('./testkit').mockNav }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const ME = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'priya@gmail.com',
  emailMasked: 'p***@gmail.com',
  provider: 'email',
  locale: 'en-IN',
  onboarded: false,
  createdAt: '2026-10-30T10:00:00+00:00',
  freeChecksRemaining: 2,
  pro: { active: false, expiresAt: null },
  plan: null,
  ...over,
});

const fetchMock = jest.fn();
let close: () => void;
let auth: FakeAuth;
beforeEach(async () => {
  ({ close, auth } = await setupDb());
  fetchMock.mockReset();
  // GET /v1/me: a new account unless a test says otherwise.
  fetchMock.mockResolvedValue(jsonResponse(200, ME()));
  (globalThis as { fetch: unknown }).fetch = fetchMock;
});
afterEach(() => {
  jest.useRealTimers();
  close();
});

async function sendEmail(address = 'Priya@Gmail.com') {
  await render(<VerifyScreen />);
  await fireEvent.changeText(screen.getByTestId('verify-email'), address);
  await act(async () => fireEvent.press(screen.getByLabelText('Continue with email')));
}
const enter = async (code: string) => {
  await act(async () => fireEvent.changeText(screen.getByLabelText('One-time code input'), code));
};

describe('Sign in: email code', () => {
  it('sends the trimmed, lower-cased address and shows the masked address with a resend timer', async () => {
    jest.useFakeTimers();
    await sendEmail('  Priya@Gmail.com ');
    expect(auth.sent).toEqual(['priya@gmail.com']);
    expect(screen.getByText('Check your email')).toBeTruthy();
    expect(screen.getByText('We sent a code to p***@gmail.com')).toBeTruthy();
    expect(screen.getByText('Resend code in 1:00')).toBeTruthy();
    await act(async () => void jest.advanceTimersByTime(60_000));
    expect(screen.getByLabelText('Resend code')).toBeTruthy();
  });

  it('opens the keyboard on the first code box', async () => {
    await sendEmail();
    expect(screen.getByLabelText('One-time code input').props.autoFocus).toBe(true);
  });

  it('rejects a bad address before any request', async () => {
    await render(<VerifyScreen />);
    await fireEvent.changeText(screen.getByTestId('verify-email'), 'priya@');
    await act(async () => fireEvent.press(screen.getByLabelText('Continue with email')));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(auth.sent).toEqual([]);
  });

  it('explains a rate limit and starts the resend timer', async () => {
    auth.sendResult = { ok: false, reason: 'rate_limited', retryAfterS: 60 };
    await sendEmail();
    expect(screen.getByText(/A code was sent a moment ago\. You can ask again in 1:00/)).toBeTruthy();
  });

  it('shows a field error when the server refuses the address', async () => {
    auth.sendResult = { ok: false, reason: 'invalid_email' };
    await sendEmail();
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  });

  it('keeps going with a calm message when sending fails', async () => {
    auth.sendResult = { ok: false, reason: 'error' };
    await sendEmail();
    expect(screen.getByText(/Something went wrong sending the code/)).toBeTruthy();
  });

  it('goes to Offline when sending finds no network', async () => {
    auth.sendResult = { ok: false, reason: 'offline' };
    await sendEmail();
    expect(mockNav.navigate).toHaveBeenCalledWith('Offline');
  });

  it('goes to Offline without sending when NetInfo says offline', async () => {
    configureOnboardingDeps({ isOnline: async () => false });
    await sendEmail();
    expect(auth.sent).toEqual([]);
    expect(mockNav.navigate).toHaveBeenCalledWith('Offline');
  });

  it('verifies on the sixth digit, creates the account with /v1/me and resets to Goals for a new adult', async () => {
    await useOnboarding.getState().update({ confirmed18: true, birthYear: 1990 });
    await sendEmail();
    await enter('123456');
    expect(auth.verified).toEqual([{ email: 'priya@gmail.com', code: '123456' }]);
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Goals' }] }));
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/me$/);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer fake-access-token');
    expect(useAuth.getState().account).toMatchObject({ emailMasked: 'p***@gmail.com', provider: 'email' });
    expect(useVerifyOutcome.getState()).toMatchObject({ masked: 'p***@gmail.com', isNewAccount: true });
  });

  it('sends a new account that skipped Age back to Age', async () => {
    await sendEmail();
    await enter('123456');
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Age' }] }));
  });

  it('sends a returning account with a local plan to WelcomeBack', async () => {
    const { getRepositories } = require('../../state/storage');
    await getRepositories().plan.save({
      goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'new', variant: 'standard', weekNumber: 1, engineVersion: '1',
    });
    fetchMock.mockResolvedValue(jsonResponse(200, ME({ onboarded: true, plan: { goal: 'stay_fit' } })));
    await sendEmail();
    await enter('123456');
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'WelcomeBack' }] }));
    expect(useVerifyOutcome.getState().isNewAccount).toBe(false);
  });

  it('still signs in when /v1/me cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('network'));
    await useOnboarding.getState().update({ confirmed18: true, birthYear: 1990 });
    await sendEmail();
    await enter('123456');
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Goals' }] }));
    expect(useVerifyOutcome.getState().masked).toBe('p***@gmail.com');
  });

  it('counts down tries on a wrong code and shows the error only after six digits', async () => {
    await sendEmail();
    await enter('12345');
    expect(screen.queryByText(/not right/)).toBeNull();
    await enter('654321');
    expect(await screen.findByText('That code is not right, or it has expired. 2 tries left.')).toBeTruthy();
    expect(mockNav.reset).not.toHaveBeenCalled();
  });

  it('shows the expired message', async () => {
    await sendEmail();
    auth.verifyResult = { ok: false, reason: 'expired' };
    await enter('123456');
    expect(await screen.findByText('That code has expired. Ask for a new one.')).toBeTruthy();
  });

  it('calls a code that the server rejects expired once its lifetime has passed', async () => {
    let now = new Date(2026, 9, 27, 9, 0).getTime();
    configureOnboardingDeps({ now: () => now });
    await sendEmail();
    now += 61 * 60 * 1000;
    await enter('654321');
    expect(await screen.findByText('That code has expired. Ask for a new one.')).toBeTruthy();
  });

  it('locks after three wrong codes and disables Verify', async () => {
    await sendEmail();
    for (const c of ['111111', '222222', '333333']) await enter(c);
    expect(await screen.findByText(/Too many wrong codes/)).toBeTruthy();
    expect(screen.getByLabelText('Verify and continue').props.accessibilityState.disabled).toBe(true);
  });

  it('lets the user change the email', async () => {
    await sendEmail();
    await fireEvent.press(screen.getByLabelText('Wrong email? Change it'));
    expect(screen.getByTestId('verify-email')).toBeTruthy();
  });
});

describe('Sign in: social', () => {
  const asOs = (os: 'ios' | 'android') => {
    const prev = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    return () => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => prev });
  };

  it('signs in with Google and routes like an email sign-in', async () => {
    await useOnboarding.getState().update({ confirmed18: true, birthYear: 1990 });
    fetchMock.mockResolvedValue(jsonResponse(200, ME({ provider: 'google' })));
    await render(<VerifyScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('Continue with Google')));
    expect(auth.oauthCalls).toEqual(['google']);
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Goals' }] }));
    expect(useVerifyOutcome.getState().provider).toBe('google');
  });

  it('offers Apple on iOS only', async () => {
    let restore = asOs('ios');
    const view = await render(<VerifyScreen />);
    expect(screen.getByLabelText('Continue with Apple')).toBeTruthy();
    expect(screen.getByLabelText('Continue with Facebook')).toBeTruthy();
    await view.unmount();
    restore();
    restore = asOs('android');
    await render(<VerifyScreen />);
    expect(screen.queryByLabelText('Continue with Apple')).toBeNull();
    expect(screen.getByLabelText('Continue with Google')).toBeTruthy();
    restore();
  });

  it('is calm when the person closes the browser', async () => {
    auth.oauthResult = { ok: false, reason: 'cancelled' };
    await render(<VerifyScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('Continue with Facebook')));
    expect(screen.getByText('Sign-in was cancelled. Nothing was changed.')).toBeTruthy();
    expect(mockNav.reset).not.toHaveBeenCalled();
  });

  it('points to email when a provider fails', async () => {
    auth.oauthResult = { ok: false, reason: 'error' };
    await render(<VerifyScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('Continue with Google')));
    expect(screen.getByText(/could not finish signing in with Google. Try again, or use email/)).toBeTruthy();
  });

  it('goes to Offline when there is no network', async () => {
    configureOnboardingDeps({ isOnline: async () => false });
    await render(<VerifyScreen />);
    await act(async () => fireEvent.press(screen.getByLabelText('Continue with Google')));
    expect(auth.oauthCalls).toEqual([]);
    expect(mockNav.navigate).toHaveBeenCalledWith('Offline');
  });
});

describe('Sign in: not set up', () => {
  it('shows a calm note and no sign-in buttons', async () => {
    setAuth(createUnconfiguredAuth());
    await render(<VerifyScreen />);
    expect(screen.getByText(/Sign in is not set up on this build/)).toBeTruthy();
    expect(screen.queryByLabelText('Continue with email')).toBeNull();
    expect(screen.queryByLabelText('Continue with Google')).toBeNull();
  });
});
