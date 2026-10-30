# CasaFit · Progress

**The single source of truth for what is done, what is pending and what comes next.** Read it at the start of every session and before picking up work. Update it in the same commit as the work, every time something is completed, started, blocked or decided.

Last updated: 30 October 2026 (Home and plan slice) · `main` after the bottom-sheet fix (`9b339ab`) plus the local API, integration-test and icon fixes.

## How to keep this file current

1. When you finish an item, move it to **Done** with the date and the commit or merge.
2. When you start one, move it to **In progress** and name the lane or owner.
3. New work goes under **Pending** in the right area, with a priority (P0 blocks a release, P1 needed for beta, P2 later).
4. Update **Next up** so the first three items are always the real next actions.
5. Record a decision in `decisions.md` and tick it off under **Open decisions**.
6. Update the "Last updated" line.

## Next up

0. Player polish list under Pending frontend, then the settings lane (Settings, Notify, Language, Privacy, Profile, EditProfile, Help, DeleteAccount).
1. Onboarding pass: Goals, About, Building and Week one verified on device. Still to check: Mix and Health branches, the Offline and Welcome back variants, and the open items under Pending frontend.
2. Wave 2 lane `session`: Home and plan surfaces. The Workout tab is still a placeholder.
3. Wave 2 lane `settings`: Settings, Notify, Language, Privacy, Profile, EditProfile, Help, DeleteAccount.
4. Fix the status bar contrast (below) and add the app icon.

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
| Housekeeping | Finished lane worktrees and stale agent worktrees removed | 29 Oct |

## In progress

Nothing running. Next lanes start from the **Next up** list.

## Pending

### Frontend

| Pri | Item |
|---|---|
| P0 | Wave 2 session lane: Home (all variants), WeekPlan, Why, Library, BodyPart, Plan, Editor, Picker, Parts, Lunge, Exercise, CheckIn |
| P0 | Wave 2 settings lane: Settings, Notify, Language, Privacy, Profile, EditProfile, Help, DeleteAccount |
| P1 | Form-check and Pro lane: camera, live check, result, camdenied, nocredits, paywall, managepro. Re-check the vision-camera and Nitro spikes on RN 0.88 |
| P1 | Gap and empty states, Maestro end-to-end flows |
| P1 | On-device pass through every built screen (only Welcome seen so far) |
| P1 | Status bar: dark icons now show on light screens (React Native `StatusBar` set from the app theme in `App.tsx`). My earlier "still white" result came from stale Metro code, not the fix. Still to check on a dark-theme device |
| P1 | Week one: the cool-down segment of the session bar is nearly invisible on the tonal card (`sc` on `pc`); the 2/11/2 split also has no labels on warm-up and cool-down. Check contrast |
| P1 | Player screen (verified on device) needs polish: status bar text is dark on the dark screen (clock unreadable); close, previous, next and menu show plain characters (X, <, >, =, v) instead of icons; the move illustration is a placeholder bar; caption reads "Work . 14:56" with a full stop instead of a middle dot |
| P1 | Plan detail: the Bird dog row shows a dash instead of an icon; a ready-made plan (`readyMadeId`) is a title card only until Library lands |
| P1 | Day zero for the week is taken from `plan.updatedAt`, while progress treats dayIndex as Monday = 0. Persist a plan start date and make both agree |
| P1 | Home: weekly myth card not built (Learn lane has no weekly pick); comeback week is not rebuilt with the engine's comebackInput; WeekPlan shows only the current week |
| P1 | Slice B deferred: Exercise "Try 30 seconds" (store has no single-move mode), drag to reorder (up and down buttons only), yoga body-part sessions often cannot be built (catalogue has 5 yoga work moves), some ready-made plans run over 15:00 in the Editor. Editor "Save" goes back rather than to the Player |
| P1 | Resume card showed "11 of 15 min done" after an emulator restart; check the active-time clock is not counting time while the app is closed |
| P1 | Code entry: the six boxes show focus but the keyboard does not open until a box is tapped (autofocus) |
| P1 | Audit every icon name against the glyph set. Names are fine today, but `ads_click` rendered as "?" even though it is a valid name, so check new icons on a device. A node check is in this session's history; turn it into a test |
| P1 | App icon and splash are still the Expo defaults |
| P2 | Material Symbols Rounded font (icons are MaterialIcons today) |

### Backend

| Pri | Item |
|---|---|
| P1 | Real SMS (MSG91 or 2Factor with DLT registration) |
| P1 | Play Integrity and App Attest |
| P1 | Refresh-token revocation |
| P1 | Content endpoints (stub only) and background jobs |
| P1 | Connect Supabase, Upstash, Cloudflare R2 |
| P1 | CI and deployment; first host is Railway for beta |
| P1 | Regenerate `shared/` types (refund shape, consume path `/v1/entitlements/form-check/consume`); add `RevenueCat__WebhookSecret` to `.env.example` |
| P2 | Security review; Cloud Run asia-south1 for launch |

### Docs and housekeeping

| Pri | Item |
|---|---|
| P1 | Record decisions in `decisions.md`: hoisted linker, compileSdk 37, Windows path workarounds, new tables, refund and webhook choices, NuGet deps, local data layer, step counter |
| P2 | `.gitignore` legacy Prisma lines; make `shared/src/identifiers.ts` reject `+abc` like the C# normaliser |

## Open decisions (need the user)

| Decision | Options or note |
|---|---|
| Webhook auth | Static header or IP allowlist |
| Refresh tokens | Add revocation now or later |
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
