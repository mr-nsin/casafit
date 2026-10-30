import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { createTestDb } from '../../db/testing/nodeSqliteDriver';
import { createDevCameraPermission, createUnavailableSource, type CameraPermissionPort, type PoseFrame, type PoseSource } from '../../services/pose';
import { squatSequence } from '../../services/pose/synthetic';
import { DAY_MS, createFakePurchases, freeProInfo, setPurchases, type FakePurchases, type ProInfo } from '../../services/purchases';
import { useAuth } from '../../state/auth';
import { useConsent } from '../../state/consent';
import { setRepositories } from '../../state/storage';
import { formCheckRoutes } from '.';
import { useFormCheck, type FormCheckResult } from './controller';
import { configureFormCheckDeps } from './deps';
import { useEntitlements } from './entitlements';
import { resolveFormCheckEntry } from './gate';
import { CameraDeniedScreen, CameraPermissionScreen, FormCheckScreen, FormResultScreen, LiveCheckScreen, NoCreditsScreen } from './CheckScreens';
import { ManageProScreen, PaywallScreen, ProWelcomeScreen, formatDate } from './ProScreens';
import { exerciseChoices } from './model';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), reset: jest.fn(), goBack: jest.fn(), popTo: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useIsFocused: () => true }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const glyphs: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');

declare const __dirname: string;
const NOW = Date.UTC(2026, 9, 30);
const pro = (patch: Partial<ProInfo> = {}): ProInfo => ({
  active: true,
  plan: 'pro_yearly',
  expiresAt: Date.UTC(2027, 9, 14),
  willRenew: true,
  billingIssue: false,
  trial: false,
  priceString: 'STORE-PRICE',
  verifiedAt: NOW,
  ...patch,
});

let db: Awaited<ReturnType<typeof createTestDb>>;
let purchases: FakePurchases;
const api = jest.fn();
const openSettings = jest.fn(async () => undefined);
let source: PoseSource;
let push: (f: PoseFrame) => void;
let permission: CameraPermissionPort = createDevCameraPermission('undetermined');

const settle = async () => {
  for (let i = 0; i < 6; i += 1) await act(async () => new Promise((r) => setTimeout(r, 0)));
};
const feed = async (frames: PoseFrame[]) => {
  await act(async () => {
    for (const f of frames) push(f);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
  await settle();
};
const press = async (label: string | RegExp) => {
  await fireEvent.press(screen.getByLabelText(label));
  await settle();
};

beforeEach(async () => {
  db = await createTestDb();
  setRepositories(db.repos);
  Object.values(mockNav).forEach((f) => f.mockClear());
  mockNav.canGoBack.mockReturnValue(true);
  api.mockReset();
  api.mockImplementation(async (path: string) =>
    path === '/me/entitlements' ? { freeChecksRemaining: 2, pro: { active: false, expiresAt: null } } : { ok: true, freeChecksRemaining: 1 },
  );
  openSettings.mockClear();
  permission = createDevCameraPermission('granted');
  source = { kind: 'simulated', available: true, start: (cb) => (push = cb), stop: jest.fn() };
  purchases = createFakePurchases({ info: freeProInfo(NOW) });
  setPurchases(purchases);
  configureFormCheckDeps({
    api: api as never,
    repos: () => db.repos,
    now: () => NOW,
    openSettings,
    poseSource: () => source,
    permission: () => permission,
  });
  useAuth.setState({ freeChecksRemaining: 2, pro: { active: false, expiresAt: null } });
  useConsent.setState({ latest: { camera: { id: 'c', purpose: 'camera', granted: true, noticeVersion: 'v', at: NOW, source: 'permission_primer' } }, hydrated: true });
  useEntitlements.setState({ hydrated: true, freeChecks: 2, pro: null, offline: false, proChecksThisMonth: 0, welcomeKind: 'purchase' });
  useFormCheck.getState().reset();
  useFormCheck.getState().select('squat');
});
afterEach(() => {
  useFormCheck.getState().reset();
  configureFormCheckDeps(null);
  setPurchases(null);
  setRepositories(null);
  db.driver.close();
});

describe('route table', () => {
  it('has all nine routes with a component', () => {
    expect(Object.keys(formCheckRoutes).sort()).toEqual(
      ['CameraDenied', 'CameraPermission', 'FormCheck', 'FormResult', 'LiveCheck', 'ManagePro', 'NoCredits', 'Paywall', 'ProWelcome'].sort(),
    );
    for (const e of Object.values(formCheckRoutes)) expect(e.component).toBeDefined();
  });
});

describe('gate', () => {
  it('undetermined permission -> CameraPermission', async () => {
    permission = createDevCameraPermission('undetermined');
    expect(await resolveFormCheckEntry()).toBe('CameraPermission');
  });
  it('denied -> CameraDenied', async () => {
    permission = createDevCameraPermission('denied');
    expect(await resolveFormCheckEntry()).toBe('CameraDenied');
  });
  it('balance 0 and not Pro -> NoCredits', async () => {
    useEntitlements.setState({ freeChecks: 0 });
    expect(await resolveFormCheckEntry()).toBe('NoCredits');
  });
  it('balance 0 but Pro -> FormCheck', async () => {
    useEntitlements.setState({ freeChecks: 0, pro: pro() });
    expect(await resolveFormCheckEntry()).toBe('FormCheck');
  });
  it('otherwise FormCheck, and an unavailable camera module also goes to FormCheck', async () => {
    expect(await resolveFormCheckEntry()).toBe('FormCheck');
    permission = { status: () => 'unavailable', request: async () => 'unavailable' };
    expect(await resolveFormCheckEntry()).toBe('FormCheck');
  });
  it('asks again when camera consent was withdrawn', async () => {
    useConsent.setState({ latest: {}, hydrated: true });
    expect(await resolveFormCheckEntry()).toBe('CameraPermission');
    await useConsent.getState().record('camera', true, 'permission_primer');
    expect(await resolveFormCheckEntry()).toBe('FormCheck');
  });
});

describe('model', () => {
  it('knees disable the lunge, wrists the push-up, others nothing', () => {
    expect(exerciseChoices(['knees']).filter((c) => c.disabled).map((c) => c.id)).toEqual(['lunge']);
    expect(exerciseChoices(['wrists']).filter((c) => c.disabled).map((c) => c.id)).toEqual(['push_up']);
    expect(exerciseChoices(['back', 'shoulders']).some((c) => c.disabled)).toBe(false);
    expect(exerciseChoices(['knees']).find((c) => c.id === 'lunge')!.reason).toBe('Lunge is unavailable because of your knee');
  });
});

describe('CameraPermission', () => {
  it('shows the three privacy points', async () => {
    await render(<CameraPermissionScreen />);
    expect(screen.getByText('Your camera stays on this phone')).toBeTruthy();
    for (const t of ['Nothing is recorded', 'Nothing is uploaded', 'Off when you leave']) expect(screen.getByText(t)).toBeTruthy();
  });

  it('Allow camera records consent and moves on to FormCheck', async () => {
    permission = createDevCameraPermission('undetermined');
    await render(<CameraPermissionScreen />);
    await press('Allow camera');
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('FormCheck'));
    expect((await db.repos.consent.latest()).camera).toMatchObject({ granted: true, source: 'permission_primer' });
  });

  it('goes to NoCredits when the free checks are used up', async () => {
    permission = createDevCameraPermission('undetermined');
    useEntitlements.setState({ freeChecks: 0 });
    await render(<CameraPermissionScreen />);
    await press('Allow camera');
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('NoCredits'));
  });

  it('a denied prompt goes to CameraDenied and records no consent', async () => {
    permission = { status: () => 'undetermined', request: async () => 'denied' };
    await render(<CameraPermissionScreen />);
    await press('Allow camera');
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('CameraDenied'));
    expect((await db.repos.consent.latest()).camera).toBeUndefined();
  });

  it('Not now goes back', async () => {
    await render(<CameraPermissionScreen />);
    await press('Not now');
    expect(mockNav.goBack).toHaveBeenCalled();
  });
});

describe('CameraDenied', () => {
  it('explains, says nothing was spent, opens Settings and offers voice cues', async () => {
    await render(<CameraDeniedScreen />);
    expect(screen.getByText('The camera is off for CasaFit')).toBeTruthy();
    expect(screen.getByText('This did not use one of your free checks.')).toBeTruthy();
    await press('Open Settings');
    expect(openSettings).toHaveBeenCalled();
    await press('Continue with voice cues only');
    expect(mockNav.popTo).toHaveBeenCalledWith('Player');
  });
});

describe('NoCredits', () => {
  it('shows the empty tiles and links to Pro', async () => {
    await render(<NoCreditsScreen />);
    expect(screen.getByText('You have used both free form checks')).toBeTruthy();
    expect(screen.getByLabelText('0 of 2 free form checks left')).toBeTruthy();
    await press('See Pro');
    expect(mockNav.navigate).toHaveBeenCalledWith('Paywall');
    await press('Keep training with voice cues');
    expect(mockNav.popTo).toHaveBeenCalledWith('Player');
  });
});

describe('FormCheck', () => {
  it('lists the four exercises and the spend notice for a free account', async () => {
    await render(<FormCheckScreen />);
    for (const l of ['Squat', 'Push-up', 'Plank', 'Lunge']) expect(screen.getByLabelText(l)).toBeTruthy();
    expect(screen.getByText('This will use 1 of your 2 free form checks.')).toBeTruthy();
    expect(screen.getByText("It's only spent after 3 analysed reps. Stop before that and it's free.")).toBeTruthy();
  });

  it('says 10 seconds for the plank, not reps', async () => {
    await render(<FormCheckScreen />);
    await press('Plank');
    expect(screen.getByText("It's only spent after a 10 second hold. Stop before that and it's free.")).toBeTruthy();
  });

  it('the last free check has its own wording', async () => {
    useEntitlements.setState({ freeChecks: 1 });
    api.mockImplementation(async () => ({ freeChecksRemaining: 1, pro: { active: false, expiresAt: null } }));
    await render(<FormCheckScreen />);
    expect(await screen.findByText('This will use your last free form check.')).toBeTruthy();
  });

  it('Pro hides the spend notice and shows Unlimited', async () => {
    useEntitlements.setState({ pro: pro() });
    purchases.info = pro();
    await render(<FormCheckScreen />);
    await settle();
    expect(screen.queryByText(/This will use/)).toBeNull();
    expect(screen.getByLabelText('Unlimited form checks')).toBeTruthy();
  });

  it('disables the lunge with a reason when the knees are flagged, and keeps the others on', async () => {
    await db.repos.profile.save({ painAreas: ['knees'] });
    await render(<FormCheckScreen />);
    expect(await screen.findByText('Lunge is unavailable because of your knee')).toBeTruthy();
    expect(screen.getByLabelText('Lunge')).toBeDisabled();
    expect(screen.getByLabelText('Squat')).not.toBeDisabled();
  });

  it('with 0 free checks it sends you to NoCredits before the camera opens', async () => {
    useEntitlements.setState({ freeChecks: 0 });
    api.mockImplementation(async () => ({ freeChecksRemaining: 0, pro: { active: false, expiresAt: null } }));
    await render(<FormCheckScreen />);
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('NoCredits'));
  });

  it('Check framing is free: no attempt, no network call besides the balance read', async () => {
    await render(<FormCheckScreen />);
    await settle();
    api.mockClear();
    await press('Check framing (free)');
    await feed([squatSequence({ reps: 1 })[0]!]);
    expect(await screen.findByText('Whole body in frame')).toBeTruthy();
    expect(screen.getByText('Light OK')).toBeTruthy();
    expect(api).not.toHaveBeenCalled();
    expect(useFormCheck.getState().attemptId).toBeNull();
  });

  it('asks for a step closer when the figure is small', async () => {
    await render(<FormCheckScreen />);
    await press('Check framing (free)');
    await feed([squatSequence({ reps: 1, scale: 0.3 })[0]!]);
    expect(await screen.findByText('Step a little closer')).toBeTruthy();
  });

  it('Start analysis creates the attempt and opens LiveCheck', async () => {
    await render(<FormCheckScreen />);
    await press('Start analysis');
    await waitFor(() => expect(mockNav.navigate).toHaveBeenCalledWith('LiveCheck'));
    expect(useFormCheck.getState().phase).toBe('running');
    expect((await db.repos.formCheck.get(useFormCheck.getState().attemptId!))!.state).toBe('armed');
  });

  it('shows a calm not-ready state when there is no pose source, and spends nothing', async () => {
    source = createUnavailableSource('native_module_missing');
    await render(<FormCheckScreen />);
    expect(screen.getByText('Form check is not ready on this build')).toBeTruthy();
    expect(screen.queryByLabelText('Start analysis')).toBeNull();
    expect(useFormCheck.getState().attemptId).toBeNull();
  });
});

describe('LiveCheck', () => {
  const open = async () => {
    await useFormCheck.getState().start();
    await render(<LiveCheckScreen />);
  };

  it('counts reps up to the count point, then says it counts and offers the result', async () => {
    await open();
    expect(screen.getByText('Reps analysed')).toBeTruthy();
    expect(screen.getByText('3 more to count')).toBeTruthy();
    const frames = squatSequence({ reps: 5 });
    await feed(frames);
    expect(screen.getByText('3 reps done. This check now counts.')).toBeTruthy();
    expect(screen.getByLabelText('See result')).toBeTruthy();
    expect(screen.getByText('Nothing is recorded or saved')).toBeTruthy();
    expect(screen.getByText('Squat · free check 1 of 2')).toBeTruthy();
  });

  it('shows a cue for a shallow rep in a live region', async () => {
    await open();
    await feed(squatSequence({ reps: 1, minKnee: 108 }));
    expect(screen.getByText('A little deeper')).toBeTruthy();
  });

  it('See result finishes the check and opens FormResult', async () => {
    await open();
    await feed(squatSequence({ reps: 4 }));
    await press('See result');
    expect(mockNav.replace).toHaveBeenCalledWith('FormResult');
    expect(useFormCheck.getState().result).toMatchObject({ repsAnalysed: 4 });
  });

  it('close before rep 3 discards, spends nothing and goes back to FormCheck (A5)', async () => {
    await open();
    const id = useFormCheck.getState().attemptId!;
    await feed(squatSequence({ reps: 2 }));
    await press('Close');
    expect(mockNav.goBack).toHaveBeenCalled();
    expect(mockNav.replace).not.toHaveBeenCalledWith('FormResult');
    expect((await db.repos.formCheck.get(id))!.state).toBe('cancelled');
    expect(api.mock.calls.some((c) => String(c[0]).includes('consume'))).toBe(false);
    expect(useFormCheck.getState().result).toBeNull();
  });

  it('the plank shows seconds held', async () => {
    useFormCheck.getState().select('plank');
    await useFormCheck.getState().start();
    await render(<LiveCheckScreen />);
    expect(screen.getByText('Hold time')).toBeTruthy();
    expect(screen.getByText('of 10 seconds to count')).toBeTruthy();
    expect(screen.queryByText(/reps/)).toBeNull();
  });

  it('tells you when it loses you, without a cue', async () => {
    await open();
    const f = squatSequence({ reps: 1 });
    await feed(f.slice(0, 20));
    const hidden = f.slice(20, 50).map((x) => ({ ...x, lm: x.lm.map((l) => ({ ...l, v: 0.05 })) }));
    await feed(hidden);
    expect(screen.getByText('We lost you. Step back into view.')).toBeTruthy();
  });

  it('with no attempt (cold open) it returns to FormCheck', async () => {
    await render(<LiveCheckScreen />);
    expect(mockNav.replace).toHaveBeenCalledWith('FormCheck');
  });

  it('cancels a running check when the screen goes away', async () => {
    await open();
    const id = useFormCheck.getState().attemptId!;
    await screen.unmount();
    await settle();
    expect((await db.repos.formCheck.get(id))!.state).toBe('cancelled');
  });
});

const result = (patch: Partial<FormCheckResult> = {}): FormCheckResult => ({
  attemptId: 'a',
  exercise: 'squat',
  repsAnalysed: 5,
  repsClean: 4,
  perRep: [1, 2, 3, 4, 5].map((i) => ({ index: i, ok: i !== 3, ...(i === 3 ? { issue: 'knees' as const } : {}) })),
  findings: [
    { area: 'depth', status: 'ok', text: 'Good depth' },
    { area: 'knees', status: 'warn', text: 'Try to keep your knees over your toes' },
    { area: 'back', status: 'ok', text: 'Stayed neutral' },
  ],
  rating: 'good',
  tip: 'Push your knees out over your toes as you go down.',
  spend: 'spent',
  creditsLeft: 1,
  ...patch,
});

describe('FormResult', () => {
  it('shows the rating, rep chips, findings, tip and the Pro link', async () => {
    useFormCheck.setState({ result: result() });
    await render(<FormResultScreen />);
    expect(screen.getByText('Good form')).toBeTruthy();
    expect(screen.getByText('4/5')).toBeTruthy();
    expect(screen.getByText('4 of 5 reps were clean. Nothing was recorded or saved.')).toBeTruthy();
    expect(screen.getByLabelText('Rep 3, knees needs attention')).toBeTruthy();
    expect(screen.getByLabelText('Rep 1, clean')).toBeTruthy();
    expect(screen.getByText('Knees')).toBeTruthy();
    expect(screen.getByText('Push your knees out over your toes as you go down.')).toBeTruthy();
    expect(screen.getByLabelText('1 of 2 free form checks left')).toBeTruthy();
    await press('Unlimited in Pro');
    expect(mockNav.navigate).toHaveBeenCalledWith('Paywall');
  });

  it('Done clears the result and goes back to the workout', async () => {
    useFormCheck.setState({ result: result() });
    await render(<FormResultScreen />);
    await press('Done');
    expect(useFormCheck.getState().result).toBeNull();
    expect(mockNav.popTo).toHaveBeenCalledWith('Player');
  });

  it('the last-credit variant says none left and keeps the tone kind', async () => {
    useFormCheck.setState({ result: result({ creditsLeft: 0, rating: 'needs_work', repsClean: 2 }) });
    await render(<FormResultScreen />);
    expect(screen.getByLabelText('0 of 2 free form checks left')).toBeTruthy();
    expect(screen.getByText('Needs work')).toBeTruthy();
  });

  it('Pro hides the chip and the Pro link', async () => {
    useFormCheck.setState({ result: result({ creditsLeft: 'unlimited', spend: 'pro' }) });
    await render(<FormResultScreen />);
    expect(screen.queryByLabelText('Unlimited in Pro')).toBeNull();
    expect(screen.queryByLabelText(/free form checks left/)).toBeNull();
  });

  it('the plank says seconds, and the offline and overdrawn notes are gentle', async () => {
    useFormCheck.setState({
      result: result({ exercise: 'plank', holdSeconds: 12, repsAnalysed: 2, repsClean: 2, perRep: [{ index: 1, ok: true }, { index: 2, ok: true }], findings: [], spend: 'local' }),
    });
    await render(<FormResultScreen />);
    expect(screen.getByText('You held a plank for 12 seconds. Nothing was recorded or saved.')).toBeTruthy();
    expect(screen.getByText('12s')).toBeTruthy();
    expect(screen.getByText("You're offline. We'll update your count when you are back online.")).toBeTruthy();
    expect(screen.queryByText(/reps/)).toBeNull();
  });

  it('with no result in memory it says so instead of crashing', async () => {
    await render(<FormResultScreen />);
    expect(screen.getByText(/no result to show/)).toBeTruthy();
  });
});

describe('Paywall', () => {
  it('shows a loading state, then the store prices and a save percent computed from them', async () => {
    let release: () => void = () => undefined;
    const real = purchases.getOfferings.bind(purchases);
    purchases.getOfferings = () => new Promise((r) => (release = () => void real().then(r)));
    await render(<PaywallScreen />);
    expect(screen.getByLabelText('Loading plans')).toBeTruthy();
    expect(screen.getByLabelText('Start Pro')).toBeDisabled();
    await act(async () => release());
    expect(await screen.findByLabelText(/Yearly, SAMPLE-Y, Save 17%/)).toBeTruthy();
    expect(screen.getByLabelText('Monthly, SAMPLE-M')).toBeTruthy();
    expect(screen.getByText('Best value')).toBeTruthy();
    expect(screen.getByText('You have used 0 of your 2 free checks. Free checks never expire.')).toBeTruthy();
  });

  it('hard-codes no price and hides the save percent when it cannot be worked out', async () => {
    purchases.offerings = {
      packages: [
        { id: 'a', plan: 'pro_yearly', priceString: 'ONLY-Y', price: 1000, currencyCode: 'AAA' },
        { id: 'm', plan: 'pro_monthly', priceString: 'ONLY-M', price: 100, currencyCode: 'BBB' },
      ],
    };
    await render(<PaywallScreen />);
    await screen.findByLabelText('Yearly, ONLY-Y');
    expect(screen.queryByText(/Save/)).toBeNull();
    expect(screen.queryByText('Best value')).toBeNull();
    expect(screen.queryByText(/₹|\$/)).toBeNull();
  });

  it('reflects how many free checks are used', async () => {
    useEntitlements.setState({ freeChecks: 1 });
    api.mockImplementation(async () => ({ freeChecksRemaining: 1, pro: { active: false, expiresAt: null } }));
    await render(<PaywallScreen />);
    expect(await screen.findByText('You have used 1 of your 2 free checks. Free checks never expire.')).toBeTruthy();
  });

  it('offline: a calm message, retry, and a disabled Start', async () => {
    purchases.offeringsError = 'offline';
    await render(<PaywallScreen />);
    expect(await screen.findByText(/Plans are not available right now/)).toBeTruthy();
    expect(screen.getByLabelText('Start Pro')).toBeDisabled();
    purchases.offeringsError = null;
    await press('Try again');
    expect(await screen.findByLabelText(/Yearly, SAMPLE-Y/)).toBeTruthy();
    expect(screen.getByLabelText('Start Pro')).not.toBeDisabled();
  });

  it('no RevenueCat key: says Pro is not on this build yet, no retry', async () => {
    setPurchases(createFakePurchases({ configured: false, info: freeProInfo(NOW) }));
    await render(<PaywallScreen />);
    expect(await screen.findByText(/Pro is not available on this build yet/)).toBeTruthy();
    expect(screen.queryByLabelText('Try again')).toBeNull();
    expect(screen.getByLabelText('Start Pro')).toBeDisabled();
    // Leaving still works.
    await press('Maybe later');
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('purchasing disables the buttons, and success opens ProWelcome', async () => {
    purchases.purchaseOutcome = 'hang';
    await render(<PaywallScreen />);
    await screen.findByLabelText(/Yearly/);
    await press('Start Pro');
    expect(screen.getByLabelText('Start Pro')).toBeDisabled();
    expect(purchases.calls).toContain('purchase:annual');
    await act(async () => purchases.settle({ kind: 'purchased', info: pro() }));
    await settle();
    expect(mockNav.replace).toHaveBeenCalledWith('ProWelcome');
    expect(useEntitlements.getState().pro).toMatchObject({ active: true });
    expect(useAuth.getState().pro.active).toBe(true);
  });

  it('picks the plan you select', async () => {
    purchases.purchaseOutcome = { kind: 'cancelled' };
    await render(<PaywallScreen />);
    await screen.findByLabelText(/Yearly/);
    await press(/Monthly, SAMPLE-M/);
    await press('Start Pro');
    expect(purchases.calls).toContain('purchase:monthly');
  });

  it('cancelling stays on the screen with a kind note', async () => {
    purchases.purchaseOutcome = { kind: 'cancelled' };
    await render(<PaywallScreen />);
    await screen.findByLabelText(/Yearly/);
    await press('Start Pro');
    expect(screen.getByText('No problem. You have not been charged.')).toBeTruthy();
    expect(mockNav.replace).not.toHaveBeenCalledWith('ProWelcome');
    expect(screen.getByLabelText('Start Pro')).not.toBeDisabled();
  });

  it('pending and failed purchases are explained', async () => {
    purchases.purchaseOutcome = { kind: 'pending' };
    await render(<PaywallScreen />);
    await screen.findByLabelText(/Yearly/);
    await press('Start Pro');
    expect(screen.getByText(/pending/)).toBeTruthy();
    purchases.purchaseOutcome = { kind: 'error', message: 'The store could not finish the purchase.' };
    await press('Start Pro');
    expect(screen.getByText('The store could not finish the purchase.')).toBeTruthy();
  });

  it('restore found: Pro is back', async () => {
    purchases.restoreInfo = pro();
    await render(<PaywallScreen />);
    await screen.findByLabelText(/Yearly/);
    await press('Restore purchase');
    expect(mockNav.replace).toHaveBeenCalledWith('ProWelcome');
    expect(useEntitlements.getState().welcomeKind).toBe('restore');
  });

  it('restore not found: says so and stays', async () => {
    purchases.restoreInfo = null;
    await render(<PaywallScreen />);
    await screen.findByLabelText(/Yearly/);
    await press('Restore purchase');
    expect(screen.getByText('No purchase found for this store account.')).toBeTruthy();
    expect(mockNav.replace).not.toHaveBeenCalledWith('ProWelcome');
  });

  it('restore offline: asks to try again', async () => {
    purchases.restoreError = 'offline';
    await render(<PaywallScreen />);
    await screen.findByLabelText(/Yearly/);
    await press('Restore purchase');
    expect(screen.getByText(/could not reach the store/)).toBeTruthy();
  });

  it('already Pro: goes to ManagePro', async () => {
    useEntitlements.setState({ pro: pro() });
    purchases.info = pro();
    await render(<PaywallScreen />);
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('ManagePro'));
  });
});

describe('ManagePro', () => {
  const show = async (info: ProInfo, extra: Partial<ReturnType<typeof useEntitlements.getState>> = {}) => {
    useEntitlements.setState({ pro: info, ...extra });
    purchases.info = info;
    await render(<ManageProScreen />);
    await settle();
  };

  it('active yearly: status, renewal date with the store price, free-check footnote', async () => {
    await show(pro(), { proChecksThisMonth: 12 });
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Pro · Yearly')).toBeTruthy();
    expect(screen.getByText('Renews on 14 October 2027 · STORE-PRICE')).toBeTruthy();
    expect(screen.getByText('12 checks used this month · still on this phone')).toBeTruthy();
    expect(screen.getByText(/You keep Pro until 14 October 2027, and your 2 free checks stay as they were/)).toBeTruthy();
    expect(screen.getByLabelText(/Switch to monthly/)).toBeTruthy();
    expect(screen.getByLabelText(/Cancel Pro/)).toBeTruthy();
  });

  it('monthly offers Switch to yearly', async () => {
    await show(pro({ plan: 'pro_monthly' }));
    expect(screen.getByText('Pro · Monthly')).toBeTruthy();
    expect(screen.getByLabelText(/Switch to yearly/)).toBeTruthy();
  });

  it('cancelled: Pro until the date, will not renew, no cancel row', async () => {
    await show(pro({ willRenew: false }));
    expect(screen.getByText('Pro until 14 October 2027. It will not renew.')).toBeTruthy();
    expect(screen.queryByLabelText(/Cancel Pro/)).toBeNull();
  });

  it('billing issue: asks to update the payment method', async () => {
    await show(pro({ billingIssue: true }));
    expect(screen.getByText(/Update your payment method/)).toBeTruthy();
    await press(/Update payment method/);
    expect(purchases.calls).toContain('manage');
  });

  it('trial shows the trial end', async () => {
    await show(pro({ trial: true }));
    expect(screen.getByText('Trial ends on 14 October 2027')).toBeTruthy();
  });

  it('offline: an "as of" note and the actions do nothing', async () => {
    purchases.infoError = 'offline';
    api.mockRejectedValue(new Error('offline'));
    await show(pro());
    expect(screen.getByText(/as of 30 October 2026/)).toBeTruthy();
    purchases.calls.length = 0;
    await fireEvent.press(screen.getByLabelText(/Cancel Pro/));
    expect(purchases.calls).not.toContain('manage');
  });

  it('Cancel Pro and Switch open the store page', async () => {
    await show(pro());
    purchases.calls.length = 0;
    await press(/Cancel Pro/);
    await press(/Switch to monthly/);
    expect(purchases.calls.filter((c) => c === 'manage')).toHaveLength(2);
  });

  it('Restore purchase runs in place and says what it found', async () => {
    await show(pro());
    purchases.restoreInfo = pro();
    await press(/Restore purchase/);
    expect(screen.getByText('Pro restored.')).toBeTruthy();
    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  it('a free account sees the free plan and a way to the paywall', async () => {
    useEntitlements.setState({ pro: null });
    await render(<ManageProScreen />);
    expect(screen.getByText(/You are on the free plan/)).toBeTruthy();
    await press('See Pro');
    expect(mockNav.replace).toHaveBeenCalledWith('Paywall');
  });

  it('formats dates in plain words', () => {
    expect(formatDate(Date.UTC(2027, 9, 14))).toBe('14 October 2027');
  });
});

describe('ProWelcome', () => {
  it('announces success, shows the plan and offers the next step', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    useEntitlements.setState({ pro: pro() });
    await render(<ProWelcomeScreen />);
    expect(screen.getAllByText("You're on Pro").length).toBeGreaterThan(0);
    expect(announce).toHaveBeenCalledWith("You're on Pro");
    expect(screen.getByText('Yearly plan · renews 14 October 2027. Thank you for backing CasaFit.')).toBeTruthy();
    await press('Back to home');
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    announce.mockRestore();
  });

  it('after a restore it says Pro is back', async () => {
    useEntitlements.setState({ pro: pro(), welcomeKind: 'restore' });
    await render(<ProWelcomeScreen />);
    expect(screen.getAllByText('Pro is back').length).toBeGreaterThan(0);
  });

  it('Try a form check goes through the gate', async () => {
    permission = createDevCameraPermission('undetermined');
    useEntitlements.setState({ pro: pro() });
    await render(<ProWelcomeScreen />);
    await press('Try a form check');
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('CameraPermission'));
  });
});

describe('entitlements cache', () => {
  it('survives a restart: balance and Pro come back from the phone', async () => {
    await useEntitlements.getState().applyPro(pro());
    await useEntitlements.getState().setFreeChecks(1);
    useEntitlements.setState({ hydrated: false, freeChecks: 2, pro: null });
    await useEntitlements.getState().hydrate();
    expect(useEntitlements.getState()).toMatchObject({ freeChecks: 1, hydrated: true });
    expect(useEntitlements.getState().pro).toMatchObject({ active: true, plan: 'pro_yearly' });
    expect(useAuth.getState().freeChecksRemaining).toBe(1);
  });

  it('refresh keeps the cache when offline and flags it', async () => {
    await useEntitlements.getState().applyPro(pro());
    purchases.infoError = 'offline';
    api.mockRejectedValue(new Error('network'));
    await useEntitlements.getState().refresh();
    expect(useEntitlements.getState().offline).toBe(true);
    expect(useEntitlements.getState().pro).toMatchObject({ active: true });
  });

  it('refresh takes the server balance and the store answer when online', async () => {
    api.mockResolvedValue({ freeChecksRemaining: 0, pro: { active: false, expiresAt: null } });
    purchases.info = pro();
    await useEntitlements.getState().refresh();
    expect(useEntitlements.getState()).toMatchObject({ freeChecks: 0, offline: false });
    expect(useEntitlements.getState().pro?.active).toBe(true);
  });

  it('with no store key the server view stands in for Pro', async () => {
    setPurchases(createFakePurchases({ configured: false, info: freeProInfo(NOW) }));
    api.mockResolvedValue({ freeChecksRemaining: 2, pro: { active: true, expiresAt: new Date(NOW + DAY_MS).toISOString() } });
    await useEntitlements.getState().refresh();
    expect(useEntitlements.getState().pro?.active).toBe(true);
  });
});

describe('icons', () => {
  it('every literal icon in this lane is a real MaterialIcons glyph', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readFileSync(f: string, e: string): string; readdirSync(d: string): string[] };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as { join(...p: string[]): string };
    const dir = __dirname;
    const bad: string[] = [];
    for (const f of fs.readdirSync(dir).filter((x) => /\.tsx?$/.test(x) && !/\.test\./.test(x))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/(?:icon|leadingIcon|trailingIcon|name)=\{?['"]([a-z0-9_]+)['"]/g)) {
        if (m[1] === 'fitness_center' || !(m[1]!.replace(/_/g, '-') in glyphs)) bad.push(`${f}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
