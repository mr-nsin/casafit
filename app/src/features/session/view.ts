// Derives everything a screen shows from the store state and the monotonic clock.
// Nothing here counts ticks: remaining time is always end minus now.

import { effectiveSegments, locate, totalMs, type EffSeg } from './locate';
import type { Phase, PlanStep, Rung, SegmentKind } from './types';
import type { SessionState } from './store';

export interface ProgressSegment {
  key: string;
  phase: Phase;
  /** Relative width. Warm-up and cool-down use their length, a move uses its length. */
  weight: number;
  state: 'done' | 'current' | 'todo';
  /** 0..1 for the current segment. */
  fill: number;
}

export interface UpNext {
  name: string;
  exerciseId: string;
  set: number;
  sets: number;
  workS: number;
  sameStep: boolean;
}

export interface SessionView {
  status: SessionState['status'];
  title: string;
  style: 'normal' | 'yoga' | 'dance';
  kind: SegmentKind | null;
  phase: Phase | null;
  step: PlanStep | null;
  stepIndex: number;
  set: number;
  sets: number;
  side: 'R' | 'L' | null;
  segmentRemainingMs: number;
  segmentTotalMs: number;
  sessionRemainingMs: number;
  sessionTotalMs: number;
  elapsedMs: number;
  /** 1-based index of the current move inside its phase, and how many moves the phase has. */
  moveNumber: number;
  moveCount: number;
  moveLabel: string;
  progress: ProgressSegment[];
  upNext: UpNext | null;
  rung: Rung;
  pausedReason: SessionState['pausedReason'];
}

export function positionAt(s: SessionState, now: number): number {
  if (!s.timeline) return 0;
  const total = totalMs(effectiveSegments(s.timeline, s.extras));
  const raw = s.status === 'active' ? s.positionMs + (now - s.anchorMono) : s.positionMs;
  return Math.max(0, Math.min(raw, total));
}

export function effOf(s: SessionState): EffSeg[] {
  return s.timeline ? effectiveSegments(s.timeline, s.extras) : [];
}

export function deriveView(s: SessionState, now: number): SessionView {
  const plan = s.plan;
  const eff = effOf(s);
  const total = totalMs(eff);
  const pos = positionAt(s, now);
  const loc = locate(eff, pos) ?? (eff.length ? eff[eff.length - 1]! : null);
  const atEnd = pos >= total;
  const seg = loc?.seg ?? null;
  const step = plan && seg ? (plan.steps[seg.stepIndex] ?? null) : null;

  const phase = seg?.phase ?? null;
  const phaseSteps = plan && phase ? plan.steps.filter((x) => x.phase === phase) : [];
  const moveNumber = step ? phaseSteps.findIndex((x) => x.id === step.id) + 1 : 0;
  const moveLabel =
    phase === 'warmup'
      ? `Warm-up ${moveNumber} of ${phaseSteps.length}`
      : phase === 'cooldown'
        ? `Cool-down ${moveNumber} of ${phaseSteps.length}`
        : `Move ${moveNumber} of ${phaseSteps.length}`;

  // Progress groups: warm-up, one per move, cool-down.
  const progress: ProgressSegment[] = [];
  if (plan) {
    const groups: { key: string; phase: Phase; start: number; end: number }[] = [];
    plan.steps.forEach((st, i) => {
      const startMs = eff.find((e) => e.seg.stepIndex === i)?.startMs ?? 0;
      let endMs = startMs;
      for (const e of eff) if (e.seg.stepIndex === i) endMs = e.endMs;
      const last = groups[groups.length - 1];
      if (st.phase !== 'work' && last && last.phase === st.phase) last.end = endMs;
      else groups.push({ key: st.phase === 'work' ? st.id : st.phase, phase: st.phase, start: startMs, end: endMs });
    });
    for (const g of groups) {
      const done = pos >= g.end;
      const current = !done && pos >= g.start;
      progress.push({
        key: g.key,
        phase: g.phase,
        weight: g.end - g.start,
        state: done ? 'done' : current ? 'current' : 'todo',
        fill: done ? 1 : current ? (pos - g.start) / Math.max(1, g.end - g.start) : 0,
      });
    }
  }

  // Up next: the same step's next set if one remains, else the next step.
  let upNext: UpNext | null = null;
  if (plan && seg && step) {
    if (seg.set > 0 && seg.set < step.sets) {
      upNext = {
        name: step.name,
        exerciseId: step.exerciseId,
        set: seg.set + 1,
        sets: step.sets,
        workS: step.workS,
        sameStep: true,
      };
    } else {
      const nx = plan.steps[seg.stepIndex + 1];
      if (nx) {
        upNext = {
          name: nx.name,
          exerciseId: nx.exerciseId,
          set: 1,
          sets: nx.sets,
          workS: nx.workS,
          sameStep: false,
        };
      }
    }
  }

  return {
    status: s.status,
    title: plan?.title ?? '',
    style: plan?.style ?? 'normal',
    kind: seg?.kind ?? null,
    phase,
    step,
    stepIndex: seg?.stepIndex ?? 0,
    set: seg?.set ?? 0,
    sets: step?.sets ?? 0,
    side: seg?.side ?? null,
    segmentRemainingMs: loc && !atEnd ? Math.max(0, loc.endMs - pos) : 0,
    segmentTotalMs: loc ? loc.endMs - loc.startMs : 0,
    sessionRemainingMs: Math.max(0, total - pos),
    sessionTotalMs: total,
    elapsedMs: pos,
    moveNumber,
    moveCount: phaseSteps.length,
    moveLabel,
    progress,
    upNext,
    rung: s.rung,
    pausedReason: s.pausedReason,
  };
}

/** m:ss, rounding up so "0:00" is only shown at the end. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}
