import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../state/auth';
import { useOnboarding } from '../../state/onboardingDraft';
import { configureOnboardingDeps } from './deps';
import { VerifyScreen } from './screens/Verify';
import { jsonResponse, mockNav, setupDb } from './testkit';

jest.mock('@react-navigation/native', () => ({ useNavigation: () => require('./testkit').mockNav }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const fetchMock = jest.fn();
let close: () => void;
beforeEach(async () => {
  ({ close } = await setupDb());
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
});
afterEach(() => {
  jest.useRealTimers();
  close();
});

const OK_SEND = { resendInSeconds: 30, attemptsLeftThisHour: 4 };
const VERIFIED = (isNewAccount: boolean) => ({
  accessToken: 'a', refreshToken: 'r', isNewAccount, freeChecksRemaining: 2, pro: { active: false, expiresAt: null },
});

async function sendPhone() {
  await render(<VerifyScreen />);
  await fireEvent.changeText(screen.getByTestId('verify-identifier'), '98765 43210');
  await act(async () => fireEvent.press(screen.getByLabelText('Send code')));
}
const enter = async (code: string) => {
  await act(async () => fireEvent.changeText(screen.getByLabelText('One-time code input'), code));
};
const lastBody = (i: number) => JSON.parse(fetchMock.mock.calls[i][1].body);

describe('Verify: sending', () => {
  it('normalises the number and shows the code step with a resend timer', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, OK_SEND));
    await sendPhone();
    expect(lastBody(0)).toEqual({ phone: '+919876543210' });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/auth\/code$/);
    expect(screen.getByText('Enter the code')).toBeTruthy();
    expect(screen.getByText('Resend code in 0:30')).toBeTruthy();
    await act(async () => void jest.advanceTimersByTime(30_000));
    expect(screen.getByLabelText('Resend code')).toBeTruthy();
  });

  it('rejects a bad number before any request', async () => {
    await render(<VerifyScreen />);
    await fireEvent.changeText(screen.getByTestId('verify-identifier'), '123');
    await act(async () => fireEvent.press(screen.getByLabelText('Send code')));
    expect(screen.getByText('Enter a valid mobile number.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends email normalised on the Email tab', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, OK_SEND));
    await render(<VerifyScreen />);
    await fireEvent.press(screen.getByLabelText('Email'));
    await fireEvent.changeText(screen.getByTestId('verify-identifier'), 'P.R.I.Y.A+x@gmail.com');
    await act(async () => fireEvent.press(screen.getByLabelText('Send code')));
    expect(lastBody(0)).toEqual({ email: 'priya@gmail.com' });
  });

  it('explains the hour limit (throttled 200)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { resendInSeconds: 1800, attemptsLeftThisHour: 0 }));
    await sendPhone();
    expect(screen.getByText(/5 codes this hour/)).toBeTruthy();
  });

  it('explains a short throttle', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { resendInSeconds: 12, attemptsLeftThisHour: 3 }));
    await sendPhone();
    expect(screen.getByText(/You can ask again in 0:12/)).toBeTruthy();
  });

  it('reports a failed device check (403)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { code: 'attestation_failed' }));
    await sendPhone();
    expect(screen.getByText(/could not check this device/)).toBeTruthy();
  });

  it('shows a field error on 400', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { errors: {} }));
    await sendPhone();
    expect(screen.getByText('Enter a valid mobile number.')).toBeTruthy();
  });

  it('goes to Offline when the network is down', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    await sendPhone();
    expect(mockNav.navigate).toHaveBeenCalledWith('Offline');
  });

  it('goes to Offline without calling the server when NetInfo says offline', async () => {
    configureOnboardingDeps({ isOnline: async () => false });
    await sendPhone();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockNav.navigate).toHaveBeenCalledWith('Offline');
  });
});

describe('Verify: code', () => {
  beforeEach(() => fetchMock.mockResolvedValueOnce(jsonResponse(200, OK_SEND)));

  it('verifies on the sixth digit, saves the session and resets to Goals for a new adult', async () => {
    await useOnboarding.getState().update({ confirmed18: true, birthYear: 1990 });
    await sendPhone();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, VERIFIED(true)));
    await enter('123456');
    expect(lastBody(1)).toEqual({ phone: '+919876543210', code: '123456' });
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Goals' }] }));
    expect(useAuth.getState().session?.accessToken).toBe('a');
  });

  it('sends a new account that skipped Age back to Age', async () => {
    await sendPhone();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, VERIFIED(true)));
    await enter('123456');
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Age' }] }));
  });

  it('sends a returning account with a local plan to WelcomeBack', async () => {
    const { getRepositories } = require('../../state/storage');
    await getRepositories().plan.save({
      goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'new', variant: 'standard', weekNumber: 1, engineVersion: '1',
    });
    await sendPhone();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, VERIFIED(false)));
    await enter('123456');
    await waitFor(() => expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'WelcomeBack' }] }));
  });

  it('counts down tries on a wrong code and shows the error only after six digits', async () => {
    await sendPhone();
    await enter('12345');
    expect(screen.queryByText(/not right/)).toBeNull();
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { code: 'wrong' }));
    await enter('123456');
    expect(await screen.findByText('That code is not right. 2 tries left.')).toBeTruthy();
    expect(mockNav.reset).not.toHaveBeenCalled();
  });

  it('shows the expired message', async () => {
    await sendPhone();
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { code: 'expired' }));
    await enter('123456');
    expect(await screen.findByText(/has expired/)).toBeTruthy();
  });

  it('locks after no_tries_left and disables Verify', async () => {
    await sendPhone();
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { code: 'no_tries_left' }));
    await enter('123456');
    expect(await screen.findByText(/Too many wrong codes/)).toBeTruthy();
    expect(screen.getByLabelText('Verify and continue').props.accessibilityState.disabled).toBe(true);
  });

  it('lets the user change the number', async () => {
    await sendPhone();
    await fireEvent.press(screen.getByLabelText('Wrong number? Change it'));
    expect(screen.getByTestId('verify-identifier')).toBeTruthy();
  });
});
