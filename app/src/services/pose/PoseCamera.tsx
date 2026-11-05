// Camera preview plus the frame output that feeds the native pose landmarker.
//
// Only preview and frame outputs: no photo, video or audio output (the privacy lint in
// privacy.test.ts fails on `usePhotoOutput`, `useVideoOutput` or a recorder). In the frame callback
// the frame goes to native `detect()` and is disposed in `finally`, always, or the pipeline stalls.
// Only 264 numbers come back to the JS thread.
//
// This file imports vision-camera and worklets statically, which needs their native builds. Never
// import it from a module that Jest or a build without them loads: require it lazily, and only when
// `nativePoseModulePresent()` (see CameraSurface in features/formcheck/components.tsx).

import { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { getNativePose, poseBridge, type FrameOrientation } from './mediapipe';

export function PoseCamera({ device = 'back' }: { device?: 'back' | 'front' }) {
  // The shared hybrid object. Nitro makes it usable inside the frame worklet.
  const pose = useMemo(() => getNativePose(), []);

  // Runs on the JS thread. Frames are dropped here unless a source is listening.
  const deliver = useCallback((values: number[], width: number, height: number, orientation: FrameOrientation) => {
    poseBridge.deliver(values, { width, height, orientation });
  }, []);

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      try {
        if (pose == null) return;
        const raw = pose.detect(frame, frame.orientation, frame.isMirrored);
        if (raw != null) {
          // Plain numbers cross to the JS thread; the buffer itself stays here.
          scheduleOnRN(deliver, Array.from(new Float32Array(raw)), frame.width, frame.height, frame.orientation);
        }
      } catch {
        // A bad frame is a missed sample, never a crash.
      } finally {
        frame.dispose();
      }
    },
    [pose, deliver],
  );

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    targetResolution: { width: 640, height: 480 },
    dropFramesWhileBusy: true,
    // Rotation is passed to MediaPipe instead; a physical rotation costs a pass over every frame.
    enablePhysicalBufferRotation: false,
    onFrame,
  });

  return <Camera style={StyleSheet.absoluteFill} device={device} isActive outputs={[frameOutput]} />;
}
