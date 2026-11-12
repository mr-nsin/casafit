# CasaFit · Progress

**The single source of truth for what is done, what is pending and what comes next.** Read it at the start of every session and before picking up work. Update it in the same commit as the work, every time something is completed, started, blocked or decided.

Last updated: 12 November 2026 (tester fixes: ready gate, ft/in height, gender, food plan, pieces) · `main` after the bottom-sheet fix (`9b339ab`) plus the local API, integration-test and icon fixes.

## How to keep this file current

1. When you finish an item, move it to **Done** with the date and the commit or merge.
2. When you start one, move it to **In progress** and name the lane or owner.
3. New work goes under **Pending** in the right area, with a priority (P0 blocks a release, P1 needed for beta, P2 later).
4. Update **Next up** so the first three items are always the real next actions.
5. Record a decision in `decisions.md` and tick it off under **Open decisions**.
6. Update the "Last updated" line.

## Next up

0a. Finish the device walk (Progress, Steps, Learn, Settings, Library, Rest, Complete, Pro, camera); fix the clipped button labels on Add to snack and Same as yesterday; then the tester fixes are verified except Welcome and the keyboard on Edit profile. Original line: device-walk the tester fixes and the remaining screens on the emulator (Welcome logo, ft/in height, Ready then Start, Easier/Harder and rest feedback, food plan 1 to 5 meals and pieces, keyboard scrolling on forms); then the UI/UX redesign (scope not decided). Still open from the device findings: back from the food plan returns to the questionnaire and hides the tab bar, Welcome bar segments unlabelled, 3-2-1 beat before Start, Easier/Harder applies from the next set only, saved rest preference is not loaded at start, Maestro flows need a Start tap added.
0. Create the Supabase project and give the app its URL and anon key (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY); then check email code and Google sign-in on a device. A dev client rebuild is needed first (expo-web-browser).
1. Device-check the `casafit-pose` module (run `pnpm install`, rebuild the dev client, set `EXPO_PUBLIC_CAMERA_PREVIEW=1`): landmarks upright on both cameras, frame rate, heat, a network capture for MediaPipe telemetry; build iOS on a Mac.
2. Onboarding pass: Goals, About, Building and Week one verified on device. Still to check: Mix and Health branches, the Offline and Welcome back variants, and the open items under Pending frontend.
3. Real branding for icon and splash, then run the Maestro flows on the emulator and fix selectors.
4. Create the Supabase project (providers, redirect URL), Railway project and RevenueCat webhook secret; Play Integrity once Google Play credentials exist.

## Done

| Area | What | When |
|---|---|---|
| Design | 86 Material 3 screens; `tools/check.py` passes with 0 errors | to 27 Oct |
| App foundation | Shell, UI kit, local database (Op-SQLite + Drizzle), session engine, content | Wave 0 |
| App features | Onboarding, session, nutrition, steps, progress, learn lanes, wired into the app shell | Wave 1, merged `9d422e1`, `4e48139` |
| App quality | 548 tests passing, `tsc` clean | 28 Oct |
| Backend | ASP.NET Core: auth, profile and plan, consents, export and delete, sync, form-check credits with refunds, RevenueCat webhook, 2 migrations, OpenAPI (14 paths), Dockerfile, docker-compose; 105 unit tests passing | B1 to B3 |
| Device | App builds as a debug APK and runs on the Pixel 7 emulator; real Welcome screen renders; no crash | 29 Oct |
| Build | compileSdk 37 (Expo SDK 58 needs it), flat `node_modules` (`.npmrc`), `app/plugins/with-windows-build.js` makes the Windows Gradle fixes survive `prebuild --clean` | 29 Oct |
| On-device check | Welcome, Age and Verify screens verified on the emulator. Bug fixed: bottom sheets with long lists (year of birth) overflowed the screen and could not scroll; `BottomSheet` content now scrolls (`app/src/ui/overlays.tsx`) | 29 Oct |
| Backend verified | `docker compose up --build` works (API, Postgres 16, Redis 7); 11 tables migrated; OTP send and verify tested live; all 51 integration tests pass (they were 25 failing: test sign-ins tripped the 30-a-minute auth rate limit, and validation and domain errors were `application/json` instead of `application/problem+json`; both fixed) plus 105 unit tests | 29 Oct |
| App to API | App defaults to `http://localhost:5080` (override with `EXPO_PUBLIC_API_BASE_URL`); `adb reverse tcp:5080 tcp:5080` for the emulator. Signed in on the emulator through Welcome, Age, Verify, code entry and Goals. Fixed a missing icon on the Goals screen (`target` is not in the icon set; now `gps_fixed`) | 29 Oct |
| Onboarding pass | Goals, About you, Building and Week one verified on the emulator against the local API. Fixed the plan reason ending in a bare "4 normal." (now "Your week mixes 4 normal.") | 30 Oct |
| Home and plan | Workout tab is now the real Home (training day, rest day, resume, comeback, hide calories), plus WeekPlan, Why and Plan detail, registered in the session lane. 587 tests pass. Verified on the emulator: Home, My plan, Why this plan, Plan detail, Start session into the Player | 30 Oct |
| Home and plan, slice B | Library (16 real plans, filters, hidden-for-your-knees note), BodyPart (builds and starts a 15-minute session), Editor and Picker (swap, add, remove, reorder; saved to the plan day), Parts, Lunge, Exercise and CheckIn registered. 654 tests pass. Verified on the emulator: Library, Editor, Picker, and a saved swap (Squat to Chair squat) showing in Plan detail | 30 Oct |
| Player polish | Light status bar on the dark Player family screens, real icons for close, tune, previous, next, pause and check, a large move icon on the stage card, middle dots in captions, Bird dog row icon (holds had a dash icon; all 66 moves now tested against the glyph set), require cycle between session index and browse screens removed. Resume time fix: a tick gap over 10 s is treated as the app not running, so a restored or frozen process no longer credits dead time. 661 tests pass. Verified on the emulator | 30 Oct |
| Settings lane | Settings, Notify, Language, Privacy, Profile, EditProfile, Help and DeleteAccount built and registered. Hide calories reaches Home and Nutrition; reminders are scheduled as local notifications; Download my data and Delete my account call the backend and fail kindly offline (nothing is wiped unless the server confirms). 701 tests pass. Verified on the emulator: Profile, Settings, the delete dialog (cancelled). Fixed an invalid icon on Profile and added a test that checks every literal icon name in the app against the glyph set | 30 Oct |
| Form check and Pro | CameraPermission, FormCheck, LiveCheck, FormResult, CameraDenied, NoCredits, Paywall, ManagePro, ProWelcome built and registered; Player "Check form" goes through the gate (permission, then balance). Pure-TS rep engine for squat, push-up, plank and lunge with tests; purchases port over RevenueCat with a fake; consume uses one idempotency key per attempt, queued offline, no spend before rep 3. 827 tests pass. Verified on the emulator: real Android camera prompt, FormCheck, LiveCheck with the simulated squat set (counted at rep 3), FormResult, Paywall with no store key (calm "not available on this build" state). Fixed on device: light status bar on the dark camera screens, spacing of the credit chip, "Move 1 1 of 6 done" copy on Rest | 30 Oct |
| Session leftovers | Save-your-session card for a finished but unlogged session (no more "15 of 15 Resume"), plan day zero from `plan.updatedAt` shared by Home, WeekPlan and progress, weekly myth card on Home, WeekPlan previous and next week (past read-only), Exercise "Try 30 seconds" single-move mode, Editor Save returns to Plan detail. 849 tests pass | 30 Oct |
| Backend: Supabase identity | Email and social sign-in move to Supabase Auth. The API validates Supabase JWTs (HS256 secret or JWKS), creates the account on first request (ExternalId, Email, Provider), `GET /v1/me` returns email, masked email and provider, `DELETE /v1/me` also deletes the Supabase user through `IIdentityAdmin`. Phone, SMS, OTP, refresh endpoints and Redis removed. RevenueCat webhook needs the `Authorization` header to equal `RevenueCat__WebhookSecret`. Content packs at `GET /v1/content/packs/{name}` with ETag. OpenAPI and `shared/` types updated, GitHub workflows `api.yml` and `app.yml`, `api/railway.json` and README deploy steps added. 105 unit and 74 integration tests pass | 30 Oct |
| App sign-in | Verify is now the sign-in step (email field, email code, Google, Apple on iOS, Facebook) through supabase-js with a SecureStore chunk adapter and PKCE; API client takes the token from the auth provider and refreshes once on 401; dev-only provider with `EXPO_PUBLIC_DEV_AUTH_TOKEN` and `api/tools/mint-dev-token.mjs`; masked email on Profile; sign out; delete handles `identity_delete_failed`; `shared/` phone helpers removed, plan upsert matches the API. 907 tests pass. Not run against a real Supabase project | 30 Oct |
| Frontend leftovers | Notify permission-denied state; consents sent to `POST /v1/me/consents` (health_answers and steps map to `health_sync`; camera consent stays on the phone); pain-area edits queue `PUT /v1/me/plan` metadata; reminder text refreshes; tab bar Workout icon matches Settings; `Purchases.logIn(accountId)`; Paywall Terms and Privacy links; masked email on ManagePro; attempts stuck in `counted` after a crash are retried with their own idempotency key; Week one bar contrast and labels; Home "Make this week a bit lighter" comeback rebuild with confirm. 937 tests pass. Not yet checked on a device | 2 Nov |
| Icon, Maestro, empty states | Placeholder app icon, adaptive and monochrome icons, splash and favicon (white house on `--p`, regenerate with `node app/tools/make-icons.mjs`; needs prebuild to show); Maestro flows in `app/.maestro` (sign-in, onboarding to Week one, session, Settings and Privacy; written, not yet run); Nutrition hidden-calories note and load error, Progress and Recap load error with retry and reload on focus, Manage Pro lapsed, cancelled, billing and trial variants, bar and heatmap contrast. 943 tests pass | 3 Nov |
| Backlog slice | Home shows an error with Try again when the plan read fails (no more false 'Build my plan'); Manage Pro trial shows 'Day N of 7' from the store's trial start; Editor drag-to-reorder with a handle (buttons kept; gesture not yet checked on a device); yoga body-part sessions now build (spread pool, repeat poses, borrow gentle bookend moves via `fillShort`). 957 tests pass | 5 Nov |
| Native pose module | In-repo Nitro module `app/modules/casafit-pose`: Kotlin on MediaPipe tasks-vision 1.1.1 with the bundled `pose_landmarker_lite.task` (SHA-256 pinned), Swift and podspec written but never built. `services/pose/mediapipe.ts` + `PoseCamera.tsx` feed real landmarks into the existing engine; used only when the module is present and `EXPO_PUBLIC_CAMERA_PREVIEW=1`; `RECORD_AUDIO` blocked; Jest privacy lint. Android debug APK builds (x86_64). 994 tests pass. Nothing run on a device | 7 Nov |
| Control audit and device pass | `npm run audit` (app/src/__audit__) presses every control on 68 routes and 148 screen states: 1,519 controls, 6 broken, 6 suspicious (`docs/plans/ui-audit.md`, allowlist keeps new regressions failing). First emulator pass (Welcome, Age, Verify, Home, Nutrition) found 10 defects (`docs/plans/device-findings.md`). Nothing fixed yet | 12 Nov |
| Tester fixes | From a tester's notes: Welcome is a full page with logo and name; shared `HeightInput` (ft/in or cm) and `WeightInput` (kg or lb) in About, Edit profile and food plan; Sex relabelled Gender (Male, Female, Other); food plan always shows height, weight and gender, button never silent, meals a day 1 to 5 (migration 2); nuts in pieces and natural names ('Almonds, 5 pieces'); sessions open in a Ready state and the timer starts on Start; Easier/Harder and +15s/+30s rest show what changed; the Rest between sets setting now works; Previous move disabled on the first move; ReverseTimer no longer a dead end; keyboard first-tap fixes, status-bar inset on Nutrition, Settings Account row, WeekOne chips, switch labels, year of birth from 18+. 1043 tests and the control audit (150 scenarios) pass. Checked on the emulator: About, Ready/Start, rest feedback, food plan, pieces. Also fixed: Player header under the status bar (Close X was hard to tap), year of birth asked in the food plan, Back from the plan, plan almonds capped at 10 | 12 Nov |
| Redesign brief | `docs/plans/ui-redesign-master-prompt.md` written (version 2 of the user's master prompt, checked against the code). Approved by the user and recorded in `decisions.md` | 12 Nov |
| Redesign Phase 0 (foundation) | New palette on the existing token keys plus `pp`, `el`, `cd`, `edge`; Fraunces and Plus Jakarta Sans (static files, `Text` picks the family from the weight); Lucide icons through `ui/iconMap.ts` (150 names, screens unchanged); `Touchable` spring to 0.96 and haptics (`ui/haptics.ts`: select for tabs, pills and switches, light tap for primary buttons); pill buttons 54 high; continuous corners; solid day pills (no dashes); one-pill session bar with minutes in every segment; tab bar on the elevated surface. `ExerciseVisual` draws all 66 moves as a jointed figure that eases between two key poses (`ui/exercisePoses.ts`), in theme colours, with a slot for Lottie files. 1053 tests, `tsc` clean, control audit 150 of 150. Seen on the emulator: Home. Lint: 15 errors, all older than this work (17 before). Deviations from the brief: press spring uses React Native `Animated` with the native driver, not Reanimated (no test or audit risk); `@gorhom/bottom-sheet` not adopted; the elevated surface is a new key `el` rather than `c1`; `lottie-react-native` 7.5.0 is installed but not yet in the dev client (needs a rebuild before any Lottie file can play) | 12 Nov |
| Housekeeping | Finished lane worktrees and stale agent worktrees removed | 29 Oct |

## In progress

**UI/UX redesign** (brief: `plans/ui-redesign-master-prompt.md`). Phase 0 is merged. Running: Wave 1 screens (Home, Player family, Library, Plan detail, Week one, Complete, Progress, Paywall), then a device review, then Wave 2.

## Pending

### Frontend

| Pri | Item |
|---|---|
| P0 | Wave 2 session lane: Home (all variants), WeekPlan, Why, Library, BodyPart, Plan, Editor, Picker, Parts, Lunge, Exercise, CheckIn |
| P0 | Wave 2 settings lane: Settings, Notify, Language, Privacy, Profile, EditProfile, Help, DeleteAccount |
| P1 | Form check deferred: native `casafit-pose` module and frame-processor glue (live skeleton is a static guide today, no real landmarks, no bad-form detection); `<Camera>` preview is opt-in with `EXPO_PUBLIC_CAMERA_PREVIEW=1` and untested; spoken cues (TTS); `Purchases.logIn(accountId)`; store disclosure links on Paywall (Terms, Privacy); trial wording; masked phone on ManagePro; recovery of attempts left in `counted` after a crash; RevenueCat key (`EXPO_PUBLIC_REVENUECAT_KEY`) and products not configured; pain gating map (knees: lunge, wrists: push-up) needs sign-off |
| P1 | "Check form" only appears on moves with the ids squat, pushup, plank, lunge (no ready-made plan screen shows it for chair squat or reverse lunge); check whether plans should offer a form-check move. Hold variant screens (plank) were not checked on device |
| P1 | Gap and empty states, Maestro end-to-end flows |
| P1 | On-device pass through every built screen (only Welcome seen so far) |
| P1 | Status bar: dark icons now show on light screens (React Native `StatusBar` set from the app theme in `App.tsx`). My earlier "still white" result came from stale Metro code, not the fix. Still to check on a dark-theme device |
| Done | Week one: the cool-down segment of the session bar is nearly invisible on the tonal card (`sc` on `pc`); the 2/11/2 split also has no labels on warm-up and cool-down. Check contrast |
| P1 | Exercise figures: all 66 moves are drawn by `ExerciseVisual` from hand-set key poses. A trainer or physiotherapist must review every pose before release (contact sheets in `docs/plans/screens/poses/`) |
| P1 | Slice B deferred: Exercise "Try 30 seconds" (store has no single-move mode), drag to reorder (up and down buttons only), yoga body-part sessions often cannot be built (catalogue has 5 yoga work moves), some ready-made plans run over 15:00 in the Editor. Editor "Save" goes back rather than to the Player |
| P1 | Settings deferred: masked phone number and "since" date need `GET /v1/me`; no avatar photo (no image picker); only the locale is saved, no translations or i18next yet; consent changes are stored locally, not sent to `POST /v1/me/consents`; edited pain areas are not pushed to `PUT /v1/me/plan`; reminder text does not refresh when the plan changes until Notify is saved again; Chat opens an email link; the native notification path is only unit-tested against a fake |
| P2 | Settings bottom bar uses a different Workout icon from the tab bar |
| P1 | Code entry: the six boxes show focus but the keyboard does not open until a box is tapped (autofocus) |
| P2 | Icon audit: done as `app/src/ui/iconNames.test.ts` for literal names. Names built at run time are still only checked where a screen test does it. Original note: audit every icon name against the glyph set. Names are fine today, but `ads_click` rendered as "?" even though it is a valid name, so check new icons on a device. A node check is in this session's history; turn it into a test |
| P1 | Replace the placeholder icon and splash with real branding; run and fix the Maestro flows; Manage Pro billing help row (destination unknown) |
| P1 | Content for yoga and dance: give each pose its own family or ladder, add about 5 more yoga poses and 3 or 4 yoga warm-up moves; plan-level yoga and dance days still fall back to Normal (`fillShort` is only on for body-part sessions) |
| P2 | Remove `@expo/vector-icons` and Roboto Flex once nothing imports them (icons are Lucide now) |

### Backend

| Pri | Item |
|---|---|
| P1 | Play Integrity and App Attest (needs Google Play credentials) |
| P1 | Background jobs; content pack publishing pipeline (server serves the bundled packs today)
| P1 | Create and connect the Supabase project (email code, Google, Apple, Facebook); R2 later. Upstash dropped for beta (rate limiting is in process, per instance) |
| P1 | CI and deployment; first host is Railway for beta |
| P1 | `shared/` still has phone helpers (`identifiers.ts`, fixtures) and `upsertPlanRequest` does not match the API (API rejects ageYears, health, pain with 400); fix with the app auth rewrite
| P2 | Security review; Cloud Run asia-south1 for launch |

### Docs and housekeeping

| Pri | Item |
|---|---|
| P1 | Record decisions in `decisions.md`: hoisted linker, compileSdk 37, Windows path workarounds, new tables, refund and webhook choices, NuGet deps, local data layer, step counter |
| P2 | `.gitignore` legacy Prisma lines; make `shared/src/identifiers.ts` reject `+abc` like the C# normaliser |

## Open decisions (need the user)

| Decision | Options or note |
|---|---|
| Webhook auth | Decided: static `Authorization` header equal to `RevenueCat__WebhookSecret` |
| Icons | Add the Material Symbols font dependency |
| Yoga and dance timing | 5 slots of 2:12 |
| `profile.sex` values | Allowed set |
| Nutrition numbers | Invented by the engine; need dietitian sign-off |
| Content review | Foods, exclusions, myth sources, chamach size |
| API host | Decided: Railway for beta, Cloud Run asia-south1 (Mumbai) for launch. Record in decisions.md |
| Windows long paths | `LongPathsEnabled` is a user-only admin change; removes the need for most build workarounds |

## Build and run notes (Windows)

- Build: `JAVA_HOME` is Android Studio's JDK 21; Java ignores `HTTPS_PROXY`, so set `JAVA_TOOL_OPTIONS` with `-Dhttps.proxyHost` and `-Dhttps.proxyPort`.
- Command from the repo root: `app/android/gradlew.bat -p app/android assembleDebug -x lint --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64`.
- Never `cd` into `app/android` in a shell you will later use for `prebuild --clean` (EBUSY).
- Run: `cd app && npx expo start --dev-client --port 8081`, `adb reverse tcp:8081 tcp:8081`, then open `casafit://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`. The first bundle takes about a minute.
- Dev API: from `api/`, `docker compose up -d --build`; health at `http://localhost:5080/healthz`. With `Sms__Provider=log` the one-time code is printed in `docker compose logs api`.
- If an edit does not show up on the emulator, check the served bundle (`curl` the bundle URL and grep for your change). Metro's file watcher goes stale on this machine often (it cost hours of false leads); restart it with `npx expo start --dev-client --port 8081 --clear` after edits rather than debugging a change that is not showing up.
- The emulator loses installed apps after a cold boot; reinstall the APK with `adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk`.
- pnpm is not on PATH; use `npx --yes pnpm@9.12.0`.
