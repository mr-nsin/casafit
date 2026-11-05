// Pose source port. The real source is the Nitro module `casafit-pose` (mediapipe.ts, spike
// docs/plans/spikes/pose.md); it reports available = false when the module is not in the build. A
// dev-only simulated source replays a synthetic set so the whole flow runs on an emulator without it.
// Nothing here writes or sends a frame or landmark.

import type { FormExercise, PoseFrame } from './types';

export interface PoseSource {
  readonly kind: 'native' | 'simulated' | 'unavailable';
  readonly available: boolean;
  /** Why it is unavailable, for logs and tests. Never shown to people. */
  readonly reason?: string;
  /** True when landmarks only flow while a `PoseCamera` is mounted (the native source). */
  readonly needsCamera?: boolean;
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

/**
 * The frame output needs a mounted camera, and the camera is still opt-in (EXPO_PUBLIC_CAMERA_PREVIEW=1)
 * until it is confirmed on a device with RN 0.88. So the native source is chosen only when the module is
 * in the build AND the flag is on. Otherwise a dev build keeps the simulated source and a release build
 * reports unavailable, exactly as before.
 */
export const poseCameraEnabled = (): boolean => process.env.EXPO_PUBLIC_CAMERA_PREVIEW === '1';

export const defaultPoseSourceFactory: PoseSourceFactory = (exercise) => {
  if (nativePoseModulePresent() && poseCameraEnabled()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMediaPipePoseSource } = require('./mediapipe') as typeof import('./mediapipe');
    return createMediaPipePoseSource();
  }
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
