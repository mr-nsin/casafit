// Nitro spec for `casafit-pose`. Run `npm run specs` (nitrogen) in this folder after changing it.
//
// Privacy contract (docs/plans/spikes/pose.md section 6): the frame is read and released inside
// `detect()`. This module has no file, network or logging API, and the generated code adds none.
import type { HybridObject } from 'react-native-nitro-modules';
import type { CameraOrientation, Frame } from 'react-native-vision-camera';

export interface CasafitPose extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Loads the bundled Pose Landmarker Lite model. Throws when the model asset is missing.
   * Calling it again replaces the previous detector. `maxHz` caps inferences per second.
   */
  open(minDetect: number, minPresence: number, minTrack: number, maxHz: number): void;

  /**
   * Runs the landmarker on one camera frame and returns a packed little-endian Float32 buffer:
   * 33 image landmarks of (x, y, z, visibility), then 33 world landmarks of (x, y, z, visibility),
   * 264 floats in all. x and y are normalised 0..1 on the upright image (rotation from `orientation`
   * applied, y down); world values are metres from the hip centre. Returns undefined when throttled,
   * when no person is found, or when the detector is not open. Never keeps the frame: the caller
   * disposes it.
   */
  detect(frame: Frame, orientation: CameraOrientation, isMirrored: boolean): ArrayBuffer | undefined;

  /** Releases the detector and every native buffer. Safe to call twice. */
  close(): void;
}
