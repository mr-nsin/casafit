import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createTestDb } from '../../../db/testing/nodeSqliteDriver';
import { usePreferences, defaultPreferences } from '../../../state/preferences';
import { setRepositories } from '../../../state/storage';
import { useAuth } from '../../../state/auth';
import { addDays, addExercise, pickerOptions, totalS } from '../../../engine';
import { useVerifyOutcome } from '../../onboarding/flowState';
import { useSessionStore } from '../store';
import { createHarness } from '../testkit';
import { CheckInScreen, weekStartOf } from './CheckInScreen';
import { EditorScreen, LungeScreen, PartsScreen, PickerScreen } from './EditScreens';
import { PlanScreen } from './PlanScreens';
import { HomeScreen } from './HomeScreen';
import { clock, isDirty, moveWork, useEditDraft } from './editing';
import { getCatalogueIndex } from './library';
import { localDate, parseSession, workSteps } from './model';
import { seedPlan, DAY_MS, type TestDb } from './testkit';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), reset: jest.fn(), goBack: jest.fn(), popTo: jest.fn(), canGoBack: jest.fn(() => true) };
let mockRoute: { params?: Record<string, unknown> } = {};
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => mockNav,
    useRoute: () => mockRoute,
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(() => cb(), [cb]),
  };
});

jest.mock('../../../ui/useMotion', () => {
  const { Animated } = require('react-native');
  const actual = jest.requireActual('../../../ui/useMotion');
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

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  setRepositories(db.repos);
  createHarness();
  Object.values(mockNav).forEach((f) => f.mockClear());
  mockNav.canGoBack.mockReturnValue(true);
  mockRoute = {};
  usePreferences.setState({ ...defaultPreferences(), hydrated: true });
  useAuth.setState({ freeChecksRemaining: 2, pro: { active: false, expiresAt: null } });
  useVerifyOutcome.getState().reset();
  useEditDraft.getState().clear();
});
afterEach(() => {
  useSessionStore.getState().reset();
  useEditDraft.getState().clear();
  setRepositories(null);
  db.driver.close();
});

async function todaySession(week = 1, day = 0) {
  const row = (await db.repos.plan.days(week)).find((r) => r.dayIndex === day)!;
  return parseSession(row)!;
}

/** A move that is allowed today and not yet in the session. */
async function freshMove() {
  const s = await todaySession();
  const o = pickerOptions(s, getCatalogueIndex(), { style: 'normal' })[0]!.exercise;
  return { id: o.id, name: o.name };
}

describe('editing model', () => {
  it('formats clocks and detects changes', async () => {
    expect(clock(900)).toBe('15:00');
    expect(clock(132)).toBe('2:12');
    await seedPlan(db);
    const s = await todaySession();
    useEditDraft.getState().init({ key: '1-0', week: 1, dayIndex: 0, session: s });
    expect(isDirty(useEditDraft.getState().draft)).toBe(false);
    useEditDraft.getState().set(moveWork(s, workSteps(s)[0]!.id, 1));
    expect(isDirty(useEditDraft.getState().draft)).toBe(true);
  });

  it('moves a work step one place and stops at the ends', async () => {
    await seedPlan(db);
    const s = await todaySession();
    const ids = workSteps(s).map((x) => x.id);
    expect(workSteps(moveWork(s, ids[0]!, 1)).map((x) => x.id).slice(0, 2)).toEqual([ids[1], ids[0]]);
    expect(moveWork(s, ids[0]!, -1)).toBe(s);
    expect(moveWork(s, ids[ids.length - 1]!, 1)).toBe(s);
    expect(s.steps.filter((x) => x.phase !== 'work')).toEqual(moveWork(s, ids[0]!, 1).steps.filter((x) => x.phase !== 'work'));
  });

  it('weeks start on Monday', () => {
    expect(weekStartOf('2026-10-30')).toBe('2026-10-26');
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26');
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26');
  });
});

describe('Editor', () => {
  it("shows today's budget, the moves, warm-up and cool-down", async () => {
    await seedPlan(db);
    await render(<EditorScreen />);
    expect(await screen.findByText('Edit today')).toBeTruthy();
    expect(screen.getByText('15:00')).toBeTruthy();
    expect(screen.getByText('/ 15:00')).toBeTruthy();
    expect(screen.getByText('Right on time')).toBeTruthy();
    const s = await todaySession();
    for (const m of workSteps(s)) expect(screen.getByLabelText(`Remove ${m.name}`)).toBeTruthy();
    expect(screen.getByLabelText(/^Warm-up, matched to your moves, 2:00/)).toBeTruthy();
    expect(screen.getByLabelText(/^Cool-down, rebuilt for your moves, 2:00/)).toBeTruthy();
    expect(screen.getByLabelText('Save to my plan').props.accessibilityState.disabled).toBe(true);
  });

  it('opens the picker to add or to swap, and the parts', async () => {
    await seedPlan(db);
    await render(<EditorScreen />);
    const s = await todaySession();
    const first = workSteps(s)[0]!;
    await fireEvent.press(await screen.findByLabelText('Add an exercise'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Picker');
    await fireEvent.press(screen.getByLabelText(`Swap ${first.name}`));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Picker', { stepId: first.id });
    await fireEvent.press(screen.getByLabelText(/^Warm-up, matched/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Parts', { part: 'warmup' });
    await fireEvent.press(screen.getByLabelText(/^Cool-down, rebuilt/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Parts', { part: 'cooldown' });
  });

  it('removes a move, rebuilds the cool-down and saves to the plan', async () => {
    await seedPlan(db);
    await render(<EditorScreen />);
    const s = await todaySession();
    const [a, b] = workSteps(s);
    await fireEvent.press(await screen.findByLabelText(`Remove ${a!.name}`));
    expect(screen.getByText(`Removed ${a!.name}.`)).toBeTruthy();
    expect(screen.getByText('2:12 to spare')).toBeTruthy();
    expect(screen.getByText('12:48')).toBeTruthy();
    expect(screen.queryByLabelText(`Remove ${a!.name}`)).toBeNull();
    expect(screen.getByLabelText(`Remove ${b!.name}`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Save to my plan'));
    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
    const saved = await todaySession();
    expect(workSteps(saved)).toHaveLength(4);
    expect(workSteps(saved).map((x) => x.id)).not.toContain(a!.id);
    expect((await db.repos.plan.days(1)).find((r) => r.dayIndex === 0)!.overridden).toBe(true);
    expect(useEditDraft.getState().draft).toBeNull();
  });

  it('Save returns to plan detail when the editor was opened from a plan, and goes back otherwise', async () => {
    await seedPlan(db);
    mockRoute = { params: { planDayId: '1-0', from: 'plan' } };
    await render(<EditorScreen />);
    const s = await todaySession();
    await fireEvent.press(await screen.findByLabelText(`Remove ${workSteps(s)[0]!.name}`));
    await fireEvent.press(screen.getByLabelText('Save to my plan'));
    await waitFor(() => expect(mockNav.popTo).toHaveBeenCalledWith('Plan', { planDayId: '1-0' }));
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect(mockNav.replace).not.toHaveBeenCalled();
  });

  it('keeps at least three moves, and says so plainly', async () => {
    await seedPlan(db);
    await render(<EditorScreen />);
    const s = await todaySession();
    const names = workSteps(s).map((x) => x.name);
    await fireEvent.press(await screen.findByLabelText(`Remove ${names[0]}`));
    await fireEvent.press(screen.getByLabelText(`Remove ${names[1]}`));
    await fireEvent.press(screen.getByLabelText(`Remove ${names[2]}`));
    expect(screen.getByText('Keep at least 3 moves in a session.')).toBeTruthy();
    expect(screen.getByLabelText(`Remove ${names[2]}`)).toBeTruthy();
  });

  it('reorders moves with the earlier and later buttons and saves the order', async () => {
    await seedPlan(db);
    await render(<EditorScreen />);
    const s = await todaySession();
    const [a, b] = workSteps(s);
    await fireEvent.press(await screen.findByLabelText(`Move ${a!.name} later`));
    expect(screen.getByLabelText(`Move ${a!.name} earlier`).props.accessibilityState.disabled).toBe(false);
    expect(screen.getByLabelText(`Move ${b!.name} earlier`).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Save to my plan'));
    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalled());
    expect(workSteps(await todaySession()).map((x) => x.id).slice(0, 2)).toEqual([b!.id, a!.id]);
  });

  it('Just today starts the edited session and writes nothing to the plan', async () => {
    await seedPlan(db);
    await render(<EditorScreen />);
    const s = await todaySession();
    await fireEvent.press(await screen.findByLabelText(`Remove ${workSteps(s)[0]!.name}`));
    await fireEvent.press(screen.getByLabelText('Just today'));
    expect(mockNav.replace).toHaveBeenCalledWith('Player');
    const st = useSessionStore.getState();
    expect(st.status).toBe('active');
    expect(workSteps(st.plan as never)).toHaveLength(4);
    expect(st.planDay).toBe(0);
    expect(workSteps(await todaySession())).toHaveLength(5);
  });

  it('asks before leaving with unsaved changes', async () => {
    await seedPlan(db);
    await render(<EditorScreen />);
    await fireEvent.press(await screen.findByLabelText('Back'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    const s = await todaySession();
    await fireEvent.press(screen.getByLabelText(`Remove ${workSteps(s)[0]!.name}`));
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByText('Leave without saving?')).toBeTruthy();
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Keep editing'));
    await fireEvent.press(screen.getByLabelText('Back'));
    await fireEvent.press(screen.getByLabelText('Leave without saving'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(2);
    expect(workSteps(await todaySession())).toHaveLength(5);
  });

  it('adds the move named by addExerciseId when it opens, once', async () => {
    await seedPlan(db, { painAreas: [] });
    const m = await freshMove();
    mockRoute = { params: { addExerciseId: m.id } };
    await render(<EditorScreen />);
    expect(await screen.findByText(`Added ${m.name}.`)).toBeTruthy();
    expect(screen.getByText('Over by 2:12')).toBeTruthy();
    expect(screen.getByText('New +2:12')).toBeTruthy();
    expect(screen.getByLabelText(`Remove ${m.name}`)).toBeTruthy();
  });

  it('says a move is already in the session instead of adding it twice', async () => {
    await seedPlan(db, { painAreas: [] });
    const s = await todaySession();
    mockRoute = { params: { addExerciseId: workSteps(s)[0]!.exerciseId } };
    await render(<EditorScreen />);
    expect(await screen.findByText("That move is already in today's session.")).toBeTruthy();
    expect(screen.getByText('Right on time')).toBeTruthy();
  });

  it('fixes an over-budget day by going longer for today', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { addExerciseId: (await freshMove()).id } };
    await render(<EditorScreen />);
    expect(await screen.findByText('Over by 2:12')).toBeTruthy();
    expect(screen.getByText('17:12')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Go 18 min today'));
    expect(screen.getByText('/ 18:00')).toBeTruthy();
    expect(screen.queryByText(/^Over by/)).toBeNull();
    expect(screen.getByLabelText('Save to my plan').props.accessibilityState.disabled).toBe(false);
  });

  it('Shorter rests either fits the day or says plainly that it cannot', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { addExerciseId: (await freshMove()).id } };
    await render(<EditorScreen />);
    await fireEvent.press(await screen.findByLabelText('Shorter rests'));
    if (screen.queryByText('Rests are shorter now.')) expect(screen.queryByText(/^Over by/)).toBeNull();
    else {
      expect(screen.getByText('Rests are already as short as they go. Try removing one move.')).toBeTruthy();
      expect(screen.getByText('Over by 2:12')).toBeTruthy();
    }
  });

  it('says so, and changes nothing, when rests cannot be shortened enough', async () => {
    await seedPlan(db, { painAreas: [] });
    let s = await todaySession();
    const index = getCatalogueIndex();
    for (const o of pickerOptions(s, index, { style: 'normal' }).slice(0, 3)) {
      const r = addExercise(s, o.exercise.id, index);
      if (r.ok) s = r.session;
    }
    expect(workSteps(s)).toHaveLength(8);
    useEditDraft.getState().init({ key: '1-0', week: 1, dayIndex: 0, session: s });
    await render(<EditorScreen />);
    expect(await screen.findByText('Over by 6:36')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Shorter rests'));
    expect(screen.getByText('Rests are already as short as they go. Try removing one move.')).toBeTruthy();
    expect(screen.getByText('Over by 6:36')).toBeTruthy();
  });

  it('Remove one brings an over-budget day back to 15:00', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { addExerciseId: (await freshMove()).id } };
    await render(<EditorScreen />);
    await fireEvent.press(await screen.findByLabelText('Remove one'));
    expect(screen.getByText('Right on time')).toBeTruthy();
    expect(screen.getByText('15:00')).toBeTruthy();
  });

  it('opens another day by planDayId, and says so on a day with no session', async () => {
    await seedPlan(db);
    mockRoute = { params: { planDayId: '1-1' } };
    await render(<EditorScreen />);
    expect(await screen.findByText(/^Edit /)).toBeTruthy();
    const row = (await db.repos.plan.days(1)).find((r) => r.dayIndex === 1)!;
    expect(parseSession(row)).not.toBeNull();
    expect(screen.queryByText('Edit today')).toBeNull();
    mockRoute = { params: { planDayId: '1-2' } };
    await render(<EditorScreen />);
    expect(await screen.findByText('Nothing to edit here')).toBeTruthy();
  });
});

describe('Picker', () => {
  async function openDraft() {
    await seedPlan(db, { painAreas: ['knees'] });
    const s = await todaySession();
    useEditDraft.getState().init({ key: '1-0', week: 1, dayIndex: 0, session: s });
    return s;
  }

  it('asks to open the editor first when there is no working copy', async () => {
    await render(<PickerScreen />);
    expect(await screen.findByText('Open the editor first')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('offers moves for the day, searches, and hides moves that load the knees', async () => {
    const s = await openDraft();
    await render(<PickerScreen />);
    expect(await screen.findByText('Add an exercise')).toBeTruthy();
    expect(screen.getByText(/^13:00 now|^15:00 now/)).toBeTruthy();
    expect(screen.getByText(/Another move goes over 15:00/)).toBeTruthy();
    // Pick Legs: lunge-type moves are hidden for knees.
    await fireEvent.press(screen.getByLabelText('Legs'));
    expect(screen.getAllByText(/^Hidden for your knees/).length).toBeGreaterThan(0);
    await fireEvent.changeText(screen.getByLabelText('Search moves'), 'zzzz');
    expect(screen.getByText('No moves match. Try another body part.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search moves'), '');
    const inSession = new Set(s.steps.map((x) => x.name));
    for (const el of screen.queryAllByLabelText(/^Add /)) expect(inSession.has(String(el.props.accessibilityLabel).replace(/^Add /, '').split(',')[0]!)).toBe(false);
  });

  it('adds a move to the working copy and closes', async () => {
    await openDraft();
    await render(<PickerScreen />);
    await fireEvent.press(await screen.findByLabelText('Legs'));
    const row = screen.getAllByLabelText(/^Add .*, /)[0]!;
    const name = String(row.props.accessibilityLabel).replace(/^Add /, '').split(',')[0]!;
    await fireEvent.press(row);
    expect(mockNav.goBack).toHaveBeenCalled();
    const d = useEditDraft.getState().draft!;
    expect(workSteps(d.session)).toHaveLength(6);
    expect(workSteps(d.session).map((x) => x.name)).toContain(name);
    expect(totalS(d.session)).toBe(totalS(d.baseline) + 132);
  });

  it('swaps the move named by stepId, keeping the total, and the editor shows and saves it', async () => {
    await seedPlan(db, { painAreas: [] });
    const s = await todaySession();
    const first = workSteps(s)[0]!;
    mockRoute = { params: { stepId: first.id } };
    // The editor and the sheet are separate routes sharing one working copy; render both.
    await render(
      <>
        <EditorScreen />
        <PickerScreen />
      </>,
    );
    expect(await screen.findByText(`Swap ${first.name}`)).toBeTruthy();
    expect(screen.getByText('Swapping keeps the session at 15:00.')).toBeTruthy();
    const options = await screen.findAllByLabelText(/^Swap in /);
    const label = String(options[0]!.props.accessibilityLabel);
    const name = label.replace(/^Swap in /, '').split(',')[0]!;
    await fireEvent.press(options[0]!);
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByLabelText(`Remove ${name}`)).toBeTruthy());
    expect(screen.queryByLabelText(`Remove ${first.name}`)).toBeNull();
    expect(screen.getByText('Right on time')).toBeTruthy();
    // Same place in the list, same step id.
    const d = useEditDraft.getState().draft!;
    expect(d.session.steps.find((x) => x.id === first.id)!.name).toBe(name);

    await fireEvent.press(screen.getByLabelText('Save to my plan'));
    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalledTimes(2));
    const saved = await todaySession();
    expect(saved.steps.find((x) => x.id === first.id)!.name).toBe(name);
    expect(saved.steps.some((x) => x.exerciseId === first.exerciseId)).toBe(false);
    expect(totalS(saved)).toBe(totalS(s));
  });

  it('the saved swap shows in Plan and Start runs it', async () => {
    await seedPlan(db, { painAreas: [] });
    const s = await todaySession();
    const first = workSteps(s)[0]!;
    mockRoute = { params: { stepId: first.id } };
    const view = await render(
      <>
        <EditorScreen />
        <PickerScreen />
      </>,
    );
    const options = await screen.findAllByLabelText(/^Swap in /);
    const name = String(options[0]!.props.accessibilityLabel).replace(/^Swap in /, '').split(',')[0]!;
    await fireEvent.press(options[0]!);
    await fireEvent.press(await screen.findByLabelText('Save to my plan'));
    await waitFor(() => expect(mockNav.goBack).toHaveBeenCalledTimes(2));
    await view.unmount();

    mockRoute = {};
    await render(<PlanScreen />);
    expect(await screen.findByText(name)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Start session'));
    expect(useSessionStore.getState().plan?.steps.map((x) => x.name)).toContain(name);
    expect(useSessionStore.getState().plan?.steps.map((x) => x.exerciseId)).not.toContain(first.exerciseId);
  });

  it('closes from the scrim and the close button', async () => {
    await openDraft();
    await render(<PickerScreen />);
    await fireEvent.press(await screen.findByLabelText('Close'));
    const scrim = screen.getAllByLabelText('Close', { includeHiddenElements: true });
    expect(scrim).toHaveLength(2);
    await fireEvent.press(scrim[0]!);
    expect(mockNav.goBack).toHaveBeenCalledTimes(2);
  });

  it('Home swap and tune buttons reach the editor for today', async () => {
    await seedPlan(db);
    await render(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText("Swap today's session"));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Editor');
  });
});

describe('Parts', () => {
  it('shows the cool-down by default, rebuilt for the muscles worked', async () => {
    await seedPlan(db);
    await render(<PartsScreen />);
    expect((await screen.findAllByText('Cool-down')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('2:00')).toHaveLength(1);
    expect(screen.getByText(/^Rebuilt for today\. You trained .*, so we stretch those\.$/)).toBeTruthy();
    expect(screen.getAllByLabelText(/^[1-4]\. .*, 30s$/)).toHaveLength(4);
    expect(screen.getByText('Warm-up and cool-down are always 2 minutes each, so a 15-minute session stays 15 minutes.')).toBeTruthy();
    expect((await screen.findByLabelText('Cool-down')).props.accessibilityState.selected).toBe(true);
  });

  it('opens on the part named by the route and switches between the three', async () => {
    await seedPlan(db);
    mockRoute = { params: { part: 'warmup' } };
    await render(<PartsScreen />);
    expect(await screen.findByText(/^Matched to today\. You are working /)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Work'));
    const s = await todaySession();
    expect(screen.getByText(`Your ${workSteps(s).length} moves for today. Swap or add moves in the editor.`)).toBeTruthy();
    expect(screen.getAllByLabelText(/^[1-5]\. .*, 2 × \d+s$/)).toHaveLength(5);
    expect(screen.queryByText(/always 2 minutes each/)).toBeNull();
  });

  it('Swap a move opens the editor; Back to my session goes back', async () => {
    await seedPlan(db);
    await render(<PartsScreen />);
    await fireEvent.press(await screen.findByLabelText('Swap a move'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Editor');
    await fireEvent.press(screen.getByLabelText('Back to my session'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('says so on a rest day', async () => {
    await seedPlan(db, { dayOffset: 2 });
    await render(<PartsScreen />);
    expect(await screen.findByText('No session today')).toBeTruthy();
  });

  it('shows the working copy when one is open', async () => {
    await seedPlan(db);
    const s = await todaySession();
    useEditDraft.getState().init({ key: '1-0', week: 1, dayIndex: 0, session: { ...s, steps: s.steps.filter((x, i) => i !== s.steps.findIndex((y) => y.phase === 'work')) } });
    mockRoute = { params: { part: 'work' } };
    await render(<PartsScreen />);
    expect(await screen.findAllByLabelText(/^[1-4]\. /)).toHaveLength(4);
  });
});

describe('Lunge', () => {
  it('explains the swap for the knees, with the replacement', async () => {
    await seedPlan(db);
    mockRoute = { params: { excludedExerciseId: 'lunge' } };
    await render(<LungeScreen />);
    expect(await screen.findByText('We swapped a move for your knees')).toBeTruthy();
    expect(screen.getByText('You told us your knees hurt, so we skip moves that load them.')).toBeTruthy();
    expect(screen.getByText('Forward lunge')).toBeTruthy();
    expect(screen.getByText('Skipped')).toBeTruthy();
    expect(screen.getByText('Glute bridge')).toBeTruthy();
    expect(screen.getByText('Works similar muscles with less load on your knees.')).toBeTruthy();
    expect(screen.getByText(/Forward lunge is also hidden in the form camera\.$/)).toBeTruthy();
  });

  it('Got it goes back and Change pain areas opens About', async () => {
    await seedPlan(db);
    mockRoute = { params: { excludedExerciseId: 'lunge' } };
    await render(<LungeScreen />);
    await fireEvent.press(await screen.findByLabelText('Change pain areas'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('About');
    await fireEvent.press(screen.getByLabelText('Got it'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('says nothing was swapped when the user has no restrictions', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { excludedExerciseId: 'lunge' } };
    await render(<LungeScreen />);
    expect(await screen.findByText('We swapped a move for you')).toBeTruthy();
    expect(screen.queryByText('Glute bridge')).toBeNull();
  });

  it('handles an unknown move', async () => {
    await seedPlan(db);
    mockRoute = { params: { excludedExerciseId: 'nope' } };
    await render(<LungeScreen />);
    expect(await screen.findByText('Nothing was swapped')).toBeTruthy();
  });
});

describe('CheckIn', () => {
  const thisWeek = () => weekStartOf(localDate(Date.now()));

  it('shows the intro, mood, weight, trend note and waist', async () => {
    await seedPlan(db);
    await db.repos.profile.save({ weightKg: 61.2 });
    await render(<CheckInScreen />);
    expect(await screen.findByText('Weekly check-in')).toBeTruthy();
    expect(screen.getByText('Two minutes, once a week. Every question is optional, and only you see the answers.')).toBeTruthy();
    expect(screen.getByText('How did this week feel?')).toBeTruthy();
    expect(await screen.findByText('61.2 kg')).toBeTruthy();
    expect(screen.getByText("We show a trend, never one day's number. Weight moves 1 to 2 kg a day with water alone.")).toBeTruthy();
    expect(screen.getByLabelText('Add a waist measurement')).toBeTruthy();
    expect(screen.getByText('Your trend shows up after two check-ins with a weight.')).toBeTruthy();
  });

  it('saves the mood, weight and waist, then goes to the recap', async () => {
    await seedPlan(db);
    await db.repos.profile.save({ weightKg: 61.2 });
    await render(<CheckInScreen />);
    await screen.findByText('61.2 kg');
    await fireEvent.press(screen.getByLabelText('Great'));
    expect(screen.getByLabelText('Great').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText('Increase weight'));
    expect(screen.getByText('61.3 kg')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add a waist measurement'));
    await fireEvent.changeText(screen.getByLabelText('Waist'), '78,5');
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(mockNav.navigate).toHaveBeenLastCalledWith('Recap'));
    expect(await db.repos.checkin.get(thisWeek())).toEqual({ weekStart: thisWeek(), mood: 'great', weightKg: 61.3, waistCm: 78.5 });
  });

  it('everything is optional: Save with nothing chosen stores an empty check-in', async () => {
    await seedPlan(db);
    await render(<CheckInScreen />);
    await fireEvent.press(await screen.findByLabelText('Save'));
    await waitFor(() => expect(mockNav.navigate).toHaveBeenLastCalledWith('Recap'));
    expect(await db.repos.checkin.get(thisWeek())).toEqual({ weekStart: thisWeek(), mood: null, weightKg: null, waistCm: null });
  });

  it('skips the week without saving anything', async () => {
    await seedPlan(db);
    await render(<CheckInScreen />);
    await fireEvent.press(await screen.findByLabelText('Skip this week'));
    expect(mockNav.goBack).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Close'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(2);
    expect(await db.repos.checkin.get(thisWeek())).toBeNull();
  });

  it('fills in this week when it was already saved, and draws the trend from past weeks', async () => {
    await seedPlan(db);
    const w = thisWeek();
    await db.repos.checkin.save({ weekStart: addDays(w, -14), mood: 'good', weightKg: 62, waistCm: null });
    await db.repos.checkin.save({ weekStart: addDays(w, -7), mood: 'good', weightKg: 61.6, waistCm: null });
    await db.repos.checkin.save({ weekStart: w, mood: 'tough', weightKg: 61.2, waistCm: 80 });
    await render(<CheckInScreen />);
    expect(await screen.findByText('61.2 kg')).toBeTruthy();
    expect(screen.getByLabelText('Tough').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Waist').props.value).toBe('80');
    expect(screen.getByLabelText('Your weight over 3 weeks: 62 kilograms, 61.6 kilograms, 61.2 kilograms')).toBeTruthy();
    // Tapping the chosen mood again clears it.
    await fireEvent.press(screen.getByLabelText('Tough'));
    expect(screen.getByLabelText('Tough').props.accessibilityState.selected).toBe(false);
  });

  it('rejects a waist that is not a plausible number, kindly', async () => {
    await seedPlan(db);
    await render(<CheckInScreen />);
    await fireEvent.press(await screen.findByLabelText('Add a waist measurement'));
    await fireEvent.changeText(screen.getByLabelText('Waist'), '7');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Waist should be between 30 and 250 cm. You can also leave it blank.')).toBeTruthy();
    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  it('weight can be cleared and added again', async () => {
    await seedPlan(db);
    await db.repos.profile.save({ weightKg: 70 });
    await render(<CheckInScreen />);
    await fireEvent.press(await screen.findByLabelText('Clear weight'));
    expect(screen.getByLabelText('Add my weight')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add my weight'));
    expect(screen.getByText('60 kg')).toBeTruthy();
    expect(DAY_MS).toBeGreaterThan(0);
  });
});
