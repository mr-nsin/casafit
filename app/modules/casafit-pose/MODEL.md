# Model asset

`pose_landmarker_lite.task` is the MediaPipe Pose Landmarker Lite (float16) bundle, 5,777,746 bytes.

- Source: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
- Fetched: 5 November 2026
- Pinned SHA-256: see `pose_landmarker_lite.task.sha256` in this folder

The Android build checks the file against that hash before it compiles and stops with a clear error
if it is missing or different. To fetch or repair it, run `node scripts/fetch-model.mjs` in the
module folder (honours `HTTPS_PROXY`). The app never downloads a model at run time.

Check the model-card licence text before a public release (spike `docs/plans/spikes/pose.md` section 10).
