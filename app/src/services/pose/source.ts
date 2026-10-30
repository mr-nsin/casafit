// Pose source port. The native Nitro module `casafit-pose` (docs/plans/spikes/pose.md section 5) is a
// separate day-1 spike and is not built yet, so the real source reports available = false. A
// dev-only simulated source replays a synthetic set so the whole flow runs on an emulator.
// Nothing here writes or sends a frame or landmark.

import type { FormExercise, PoseFrame } from './types';

export interface PoseSource {
  readonly kind: 'native' | 'simulated' | 'unavailable';
  readonly available: boolean;
  /** Why it is unavailable, for logs and tests. Never shown to people. */
  readonly reason?: string;
  start(onLandmarks: (frame: PoseFrame) => void): void;
  stop(): void;
}

export function createUnavailableSource(reason: string): PoseSource {
  return { kind: 'unavailable', available: false, reason, start() {}, stop() {} };
}

/** True when the Nitro hybrid object `CasafitPose` is registered in this build. */
export function nativePoseModulePresent(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NitroModules } = require('react-native-nitro-modules') as { NitroModules: { hasHybridObject(name: string): boolean } };
    return NitroModules.hasHybridObject('CasafitPose');
  } catch {
    return false;
  }
}

export interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

/** Replays a clean synthetic set in real time (or faster with `speed`). Dev builds only. */
export function createSimulatedSource(exercise: FormExercise, opts: { speed?: number; timers?: Timers } = {}): PoseSource {
  const timers: Timers = opts.timers ?? { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: (h) => clearInterval(h as never) };
  let handle: unknown = null;
  return {
    kind: 'simulated',
    available: true,
    start(onLandmarks) {
      if (handle !== null) return;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const frames = (require('./synthetic') as typeof import('./synthetic')).demoSequence(exercise);
      const speed = opts.speed ?? 1;
      const base = frames[0]!.t;
      const startedAt = Date.now();
      let i = 0;
      handle = timers.setInterval(() => {
        // Deliver every frame whose time has come, so a slow timer does not stretch the set.
        const now = (Date.now() - startedAt) * speed;
        while (i < frames.length && frames[i]!.t - base <= now) onLandmarks(frames[i++]!);
        if (i >= frames.length && handle !== null) {
          timers.clearInterval(handle);
          handle = null;
        }
      }, 1000 / 15 / Math.max(1, speed));
    },
    stop() {
      if (handle !== null) timers.clearInterval(handle);
      handle = null;
    },
  };
}

export type PoseSourceFactory = (exercise: FormExercise) => PoseSource;

export const defaultPoseSourceFactory: PoseSourceFactory = (exercise) => {
  // The frame-output glue to the native module is part of the casafit-pose spike. Until it is
  // wired, a present module is still reported as not ready rather than half working.
  if (nativePoseModulePresent()) return createUnavailableSource('native_module_not_wired');
  if (__DEV__) return createSimulatedSource(exercise);
  return createUnavailableSource('native_module_missing');
};

let factory: PoseSourceFactory = defaultPoseSourceFactory;
export const getPoseSource: PoseSourceFactory = (e) => factory(e);
export function setPoseSourceFactory(f: PoseSourceFactory | null): void {
  factory = f ?? defaultPoseSourceFactory;
}

/** Whether a check can run on this build, without starting anything. */
export function poseAvailable(exercise: FormExercise = 'squat'): boolean {
  return getPoseSource(exercise).available;
}
