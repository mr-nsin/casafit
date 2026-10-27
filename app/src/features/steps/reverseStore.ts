// Running reverse-walk bout. Elapsed time comes from a monotonic clock read, never from
// counting timer ticks, so backgrounding or a slow render cannot drift it. The start
// is also written to reverse_bout so a killed app still leaves a record.

import { create } from 'zustand';

import { reverseBoutState } from '../../engine';
import { getRepositories } from '../../state/storage';
import { getStepCounter } from '../../services/step-counter';
import { newBoutId } from './ids';

export interface BoutClock {
  /** Monotonic ms. */
  now(): number;
  /** Wall-clock ms. */
  wall(): number;
}

export interface BoutDeps {
  clock: BoutClock;
  keepAwake: { activate(): void; deactivate(): void };
  haptic: () => void;
}

declare const require: (id: string) => any;

const defaults: BoutDeps = {
  clock: {
    now: () => (globalThis as { performance?: { now(): number } }).performance?.now() ?? Date.now(),
    wall: () => Date.now(),
  },
  keepAwake: {
    activate() {
      try {
        void require('expo-keep-awake').activateKeepAwakeAsync('casafit-reverse');
      } catch {
        /* optional */
      }
    },
    deactivate() {
      try {
        void require('expo-keep-awake').deactivateKeepAwake('casafit-reverse');
      } catch {
        /* optional */
      }
    },
  },
  haptic() {
    try {
      void require('expo-haptics').notificationAsync('success');
    } catch {
      /* optional */
    }
  },
};

let deps: BoutDeps = defaults;
export const configureBoutDeps = (d: Partial<BoutDeps>) => {
  deps = { ...deps, ...d };
};

export type StoppedBy = 'user' | 'cap' | 'app';

export interface BoutState {
  status: 'idle' | 'running' | 'finished';
  id: string | null;
  startedMono: number;
  startedWall: number;
  usedBeforeS: number;
  /** Planned length of this bout in seconds (10 minutes, or less when the day is nearly used). */
  targetS: number;
  elapsedS: number;
  steps: number;
  stoppedBy: StoppedBy | null;
  start(opts: { usedBeforeS: number; targetS: number }): Promise<void>;
  tick(): void;
  stop(by: StoppedBy): Promise<void>;
  reset(): void;
}

let unsubscribe: (() => void) | null = null;

export const useBout = create<BoutState>((set, get) => ({
  status: 'idle',
  id: null,
  startedMono: 0,
  startedWall: 0,
  usedBeforeS: 0,
  targetS: 0,
  elapsedS: 0,
  steps: 0,
  stoppedBy: null,
  async start({ usedBeforeS, targetS }) {
    if (get().status === 'running') return;
    const id = newBoutId();
    const startedWall = deps.clock.wall();
    set({ status: 'running', id, startedMono: deps.clock.now(), startedWall, usedBeforeS, targetS, elapsedS: 0, steps: 0, stoppedBy: null });
    deps.keepAwake.activate();
    unsubscribe?.();
    unsubscribe = getStepCounter().subscribeLive((n) => set({ steps: Math.max(get().steps, n) }));
    await getRepositories().steps.startBout({ id, startedAt: startedWall });
  },
  tick() {
    const s = get();
    if (s.status !== 'running') return;
    const elapsedS = Math.max(0, Math.floor((deps.clock.now() - s.startedMono) / 1000));
    if (elapsedS !== s.elapsedS) set({ elapsedS });
    const day = reverseBoutState({ usedBeforeS: s.usedBeforeS, elapsedS });
    if (day.autoStop) void get().stop('cap');
    else if (elapsedS >= s.targetS) void get().stop('app');
  },
  async stop(by) {
    const s = get();
    if (s.status !== 'running' || !s.id) return;
    // Mark finished first so a second tick cannot stop it twice.
    const elapsedS = Math.min(Math.max(0, Math.floor((deps.clock.now() - s.startedMono) / 1000)), s.targetS);
    set({ status: 'finished', elapsedS, stoppedBy: by });
    unsubscribe?.();
    unsubscribe = null;
    deps.keepAwake.deactivate();
    deps.haptic();
    const endedAt = s.startedWall + elapsedS * 1000;
    let steps = s.steps;
    try {
      // Health Connect has no live stream, so also read the bout window; the larger count wins.
      const read = await getStepCounter().readRange({ startMs: s.startedWall, endMs: endedAt });
      steps = Math.max(steps, read.steps);
    } catch {
      /* live count stands */
    }
    set({ steps });
    await getRepositories().steps.endBout(s.id, endedAt, steps, by);
  },
  reset() {
    unsubscribe?.();
    unsubscribe = null;
    set({ status: 'idle', id: null, elapsedS: 0, steps: 0, stoppedBy: null });
  },
}));
