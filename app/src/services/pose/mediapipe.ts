// Real pose source: MediaPipe Pose Landmarker through the in-repo Nitro module `casafit-pose`
// (app/modules/casafit-pose, spike docs/plans/spikes/pose.md). Frames come from a vision-camera 5
// frame output (see PoseCamera.tsx); this file holds everything that can run under Jest.
//
// Privacy: a frame never reaches this file. The native `detect()` reads and releases it, and only
// 33 landmarks (numbers) come back. Nothing here stores, logs or sends them. `stop()` and `reset`
// drop the sink so no landmark outlives a check.

import type { CasafitPose } from 'casafit-pose';
import type { PoseSource } from './source';
import type { Landmark, PoseFrame, WorldLandmark } from './types';

export const POSE_LANDMARKS = 33;
/** x, y, z, visibility */
const FLOATS_PER_LANDMARK = 4;
/** 33 image landmarks then 33 world landmarks. Must match the native `pack()` (Kotlin and Swift). */
export const POSE_BUFFER_FLOATS = POSE_LANDMARKS * FLOATS_PER_LANDMARK * 2;

/** Detector settings. The spike starts at 0.5 on every threshold and a 15 Hz cap. */
export const POSE_DETECTOR_CONFIG = { minDetect: 0.5, minPresence: 0.5, minTrack: 0.5, maxHz: 15 } as const;

export type FrameOrientation = 'up' | 'right' | 'down' | 'left';

export interface PoseFrameInfo {
  /** Buffer size before rotation. */
  width: number;
  height: number;
  orientation: FrameOrientation;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Turns the packed native buffer into a PoseFrame. Returns null for anything that is not a full,
 * finite 33-landmark result (wrong length, NaN or Infinity), so a bad frame is dropped rather than fed
 * to the engine as a pose.
 */
export function unpackLandmarks(values: ArrayLike<number> | null | undefined, t: number, info?: PoseFrameInfo): PoseFrame | null {
  if (!values || values.length !== POSE_BUFFER_FLOATS || !Number.isFinite(t)) return null;
  for (let i = 0; i < POSE_BUFFER_FLOATS; i++) {
    if (!Number.isFinite(values[i]!)) return null;
  }
  const lm: Landmark[] = [];
  const world: WorldLandmark[] = [];
  const worldBase = POSE_LANDMARKS * FLOATS_PER_LANDMARK;
  for (let i = 0; i < POSE_LANDMARKS; i++) {
    const o = i * FLOATS_PER_LANDMARK;
    lm.push({ x: values[o]!, y: values[o + 1]!, v: clamp01(values[o + 3]!) });
    const w = worldBase + o;
    world.push({ x: values[w]!, y: values[w + 1]!, z: values[w + 2]!, v: clamp01(values[w + 3]!) });
  }
  const frame: PoseFrame = { t, lm, world };
  if (info && info.width > 0 && info.height > 0) {
    // The landmarks are on the upright image, so a sideways buffer swaps its sides.
    const sideways = info.orientation === 'left' || info.orientation === 'right';
    frame.w = sideways ? info.height : info.width;
    frame.h = sideways ? info.width : info.height;
  }
  return frame;
}

/** Hands landmark frames from the camera's frame output to whichever source is running. */
export interface PoseBridge {
  readonly attached: boolean;
  attach(sink: (frame: PoseFrame) => void): void;
  detach(): void;
  /** Called on the JS thread by the camera component. Drops the frame when nobody listens or it is invalid. */
  deliver(values: ArrayLike<number> | null | undefined, info?: PoseFrameInfo): boolean;
}

export function createPoseBridge(now: () => number = defaultNow): PoseBridge {
  let sink: ((frame: PoseFrame) => void) | null = null;
  return {
    get attached() {
      return sink !== null;
    },
    attach(s) {
      sink = s;
    },
    detach() {
      sink = null;
    },
    deliver(values, info) {
      const target = sink;
      if (!target) return false;
      // Engine time is the delivery time on the JS thread in ms: the platforms stamp frames in
      // different units (nanoseconds on Android), and at 10 to 15 Hz the jitter does not matter.
      const frame = unpackLandmarks(values, now(), info);
      if (!frame) return false;
      target(frame);
      return true;
    },
  };
}

function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/** The one bridge the camera component and the default source share. */
export const poseBridge: PoseBridge = createPoseBridge();

type NativePose = Pick<CasafitPose, 'open' | 'close'>;

let nativeInstance: CasafitPose | null | undefined;

/** The shared hybrid object, or null when this build has no native module. Created once. */
export function getNativePose(): CasafitPose | null {
  if (nativeInstance !== undefined) return nativeInstance;
  try {
    // Lazy: importing nitro-modules without the native build throws.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NitroModules } = require('react-native-nitro-modules') as typeof import('react-native-nitro-modules');
    nativeInstance = NitroModules.hasHybridObject('CasafitPose') ? NitroModules.createHybridObject<CasafitPose>('CasafitPose') : null;
  } catch {
    nativeInstance = null;
  }
  return nativeInstance;
}

/** Test seam. */
export function resetNativePoseForTests(value?: CasafitPose | null): void {
  nativeInstance = value;
}

export interface MediaPipeOptions {
  native?: NativePose | null;
  bridge?: PoseBridge;
}

/**
 * The PoseSource over the native module. `available` is false when the module is not in this build
 * (Jest, release builds without it), and `start` then does nothing. Landmarks only flow while a
 * `PoseCamera` is mounted, because the frames come from its frame output.
 */
export function createMediaPipePoseSource(opts: MediaPipeOptions = {}): PoseSource {
  const native = opts.native === undefined ? getNativePose() : opts.native;
  const bridge = opts.bridge ?? poseBridge;
  if (!native) {
    return { kind: 'unavailable', available: false, reason: 'native_module_missing', start() {}, stop() {} };
  }
  let running = false;
  return {
    kind: 'native',
    available: true,
    needsCamera: true,
    start(onLandmarks) {
      if (running) return;
      try {
        native.open(POSE_DETECTOR_CONFIG.minDetect, POSE_DETECTOR_CONFIG.minPresence, POSE_DETECTOR_CONFIG.minTrack, POSE_DETECTOR_CONFIG.maxHz);
      } catch {
        // The model could not load. Stay quiet: no landmarks means no count and no spend.
        return;
      }
      running = true;
      bridge.attach(onLandmarks);
    },
    stop() {
      if (!running) return;
      bridge.detach();
      running = false;
      try {
        native.close();
      } catch {
        /* a detector that fails to close must not block leaving the screen */
      }
    },
  };
}
