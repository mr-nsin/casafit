# Spike: on-device pose estimation for form check

Written 26 Oct 2026. Feeds lane L3 (`docs/plans/implementation.md`). Context read: `screens/camera-pro-nutrition.md` Part A, `architecture.md`, `tech-stack.md` §1 and §5. Nothing was built or run on a device; every FPS figure is either a third-party claim or an estimate and says so. "Unverified" means I could not confirm it from a primary source.

## 0. Answer in five lines
- **No maintained MediaPipe frame-processor plugin exists for vision-camera 5.** The v4-era ones (`react-native-mediapipe`, `expo-vision-camera-v4-mediapipe`, `vision-camera-pose-landmarks-plugin`, `react-native-mediapipe-posedetection`) target v4 and `react-native-worklets-core`. v5 uses Nitro and `react-native-worklets`. The `tech-stack.md` line "vision-camera 4 + MediaPipe plugin" is stale.
- **Recommendation:** write a thin in-repo Nitro module `casafit-pose` that takes a v5 `Frame` and runs MediaPipe Pose Landmarker (Lite, 5.8 MB, bundled) on both platforms. Same model, same 33 landmarks, same thresholds on both. Roughly 300 lines of Kotlin plus 300 of Swift.
- **Fallback:** `react-native-nitro-pose-exercises` (v5-native, Apple Vision on iOS, ML Kit on Android, no model file), used only as a landmark source. Second fallback: our own Apple Vision Expo or Nitro module on iOS plus ML Kit on Android.
- **Landmark maths lives in pure TypeScript** (no worklet, no native), so it is unit-testable from recorded fixtures. Section 3 gives starting numbers.
- **Biggest risk:** the native Nitro glue (v5 `Frame` to MediaPipe image on Android and iOS), not the maths. That is the day-1 gate.

## 1. Environment facts (checked on npm and Google Maven, 26 Oct 2026)
| Item | Value | Source |
|---|---|---|
| Expo SDK | `expo@58.0.19` (published 23 Oct 2026). `sdk-57` tag is 57.0.31 | npm |
| React Native | 0.88.0 (15 Oct 2026) | npm |
| react-native-vision-camera | 5.2.3 (20 Aug 2026), MIT, peers `react-native-nitro-modules`, `react-native-nitro-image` | npm |
| Frame processors in v5 | Separate packages `react-native-vision-camera-worklets` 5.2.3 and `react-native-worklets` (0.13.1 supports RN 0.86 to 0.88) | npm |
| v5 has no Expo config plugin | The 5.2.3 tarball has no `app.plugin.js`. Docs say set permissions in app config and run `expo prebuild` | tarball, docs |
| v4 status | "No longer actively maintained, code archived" | VC GitHub README |
| fast-tflite | 3.0.1 (21 Apr 2026). README: the **v5 integration is in a private repo, sponsors only** | npm README |
| MediaPipe Tasks Android | `com.google.mediapipe:tasks-vision:1.1.1` on Google Maven | maven metadata |
| MediaPipe Tasks iOS | CocoaPod `MediaPipeTasksVision`, current version unverified | not fetched |
| ML Kit pose (Android) | `com.google.mlkit:pose-detection:18.0.0-beta5`, still beta; page last updated 2024-07-10: "no SLA or deprecation policy" | Google Maven, ML Kit docs |

v5 `useFrameOutput` options seen in the 5.2.3 source: `pixelFormat` (`'yuv' | 'rgb' | 'native'`), `targetResolution`, `dropFramesWhileBusy` (default true), `enablePhysicalBufferRotation`, `enableCameraMatrixDelivery`, `onFrameDropped`. `Frame` exposes `width`, `height`, `orientation`, `isMirrored`, `timestamp`, `pixelFormat`, `getPixelBuffer()`, `getNativeBuffer()`, `getPlanes()`, `dispose()`. A frame that is not disposed stalls the pipeline.

## 2. Options compared
| Option | Maintained? | VC 5 + New Arch | Expo story | Android / iOS parity | Model, licence | FPS (mid Android / iPhone) |
|---|---|---|---|---|---|---|
| **A. MediaPipe Pose Landmarker via our Nitro module** | Model and SDK: Google, actively updated (docs updated 9 Oct 2026). Glue: us | Yes by construction: Nitro modules take `Frame` directly, same pattern as official `-barcode-scanner` and `-resizer` | Local Nitro module + `expo-build-properties` + dev client. No plugin needed for permissions | **Identical**: one model, 33 landmarks, `visibility`/`presence`, world landmarks in metres | Lite 5.78 MB, Full 9.40 MB, Heavy 30.7 MB (HTTP content-length, files dated Apr 2023). Doc content CC BY 4.0, samples Apache 2.0. Check the model-card licence text before release (unverified) | Estimate 8 to 15 inferences/s Lite on CPU, Snapdragon 6-series; 20 to 30 on iPhone 12+. Third-party: Lite 103 ms/pose on a Helio P90 (2019) and 26 ms on iPhone 11 Pro (§5 table) |
| **B. `react-native-nitro-pose-exercises` 1.1.19** (Jul 2026, MIT, ~10 stars, one maintainer) | Thin. Created May 2026 | Yes, v5 + Nitro + `useFrameOutput` + `useAsyncRunner` | npm only, no model file. Needs `react-native-vision-camera-resizer` and Reanimated peers | **Not identical**: Android = ML Kit (33 pts), iOS = Apple Vision 19 joints, missing indices filled with `visibility: 0` (no heel or foot index). Exposes raw `landmarks` | OS-native, ~200 KB. Ships its own rep engine (we would ignore it) | Not benchmarked by the author. ML Kit official: ~30 fps Pixel 4, ~45 fps iPhone X (base model) |
| **C. `@rbayuokt/expo-body-vision` 0.1.1** (1 Oct 2026, MIT, 12 commits, 10 stars) | Brand new, one author | **Does not use vision-camera**: own CameraX and AVFoundation camera. Tested on Expo SDK 55 / RN 0.83 | Expo module + config plugin, dev build | MediaPipe on iOS, ML Kit default on Android | 16 MB package. MediaPipe Lite and Full bundled | Own benchmark (charging, warm): Helio P90: ML Kit 60 to 77 ms, MediaPipe Lite 103 ms. iPhone 11 Pro: 20 to 26 ms |
| **D. `react-native-fast-tflite` + MoveNet/BlazePose** | Library yes (3.0.1) | v5 sample is private. Public sample is v4. 17-point MoveNet has no heel or toe | Config: add `tflite` to `assetExts`; GPU delegates optional | Same `.tflite` both sides | MoveNet Lightning ~3 MB (unverified), Apache 2.0 | MoveNet is fast, but we must write letterbox, resize and decode ourselves. No pose tracker, so more jitter |
| **E. ML Kit via `react-native-vision-camera-mlkit` 2.0.1** | Yes (20 Aug 2026), v5 | Yes | Has an Expo config plugin | n/a | **No pose.** v2 ships OCR and barcode only. Pose is "post-v2 roadmap" | n/a |
| **F. Apple Vision body pose via own Expo module** | Apple | Own glue | Swift module | iOS only; 19 joints (from memory, unverified against Apple docs); the 3D request is iOS 17+ | System, no download, no size | 25 ms/pose iPhone 11 Pro (third-party) |
| **G. v4-era MediaPipe RN plugins** | Last release: `react-native-mediapipe` 0.6.0 Dec 2024; `-posedetection` 0.4.0 Jan 2026 (README says VC ^4); `vision-camera-pose-landmarks-plugin` 0.1.0 Nov 2025 | **No** (needs `worklets-core`, v4 frame API) | n/a | n/a | n/a | n/a |

Why A over B: `tech-stack.md` and `architecture.md` already commit to MediaPipe on both platforms. With B the two platforms report different joints and confidences, so thresholds would need two tunings and a lunge or plank on iOS has no heel or toe data. A costs about 2 engineer-days of native work (this spike).

Privacy note on ML Kit and MediaPipe telemetry: the web package `@mediapipe/tasks-vision` links a privacy notice. Whether the native Tasks libraries send usage metrics is **unverified**. The go/no-go includes a network capture during a session.

## 3. Install and config (Expo SDK 58, dev client, EAS)
```bash
npx expo install react-native-vision-camera react-native-nitro-modules react-native-nitro-image \
  react-native-vision-camera-worklets react-native-worklets expo-build-properties expo-dev-client
# our module (local, Nitro): modules/casafit-pose  (npx nitrogen generates the specs)
# no react-native-vision-camera-skia: overlay is drawn from the landmark stream with react-native-svg
```
- Babel: `react-native-worklets/plugin` must be the last plugin if `babel-preset-expo` does not add it (unverified for SDK 58; check `npx expo-doctor`).
- `app.json`:
```json
{ "expo": { "newArchEnabled": true,
  "ios": { "infoPlist": { "NSCameraUsageDescription": "CasaFit checks your form on the phone. Nothing is recorded or saved." } },
  "android": { "permissions": ["CAMERA"], "blockedPermissions": ["android.permission.RECORD_AUDIO"] },
  "plugins": [["expo-build-properties", { "ios": { "deploymentTarget": "15.1" }, "android": { "minSdkVersion": 26 } }], "expo-dev-client"] } }
```
- **Model asset:** download `pose_landmarker_lite.task` (`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/...`), pin its SHA-256 in the repo, put it in `modules/casafit-pose/assets/`.
  - Android: `sourceSets.main.assets.srcDirs += 'assets'` in the module's `build.gradle`, then `BaseOptions.setModelAssetPath("pose_landmarker_lite.task")`. No network, no downloader.
  - iOS: podspec `s.resources = ['assets/*.task']`, load with `Bundle(for:).path(forResource:)`.
- Native deps: Android `implementation "com.google.mediapipe:tasks-vision:1.1.1"`; iOS pod `MediaPipeTasksVision` (pin the version found on day 1; static frameworks and the RN 0.88 prebuilt-deps setting may conflict, which is the known iOS risk in `tech-stack.md` §5).
- Orientation and mirror: pass `frame.orientation` and `frame.isMirrored` to the native `detect()` (MediaPipe takes a rotation) so `enablePhysicalBufferRotation` stays false (it costs a pass over every frame). Landmarks are returned upright in the user's own left and right. The overlay mirrors itself for a front camera.

## 4. Landmark maths (starting values; all need tuning on real footage)
MediaPipe indices: 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 foot index (left/right).

**Common**
| Topic | Rule |
|---|---|
| Coordinates | 2D angles from image landmarks, scaled by frame aspect (x*w, y*h), never raw normalised. Prefer **world landmarks** (metres, hip origin) for 3D angles when `v` is high: less perspective error from an off-axis phone. Fall back to image landmarks. |
| Side choice | Side-on shots: use the side with the higher mean visibility of (shoulder, hip, knee, ankle), re-evaluated every 2 s with 0.1 hysteresis so it does not flip mid-rep. |
| Confidence | A landmark is usable when `visibility >= 0.5` (soft floor 0.35 for feet). A frame is **valid** when all required landmarks for the exercise are usable. Required: squat/lunge shoulder, hip, knee, ankle (one side); push-up/plank shoulder, elbow, wrist, hip, ankle (one side). |
| Occlusion | Invalid frame: freeze the state machine (do not interpolate). Invalid for >1.0 s: show "lost framing" banner, discard any in-flight rep as `unscored` (neither ok nor not ok, not counted). Invalid for >5 s: pause counting until 10 valid frames in a row. Low confidence: **no cue** (spec says stay quiet). |
| Framing | Torso length (mid-shoulder to mid-hip) under 12% of frame height: "step closer". Any required landmark within 2% of an edge: "step back". Check before Start (free preview) and keep checking during. |
| Smoothing | One Euro filter per landmark coordinate (`minCutoff` 1.0 Hz, `beta` 0.05, `dCutoff` 1.0) at the actual sample rate, then a median-of-3 on each derived angle. Run the engine on `frame.timestamp`, not on `Date.now()`. Expect 10 to 15 Hz input: do not assume 30. |
| Rating | `good` if clean/analysed >= 0.8, `okay` >= 0.5, else `needs_work`. A rep is `ok` only if no rule fired on it. Findings warn if the rule fired on >= 30% of reps. Never shaming copy: findings text comes from the content writer, not from here. |
| Count point | Spec: Counted at rep 3 (or hold 10 s). The engine emits `repCounted(n)`; the feature controller owns Armed to Counted and the consume call. |

**Squat** (side view)
| Item | Value |
|---|---|
| Primary angle | knee = angle(hip, knee, ankle), working side |
| States | `up` when knee > 160. `down` entered at knee < 105. Rep counted on return to > 158 (hysteresis 105/158) |
| depth | ok if min knee <= 100 (thighs at about parallel). warn if min knee in (100, 115]: "a little deeper"; fail >115 counts as a shallow rep: still counted if it reached <115, flagged `depth` |
| back | trunk lean = angle of (mid-shoulder minus mid-hip) from vertical, at the bottom frame. ok <= 50 degrees. fail > 60 |
| hips | hip-below-knee check: hip.y minus knee.y (in torso lengths) >= -0.05 at bottom is "parallel reached"; also catches heel lift via hip x moving behind ankle by >0.4 femur lengths: `hips` |
| knees | side view: knee ahead of foot index by > 0.35 shin length at bottom while heel (29/30) rises >0.04 torso: `knees` (info level). Valgus needs a front view: ratio knee-to-knee / ankle-to-ankle < 0.8 at bottom. **Open question**: ship valgus in v1 or leave to a 3/4 view? Needs a coach's input (content-accuracy risk in plan §6) |
| Placement | Phone portrait on the floor or a shelf at hip height, 2 to 2.5 m away, side-on (body at 90 degrees to the lens), whole body incl. feet in frame, even light, plain background, fitted clothes |

**Push-up** (side view, floor)
| Item | Value |
|---|---|
| Posture gate | line shoulder to ankle within 30 degrees of horizontal, else "get in position" (and no counting) |
| Primary angle | elbow = angle(shoulder, elbow, wrist). `up` > 155. `down` entered < 100. Count on return > 155 |
| elbows (range) | ok if min elbow <= 95. warn (95, 115]: "lower a little more". Not reaching 115 is a half rep: flag, still counted |
| hips (body line) | body = angle(shoulder, hip, ankle). ok >= 160. fail < 150. Sign from hip height relative to the shoulder-ankle line: below = sag, above = pike |
| Placement | Phone on the floor, landscape, side-on, 1.5 to 2 m away, head to heels in frame. Wrist and elbow must not be hidden behind the body: the camera-side arm is the working side |

**Plank** (hold, side view)
| Item | Value |
|---|---|
| In-plank | body line angle(shoulder, hip, ankle) between 160 and 195 (use unsigned deviation <= 20 degrees) and shoulder to ankle within 25 degrees of horizontal |
| Hold timer | accumulates `dt` while in-plank. A break shorter than 0.7 s (blur, flicker) is bridged. A longer break ends the segment. Counted at 10.0 s continuous accumulated |
| Rating | share of held time in-plank: good >= 85%, okay >= 60% |
| hips | sag if deviation > 20 degrees and hip below the line; pike if above. Add a 1 s warn latch so a single glitch is not a finding |
| elbows | forearm plank: |shoulder.x minus elbow.x| <= 0.15 torso lengths (shoulder over elbow); else warn |
| Mapping to `FormCheckResult` | There is no `holdSeconds` field. Proposal: add optional `holdSeconds: number` and make `perRep` one entry per 5 s block (ok if >= 80% in-plank). **Decision for architect/PM**, not made here |
| Placement | Same as push-up. Needs stillness: hip speed < 0.05 torso/s counts as steady |

**Lunge** (side view, alternating or split)
| Item | Value |
|---|---|
| Front leg | at the deepest frame, the ankle further in the facing direction (facing from nose.x vs hip.x). Count the rep for whichever leg is front; alternating legs count as separate reps |
| Primary angle | front knee = angle(hip, knee, ankle). `up` > 160 (standing). `down` entered < 105. Count on return > 158 |
| depth | ok if front knee <= 100 and rear knee <= 115 (rear knee near the floor). warn above |
| knees | front knee ahead of front foot index by > 0.3 shin length: `knees` warn; front shin lean from vertical > 25 degrees: same finding |
| back | trunk lean from vertical > 25 degrees at bottom: `back` (lunge wants an upright torso) |
| hips | hips not level on the way down is invisible from the side: omit in v1. `hips` only if rear hip rises above front hip at the bottom by > 0.1 torso |
| Placement | As squat, but 2.5 m, enough room for one step forward and back |

Finding mapping to `FormCheckResult.findings`: five areas (`depth`, `knees`, `back`, `hips`, `elbows`); exercises that do not use an area simply omit it (squat has no `elbows`, push-up has no `knees`). Pain-flag gating (plan flag A4) is outside the engine.

## 5. Code sketches
**Native spec** (Nitro; module `casafit-pose`). One flat array out, no per-frame object graphs:
```ts
// modules/casafit-pose/src/CasafitPose.nitro.ts
import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'
export interface CasafitPose extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  open(minDetect: number, minPresence: number, minTrack: number, maxHz: number): void
  /** Returns 33*4 image floats (x,y,z,visibility) then 33*4 world floats, or undefined when throttled/no pose. */
  detect(frame: Frame): Float32Array | undefined
  close(): void
}
```
Native `detect`: throttle to `maxHz` by `frame.timestamp`, build the MediaPipe image from the frame buffer (Android `MediaImageBuilder` or bitmap; iOS `MPImage(pixelBuffer:)`; exact accessor from `getNativeBuffer()`/`getPixelBuffer()` is **unverified** and is the day-1 task), call `detectForVideo(image, timestampMs)` with the rotation from `frame.orientation`, return the array, release the buffer. No file API anywhere in this module.

**JS side** (`app/src/services/pose-runner/usePoseRunner.ts`):
```ts
const pose = NitroModules.createHybridObject<CasafitPose>('CasafitPose')
export function usePoseRunner(exercise: FormExercise, onEvent: (e: EngineEvent) => void) {
  const engine = useMemo(() => new RepEngine(CONFIG[exercise]), [exercise])
  const push = useCallback((buf: Float32Array, t: number) => {
    for (const e of engine.push(unpack(buf, t))) onEvent(e)       // runs on the JS thread, ~0.2 ms
  }, [engine, onEvent])
  useEffect(() => { pose.open(0.5, 0.5, 0.5, 15); return () => { pose.close(); engine.reset() } }, [])
  const output = useFrameOutput({
    pixelFormat: 'yuv', dropFramesWhileBusy: true, enablePhysicalBufferRotation: false,
    targetResolution: { width: 640, height: 480 },
    onFrame(frame) {
      'worklet'
      try {
        const raw = pose.detect(frame)                            // sync native call, frame never leaves native
        if (raw) scheduleOnRN(push, raw, frame.timestamp)         // name from react-native-worklets; verify
      } finally { frame.dispose() }                               // always, or the pipeline stalls
    },
  })
  return output                                                   // <Camera outputs={[preview, output]} />
}
```
**Engine and state machine** (pure TS, no worklet imports, so Jest can run it):
```ts
export type EngineEvent =
  | { k: 'framing'; ok: boolean; hint?: 'closer' | 'back' | 'lost' }
  | { k: 'rep'; index: number; ok: boolean; issue?: Issue }       // Issue = FormCheckResult['perRep'][0]['issue']
  | { k: 'counted' }                                              // rep 3 or hold 10 s: controller moves attempt armed -> counted
  | { k: 'hold'; ms: number }
export class RepEngine {
  private phase: 'arming' | 'up' | 'down' = 'arming'; private minA = 180; private t0 = 0; private flags = new Set<Issue>()
  constructor(private cfg: Cfg) {}
  push(f: PoseFrame): EngineEvent[] {
    const lm = this.smooth(f)                                     // One Euro per coordinate
    if (!this.valid(lm)) return this.onInvalid(f.t)               // freeze, count invalid time, maybe emit framing
    const a = this.angle(lm)                                      // median-of-3 of the primary angle
    const out: EngineEvent[] = []
    switch (this.phase) {
      case 'arming': if (this.heldAbove(a, this.cfg.upExit, 300, f.t)) this.phase = 'up'; break
      case 'up': if (a < this.cfg.downEnter) { this.phase = 'down'; this.t0 = f.t; this.minA = a; this.flags.clear() } break
      case 'down':
        this.minA = Math.min(this.minA, a); this.checkRules(lm, this.flags)    // depth/back/knees/hips/elbows at the extreme
        if (a > this.cfg.upExit) {
          const dt = f.t - this.t0; this.phase = 'up'
          if (dt >= this.cfg.minMs && dt <= this.cfg.maxMs) out.push(this.finishRep())    // ok = flags empty
        } else if (f.t - this.t0 > this.cfg.maxMs) this.phase = 'arming'           // abandon
    }
    return out
  }
}
// Cfg per exercise: squat { downEnter:105, upExit:158, minMs:800, maxMs:8000 }, pushup {100,155}, lunge {105,158}
```
Hold exercises use `HoldEngine` with the same `push` signature (in-plank boolean, bridge 700 ms, emits `hold` every 250 ms and `counted` at 10 000 ms). Both implement `Engine`, so the controller does not care.

Mapping to the spec types: controller sets `FormCheckAttempt.state` armed to counted on `counted`, calls consume with the stored `idempotencyKey`, then on end builds `FormCheckResult { repsAnalysed: reps.length, repsClean: reps.filter(r => r.ok).length, perRep, findings, rating }` and keeps it in a React ref or store slice with no persistence (A2 open).

## 6. Privacy proof (frames and landmarks stay in memory)
| Layer | Control | How we prove it |
|---|---|---|
| Camera | Only preview and frame outputs. No video, photo or audio output; no `RECORD_AUDIO`/mic string | Lint rule in CI: fail if `usePhotoOutput`, `useVideoOutput`, `Recorder` appears outside a dev folder |
| Native module | Frame buffer is read and released inside `detect()`. No `File`, `Bitmap.compress`, `FileOutputStream`, `UIImage.jpegData/pngData`, `write(to:)`, `FileManager` | CI grep in `modules/casafit-pose/**` fails the build on those tokens |
| MediaPipe model | Bundled asset, no downloader, no URL in code | Network capture shows no request while the camera is open |
| JS engine | Holds smoothed state for the current frame plus <= 45 angle samples; cleared in `reset()` on blur, unmount, background | Unit test: after `reset()` the engine object graph has no frame arrays |
| Logs, crash, analytics | `babel-plugin-transform-remove-console` in release; breadcrumbs and analytics carry event names and rep counts only; no session replay or view-hierarchy screenshot on `LiveCheck`/`FormCheck` (it would capture the camera); `FLAG_SECURE` on those screens | Review the Sentry/analytics config in the spike write-up |
| Disk | Release builds contain no fixture recorder (compile-time `__DEV__` and `BuildConfig.DEBUG` only) | Device test: list app sandbox before and after 5 sessions and diff (`adb shell run-as <pkg> find .`; Xcode "Download Container") |
| Network | Only `consume`/`refund` hit the API | mitmproxy or Charles during a full check: exactly one request, containing key and exercise only |
| Telemetry of SDKs | MediaPipe/ML Kit native telemetry unverified | Same capture; if any Google host appears, block via config or move to fallback |

## 7. Performance budget
| Item | Target |
|---|---|
| Camera | 30 fps preview, 640x480 `yuv` analysis stream, `dropFramesWhileBusy: true` |
| Pose rate | 15 Hz cap. Squat rep period 2 to 3 s gives 30 to 45 samples per rep; 10 Hz is the floor. Plank/push-up fine at 10 Hz |
| Latency | camera to cue <= 250 ms (third-party reference: 109 to 292 ms capture to display) |
| UI | preview and skeleton overlay at 60 fps; overlay is an SVG layer fed from landmarks (interpolate between samples if needed) |
| Thermal | no "serious" thermal state in a 3 min check on the test phones; at serious: cap to 10 Hz, at critical stop with "paused, phone is warm" and refund path per spec (refund only legal before Counted) |
| Battery | architecture.md budget: under 6% for a 15 min camera session on a Pixel-class phone. A check is 1 to 3 min, so expect about 1% |
| Third-party numbers (OPPO Helio P90 2019, iPhone 11 Pro; charging and warm; self-reported by `expo-body-vision` README, Oct 2026) | ML Kit 60 to 77 ms; MediaPipe Lite 103 ms CPU (97 ms GPU, but UI stutter); iPhone MediaPipe Lite 26 ms, Apple Vision 25 ms |
| Our estimate for SD 6-series, 4 GB | Lite CPU 60 to 120 ms per inference, so 8 to 15 Hz. **Unverified; measure.** GPU delegate off by default |

## 8. Testing without a person in front of the camera
1. **Pure engine behind `PoseSource`**: `{ t, lm[33], w[33] }` frames in, events out. Jest only, no device.
2. **Fixtures** (`app/src/services/pose-runner/__fixtures__/*.json`, 10 to 15 fps):
   - Record 6 to 8 volunteers (team, with written consent) per exercise on phones. Run MediaPipe offline in Python (`pip install mediapipe`) over the video, keep only landmarks, delete the video. Do not use stock or YouTube footage (copyright and consent).
   - Plus a synthetic generator (parametric stick figure, angle curves, noise, dropouts), as `expo-body-vision` does with CSV fixtures and golden traces.
3. **Scenarios**: clean 10 reps; half reps; fast reps; slow reps; plank 8 s, 12 s, 12 s with a 0.5 s dropout and 2 s dropout; occlusion mid-rep; leaves and re-enters frame; wrong side; jitter and 8 Hz frame rate; NaN/zero-visibility frames; multiple people (num poses 1).
4. **Golden event traces** (`expected.json`): rep count, per-rep ok/issue, findings, rating. Changing a threshold must update goldens in the same PR.
6. **E2E**: a `FakePoseSource` selected by a `E2E_POSE=fixture` build flag (absent from release) lets Maestro walk Idle to Result without a camera. The real camera path is covered by the manual device checklist.

## 9. Two-day device spike: go/no-go
Devices: one Android 4 GB Snapdragon 6-series phone (the target), one cheaper 3 to 4 GB phone, one iPhone 12 or newer, one older iPhone (XR/11).
**Day 1 (glue)**
- [ ] Expo SDK 58 + RN 0.88 dev client builds on EAS for Android and iOS with VC 5.2.3 + worklets + our Nitro module (New Arch only)
- [ ] `detect(frame)` returns 33 landmarks from a live v5 `Frame` on Android and iOS; correct upright and mirror handling, front and back camera
- [ ] iOS: `MediaPipeTasksVision` links under RN 0.88 (static frameworks / prebuilt deps) with no hacks beyond one documented Podfile line
- [ ] `frame.dispose()` path clean: 50 start/stop cycles, no stall, no leak
- [ ] Sustained >= 10 Hz on the Snapdragon phone for 90 s, >= 15 Hz on iPhone; UI >= 50 fps
**Day 2 (maths, privacy)**
- [ ] Squat, push-up, lunge: rep count within +-1 on 10-rep sets in >= 90% of 20 sets across 3 people; plank 10 s trigger within +-1 s
- [ ] Per-rep ok/not-ok agrees with a coach (or two team members) on >= 80% of reps; false "not ok" on clean reps < 10%
- [ ] 3 min thermal and battery run: no "serious" state, battery drop <= 2% on the target phone; memory flat
- [ ] Privacy: sandbox diff empty, one network request only, no SDK telemetry host, release build has no recorder

**Go** = every Day-1 box plus the rep-count and privacy boxes. **No-go triggers**: Android < 8 Hz sustained or thermal serious inside 3 min (try Full-to-Lite already; then ML Kit base via fallback B/F); iOS cannot link MediaPipe in 4 hours (use Apple Vision module for iOS only, accept 19 joints: plank/lunge still work with ankle, no heel/toe, drop the heel-lift and foot-index rules); native telemetry found and not removable (use Apple Vision + ML Kit unbundled-check). If both platforms fall back, thresholds in §4 still apply but the heel and foot rules go.

## 10. Unverified items and sources
Unverified: v5 native `Frame` to MediaPipe image path; `MediaPipeTasksVision` current version and RN 0.88 linking; native MediaPipe/ML Kit telemetry; model-card licence text; Apple Vision joint count (19) and iOS 17 3D request; MoveNet size; SD 6-series FPS; babel plugin auto-add on SDK 58; `scheduleOnRN` name.
- npm registry data pulled 26 Oct 2026 (versions and dates above); VisionCamera 5.2.3 source tarball (Frame and `useFrameOutput` docs comments)
- VisionCamera docs: https://visioncamera.margelo.com/docs , https://visioncamera.margelo.com/docs/frame-output (accessed 26 Oct 2026)
- MediaPipe Pose Landmarker: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker (updated 2026-10-09); model files at storage.googleapis.com/mediapipe-models (sizes by HTTP header)
- ML Kit pose detection: https://developers.google.com/ml-kit/vision/pose-detection (updated 2024-07-10)
- READMEs on npm: `react-native-nitro-pose-exercises` 1.1.19, `@rbayuokt/expo-body-vision` 0.1.1, `react-native-fast-tflite` 3.0.1, `react-native-vision-camera-mlkit` 2.0.1, `react-native-mediapipe-posedetection` 0.4.0, `vision-camera-pose-landmarks-plugin` 0.1.0
