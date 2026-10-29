# CasaFit · Progress

**The single source of truth for what is done, what is pending and what comes next.** Read it at the start of every session and before picking up work. Update it in the same commit as the work, every time something is completed, started, blocked or decided.

Last updated: 29 October 2026 · `main` after the Windows build plugin (`c60a68a`) plus the bottom-sheet scroll fix.

## How to keep this file current

1. When you finish an item, move it to **Done** with the date and the commit or merge.
2. When you start one, move it to **In progress** and name the lane or owner.
3. New work goes under **Pending** in the right area, with a priority (P0 blocks a release, P1 needed for beta, P2 later).
4. Update **Next up** so the first three items are always the real next actions.
5. Record a decision in `decisions.md` and tick it off under **Open decisions**.
6. Update the "Last updated" line.

## Next up

1. Finish the on-device onboarding pass: Welcome and Age are checked; Verify renders but needs the API running to go further (Goals, Mix, About, Health, Building, WeekOne unchecked). Fix the status bar (below) and add the app icon.
2. Wave 2 lane `session`: Home and plan surfaces. The Workout tab is still a placeholder.
3. Wave 2 lane `settings`: Settings, Notify, Language, Privacy, Profile, EditProfile, Help, DeleteAccount.
4. Run the backend integration tests once Docker Desktop is running.

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
| P1 | Status bar icons are white on the cream background. Tried `expo-status-bar` and React Native `StatusBar` with `barStyle` from `App.tsx`; the system still reports only light navigation bars, so the light-status-bar flag is not being set. Next idea: set it natively (`MainActivity` / theme `android:windowLightStatusBar`) or via a config plugin |
| P1 | App icon and splash are still the Expo defaults |
| P2 | Material Symbols Rounded font (icons are MaterialIcons today) |

### Backend

| Pri | Item |
|---|---|
| P0 | Run the 51 integration tests and `docker build` / `docker compose up` (needs Docker Desktop) |
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
| API host | Final choice |
| Windows long paths | `LongPathsEnabled` is a user-only admin change; removes the need for most build workarounds |

## Build and run notes (Windows)

- Build: `JAVA_HOME` is Android Studio's JDK 21; Java ignores `HTTPS_PROXY`, so set `JAVA_TOOL_OPTIONS` with `-Dhttps.proxyHost` and `-Dhttps.proxyPort`.
- Command from the repo root: `app/android/gradlew.bat -p app/android assembleDebug -x lint --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64`.
- Never `cd` into `app/android` in a shell you will later use for `prebuild --clean` (EBUSY).
- Run: `cd app && npx expo start --dev-client --port 8081`, `adb reverse tcp:8081 tcp:8081`, then open `casafit://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`. The first bundle takes about a minute.
- If an edit does not show up on the emulator, check the served bundle (`curl` the bundle URL and grep for your change). Metro's file watcher went stale once; restart with `npx expo start --dev-client --port 8081 --clear`.
- The emulator loses installed apps after a cold boot; reinstall the APK with `adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk`.
- pnpm is not on PATH; use `npx --yes pnpm@9.12.0`.
