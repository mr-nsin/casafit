// Pure maths over a timeline. Position is milliseconds of session time. Extra rest the
// user adds (+15 s, +30 s) is stored per segment index and stretches that segment.

import type { Timeline, TimelineSegment } from './types';

export interface EffSeg {
  seg: TimelineSegment;
  startMs: number;
  endMs: number;
}

export type Extras = Readonly<Record<number, number>>;

export function effectiveSegments(timeline: Timeline, extras: Extras): EffSeg[] {
  const out: EffSeg[] = [];
  let t = 0;
  for (const seg of timeline.segments) {
    const d = seg.durationS * 1000 + (extras[seg.index] ?? 0);
    out.push({ seg, startMs: t, endMs: t + d });
    t += d;
  }
  return out;
}

export function totalMs(eff: readonly EffSeg[]): number {
  const last = eff[eff.length - 1];
  return last ? last.endMs : 0;
}

/** The segment holding `positionMs`, or null when the session is over. */
export function locate(eff: readonly EffSeg[], positionMs: number): EffSeg | null {
  for (const e of eff) if (positionMs >= e.startMs && positionMs < e.endMs) return e;
  return null;
}

export function stepRange(
  eff: readonly EffSeg[],
  stepIndex: number,
): { startMs: number; endMs: number } | null {
  let start = -1;
  let end = -1;
  for (const e of eff) {
    if (e.seg.stepIndex === stepIndex) {
      if (start < 0) start = e.startMs;
      end = e.endMs;
    }
  }
  return start < 0 ? null : { startMs: start, endMs: end };
}

/** The last rest segment of a step, if any. */
export function lastRestOfStep(eff: readonly EffSeg[], stepIndex: number): EffSeg | null {
  let found: EffSeg | null = null;
  for (const e of eff) if (e.seg.stepIndex === stepIndex && e.seg.kind === 'rest') found = e;
  return found;
}

/** First rest segment at or after `positionMs`, whichever step it belongs to. */
export function nextRestFrom(eff: readonly EffSeg[], positionMs: number): EffSeg | null {
  for (const e of eff) if (e.seg.kind === 'rest' && e.endMs > positionMs) return e;
  return null;
}
