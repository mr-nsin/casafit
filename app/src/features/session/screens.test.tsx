import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { routeForView } from './hooks';
import { CompleteScreen } from './screens/CompleteScreen';
import { DESK_MOVES, DeskScreen, deskPosition } from './screens/DeskScreen';
import { EndSessionScreen, FeelScreen, SessionSettingsScreen } from './screens/Overlays';
import { PausedScreen } from './screens/PausedScreen';
import { RestScreen } from './screens/RestScreen';
import { DanceScreen, PlayerScreen, YogaScreen } from './screens/Stages';
import { createHarness, makePlan } from './testkit';
import { effOf } from './view';
import { configureSessionDeps } from './deps';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), reset: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav, useIsFocused: () => true }));

beforeEach(() => {
  jest.useFakeTimers();
  Object.values(mockNav).forEach((f) => f.mockClear());
});
afterEach(() => jest.useRealTimers());

function setup(style: 'normal' | 'yoga' | 'dance' = 'normal') {
  const h = createHarness();
  configureSessionDeps({
    content: { exercise: (id) => ({ id, cue: `Cue for ${id}`, bpm: 112, breath: { inS: 4, outS: 6 } }) },
  });
  h.store.getState().start(makePlan({ style }));
  return h;
}

/** Advance the fake clock and the render interval together. */
async function elapse(h: ReturnType<typeof createHarness>, ms: number) {
  await act(async () => {
    // Tick each second so a long step never looks like a frozen app.
    for (let left = ms; left > 0; left -= 1000) {
      h.clock.advance(Math.min(1000, left));
      h.store.getState().tick();
    }
    jest.advanceTimersByTime(250);
  });
}

describe('Player controls', () => {
  it('draw real icons, not characters, with labelled 44 px targets', async () => {
    setup();
    await render(<PlayerScreen />);
    for (const [label, icon] of [
      ['End session', 'close'],
      ['Edit session', 'tune'],
      ['Previous move', 'skip-previous'],
      ['Pause', 'pause'],
      ['Next move', 'skip-next'],
    ] as const) {
      const btn = screen.getByLabelText(label);
      expect(btn).toBeTruthy();
      expect(screen.getByText(`MaterialIcons:${icon}`)).toBeTruthy();
    }
    expect(screen.queryByText('X')).toBeNull();
    expect(screen.queryByText('II')).toBeNull();
    // The selected intensity shows a check icon instead of a "v".
    expect(screen.getByText('MaterialIcons:check')).toBeTruthy();
    expect(screen.queryByText(/^v /)).toBeNull();
  });
});

describe('Player', () => {
  it('shows the move, the countdown and the move count', async () => {
    const h = setup();
    await elapse(h, 120_000 + 12_000 + 12_000);
    await render(<PlayerScreen />);
    expect(screen.getByText('Move 0')).toBeTruthy();
    expect(screen.getByText('Move 1 of 5')).toBeTruthy();
    expect(screen.getByText('0:28')).toBeTruthy();
    expect(screen.getByText('Cue for move-0')).toBeTruthy();
    expect(screen.getByText(/Set 1 of 2/)).toBeTruthy();
  });

  it('ticks the countdown from the clock, not from timer calls', async () => {
    const h = setup();
    await elapse(h, 120_000 + 12_000 + 1_000);
    await render(<PlayerScreen />);
    expect(screen.getByText('0:39')).toBeTruthy();
    await elapse(h, 10_000);
    expect(screen.getByText('0:29')).toBeTruthy();
  });

  it('pause button pauses the store; intensity buttons change the rung; +15s extends rest', async () => {
    const h = setup();
    await elapse(h, 120_000 + 12_000 + 5_000);
    await render(<PlayerScreen />);
    await fireEvent.press(screen.getByLabelText('Harder'));
    expect(h.store.getState().rung).toBe(1);
    await fireEvent.press(screen.getByLabelText('+15s rest'));
    const rest = effOf(h.store.getState()).find((e) => e.seg.kind === 'rest' && e.seg.stepIndex === 4)!;
    expect(rest.endMs - rest.startMs).toBe(35_000);
    await fireEvent.press(screen.getByLabelText('Pause'));
    expect(h.store.getState().status).toBe('paused');
  });

  it('close opens the end dialog route', async () => {
    setup();
    await render(<PlayerScreen />);
    await fireEvent.press(screen.getByLabelText('End session'));
    expect(mockNav.navigate).toHaveBeenCalledWith('EndSession');
  });

  it('offers Check form only on a form-checkable move and pauses for the camera', async () => {
    const h = setup();
    await render(<PlayerScreen />);
    expect(screen.queryByLabelText('Check form')).toBeNull();
    // move index 2 (step 6) is checkable
    const seg = effOf(h.store.getState()).find((e) => e.seg.stepIndex === 6 && e.seg.kind === 'work')!;
    await elapse(h, seg.startMs + 1000);
    await fireEvent.press(screen.getByLabelText('Check form'));
    expect(h.store.getState().pausedReason).toBe('camera');
    expect(mockNav.navigate).toHaveBeenCalledWith('CameraPermission');
  });

  it('goes to Rest on its own when the clock reaches a rest', async () => {
    const h = setup();
    const { rerender } = await render(<PlayerScreen />);
    await elapse(h, 120_000 + 12_000 + 41_000);
    await rerender(<PlayerScreen />);
    expect(mockNav.replace).toHaveBeenCalledWith('Rest');
  });

  it('shows a calm message when no session is running', async () => {
    createHarness();
    await render(<PlayerScreen />);
    expect(screen.getByText('No session running')).toBeTruthy();
  });
});

describe('Yoga and Dance', () => {
  it('Yoga shows pose wording, depth control and breath cue', async () => {
    const h = setup('yoga');
    await elapse(h, 120_000 + 12_000 + 1_000);
    await render(<YogaScreen />);
    expect(screen.getByText('Pose 1 of 5')).toBeTruthy();
    expect(screen.getByLabelText('Gentler')).toBeTruthy();
    expect(screen.getByLabelText('Deeper')).toBeTruthy();
    expect(screen.getByText('Breathe in for 4, out for 6')).toBeTruthy();
    expect(screen.queryByLabelText('+15s rest')).toBeNull();
  });

  it('Dance shows the beat and disables high impact in quiet mode', async () => {
    const h = setup('dance');
    h.store.getState().setPrefs({ quiet: true });
    await elapse(h, 120_000 + 12_000 + 1_000);
    await render(<DanceScreen />);
    expect(screen.getByText('Beat 112')).toBeTruthy();
    expect(screen.getByLabelText('High impact').props.accessibilityState.disabled).toBe(true);
  });

  it('stays on the stage during rest instead of opening Rest', async () => {
    expect(routeForView({ status: 'active', kind: 'rest', style: 'yoga' })).toBe('Yoga');
    expect(routeForView({ status: 'active', kind: 'rest', style: 'dance' })).toBe('Dance');
    expect(routeForView({ status: 'active', kind: 'rest', style: 'normal' })).toBe('Rest');
    expect(routeForView({ status: 'paused', kind: 'work', style: 'normal' })).toBe('Paused');
    expect(routeForView({ status: 'confirm_end', kind: 'work', style: 'normal' })).toBeNull();
  });
});

describe('Rest', () => {
  it('shows the ring, up next and skips the rest', async () => {
    const h = setup();
    await elapse(h, 120_000 + 12_000 + 40_000 + 8_000);
    await render(<RestScreen />);
    expect(screen.getByText('0:12')).toBeTruthy();
    expect(screen.getByLabelText('12 seconds of rest left')).toBeTruthy();
    expect(screen.getByText('Up next')).toBeTruthy();
    expect(screen.getByText('Set 2 of 2 · 40 sec')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Skip rest'));
    expect(h.store.getState().status).toBe('active');
    const eff = effOf(h.store.getState());
    expect(eff.find((e) => e.seg.kind === 'work' && e.seg.stepIndex === 4 && e.seg.set === 2)).toBeTruthy();
  });

  it('opens Feel once after the middle move', async () => {
    const h = setup();
    const rest = effOf(h.store.getState()).find((e) => e.seg.stepIndex === 6 && e.seg.kind === 'rest' && e.seg.set === 2)!;
    await elapse(h, rest.startMs + 1000);
    await render(<RestScreen />);
    expect(mockNav.navigate).toHaveBeenCalledWith('Feel');
    expect(h.store.getState().feelShown).toBe(true);
  });
});

describe('Paused', () => {
  it('shows what is paused, the 24 h note, and resumes', async () => {
    const h = setup();
    await elapse(h, 120_000 + 12_000 + 12_000);
    await act(async () => { h.store.getState().pause('call'); });
    await render(<PausedScreen />);
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getByText('Move 0 · 0:28 left')).toBeTruthy();
    expect(screen.getByText('Paused for a call.')).toBeTruthy();
    expect(screen.getByText(/next 24 hours/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Resume'));
    expect(h.store.getState().status).toBe('active');
    await fireEvent.press(screen.getByLabelText('Sound and voice'));
    expect(mockNav.navigate).toHaveBeenCalledWith('SessionSettings');
  });
});

describe('EndSession', () => {
  it('reports progress and offers the three choices', async () => {
    const h = setup();
    await elapse(h, 120_000 + 132_000 + 132_000 + 10_000);
    await act(async () => { h.store.getState().requestEnd(); });
    await render(<EndSessionScreen />);
    expect(screen.getByText(/You finished 2 of 5 moves in 6:34/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save and finish later'));
    await act(async () => {});
    expect(h.store.getState().outcome).toBe('saved_for_later');
    expect(h.getSnapshot()).not.toBeNull();
    expect(mockNav.reset).toHaveBeenCalled();
  });

  it('Keep going goes back', async () => {
    const h = setup();
    await act(async () => { h.store.getState().requestEnd(); });
    await render(<EndSessionScreen />);
    await fireEvent.press(screen.getByLabelText('Keep going'));
    expect(h.store.getState().status).toBe('active');
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('End without saving ends and leaves', async () => {
    const h = setup();
    await elapse(h, 100_000);
    await act(async () => { h.store.getState().requestEnd(); });
    await render(<EndSessionScreen />);
    await fireEvent.press(screen.getByLabelText('End without saving'));
    await act(async () => {});
    expect(h.store.getState().outcome).toBe('discarded');
    expect(h.getSnapshot()).toBeNull();
  });
});

describe('Feel and SessionSettings', () => {
  it('Feel: hard eases the next set', async () => {
    const h = setup();
    const rest = effOf(h.store.getState()).find((e) => e.seg.stepIndex === 6 && e.seg.kind === 'rest' && e.seg.set === 2)!;
    await elapse(h, rest.startMs + 1000);
    await render(<FeelScreen />);
    await fireEvent.press(screen.getByLabelText('Hard. Ease off'));
    expect(h.store.getState().rung).toBe(-1);
    expect(h.store.getState().feelSignals).toHaveLength(1);
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('Feel: Skip records nothing', async () => {
    const h = setup();
    const rest = effOf(h.store.getState()).find((e) => e.seg.stepIndex === 6 && e.seg.kind === 'rest')!;
    await elapse(h, rest.startMs + 1000);
    await render(<FeelScreen />);
    await fireEvent.press(screen.getByLabelText('Skip'));
    expect(h.store.getState().feelSignals).toHaveLength(0);
  });

  it('Settings: quiet mode and voice persist to prefs', async () => {
    const h = setup();
    await render(<SessionSettingsScreen />);
    await fireEvent(screen.getByLabelText('Quiet mode'), 'valueChange', true);
    await fireEvent(screen.getByLabelText('Voice coach'), 'valueChange', false);
    await fireEvent.press(screen.getByLabelText('30 s'));
    expect(h.store.getState().prefs).toMatchObject({ quiet: true, voice: false, restS: 30 });
  });
});

describe('Complete', () => {
  it('logs the stored felt value once and returns Home', async () => {
    const h = setup();
    await elapse(h, 900_000);
    expect(h.store.getState().status).toBe('complete');
    await render(<CompleteScreen />);
    expect(screen.getByText('Session done')).toBeTruthy();
    expect(screen.getByText('15:00')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Too hard'));
    await fireEvent.press(screen.getByLabelText('Done'));
    await fireEvent.press(screen.getByLabelText('Done'));
    await act(async () => {});
    expect(h.logs).toHaveLength(1);
    expect(h.logs[0]).toMatchObject({ felt: 'hard', status: 'complete' });
    expect(mockNav.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });
});

describe('Desk', () => {
  it('walks four moves with a side switch, pure', async () => {
    expect(deskPosition(DESK_MOVES, 0).index).toBe(0);
    const neck = deskPosition(DESK_MOVES, 60_000 + 10_000);
    expect([neck.index, neck.side, neck.remainingMs]).toEqual([1, 'Left side', 20_000]);
    expect(deskPosition(DESK_MOVES, 60_000 + 40_000).side).toBe('Right side');
    expect(deskPosition(DESK_MOVES, 240_000).done).toBe(true);
  });

  it('logs micro minutes, never a session log, when skipped', async () => {
    const h = createHarness();
    await render(<DeskScreen />);
    await act(async () => {
      h.clock.advance(45_000);
      jest.advanceTimersByTime(250);
    });
    expect(screen.getByText('Move 1 of 4')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next move'));
    expect(screen.getByText('Move 2 of 4')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Skip'));
    expect(h.micro).toEqual([{ activeS: 45 }]);
    expect(h.logs).toHaveLength(0);
    expect(h.store.getState().status).toBe('idle');
  });
});
