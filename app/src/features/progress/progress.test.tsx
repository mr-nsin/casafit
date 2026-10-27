import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { PlanDayRow, PlanRow, SessionLog, StepSummary } from '../../db/repositories';
import { createTestDb } from '../../db/testing/nodeSqliteDriver';
import { setRepositories } from '../../state/storage';
import { computeProgress, computeRecap, plannedDays, recapWeekStart, progressRoutes } from '.';
import { ProgressScreen, ProgressEmptyScreen, RecapScreen } from './ProgressScreens';
import { mondayIndex } from './model';

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNav }));

// Wednesday 28 October 2026; tz 0 keeps dates predictable.
const TODAY = '2026-10-28';
const noon = (date: string) => Date.parse(`${date}T12:00:00Z`);

const log = (date: string, over: Partial<SessionLog> = {}): SessionLog => ({
  id: `l-${date}-${Math.random()}`,
  planWeek: 1,
  planDay: 0,
  style: 'normal',
  status: 'complete',
  durationS: 900,
  movesDone: 8,
  movesPlanned: 8,
  felt: null,
  rungChanges: [],
  feelSignals: [],
  warmupSkipped: false,
  formChecks: 0,
  quiet: false,
  completedAt: noon(date),
  syncedAt: null,
  ...over,
});
const dayRow = (dayIndex: number, kind: PlanDayRow['kind']): PlanDayRow => ({ planWeek: 1, dayIndex, kind, style: null, title: '', sessionJson: null, overridden: false, status: 'upcoming' });
const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'new', variant: 'standard', weekNumber: 1, engineVersion: '1', updatedAt: 0, syncedAt: null, ...over,
});
const steps = (date: string, n: number): StepSummary => ({ onDate: date, steps: n, briskMinutes: 0, source: 'pedometer', updatedAt: 0, syncedAt: null });
// Mon, Wed, Fri, Sun are workouts; Tue, Thu, Sat rest.
const weekDays = [0, 2, 4, 6].map((i) => dayRow(i, 'workout')).concat([1, 3, 5].map((i) => dayRow(i, 'rest')));

describe('progress model', () => {
  it('weeks start on Monday', () => {
    expect(mondayIndex('2026-10-26')).toBe(0);
    expect(mondayIndex('2026-11-01')).toBe(6);
  });

  it('rest days do not break the streak and an open today does not either', () => {
    // Mon 26 done, Tue rest, Wed (today, open). Previous Fri 23 and Sun 25 done.
    const logs = ['2026-10-23', '2026-10-25', '2026-10-26'].map((d) => log(d));
    const v = computeProgress({ today: TODAY, tz: 0, logs, microActiveS: 0, steps: [], plan: plan(), currentWeekDays: weekDays });
    expect(v.streak).toBe(3);
    expect(v.best).toBe(3);
    expect(v.weekDots.find((d) => d.label === 'Mon')?.done).toBe(true);
    expect(v.weekDots.find((d) => d.label === 'Wed')?.done).toBe(false);
  });

  it('a missed planned day resets the run but keeps the best, with no negative value', () => {
    const logs = ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26'].map((d) => log(d)); // 25 (Sun) missed
    const v = computeProgress({ today: TODAY, tz: 0, logs, microActiveS: 0, steps: [], plan: plan(), currentWeekDays: weekDays });
    expect(v.best).toBe(3);
    expect(v.streak).toBe(1);
  });

  it('unfinished sessions fill the heat map but not the streak', () => {
    const v = computeProgress({ today: TODAY, tz: 0, logs: [log('2026-10-27', { status: 'unfinished', durationS: 300 })], microActiveS: 120, steps: [], plan: null, currentWeekDays: [] });
    expect(v.streak).toBe(0);
    expect(v.heat[26]).toBe(1);
    expect(v.sessions28).toBe(0);
    expect(v.minutes28).toBe(7); // 5 + 2 micro
    expect(v.empty).toBe(false);
  });

  it('is empty with no sessions and hides steps average when steps are off', () => {
    const v = computeProgress({ today: TODAY, tz: 0, logs: [], microActiveS: 0, steps: [], plan: null, currentWeekDays: [] });
    expect(v.empty).toBe(true);
    expect(v.avgSteps).toBeNull();
    expect(v.heat).toHaveLength(28);
  });

  it('averages only days with steps', () => {
    const v = computeProgress({ today: TODAY, tz: 0, logs: [log('2026-10-26')], microActiveS: 0, steps: [steps('2026-10-26', 6000), steps('2026-10-27', 0), steps('2026-10-25', 7000)], plan: null, currentWeekDays: [] });
    expect(v.avgSteps).toBe(6500);
  });

  it('plannedDays repeats the weekly pattern back to the first log', () => {
    const p = plannedDays({ today: TODAY, completed: [], currentWeekDays: weekDays, firstLogDate: '2026-10-19' });
    expect(p).toEqual(['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-25', '2026-10-26', '2026-10-28']);
  });
});

describe('recap model', () => {
  it('covers the week just ended unless today is Sunday', () => {
    expect(recapWeekStart('2026-10-28')).toBe('2026-10-19');
    expect(recapWeekStart('2026-11-01')).toBe('2026-10-26');
  });

  it('builds a strong first week from logs and steps', () => {
    const logs = ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-01'].map((d) => log(d, { felt: 'about_right', durationS: 900 }));
    const stepRows = ['2026-10-26', '2026-10-27', '2026-10-28'].map((d) => steps(d, 6000)).concat(steps('2026-10-27', 3500));
    const v = computeRecap({ today: '2026-11-01', tz: 0, logs, steps: stepRows, plan: plan(), currentWeekDays: weekDays });
    expect(v).toMatchObject({ weekNumber: 1, workouts: 4, activeMinutes: 60, headline: 'A strong first week', isCurrentWeek: true });
    expect(v.body).toContain('moved on rest days too');
    expect(v.insights[0]?.lead).toBe('Something got easier.');
    expect(v.insights[1]?.text).toBe('4 workouts planned.');
    expect(v.stepBars?.values).toHaveLength(7);
  });

  it('a week with nothing logged is kind, not shaming', () => {
    const v = computeRecap({ today: '2026-11-01', tz: 0, logs: [], steps: [], plan: plan(), currentWeekDays: weekDays });
    expect(v.quiet).toBe(true);
    expect(v.headline).toBe('A quiet week, and that is fine');
    expect(v.stepsPerDay).toBeNull();
    expect(v.stepBars).toBeNull();
    expect(v.insights.some((i) => /miss|fail|behind/i.test(i.text))).toBe(false);
  });

  it('only claims rest-day movement when steps show it', () => {
    const v = computeRecap({ today: '2026-11-01', tz: 0, logs: [log('2026-10-26')], steps: [], plan: plan(), currentWeekDays: weekDays });
    expect(v.body).not.toContain('rest days');
  });
});

describe('screens', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  beforeEach(async () => {
    db = await createTestDb();
    setRepositories(db.repos);
    jest.useFakeTimers({ now: noon(TODAY), doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    Object.values(mockNav).forEach((f) => f.mockClear());
  });
  afterEach(() => {
    jest.useRealTimers();
    setRepositories(null);
    db.driver.close();
  });
  const settle = async () => {
    for (let i = 0; i < 6; i += 1) await act(async () => Promise.resolve());
  };

  it('Progress tab shows the empty state, with the CTA to Workout', async () => {
    await render(<ProgressScreen />);
    await settle();
    expect(screen.getByText('Your progress starts with session one')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "Start today's session" }));
    expect(mockNav.navigate).toHaveBeenCalledWith('Main', { screen: 'Workout' });
  });

  it('Progress tab shows streak, week, heat map and totals after a session', async () => {
    await db.repos.plan.save({ goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'new', variant: 'standard', weekNumber: 1, engineVersion: '1' });
    await db.repos.plan.replaceDays(1, weekDays);
    for (const d of ['2026-10-23', '2026-10-25', '2026-10-26']) await db.repos.sessionLog.insert(log(d));
    await db.repos.steps.upsert({ onDate: '2026-10-26', steps: 6240, briskMinutes: 0, source: 'pedometer', updatedAt: 0 });
    await render(<ProgressScreen />);
    await settle();
    expect(screen.getByLabelText('3 day streak. Your best is 3 days.')).toBeTruthy();
    expect(screen.getByText('Last 4 weeks')).toBeTruthy();
    expect(screen.getByLabelText(/active days? in the last 4 weeks/)).toBeTruthy();
    expect(screen.getByText('Minutes trained')).toBeTruthy();
    expect(screen.getByLabelText('6,240, Avg steps a day')).toBeTruthy();
  });

  it('Progress hides the steps tile when steps are off', async () => {
    await db.repos.sessionLog.insert(log('2026-10-26'));
    await render(<ProgressScreen />);
    await settle();
    expect(screen.queryByText('Avg steps a day')).toBeNull();
  });

  it('Recap shows stats, next-week card and goes to WeekPlan', async () => {
    jest.setSystemTime(noon('2026-11-01'));
    await db.repos.plan.save({ goal: 'stay_fit', bodyParts: [], styles: ['normal'], mix: {}, daysPerWeek: 4, experience: 'new', variant: 'standard', weekNumber: 1, engineVersion: '1' });
    for (const d of ['2026-10-26', '2026-10-28']) await db.repos.sessionLog.insert(log(d, { felt: 'about_right' }));
    await render(<RecapScreen />);
    await settle();
    expect(screen.getByText('Week 1 recap')).toBeTruthy();
    expect(screen.getByText('Active minutes')).toBeTruthy();
    expect(screen.getByText(/next week adds a few reps/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'See next week' }));
    expect(mockNav.navigate).toHaveBeenCalledWith('WeekPlan');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('ProgressEmpty route renders on its own and the registry has three routes', async () => {
    await render(<ProgressEmptyScreen />);
    expect(screen.getByText('What will show up here')).toBeTruthy();
    expect(Object.keys(progressRoutes).sort()).toEqual(['Progress', 'ProgressEmpty', 'Recap']);
  });
});
