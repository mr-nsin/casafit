/** Calendar-day helpers on 'YYYY-MM-DD' strings. They are timezone-neutral (UTC arithmetic). */

const DAY_MS = 86_400_000;

export function parseDate(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Bad date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function addDays(iso: string, n: number): string {
  return formatDate(parseDate(iso) + n * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
}

/** Local calendar date for an instant, given the zone offset in minutes east of UTC. */
export function localDateKey(epochMs: number, tzOffsetMin: number): string {
  return formatDate(epochMs + tzOffsetMin * 60_000);
}

/** mm:ss, for example 900 -> "15:00". */
export function formatMmSs(totalS: number): string {
  const s = Math.max(0, Math.round(totalS));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
