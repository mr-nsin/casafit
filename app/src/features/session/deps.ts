// Dependency container for the session lane. The app shell calls configureSessionDeps once
// with the real engine, db and services; Jest passes fakes. Defaults are inert so that a
// screen never crashes before configuration.

import { createCueService } from '../../services/audio-cues';
import type { SessionDeps, Timeline, TimelineSegment, PlanStep } from './types';

export const systemClock = {
  now(): number {
    const p = (globalThis as { performance?: { now(): number } }).performance;
    return p ? p.now() : Date.now();
  },
  wall(): number {
    return Date.now();
  },
};

/**
 * Fallback only: same D1 arithmetic as the engine's buildTimeline (transition, then
 * work + rest per set). The app shell should pass the engine's real buildTimeline.
 */
export function fallbackBuildTimeline(
  plan: { steps: PlanStep[] },
  opts: { rungBySet?: Readonly<Record<string, -1 | 0 | 1>> } = {},
): Timeline {
  void opts;
  const segments: TimelineSegment[] = [];
  let t = 0;
  let warmupS = 0;
  let workS = 0;
  let cooldownS = 0;
  const push = (
    kind: TimelineSegment['kind'],
    step: PlanStep,
    stepIndex: number,
    set: number,
    side: 'R' | 'L' | null,
    d: number,
  ) => {
    if (d <= 0) return;
    segments.push({
      index: segments.length,
      kind,
      phase: step.phase,
      stepIndex,
      stepId: step.id,
      set,
      side,
      startS: t,
      durationS: d,
      endS: t + d,
    });
    t += d;
    if (step.phase === 'warmup') warmupS += d;
    else if (step.phase === 'work') workS += d;
    else cooldownS += d;
  };
  plan.steps.forEach((step, i) => {
    push('transition', step, i, 0, null, step.transitionS);
    for (let set = 1; set <= step.sets; set += 1) {
      const side = step.sides === 'each' ? (set === 1 ? 'R' : 'L') : null;
      push('work', step, i, set, side, step.workS);
      push('rest', step, i, set, side, step.restS);
    }
  });
  return { segments, totalS: t, warmupS, workS, cooldownS };
}

const noopCues = createCueService({
  audio: { play() {}, stop() {} },
  haptics: { fire() {} },
  resolveClip: () => null,
});

let deps: SessionDeps = {
  clock: systemClock,
  buildTimeline: fallbackBuildTimeline,
  cues: noopCues,
  keepAwake: { activate() {}, deactivate() {} },
  snapshot: {
    async save() {},
    async load() {
      return null;
    },
    async clear() {},
  },
  sessionLog: {
    async insert() {
      return true;
    },
  },
  micro: {
    async insert() {
      return true;
    },
  },
  prefs: {
    async load() {
      return {};
    },
    async save() {},
  },
  content: { exercise: () => null },
  newId: () => `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
};

export function configureSessionDeps(partial: Partial<SessionDeps>): void {
  deps = { ...deps, ...partial };
}

export function getSessionDeps(): SessionDeps {
  return deps;
}
