import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { loadContent } from '../../../content';
import { createTestDb } from '../../../db/testing/nodeSqliteDriver';
import { usePreferences, defaultPreferences } from '../../../state/preferences';
import { setRepositories } from '../../../state/storage';
import { useAuth } from '../../../state/auth';
import { useVerifyOutcome } from '../../onboarding/flowState';
import { useSessionStore } from '../store';
import { createHarness, makePlan } from '../testkit';
import { TRIAL_DONE, useTrialNotice } from '../trial';
import { HomeScreen } from './HomeScreen';
import { PlanScreen } from './PlanScreens';
import { BodyPartScreen, ExerciseScreen, LibraryScreen } from './LibraryScreens';
import { LIBRARY_FILTERS, contentFlags, flagPhrase, libraryPlans, moveMeta, partMoves, planIcon, planMeta, sessionFromReadyMade, restrictionsOf, buildPartSession } from './library';
import { READY_MADE, parseSession } from './model';
import { seedPlan, type TestDb } from './testkit';

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
let harness: ReturnType<typeof createHarness>;
const content = loadContent();
const knee = contentFlags({ painAreas: ['knees'], healthFlags: [] });

beforeEach(async () => {
  db = await createTestDb();
  setRepositories(db.repos);
  harness = createHarness();
  Object.values(mockNav).forEach((f) => f.mockClear());
  mockNav.canGoBack.mockReturnValue(true);
  mockRoute = {};
  usePreferences.setState({ ...defaultPreferences(), hydrated: true });
  useAuth.setState({ freeChecksRemaining: 2, pro: { active: false, expiresAt: null } });
  useVerifyOutcome.getState().reset();
});
afterEach(() => {
  useSessionStore.getState().reset();
  setRepositories(null);
  db.driver.close();
});

describe('library model', () => {
  it('Home tiles use real plan ids with the same title and level as the content', () => {
    for (const r of READY_MADE) {
      const p = content.plan(r.id);
      expect(p).toBeDefined();
      expect(content.t(p!.titleKey)).toBe(r.title);
      expect(r.icon).toBe(planIcon(p!));
      expect(r.meta.startsWith(p!.kind === 'micro' ? '4 min' : '15 min')).toBe(true);
    }
  });

  it('filters by style and hides plans that do not suit the flags', () => {
    expect(libraryPlans(content, [], 'all').shown).toHaveLength(content.plans.length);
    expect(libraryPlans(content, [], 'yoga').shown.every((p) => p.style === 'yoga')).toBe(true);
    expect(libraryPlans(content, [], 'short').shown.map((p) => p.id)).toEqual(['desk_reset']);
    const k = libraryPlans(content, knee, 'all');
    expect(k.hiddenCount).toBeGreaterThan(0);
    expect(k.shown.map((p) => p.id)).not.toContain('cardio_burst');
    expect(libraryPlans(content, [], 'dance').hiddenCount).toBe(0);
    expect(LIBRARY_FILTERS.map((f) => f.value)).toEqual(['all', 'normal', 'yoga', 'dance', 'short']);
  });

  it('words flags plainly', () => {
    expect(flagPhrase(['knee'])).toBe('knees');
    expect(flagPhrase(['back', 'shoulder'])).toBe('back and shoulders');
    expect(flagPhrase(['heart_bp'])).toBe('health answers');
    expect(planMeta(content.plan('yoga_flow_15')!)).toBe('Yoga · Medium · 5 poses');
    expect(planMeta(content.plan('desk_reset')!)).toBe('Desk · 4 min, no sweat');
  });

  it('splits a body part into moves and moves hidden for knees', () => {
    const r = partMoves(content, 'core', 'normal', knee, false);
    expect(r.shown.map((e) => e.id)).toContain('dead_bug');
    expect(r.shown.map((e) => e.id)).not.toContain('high_knees');
    expect(r.hidden.map((h) => h.exercise.id)).toContain('high_knees');
    const easy = partMoves(content, 'core', 'normal', [], true).shown;
    expect(easy[0]!.difficulty).toBe('easy');
    expect(easy[easy.length - 1]!.difficulty).toBe('hard');
    expect(moveMeta(content.exercise('plank')!)).toBe('Medium · 2 × 30s · form check');
  });

  it('turns a ready-made plan into a session the player can run', () => {
    for (const p of content.plans.filter((x) => x.kind === 'full15')) {
      const s = sessionFromReadyMade(p, content, restrictionsOf(null), 'x')!;
      expect(s).not.toBeNull();
      expect(s.style).toBe(p.style);
      expect(s.steps.filter((x) => x.phase === 'work')).toHaveLength(p.work.length);
      expect(s.steps[0]!.phase).toBe('warmup');
      expect(s.steps[s.steps.length - 1]!.phase).toBe('cooldown');
    }
    expect(sessionFromReadyMade(content.plan('desk_reset')!, content, restrictionsOf(null), 'x')).toBeNull();
  });

  it('builds a 15 minute session for each body part with the engine', () => {
    for (const part of ['arms', 'chest', 'back', 'shoulders', 'core', 'glutes', 'legs', 'full', 'stretch']) {
      const s = buildPartSession({ part, style: 'normal', profile: { painAreas: ['knees'], healthFlags: [] }, experience: 'new', id: 'p', seed: 3 })!;
      expect(s.steps.some((x) => x.phase === 'work')).toBe(true);
    }
    const core = buildPartSession({ part: 'core', style: 'normal', profile: null, experience: 'new', id: 'p', seed: 3 })!;
    expect(core.title).toBe('Core 15');
    expect(core.focus).toBe('parts');
    expect(core.parts).toEqual(['core']);
  });

  it('only uses icons that exist in the glyph set', () => {
    const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json') as Record<string, number>;
    const names = [
      ...content.plans.map(planIcon),
      'bookmark', 'bookmark_border', 'arrow_downward', 'arrow_upward', 'videocam', 'videocam_off', 'repeat', 'keyboard_arrow_up', 'keyboard_arrow_down', 'swap_horiz', 'close', 'add', 'schedule', 'edit',
      'self_improvement', 'spa', 'block', 'autorenew', 'search', 'sentiment_dissatisfied', 'sentiment_satisfied', 'sentiment_very_satisfied', 'straighten', 'check_circle', 'info', 'play_arrow', 'chevron_right', 'accessibility_new', 'sports_gymnastics',
    ];
    for (const n of names) expect(n.replace(/_/g, '-') in glyphs).toBe(true);
  });
});

describe('Library', () => {
  it('lists the plans that suit the user, with the others counted, not shown', async () => {
    await seedPlan(db);
    await render(<LibraryScreen />);
    expect(await screen.findByText('Ready-made plans')).toBeTruthy();
    expect(screen.getByLabelText('Full body starter, Normal · Easy · 6 moves')).toBeTruthy();
    expect(screen.queryByLabelText(/^Cardio burst/)).toBeNull();
    expect(screen.getByText(/plans are hidden because of your knees\./)).toBeTruthy();
  });

  it('filters with the chips and opens a normal plan to look at first', async () => {
    await seedPlan(db, { painAreas: [] });
    await render(<LibraryScreen />);
    await screen.findByLabelText(/^Full body starter/);
    await fireEvent.press(screen.getByLabelText('Yoga'));
    expect(screen.queryByLabelText(/^Full body starter/)).toBeNull();
    expect(screen.getByLabelText(/^Gentle yoga/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('All'));
    await fireEvent.press(screen.getByLabelText(/^Core strong/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Plan', { readyMadeId: 'core_strong' });
  });

  it('starts yoga and dance straight away and opens the desk reset', async () => {
    await seedPlan(db, { painAreas: [] });
    await render(<LibraryScreen />);
    await fireEvent.press(await screen.findByLabelText(/^Yoga flow 15/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Yoga');
    expect(useSessionStore.getState().status).toBe('active');
    expect(useSessionStore.getState().plan?.style).toBe('yoga');
    useSessionStore.getState().reset();
    await fireEvent.press(screen.getByLabelText(/^Dance cardio 15/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Dance');
    expect(useSessionStore.getState().plan?.title).toBe('Dance cardio 15');
    await fireEvent.press(screen.getByLabelText(/^Desk reset/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Desk');
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('the Short chip shows the desk reset', async () => {
    await seedPlan(db, { painAreas: [] });
    await render(<LibraryScreen />);
    await screen.findByLabelText(/^Full body starter/);
    await fireEvent.press(screen.getByLabelText('Short'));
    expect(screen.getByLabelText(/^Desk reset/)).toBeTruthy();
  });
});

describe('Home ready-made tiles', () => {
  it('Yoga and Dance tiles start a real session and Desk opens Desk', async () => {
    await seedPlan(db, { painAreas: [] });
    await render(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText('Yoga flow 15, 15 min · Medium'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Yoga');
    expect(useSessionStore.getState().plan?.style).toBe('yoga');
    expect(useSessionStore.getState().planDay).toBe(0);
    useSessionStore.getState().reset();
    await fireEvent.press(screen.getByLabelText('Dance cardio 15, 15 min · Easy'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Dance');
    await fireEvent.press(screen.getByLabelText(/^Desk reset/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Desk');
  });

  it('leaves out tiles that do not suit the user', async () => {
    await seedPlan(db);
    await render(<HomeScreen />);
    await screen.findByLabelText(/^Full body starter/);
    expect(screen.queryByLabelText(/^Cardio burst/)).toBeNull();
  });
});

describe('Plan, ready-made view', () => {
  it('lists the moves and starts the plan now', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { readyMadeId: 'core_glutes_15' } };
    await render(<PlanScreen />);
    expect(await screen.findByText('Core and glutes 15')).toBeTruthy();
    expect(screen.getByText('Ready-made plan')).toBeTruthy();
    expect(screen.getByText('Bridges, balance moves and a plank to wake up your middle and hips.')).toBeTruthy();
    expect(screen.getByText('5 moves')).toBeTruthy();
    expect(screen.getByText('Glute bridge')).toBeTruthy();
    await fireEvent.press(screen.getByText('Glute bridge'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Exercise', { exerciseId: 'glute_bridge' });
    await fireEvent.press(screen.getByLabelText('Start now'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Player');
    expect(useSessionStore.getState().plan?.title).toBe('Core and glutes 15');
  });

  it('Add to my plan makes it today\'s session and the plan day shows it', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { readyMadeId: 'core_glutes_15' } };
    await render(<PlanScreen />);
    await fireEvent.press(await screen.findByLabelText('Add to my plan'));
    expect(await screen.findByText("Added. This is now today's session.")).toBeTruthy();
    const row = (await db.repos.plan.days(1)).find((r) => r.dayIndex === 0)!;
    expect(row.title).toBe('Core and glutes 15');
    expect(row.overridden).toBe(true);
    expect(parseSession(row)?.steps.filter((s) => s.phase === 'work')).toHaveLength(5);
    expect(screen.getByLabelText('Add to my plan').props.accessibilityState.disabled).toBe(true);
  });

  it('says a plan is hidden for the user\'s answers and will not start it', async () => {
    await seedPlan(db);
    mockRoute = { params: { readyMadeId: 'cardio_burst' } };
    await render(<PlanScreen />);
    expect(await screen.findByText('This plan is hidden for your knees.')).toBeTruthy();
    expect(screen.getByLabelText('Start now').props.accessibilityState.disabled).toBe(true);
  });

  it('opens the desk reset from its plan and handles an unknown id', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { readyMadeId: 'desk_reset' } };
    await render(<PlanScreen />);
    await fireEvent.press(await screen.findByLabelText('Start desk reset'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Desk');
    expect(screen.queryByLabelText('Add to my plan')).toBeNull();
    mockRoute = { params: { readyMadeId: 'nope' } };
    await render(<PlanScreen />);
    expect(await screen.findByText('We could not find that plan')).toBeTruthy();
  });
});

describe('BodyPart', () => {
  it('shows the moves for the part, with those hidden for the user\'s knees', async () => {
    await seedPlan(db);
    mockRoute = { params: { part: 'core' } };
    await render(<BodyPartScreen />);
    expect(await screen.findByLabelText(/^Dead bug/)).toBeTruthy();
    expect(screen.getByText(/moves for your abs, back and hips\. All knee-friendly\./)).toBeTruthy();
    expect(screen.getByLabelText(/^Plank, Medium · 2 × 30s · form check/)).toBeTruthy();
    expect(screen.getByLabelText(/High knees is hidden/)).toBeTruthy();
    expect(screen.queryByLabelText(/^High knees,/)).toBeNull();
  });

  it('opens a move, filters by style, and puts easy moves first', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { part: 'core' } };
    await render(<BodyPartScreen />);
    await fireEvent.press(await screen.findByLabelText(/^Dead bug/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Exercise', { exerciseId: 'dead_bug' });
    await fireEvent.press(screen.getByLabelText('Easy first'));
    expect(screen.getByLabelText('Easy first').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText('Yoga'));
    expect(screen.getByLabelText(/^Tree pose/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Dead bug/)).toBeNull();
  });

  it('Start a 15-minute session builds a session with the engine and starts it', async () => {
    await seedPlan(db);
    mockRoute = { params: { part: 'core' } };
    await render(<BodyPartScreen />);
    await fireEvent.press(await screen.findByLabelText('Start a 15-minute core session'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Player');
    const s = useSessionStore.getState();
    expect(s.status).toBe('active');
    expect(s.plan?.title).toBe('Core 15');
    expect(s.plan?.steps.filter((x) => x.phase === 'work')).toHaveLength(5);
    // No knee-loading moves slip in.
    expect(s.plan?.steps.map((x) => x.exerciseId)).not.toContain('high_knees');
  });

  it('starts the gentle stretch plan for Stretch', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { part: 'stretch' } };
    await render(<BodyPartScreen />);
    await fireEvent.press(await screen.findByLabelText('Start a 15-minute stretch session'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Player');
    expect(useSessionStore.getState().plan?.title).toBe('Gentle morning');
  });

  it('says so kindly, and starts nothing, when the engine cannot fill a yoga session for a part', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { part: 'legs' } };
    await render(<BodyPartScreen />);
    await fireEvent.press(await screen.findByLabelText('Yoga'));
    await fireEvent.press(screen.getByLabelText('Start a 15-minute legs session'));
    expect(screen.getByText('We could not build that session with your answers. Try another body part or style.')).toBeTruthy();
    expect(mockNav.navigate).not.toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe('idle');
  });
});

describe('Exercise', () => {
  it('shows the move, its steps, easier and harder, and the camera note', async () => {
    await seedPlan(db);
    mockRoute = { params: { exerciseId: 'glute_bridge' } };
    await render(<ExerciseScreen />);
    expect(await screen.findByText('Glute bridge')).toBeTruthy();
    expect(screen.getByText('Easy')).toBeTruthy();
    expect(screen.getByText('No equipment')).toBeTruthy();
    expect(screen.getByText('Knee-friendly')).toBeTruthy();
    expect(screen.getByText('Demo loop')).toBeTruthy();
    expect(screen.getByText('No camera check for this move. Form checks work on squat, push-up, plank and lunge.')).toBeTruthy();
    expect(screen.getByLabelText(/^Harder: /)).toBeTruthy();
    expect(screen.getByLabelText(/^Easier: /)).toBeTruthy();
  });

  it('moves along the ladder', async () => {
    await seedPlan(db, { painAreas: [] });
    const harder = content.harder('glute_bridge');
    mockRoute = { params: { exerciseId: 'glute_bridge' } };
    await render(<ExerciseScreen />);
    if (harder) {
      await fireEvent.press(await screen.findByLabelText(/^Harder: /));
      expect(mockNav.navigate).toHaveBeenLastCalledWith('Exercise', { exerciseId: harder.id });
    }
  });

  it('Try 30 seconds starts a one-move trial and opens the player', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { exerciseId: 'glute_bridge' } };
    await render(<ExerciseScreen />);
    await fireEvent.press(await screen.findByLabelText('Try 30 seconds'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Player');
    const st = useSessionStore.getState();
    expect(st.trial).toBe(true);
    expect(st.status).toBe('active');
    expect(st.timeline!.totalS).toBe(30);
    expect(st.plan!.steps.map((x) => x.exerciseId)).toEqual(['glute_bridge']);
    expect(harness.getSnapshot()).toBeNull();
  });

  it('Try 30 seconds is off for a move hidden from the user, and never replaces a session in progress', async () => {
    await seedPlan(db);
    mockRoute = { params: { exerciseId: 'lunge' } };
    const first = await render(<ExerciseScreen />);
    expect((await screen.findByLabelText('Try 30 seconds')).props.accessibilityState.disabled).toBe(true);
    await first.unmount();

    mockRoute = { params: { exerciseId: 'glute_bridge' } };
    useSessionStore.getState().start(makePlan({ title: 'Push 15' }));
    useSessionStore.getState().pause('user');
    await render(<ExerciseScreen />);
    await fireEvent.press(await screen.findByLabelText('Try 30 seconds'));
    expect(screen.getByText('Finish or save your current session first, then try this move.')).toBeTruthy();
    expect(useSessionStore.getState().plan?.title).toBe('Push 15');
    expect(useSessionStore.getState().trial).toBe(false);
  });

  it('shows a kind message when a trial ends and leaves it behind when the screen closes', async () => {
    await seedPlan(db, { painAreas: [] });
    mockRoute = { params: { exerciseId: 'glute_bridge' } };
    useTrialNotice.getState().set(TRIAL_DONE);
    const r = await render(<ExerciseScreen />);
    expect(await screen.findByText('Nice work. That was 30 seconds.')).toBeTruthy();
    await r.unmount();
    expect(useTrialNotice.getState().message).toBeNull();
  });

  it('saves to favourites and remembers it', async () => {
    await seedPlan(db);
    mockRoute = { params: { exerciseId: 'plank' } };
    await render(<ExerciseScreen />);
    await fireEvent.press(await screen.findByLabelText('Save to favourites'));
    await waitFor(() => expect(screen.getByLabelText('Remove from favourites')).toBeTruthy());
    expect(await db.repos.favourites.all()).toEqual(['plank']);
    await fireEvent.press(screen.getByLabelText('Remove from favourites'));
    await waitFor(() => expect(screen.getByLabelText('Save to favourites')).toBeTruthy());
    expect(await db.repos.favourites.all()).toEqual([]);
  });

  it('hides Add to today for a move the user cannot do, and Add to today opens the editor for others', async () => {
    await seedPlan(db);
    mockRoute = { params: { exerciseId: 'lunge' } };
    await render(<ExerciseScreen />);
    expect(await screen.findByText('Hidden from your plan for your knees.')).toBeTruthy();
    expect(screen.getByLabelText('Add to today').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Form check works for this move. The camera view stays on your phone.')).toBeTruthy();
    mockRoute = { params: { exerciseId: 'dead_bug' } };
    await render(<ExerciseScreen />);
    await fireEvent.press(await screen.findByLabelText('Add to today'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Editor', { addExerciseId: 'dead_bug' });
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('says so when the move is not found', async () => {
    await seedPlan(db);
    mockRoute = { params: { exerciseId: 'nope' } };
    await render(<ExerciseScreen />);
    expect(await screen.findByText('We could not find that move')).toBeTruthy();
  });
});
