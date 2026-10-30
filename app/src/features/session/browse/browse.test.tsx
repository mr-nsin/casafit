import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { createTestDb } from '../../../db/testing/nodeSqliteDriver';
import type { PlanDayRow } from '../../../db/repositories';
import { buildPlan } from '../../../engine';
import { usePreferences, defaultPreferences } from '../../../state/preferences';
import { setRepositories } from '../../../state/storage';
import { useAuth } from '../../../state/auth';
import { getOnboardingDeps } from '../../onboarding/deps';
import { useVerifyOutcome } from '../../onboarding/flowState';
import { configureSessionDeps } from '../deps';
import { sessionRoutes, loadResumableSession } from '../index';
import { useSessionStore } from '../store';
import { createHarness, makePlan } from '../testkit';
import { HomeRestScreen, HomeScreen } from './HomeScreen';
import { PlanScreen, WeekPlanScreen, WhyScreen } from './PlanScreens';
import { loadContent } from '../../../content';
import { isoWeek, mythOfTheWeek } from '../../learn/model';
import { READY_MADE, WEEKDAY_LONG, answerRows, dayIcon, completedDates, dayKindFor, isComeback, localDate, parsePlanDayKey, phaseMinutes, planClock, planDayKey, weekdayIndex } from './model';

let mockNoMyths = false;
jest.mock('../../../content', () => {
  const actual = jest.requireActual('../../../content');
  return { ...actual, loadContent: (...a: unknown[]) => { const c = actual.loadContent(...a); return mockNoMyths ? { ...c, myths: [] } : c; } };
});

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

// Reduced motion, synchronously: no animation timers or late state updates in the tests.
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

const DAY_MS = 86_400_000;
let db: Awaited<ReturnType<typeof createTestDb>>;
let harness: ReturnType<typeof createHarness>;

/** Day 0 is a workout, day 2 and day 6 are walks, day 4 is a stretch (4 sessions, knees). */
async function seed(opts: { dayOffset?: number; name?: string | null; painAreas?: string[]; plan?: boolean } = {}) {
  const { dayOffset = 0, name = 'Priya', painAreas = ['knees'], plan = true } = opts;
  const repos = db.repos;
  if (plan) {
    const start = localDate(Date.now());
    const p = buildPlan(
      { goal: 'stay_fit', bodyParts: [], styles: ['normal'], daysPerWeek: 4, experience: 'on_and_off', painAreas: painAreas as never, healthFlags: [], startDate: start, seed: 1 },
      getOnboardingDeps().catalogue(),
    );
    await repos.plan.save({ goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'on_and_off', variant: 'standard', weekNumber: 1, engineVersion: p.engineVersion });
    const rows: PlanDayRow[] = p.days.map((d) => ({
      planWeek: 1,
      dayIndex: d.dayIndex,
      kind: d.kind === 'training' ? 'workout' : d.restSuggestion === 'stretch' ? 'stretch' : 'walk',
      style: d.style,
      title: d.title,
      sessionJson: d.session ? JSON.stringify(d.session) : null,
      overridden: false,
      status: 'upcoming',
    }));
    await repos.plan.replaceDays(1, rows);
  }
  await repos.profile.save({ name, painAreas: painAreas as never, onboarded: true });
  configureSessionDeps({ clock: { now: () => 1000, wall: () => Date.now() + dayOffset * DAY_MS } });
  return localDate(Date.now() + dayOffset * DAY_MS);
}

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

describe('model', () => {
  it('rolls the week from the day the plan was made and repeats it afterwards', () => {
    const made = Date.UTC(2026, 9, 28, 12);
    const c0 = planClock(made, made);
    expect(c0.dayIndex).toBe(0);
    expect(planClock(made, made + 3 * DAY_MS).dayIndex).toBe(3);
    const later = planClock(made, made + 9 * DAY_MS);
    expect(later.dayIndex).toBe(2);
    expect(later.cycleStart).toBe(planClock(made, made + 7 * DAY_MS).cycleStart);
    expect(c0.dates).toHaveLength(7);
  });

  it('maps plan days to pill kinds and parses day keys', () => {
    const row = { kind: 'walk', style: null } as PlanDayRow;
    expect(dayKindFor(row, { today: false, done: false })).toBe('active-rest');
    expect(dayKindFor(row, { today: true, done: false })).toBe('today');
    expect(dayKindFor({ kind: 'workout', style: 'yoga' } as PlanDayRow, { today: false, done: true })).toBe('done');
    expect(parsePlanDayKey(planDayKey(1, 4))).toEqual({ week: 1, dayIndex: 4 });
    expect(parsePlanDayKey('x')).toBeNull();
  });

  it('splits 15 minutes into warm-up, work and cool-down', () => {
    expect(phaseMinutes(null)).toEqual({ warm: 2, work: 11, cool: 2, total: 15 });
  });

  it('only calls it a comeback after a finished session 7 or more days ago', () => {
    const log = (daysAgo: number, status: 'complete' | 'unfinished' = 'complete') =>
      ({ status, completedAt: Date.UTC(2026, 9, 30) - daysAgo * DAY_MS, durationS: 900 }) as never;
    expect(isComeback([], '2026-10-30', 0)).toBe(false);
    expect(isComeback([log(3)], '2026-10-30', 0)).toBe(false);
    expect(isComeback([log(8)], '2026-10-30', 0)).toBe(true);
    expect(isComeback([log(8), log(1, 'unfinished')], '2026-10-30', 0)).toBe(true);
    expect(completedDates([log(1), log(1, 'unfinished')], 0).size).toBe(1);
  });

  it('writes the answers back as plain rows with a place to change each', () => {
    const rows = answerRows({ goal: 'body_part', bodyParts: ['core', 'glutes'], styles: ['normal', 'yoga'], mix: { normal: 3, yoga: 1 }, daysPerWeek: 4, experience: 'on_and_off', variant: 'standard', weekNumber: 1, engineVersion: 'x', updatedAt: 0, syncedAt: null });
    expect(rows.map((r) => [r.label, r.value, r.to])).toEqual([
      ['Focus', 'Core and glutes', 'Goals'],
      ['Days', '4 days a week, 15 minutes', 'About'],
      ['Experience', 'On and off: a gentle start', 'About'],
      ['Style', '3 Normal, 1 Yoga', 'Mix'],
    ]);
  });

  it('only uses icons that exist in the glyph set', () => {
    const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json') as Record<string, number>;
    const names = [
      ...READY_MADE.map((p) => p.icon),
      ...(['workout', 'walk', 'stretch', 'rest'] as const).flatMap((kind) => (['normal', 'yoga', 'dance'] as const).map((style) => dayIcon({ kind, style }))),
      'check', 'swap_horiz', 'tune', 'play_arrow', 'pause_circle', 'today', 'check_circle', 'bedtime', 'auto_awesome', 'visibility_off', 'gps_fixed', 'event', 'trending_up', 'block', 'autorenew', 'horizontal_rule', 'sports_gymnastics', 'directions_walk', 'spa', 'person', 'add',
    ];
    for (const n of names) expect(n.replace(/_/g, '-') in glyphs).toBe(true);
  });

  it('registers the browse routes with the session lane', () => {
    for (const name of ['HomeRest', 'WeekPlan', 'Why', 'Plan', 'Library', 'BodyPart', 'Editor', 'Picker', 'Parts', 'Lunge', 'Exercise', 'CheckIn'] as const) expect(sessionRoutes[name].component).toBeDefined();
  });
});

describe('Home, training day', () => {
  it('shows the greeting, the week, today and the session shape', async () => {
    const today = await seed();
    await render(<HomeScreen />);
    expect(await screen.findByText("Let's move, Priya")).toBeTruthy();
    expect(screen.getByText(`${WEEKDAY_LONG[weekdayIndex(today)]} · Week 1`)).toBeTruthy();
    expect(screen.getByText('Today is session 1 of 4')).toBeTruthy();
    expect(screen.getByText('Push 15')).toBeTruthy();
    expect(screen.getByText(/Normal · 5 moves · no equipment · knee-friendly/)).toBeTruthy();
    expect(screen.getByLabelText(/, today: Push 15$/)).toBeTruthy();
    expect(screen.getAllByLabelText(/^(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day/)).toHaveLength(7);
    expect(screen.getByText('15 min total')).toBeTruthy();
    expect(screen.getByLabelText('Form check, 2 free left')).toBeTruthy();
    expect(screen.queryByText('Resume your session')).toBeNull();
  });

  it('Start goes straight to the player and starts the session', async () => {
    await seed();
    await render(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText('Start'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Player');
    const s = useSessionStore.getState();
    expect(s.status).toBe('active');
    expect(s.plan?.title).toBe('Push 15');
    expect(s.planDay).toBe(0);
  });

  it('opens the plan, the week, the editor and parts from today', async () => {
    await seed();
    await render(<HomeScreen />);
    await screen.findByText('Push 15');
    await fireEvent.press(screen.getByLabelText(/, today: Push 15$/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Plan', { planDayId: '1-0' });
    await fireEvent.press(screen.getByLabelText('Full plan'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('WeekPlan');
    await fireEvent.press(screen.getByLabelText("Swap today's session"));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Editor');
    await fireEvent.press(screen.getByLabelText("Edit today's session"));
    await fireEvent.press(screen.getByLabelText('Warm-up'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Parts', { part: 'warmup' });
    await fireEvent.press(screen.getByLabelText('Cool-down'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Parts', { part: 'cooldown' });
    await fireEvent.press(screen.getByLabelText('Form check, 2 free left'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Paywall');
    await fireEvent.press(screen.getByLabelText('Profile'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Profile');
  });

  it('hides the form check chip for Pro', async () => {
    await seed();
    useAuth.setState({ pro: { active: true, expiresAt: null } });
    await render(<HomeScreen />);
    await screen.findByText('Push 15');
    expect(screen.queryByLabelText(/Form check/)).toBeNull();
  });

  it('links the ready-made plans and the body-part grid', async () => {
    await seed();
    await render(<HomeScreen />);
    await screen.findByText('Push 15');
    await fireEvent.press(screen.getByLabelText('Full body starter, 15 min · Easy'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Plan', { readyMadeId: 'full_body_starter' });
    await fireEvent.press(screen.getByLabelText(/^Desk reset/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Desk');
    await fireEvent.press(screen.getByLabelText('See all'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Library');
    await fireEvent.press(screen.getByLabelText('Core'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('BodyPart', { part: 'core' });
    expect(screen.getByText('Pick one for a quick session')).toBeTruthy();
  });

  it('shades the body parts the user chose', async () => {
    await seed();
    await db.repos.plan.save({ goal: 'body_part', bodyParts: ['core'], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'new', variant: 'standard', weekNumber: 1, engineVersion: 'x' });
    await render(<HomeScreen />);
    expect(await screen.findByLabelText('Core, your focus')).toBeTruthy();
    expect(screen.getByText('Shaded: your focus')).toBeTruthy();
  });

  it('shows today steps and food from local data when it exists', async () => {
    const today = await seed();
    await db.repos.steps.upsert({ onDate: today, steps: 4820, briskMinutes: 12, source: 'pedometer', updatedAt: 0 });
    await db.repos.profile.save({ stepGoal: 7000 });
    await db.repos.food.add({ id: 'f1', loggedOn: today, meal: 'lunch', foodId: 'dal', unit: 'katori', portions: 1, snapshot: { kcal: 1240, proteinG: 52, packVersion: 1 }, createdAt: 1 });
    await render(<HomeScreen />);
    expect(await screen.findByText('4,820')).toBeTruthy();
    expect(screen.getByText('of 7,000 steps')).toBeTruthy();
    expect(screen.getByText('12 brisk min')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/^1,240/)).toBeTruthy());
    expect(screen.getByText(/52/)).toBeTruthy();
    expect(screen.queryByText('Calories hidden')).toBeNull();
  });

  it('hides calories when the pref says so, keeps protein, and Show brings them back', async () => {
    const today = await seed();
    await db.repos.food.add({ id: 'f1', loggedOn: today, meal: 'lunch', foodId: 'dal', unit: 'katori', portions: 1, snapshot: { kcal: 1240, proteinG: 52, packVersion: 1 }, createdAt: 1 });
    usePreferences.setState({ showCalories: false });
    await render(<HomeScreen />);
    expect(await screen.findByText('Calories hidden')).toBeTruthy();
    expect(screen.queryByText(/1,240/)).toBeNull();
    expect(screen.queryByText(/kcal/)).toBeNull();
    expect(screen.getByText('Calories are hidden everywhere in CasaFit. Protein still counts.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Show'));
    await waitFor(() => expect(usePreferences.getState().showCalories).toBe(true));
  });

  it('offers to count steps and log a meal when there is no data yet', async () => {
    await seed();
    await render(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText('Count your steps'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Steps');
    await fireEvent.press(screen.getByLabelText('Food, log a meal'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Main', { screen: 'Nutrition' });
  });

  it('asks for a plan when there is none', async () => {
    await seed({ plan: false });
    await render(<HomeScreen />);
    expect(await screen.findByText('Your plan is on its way')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Build my plan'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Goals');
  });
});

describe('Home, resume', () => {
  async function pauseOne() {
    harness.store.getState().start(makePlan({ title: 'Push 15' }), { planWeek: 1, planDay: 0 });
    harness.advance(200_000);
    harness.store.getState().pause('user');
    await harness.store.getState().requestEnd();
    await harness.store.getState().saveForLater();
    expect(harness.getSnapshot()).not.toBeNull();
  }

  it('loadResumableSession returns the saved session', async () => {
    await pauseOne();
    const r = await loadResumableSession();
    expect(r?.title).toBe('Push 15');
  });

  it('shows the resume card above today and Start becomes Start fresh', async () => {
    await seed();
    configureSessionDeps({ clock: harness.clock });
    await pauseOne();
    await render(<HomeScreen />);
    expect(await screen.findByText('Resume your session')).toBeTruthy();
    expect(screen.getByText(/Push 15 · 3 of 15 min done/)).toBeTruthy();
    expect(screen.getByLabelText('Start fresh')).toBeTruthy();
    expect(screen.getByText('Today, or start fresh')).toBeTruthy();
    expect(screen.getByText('We keep it for 24 hours. Discarding does not affect your week.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Resume'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Paused');
  });

  it('Discard removes the card and clears the saved session', async () => {
    await seed();
    configureSessionDeps({ clock: harness.clock });
    await pauseOne();
    await render(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText('Discard'));
    await waitFor(() => expect(screen.queryByText('Resume your session')).toBeNull());
    expect(harness.getSnapshot()).toBeNull();
    expect(useSessionStore.getState().status).toBe('idle');
  });
});

describe('Home, finished but not saved', () => {
  async function finishOne() {
    harness.store.getState().start(makePlan({ title: 'Push 15' }), { planWeek: 1, planDay: 0 });
    harness.advance(900_000);
    expect(harness.store.getState().status).toBe('complete');
    harness.store.getState().reset(); // the app was closed before Complete was left
    expect(harness.getSnapshot()).not.toBeNull();
  }

  it('offers to save instead of resuming a session with no time left', async () => {
    await seed();
    configureSessionDeps({ clock: harness.clock });
    await finishOne();
    await render(<HomeScreen />);
    expect(await screen.findByText('Save your session')).toBeTruthy();
    expect(screen.queryByText('Resume your session')).toBeNull();
    expect(screen.queryByText(/15 of 15 min/)).toBeNull();
    expect(screen.getByText(/Push 15 · 15 min done/)).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByLabelText('Start')).toBeTruthy();
    expect(screen.queryByText(/missed|failed|gave up/i)).toBeNull();
  });

  it('Save session logs it once and the card goes away', async () => {
    await seed();
    configureSessionDeps({ clock: harness.clock });
    await finishOne();
    await render(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText('Save session'));
    await waitFor(() => expect(screen.queryByText('Save your session')).toBeNull());
    expect(harness.logs).toHaveLength(1);
    expect(harness.logs[0]).toMatchObject({ status: 'complete', felt: null });
    expect(harness.getSnapshot()).toBeNull();
    expect(useSessionStore.getState().status).toBe('idle');
  });

  it('Discard removes the card, logs nothing and clears the snapshot', async () => {
    await seed();
    configureSessionDeps({ clock: harness.clock });
    await finishOne();
    await render(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText('Discard'));
    await waitFor(() => expect(screen.queryByText('Save your session')).toBeNull());
    expect(harness.logs).toHaveLength(0);
    expect(harness.getSnapshot()).toBeNull();
  });
});

describe('Home, myth of the week', () => {
  it('picks one myth per ISO week, the same all week', () => {
    const myths = loadContent().myths;
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2024-12-30')).toBe(1);
    expect(isoWeek('2026-12-31')).toBe(53);
    expect(mythOfTheWeek(myths, '2026-10-26')?.id).toBe(mythOfTheWeek(myths, '2026-11-01')?.id);
    expect(mythOfTheWeek(myths, '2026-10-26')?.id).not.toBe(mythOfTheWeek(myths, '2026-11-02')?.id);
    expect(mythOfTheWeek([], '2026-10-26')).toBeNull();
  });

  it("shows this week's myth and opens the Myth screen", async () => {
    const today = await seed();
    const content = loadContent();
    const myth = mythOfTheWeek(content.myths, today)!;
    await render(<HomeScreen />);
    expect(await screen.findByText('Myth of the week')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(`Myth of the week: ${content.t(myth.titleKey)}`));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Myth', { mythId: myth.id });
  });

  it('is hidden when the content has no myths', async () => {
    await seed();
    mockNoMyths = true;
    try {
      await render(<HomeScreen />);
      await screen.findByText('Push 15');
      expect(screen.queryByText('Myth of the week')).toBeNull();
    } finally {
      mockNoMyths = false;
    }
  });
});

describe('Home, comeback', () => {
  it('welcomes the user back after 7 or more days away, with no count of missed days', async () => {
    const today = await seed();
    const longAgo = Date.now() - 9 * DAY_MS;
    await db.repos.sessionLog.insert({ id: 'l1', planWeek: 1, planDay: 0, style: 'normal', status: 'complete', durationS: 900, movesDone: 5, movesPlanned: 5, felt: 'about_right', rungChanges: [], feelSignals: [], warmupSkipped: false, formChecks: 0, quiet: false, completedAt: longAgo });
    await render(<HomeScreen />);
    expect(await screen.findByText('Welcome back, Priya')).toBeTruthy();
    expect(screen.getByText('Start where you are. One session today is plenty.')).toBeTruthy();
    expect(screen.queryByText(/missed/i)).toBeNull();
    expect(today).toBeTruthy();
  });

  it('does not show it for a user with a recent session', async () => {
    await seed();
    await db.repos.sessionLog.insert({ id: 'l1', planWeek: 1, planDay: 0, style: 'normal', status: 'complete', durationS: 900, movesDone: 5, movesPlanned: 5, felt: null, rungChanges: [], feelSignals: [], warmupSkipped: false, formChecks: 0, quiet: false, completedAt: Date.now() - 2 * DAY_MS });
    await render(<HomeScreen />);
    expect(await screen.findByText("Let's move, Priya")).toBeTruthy();
  });
});

describe('Home, rest day', () => {
  it('Home renders the rest layout when today is a walk or stretch day', async () => {
    await seed({ dayOffset: 2 });
    await render(<HomeScreen />);
    expect(await screen.findByText('Rest well, Priya')).toBeTruthy();
    expect(screen.getByText('Your muscles get stronger while you rest. Keep it easy today.')).toBeTruthy();
    expect(screen.getByText('0 of 4 workouts done this week. Nicely paced.')).toBeTruthy();
    expect(screen.queryByLabelText('Form check, 2 free left')).toBeTruthy();
    expect(screen.getByLabelText(/10-minute easy walk/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/10-minute easy walk/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Steps');
    await fireEvent.press(screen.getByLabelText(/Gentle stretch/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Plan', { planDayId: '1-4' });
    expect(screen.queryByText('Start')).toBeNull();
  });

  it('shows tomorrow, and a recap once a session is done', async () => {
    await seed({ dayOffset: 2 });
    await db.repos.sessionLog.insert({ id: 'l1', planWeek: 1, planDay: 0, style: 'normal', status: 'complete', durationS: 900, movesDone: 5, movesPlanned: 5, felt: null, rungChanges: [], feelSignals: [], warmupSkipped: false, formChecks: 0, quiet: false, completedAt: Date.now() + DAY_MS });
    await render(<HomeScreen />);
    expect(await screen.findByText('Tomorrow')).toBeTruthy();
    expect(screen.getByText('Cardio 15')).toBeTruthy();
    expect(screen.getByText('1 of 4 workouts done this week. Nicely paced.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Week 1 recap/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Recap');
    await fireEvent.press(screen.getByLabelText(/^Cardio 15/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Plan', { planDayId: '1-3' });
  });

  it('the HomeRest route shows the rest layout with a back button', async () => {
    await seed();
    await render(<HomeRestScreen />);
    expect(await screen.findByText('Rest well, Priya')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });
});

describe('WeekPlan', () => {
  it('lists the seven days with a summary and swap buttons', async () => {
    await seed();
    await render(<WeekPlanScreen />);
    expect(await screen.findByText('Week 1')).toBeTruthy();
    expect(screen.getByText('4 workouts · 60 minutes · 4 Normal')).toBeTruthy();
    expect(screen.getByText('Push 15')).toBeTruthy();
    expect(screen.getByText('Today · Normal · 5 moves')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Swap /)).toHaveLength(6);
  });

  it('opens the plan, the editor, Why and Mix; Start today starts the session', async () => {
    await seed();
    await render(<WeekPlanScreen />);
    await screen.findByText('Week 1');
    await fireEvent.press(screen.getByLabelText(/: Push 15, Today/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Plan', { planDayId: '1-0' });
    await fireEvent.press(screen.getAllByLabelText(/^Swap /)[0]!);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Editor', { planDayId: '1-1' });
    await fireEvent.press(screen.getByLabelText('Why this plan'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Why');
    await fireEvent.press(screen.getByLabelText('Change mix'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Mix');
    await fireEvent.press(screen.getByLabelText('Start today'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Player');
    expect(useSessionStore.getState().status).toBe('active');
  });

  it('turns Start today off on a rest day and goes back', async () => {
    await seed({ dayOffset: 2 });
    await render(<WeekPlanScreen />);
    await screen.findByText('Week 1');
    const start = screen.getByLabelText('Start today');
    expect(start.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  const enabled = (label: string) =>
    waitFor(() => {
      const b = screen.getByLabelText(label);
      if (b.props.accessibilityState?.disabled) throw new Error('not ready');
      return b;
    });

  it('steps to the next week when its rows exist, and Start today is only for this week', async () => {
    await seed();
    const rows = await db.repos.plan.days(1);
    await db.repos.plan.replaceDays(2, rows.map((r) => ({ ...r, planWeek: 2 })));
    await render(<WeekPlanScreen />);
    await screen.findByText('Week 1');
    expect(screen.getByLabelText('Previous week').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(await enabled('Next week'));
    expect(await screen.findByText('Week 2')).toBeTruthy();
    expect(screen.queryByLabelText('Start today')).toBeNull();
    expect(screen.getAllByLabelText(/^Swap /).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getAllByLabelText(/^Swap /)[0]!);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Editor', { planDayId: '2-0' });
    await fireEvent.press(screen.getByLabelText('This week'));
    expect(await screen.findByText('Week 1')).toBeTruthy();
    expect(screen.getByLabelText('Start today')).toBeTruthy();
  });

  it('shows an earlier week for reading only, and opens its days without Edit or Start', async () => {
    await seed();
    const rows = await db.repos.plan.days(1);
    await db.repos.plan.replaceDays(2, rows.map((r) => ({ ...r, planWeek: 2 })));
    await db.repos.plan.save({ goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'on_and_off', variant: 'standard', weekNumber: 2, engineVersion: 'x' });
    await render(<WeekPlanScreen />);
    await screen.findByText('Week 2');
    await fireEvent.press(await enabled('Previous week'));
    expect(await screen.findByText('Week 1')).toBeTruthy();
    expect(screen.getByText('This week is behind you, so it is for reading only.')).toBeTruthy();
    expect(screen.queryAllByLabelText(/^Swap /)).toHaveLength(0);
    expect(screen.queryByLabelText('Start today')).toBeNull();
    expect(screen.queryByLabelText('Change mix')).toBeNull();
    await fireEvent.press(screen.getByLabelText(/: Push 15/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Plan', { planDayId: '1-0' });
  });

  it('Plan opens a day from an earlier week with no Edit or Start', async () => {
    await seed();
    const rows = await db.repos.plan.days(1);
    await db.repos.plan.replaceDays(2, rows.map((r) => ({ ...r, planWeek: 2 })));
    await db.repos.plan.save({ goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'on_and_off', variant: 'standard', weekNumber: 2, engineVersion: 'x' });
    mockRoute = { params: { planDayId: '1-0' } };
    await render(<PlanScreen />);
    expect(await screen.findByText('Push 15')).toBeTruthy();
    expect(screen.queryByLabelText('Edit')).toBeNull();
    expect(screen.queryByLabelText('Start session')).toBeNull();
  });

  it('asks for a plan when there is none', async () => {
    await seed({ plan: false });
    await render(<WeekPlanScreen />);
    expect(await screen.findByText('No plan yet')).toBeTruthy();
  });
});

describe('Why', () => {
  it('shows the answers, what was left out, and how it changes', async () => {
    await seed();
    await db.repos.plan.save({ goal: 'body_part', bodyParts: ['core', 'glutes'], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'on_and_off', variant: 'standard', weekNumber: 1, engineVersion: 'x' });
    await render(<WhyScreen />);
    expect(await screen.findByText('What we used')).toBeTruthy();
    expect(screen.getByText('Rules on your phone built this week from your answers. Nothing is guessed.')).toBeTruthy();
    expect(screen.getByText('Core and glutes')).toBeTruthy();
    expect(screen.getByText('4 days a week, 15 minutes')).toBeTruthy();
    expect(screen.getByText('On and off: a gentle start')).toBeTruthy();
    expect(screen.getByText('What we left out, and why')).toBeTruthy();
    expect(screen.getByText('Forward lunge')).toBeTruthy();
    expect(screen.getAllByText('You said your knees hurt. We left it out.')).toHaveLength(3);
    expect(screen.getByText('How it changes')).toBeTruthy();
  });

  it('sends each Change link to its onboarding screen', async () => {
    await seed();
    await render(<WhyScreen />);
    await screen.findByText('What we used');
    const links = screen.getAllByLabelText('Change');
    expect(links).toHaveLength(4);
    await fireEvent.press(links[0]!);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Goals');
    await fireEvent.press(links[1]!);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('About');
    await fireEvent.press(links[2]!);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('About');
    await fireEvent.press(links[3]!);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Mix');
  });

  it('opens the swap explanation for a skipped move and Got it returns to the week', async () => {
    await seed();
    await render(<WhyScreen />);
    await fireEvent.press(await screen.findByLabelText(/^Forward lunge/));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Lunge', { excludedExerciseId: 'lunge' });
    await fireEvent.press(screen.getByLabelText('Got it'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('WeekPlan');
  });

  it('leaves out the skipped section when nothing was skipped', async () => {
    await seed({ painAreas: [] });
    await render(<WhyScreen />);
    await screen.findByText('What we used');
    expect(screen.queryByText('What we left out, and why')).toBeNull();
  });
});

describe('Plan', () => {
  it("shows today's plan by default, with its moves", async () => {
    await seed();
    await render(<PlanScreen />);
    expect(await screen.findByText("Today's plan")).toBeTruthy();
    expect(screen.getByText('Push 15')).toBeTruthy();
    expect(screen.getByText('15 min')).toBeTruthy();
    expect(screen.getByText('No equipment')).toBeTruthy();
    expect(screen.getByText('5 moves')).toBeTruthy();
    expect(screen.getAllByText(/^2 × \d+s$/)).toHaveLength(5);
    expect(screen.getByLabelText('See why')).toBeTruthy();
  });

  it('starts the session, opens the editor, Why, parts and an exercise', async () => {
    await seed();
    await render(<PlanScreen />);
    await screen.findByText("Today's plan");
    await fireEvent.press(screen.getByLabelText('Start session'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Player');
    expect(useSessionStore.getState().status).toBe('active');
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Editor', { planDayId: '1-0', from: 'plan' });
    await fireEvent.press(screen.getByLabelText('Why this plan'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Why');
    await fireEvent.press(screen.getByLabelText('Warm-up and cool-down'));
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Parts');
    await fireEvent.press(screen.getAllByText(/^2 × \d+s$/)[0]!);
    expect(mockNav.navigate).toHaveBeenLastCalledWith('Exercise', expect.objectContaining({ exerciseId: expect.any(String) }));
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('opens another day by planDayId, here a stretch day without a session', async () => {
    await seed();
    mockRoute = { params: { planDayId: '1-4' } };
    await render(<PlanScreen />);
    expect(await screen.findByText('Rest day: gentle stretch')).toBeTruthy();
    expect(screen.queryByLabelText('Start session')).toBeNull();
    expect(screen.getByText('This one is optional. Do as much as feels good.')).toBeTruthy();
  });

  it('names the weekday for a later workout', async () => {
    const today = await seed();
    mockRoute = { params: { planDayId: '1-3' } };
    await render(<PlanScreen />);
    expect(await screen.findByText("Cardio 15")).toBeTruthy();
    const date = planClock(Date.now(), Date.now()).dates[3]!;
    expect(screen.getByText(`${WEEKDAY_LONG[weekdayIndex(date)]}'s plan`)).toBeTruthy();
    expect(today).toBeTruthy();
  });

  it('shows a ready-made plan by id, with its moves', async () => {
    await seed();
    mockRoute = { params: { readyMadeId: 'core_glutes_15' } };
    await render(<PlanScreen />);
    expect(await screen.findByText('Core and glutes 15')).toBeTruthy();
    expect(screen.getByText('Ready-made plan')).toBeTruthy();
    expect(screen.getByText('5 moves')).toBeTruthy();
    expect(screen.getByLabelText('Start now')).toBeTruthy();
  });

  it('says so when the day cannot be found', async () => {
    await seed();
    mockRoute = { params: { planDayId: '9-9' } };
    await render(<PlanScreen />);
    expect(await screen.findByText('We could not find that day')).toBeTruthy();
  });
});
