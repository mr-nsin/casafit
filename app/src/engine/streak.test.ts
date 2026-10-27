import { addDays } from './dates';
import { activeSeconds, completedDaysFromLogs, computeStreak, type SessionLogLite } from './streak';

// 2026-10-27 is a Tuesday. Planned: Tue, Thu, Sat each week.
const planned = ['2026-10-13', '2026-10-15', '2026-10-17', '2026-10-20', '2026-10-22', '2026-10-24', '2026-10-27', '2026-10-29'];

describe('streak (D16)', () => {
  it('counts planned days only: rest days do not break it', () => {
    const r = computeStreak({
      plannedDays: planned,
      completedDays: ['2026-10-22', '2026-10-24', '2026-10-27'],
      today: '2026-10-27',
    });
    expect(r.current).toBe(3);
    expect(r.todayDone).toBe(true);
  });

  it('does not break while today is still open', () => {
    const r = computeStreak({
      plannedDays: planned,
      completedDays: ['2026-10-20', '2026-10-22', '2026-10-24'],
      today: '2026-10-27',
    });
    expect(r).toEqual({ current: 3, best: 3, todayPlanned: true, todayDone: false });
  });

  it('starts over after a missed planned day, and remembers the best run', () => {
    const r = computeStreak({
      plannedDays: planned,
      completedDays: ['2026-10-13', '2026-10-15', '2026-10-17', '2026-10-24', '2026-10-27'],
      today: '2026-10-27',
    });
    expect(r.current).toBe(2);
    expect(r.best).toBe(3);
  });

  it('ignores planned days in the future', () => {
    const r = computeStreak({ plannedDays: planned, completedDays: ['2026-10-27'], today: '2026-10-27' });
    expect(r.current).toBe(1);
    expect(computeStreak({ plannedDays: ['2026-10-29'], completedDays: [], today: '2026-10-27' })).toEqual({
      current: 0, best: 0, todayPlanned: false, todayDone: false,
    });
  });

  it('is unaffected by extra sessions on rest days', () => {
    const r = computeStreak({
      plannedDays: planned,
      completedDays: ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'],
      today: '2026-10-25',
    });
    expect(r.current).toBe(3);
  });

  it('handles empty input and duplicates', () => {
    expect(computeStreak({ plannedDays: [], completedDays: [], today: '2026-10-27' }).current).toBe(0);
    expect(computeStreak({ plannedDays: ['2026-10-27', '2026-10-27'], completedDays: ['2026-10-27', '2026-10-27'], today: '2026-10-27' }).current).toBe(1);
  });

  it('works across a month and year end', () => {
    const days = [0, 2, 4, 6].map((n) => addDays('2026-12-28', n));
    const r = computeStreak({ plannedDays: days, completedDays: days, today: days[3] as string });
    expect(r.current).toBe(4);
  });

  it('keeps a full week of daily training at 7', () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays('2026-10-21', i));
    expect(computeStreak({ plannedDays: days, completedDays: days, today: days[6] as string }).current).toBe(7);
  });

  it('never returns a negative or a broken-streak value', () => {
    const r = computeStreak({ plannedDays: planned, completedDays: [], today: '2026-10-27' });
    expect(r.current).toBe(0);
    expect(Object.keys(r).sort()).toEqual(['best', 'current', 'todayDone', 'todayPlanned']);
  });
});

describe('logs', () => {
  const logs: SessionLogLite[] = [
    { date: '2026-10-26', kind: 'full', status: 'complete', durationS: 900 },
    { date: '2026-10-25', kind: 'full', status: 'unfinished', durationS: 300 },
    { date: '2026-10-24', kind: 'micro', status: 'complete', durationS: 240 },
    { date: '2026-10-26', kind: 'full', status: 'complete', durationS: 600 },
  ];

  it('counts only completed full sessions towards the streak', () => {
    expect(completedDaysFromLogs(logs)).toEqual(['2026-10-26']);
  });

  it('counts every session in active minutes, micro and unfinished included', () => {
    expect(activeSeconds(logs)).toBe(2040);
    expect(activeSeconds(logs, '2026-10-25', '2026-10-25')).toBe(300);
    expect(activeSeconds(logs, '2026-10-26')).toBe(1500);
    expect(activeSeconds([{ date: 'x', kind: 'micro', status: 'complete', durationS: -5 }])).toBe(0);
  });
});
