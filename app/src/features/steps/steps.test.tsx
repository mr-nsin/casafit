import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { createTestDb } from '../../db/testing/nodeSqliteDriver';
import { setRepositories } from '../../state/storage';
import { useConsent } from '../../state/consent';
import { createFakeStepCounter, dayRange, setStepCounter, todayKey, deviceTzOffsetMin, type FakeStepCounter } from '../../services/step-counter';
import { StepsScreen } from './StepsScreen';
import { StepsPermissionScreen } from './StepsPermissionScreen';
import { ReverseScreen, ReverseTimerScreen } from './ReverseScreens';
import { configureBoutDeps, useBout } from './reverseStore';
import { buildWeek, formatCount, goalFor, reverseHidden, usedSeconds } from './model';
import { stepsRoutes } from '.';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }));

let db: Awaited<ReturnType<typeof createTestDb>>;
let counter: FakeStepCounter;

/** Steps for today only; every other day reads zero. */
const todayOnly = (steps: number) => (r: { startMs: number; endMs: number }) => ({
  steps: r.startMs <= Date.now() && Date.now() < r.endMs ? steps : 0,
  minuteBuckets: null,
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
const settle = async () => {
  for (let i = 0; i < 6; i += 1) await flush();
};

beforeEach(async () => {
  db = await createTestDb();
  setRepositories(db.repos);
  useConsent.setState({ latest: {}, hydrated: false });
  useBout.getState().reset();
  Object.values(mockNav).forEach((f) => f.mockClear());
  counter = createFakeStepCounter({ state: 'granted', reading: todayOnly(4820) });
  setStepCounter(counter);
});
afterEach(() => {
  setRepositories(null);
  setStepCounter(null);
  db.driver.close();
});

describe('model', () => {
  it('formats counts and builds the rolling week with spoken labels', () => {
    expect(formatCount(4820)).toBe('4,820');
    const w = buildWeek('2026-10-27', [{ onDate: '2026-10-25', steps: 5200, briskMinutes: 0, source: 'pedometer', updatedAt: 0, syncedAt: null }]);
    expect(w.labels).toHaveLength(7);
    expect(w.labels[6]).toBe('Today');
    expect(w.a11yLabels[4]).toBe('Sun 5,200 steps');
  });
  it('goal ramps from the recent average and defaults to 7,000', () => {
    expect(goalFor('2026-10-27', [], null, 2026)).toBe(7000);
    const row = (d: string, steps: number) => ({ onDate: d, steps, briskMinutes: 0, source: 'pedometer' as const, updatedAt: 0, syncedAt: null });
    expect(goalFor('2026-10-27', [row('2026-10-26', 3000)], 1990, 2026)).toBe(4000);
    expect(goalFor('2026-10-27', [row('2026-10-26', 3000)], 1950, 2026)).toBe(4000);
  });
  it('an unclosed bout counts at most one bout target', () => {
    const tz = 0;
    const { startMs } = dayRange('2026-10-27', tz);
    const open = { id: 'a', startedAt: startMs + 1000, endedAt: null, steps: 0, stoppedBy: null };
    expect(usedSeconds([open], '2026-10-27', startMs + 3_600_000, tz)).toBe(600);
    expect(usedSeconds([{ ...open, endedAt: startMs + 301_000 }], '2026-10-27', startMs + 3_600_000, tz)).toBe(300);
  });
  it('exposes four routes', () => {
    expect(Object.keys(stepsRoutes).sort()).toEqual(['Reverse', 'ReverseTimer', 'Steps', 'StepsPermission']);
  });
});

describe('Steps screen', () => {
  it('shows today, the goal, the week and the no-GPS note', async () => {
    await render(<StepsScreen />);
    await settle();
    expect(screen.getByLabelText(/4,820 of 7,000 steps today/)).toBeTruthy();
    expect(screen.getByText('2,180 to go')).toBeTruthy();
    expect(screen.getByText(/No GPS/)).toBeTruthy();
    expect(screen.getByText('Normal walk')).toBeTruthy();
    expect(screen.getByText('Brisk walk')).toBeTruthy();
    expect(screen.getByText('Reverse walk')).toBeTruthy();
    expect(screen.queryByTestId('steps-paused-card')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Try' }));
    expect(mockNav.navigate).toHaveBeenCalledWith('Reverse');
  });

  it('hides reverse walking with a health flag', async () => {
    await db.repos.profile.save({ healthFlags: ['heart_bp'] });
    await render(<StepsScreen />);
    await settle();
    expect(screen.queryByText('Reverse walk')).toBeNull();
    expect(reverseHidden({ allowed: false, reason: 'health_flag' })).toBe(true);
    expect(reverseHidden({ allowed: false, reason: 'daily_cap' })).toBe(false);
  });

  it('shows one calm card when counting is paused and keeps the last count', async () => {
    counter.state = 'denied_permanent';
    await db.repos.steps.upsert({ onDate: todayKey(), steps: 3100, briskMinutes: 4, source: 'health_connect', updatedAt: 1 });
    await render(<StepsScreen />);
    await settle();
    expect(screen.getByText('Step counting is paused')).toBeTruthy();
    expect(screen.getByLabelText(/3,100 of 7,000 steps today, last count/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on in Settings' }));
    expect(mockNav.navigate).toHaveBeenCalledWith('StepsPermission');
    expect(counter.ranges).toHaveLength(0); // nothing is read without permission
  });

  it('says goal reached without fuss', async () => {
    counter = createFakeStepCounter({ state: 'granted', reading: todayOnly(7400) });
    setStepCounter(counter);
    await render(<StepsScreen />);
    await settle();
    expect(screen.getByText('Goal reached')).toBeTruthy();
  });

  it('adds live steps to the stored count', async () => {
    await render(<StepsScreen />);
    await settle();
    await act(async () => counter.emitLive(30));
    expect(screen.getByLabelText(/4,850 of 7,000 steps today/)).toBeTruthy();
  });
});

describe('StepsPermission screen', () => {
  it('writes the consent record before the OS prompt, then opens Steps', async () => {
    counter.state = 'needs_primer';
    const order: string[] = [];
    const orig = counter.requestPermission.bind(counter);
    counter.requestPermission = async () => {
      order.push(`prompt:${useConsent.getState().has('steps')}`);
      return orig();
    };
    await render(<StepsPermissionScreen />);
    await settle();
    expect(screen.getByText('Count your steps too')).toBeTruthy();
    expect(screen.getByText('No GPS and no location, ever')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow step counting' }));
    await settle();
    expect(order).toEqual(['prompt:true']);
    expect((await db.repos.consent.latest()).steps).toMatchObject({ granted: true, source: 'permission_primer' });
    expect(mockNav.replace).toHaveBeenCalledWith('Steps');
  });

  it('Not now leaves without asking or recording consent', async () => {
    counter.state = 'needs_primer';
    await render(<StepsPermissionScreen />);
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(counter.requests).toBe(0);
    expect(mockNav.navigate).toHaveBeenCalledWith('Main');
    expect(await db.repos.consent.history('steps')).toHaveLength(0);
  });

  it('a first denial leads to the try-again variant', async () => {
    counter.state = 'needs_primer';
    counter.nextRequestResult = 'denied_can_ask';
    await render(<StepsPermissionScreen />);
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow step counting' }));
    await settle();
    expect(screen.getByText('Step counting is off')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('permanent denial points to Settings', async () => {
    counter.state = 'denied_permanent';
    await render(<StepsPermissionScreen />);
    await settle();
    expect(screen.getByText('Turn on steps in Settings')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(counter.settingsOpened).toBe(1);
  });

  it('Health Connect update variant offers the store and the sensor', async () => {
    counter.state = 'hc_update_required';
    await render(<StepsPermissionScreen />);
    await settle();
    expect(screen.getByRole('header', { name: 'Get Health Connect' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use the step sensor instead' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Get Health Connect' }));
    expect(counter.settingsOpened).toBe(1);
  });
});

describe('Reverse walk', () => {
  it('keeps Start disabled until all three boxes are ticked', async () => {
    await render(<ReverseScreen />);
    await settle();
    const start = () => screen.getByRole('button', { name: 'Start a bout' });
    expect(start().props.accessibilityState?.disabled ?? start().props['aria-disabled']).toBeTruthy();
    for (const box of screen.getAllByRole("checkbox")) await fireEvent.press(box);
    await fireEvent.press(start());
    await settle();
    expect(useBout.getState().status).toBe('running');
    expect(mockNav.replace).toHaveBeenCalledWith('ReverseTimer');
    expect((await db.repos.steps.boutsSince(0))[0]?.endedAt).toBeNull();
  });

  it('is blocked, without shame, by a health flag', async () => {
    await db.repos.profile.save({ healthFlags: ['pregnancy'] });
    await render(<ReverseScreen />);
    await settle();
    expect(screen.getByTestId('reverse-blocked')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start a bout' })).toBeNull();
  });

  it('is blocked after the 15 minutes are used', async () => {
    const now = Date.now();
    await db.repos.steps.startBout({ id: 'x', startedAt: now - 3_600_000 });
    await db.repos.steps.endBout('x', now - 3_600_000 + 900_000, 100, 'user');
    await render(<ReverseScreen />);
    await settle();
    expect(screen.getByText("You've done today's reverse walk")).toBeTruthy();
  });
});

describe('Reverse timer', () => {
  function clock() {
    let mono = 1000;
    let wall = Date.now();
    configureBoutDeps({
      clock: { now: () => mono, wall: () => wall },
      keepAwake: { activate: () => events.push('awake'), deactivate: () => events.push('sleep') },
      haptic: () => events.push('haptic'),
    });
    return (ms: number) => {
      mono += ms;
      wall += ms;
    };
  }
  let events: string[] = [];
  beforeEach(() => {
    events = [];
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('counts from the clock, keeps the screen awake, and stops on request', async () => {
    const advance = clock();
    await act(async () => useBout.getState().start({ usedBeforeS: 0, targetS: 600 }));
    await render(<ReverseTimerScreen />);
    advance(342_000);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText('5:42')).toBeTruthy();
    expect(screen.getByText('9:18')).toBeTruthy(); // left today of 15
    expect(screen.getByText('5 minutes done')).toBeTruthy();
    await act(async () => counter.emitLive(412));
    expect(screen.getByText('412')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Stop bout' }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    const [saved] = await db.repos.steps.boutsSince(0);
    expect(saved).toMatchObject({ steps: 4820, stoppedBy: 'user' }); // larger of live and the window read
    expect(events).toEqual(['awake', 'sleep', 'haptic']);
    expect(mockNav.replace).toHaveBeenCalledWith('Steps');
  });

  it('auto-stops at the daily cap', async () => {
    const advance = clock();
    await act(async () => useBout.getState().start({ usedBeforeS: 600, targetS: 300 }));
    await render(<ReverseTimerScreen />);
    advance(301_000);
    await act(async () => {
      jest.advanceTimersByTime(500);
      await jest.advanceTimersByTimeAsync(10);
    });
    expect(useBout.getState().stoppedBy).toBe('cap');
    expect((await db.repos.steps.boutsSince(0))[0]?.stoppedBy).toBe('cap');
    expect(screen.getByText("That is today's 15 minutes. Well done.")).toBeTruthy();
  });

  it('survives a render gap: elapsed time is clock based', async () => {
    const advance = clock();
    await act(async () => useBout.getState().start({ usedBeforeS: 0, targetS: 600 }));
    advance(125_000); // app was in the background; no ticks ran
    useBout.getState().tick();
    expect(useBout.getState().elapsedS).toBe(125);
  });

  it('with nothing running it goes back to Steps', async () => {
    await render(<ReverseTimerScreen />);
    expect(mockNav.replace).toHaveBeenCalledWith('Steps');
  });
});

void deviceTzOffsetMin;
