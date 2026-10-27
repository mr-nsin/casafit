/**
 * D16: the streak is consecutive planned training days that were completed. Planned rest
 * days do not break it. Micro sessions and unfinished sessions do not count towards it.
 * Today does not break it while it is still open. There is no "broken streak" value.
 */
export interface StreakInput {
  /** Dates ('YYYY-MM-DD') that had a planned training session. Any range; later dates are ignored. */
  plannedDays: readonly string[];
  /** Dates with a completed full session. */
  completedDays: readonly string[];
  today: string;
}

export interface StreakResult {
  current: number;
  best: number;
  todayPlanned: boolean;
  todayDone: boolean;
}

export function computeStreak(input: StreakInput): StreakResult {
  const done = new Set(input.completedDays);
  const planned = [...new Set(input.plannedDays)].filter((d) => d <= input.today).sort();
  let run = 0;
  let best = 0;
  for (const day of planned) {
    if (done.has(day)) {
      run += 1;
      if (run > best) best = run;
    } else if (day === input.today) {
      // Still open: neither counts nor breaks.
    } else {
      run = 0;
    }
  }
  return {
    current: run,
    best,
    todayPlanned: planned.includes(input.today),
    todayDone: done.has(input.today),
  };
}

export interface SessionLogLite {
  date: string;
  kind: 'full' | 'micro';
  status: 'complete' | 'unfinished';
  durationS: number;
}

/** Dates that count towards the streak: completed full sessions only. */
export function completedDaysFromLogs(logs: readonly SessionLogLite[]): string[] {
  return [...new Set(logs.filter((l) => l.kind === 'full' && l.status === 'complete').map((l) => l.date))].sort();
}

/** Active seconds on a date range: every session counts, including micro and unfinished ones. */
export function activeSeconds(logs: readonly SessionLogLite[], from?: string, to?: string): number {
  let t = 0;
  for (const l of logs) {
    if (from && l.date < from) continue;
    if (to && l.date > to) continue;
    t += Math.max(0, l.durationS);
  }
  return t;
}
