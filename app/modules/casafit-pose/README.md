# casafit-pose

A Nitro module that reads one vision-camera 5 frame and returns 33 pose landmarks (image and world) from MediaPipe Pose Landmarker Lite. Spike: `docs/plans/spikes/pose.md`.

| Part | Where | Status |
|---|---|---|
| Spec | `src/CasafitPose.nitro.ts` | `detect(frame, orientation, isMirrored)` returns a packed Float32 buffer of 264 values (33 x x,y,z,visibility, then 33 world) or undefined |
| Generated glue | `nitrogen/generated/**` | generated with nitrogen 0.37.1 (`npx nitrogen` in this folder); regenerate after any spec change |
| Android | `android/` (Kotlin, `com.google.mediapipe:tasks-vision:1.1.1`) | compiles; not run on a device |
| iOS | `ios/`, `CasafitPose.podspec` | written to the same spec, never built (no Mac) |
| Model | `assets/pose_landmarker_lite.task`, pin in `pose_landmarker_lite.task.sha256`, notes in `MODEL.md` | bundled; Gradle refuses to build if the hash differs |

The JS side is `app/src/services/pose/mediapipe.ts` (source, bridge, unpacking) and `PoseCamera.tsx` (camera and frame output).

Rules for anything in this folder: no file, bitmap-to-disk, network or logging of pixels or landmarks. `app/src/services/pose/privacy.test.ts` greps for the forbidden tokens.

Layout of the returned buffer: float index `landmark * 4 + {0: x, 1: y, 2: z, 3: visibility}` for the first 132 values, then the same for world landmarks (metres, hip origin). x and y are on the upright, unmirrored image, 0..1, y down.
