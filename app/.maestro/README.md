# Maestro end-to-end flows

These flows were written against the screens' visible text and accessibility labels. **They have not been run yet** (no emulator or Maestro in the authoring environment), so expect a first pass of selector fixes.

| Flow | What it covers |
|---|---|
| `01-sign-in.yaml` | Welcome, Age (year of birth, 18+ confirm), sign in as the local dev user, lands on Goals |
| `02-onboarding-week-one.yaml` | 01, then Goals, About you, Building, Week one |
| `03-session.yaml` | 02, then start today's session, skip through every move to "Session done", Done, back on Home |
| `04-settings-privacy.yaml` | 02, Look around first, Profile, Settings, Privacy and data |

Shared steps live in `subflows/` (Maestro runs only the top-level files). Each flow starts from a clean install (`clearState`), so the order does not matter.

## Run

1. Start the API: `docker compose -f api/docker-compose.yml up -d --build` (health at `http://localhost:5080/healthz`).
2. Mint a token and put it in `app/.env.local` as `EXPO_PUBLIC_DEV_AUTH_TOKEN=<token>`: `node api/tools/mint-dev-token.mjs`. Rebuild or restart Metro with `--clear` after changing it (Expo inlines it).
3. Boot an Android emulator (Pixel 7, x86_64) and install the dev client: `adb install -r app/android/app/build/outputs/apk/debug/app-debug.apk`.
4. Start Metro and forward ports: `cd app && npx expo start --dev-client --port 8081`, then `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:5080 tcp:5080`.
5. Install Maestro (https://maestro.mobile.dev), then from the repo root: `maestro test app/.maestro` (all flows) or `maestro test app/.maestro/03-session.yaml`.

The first step of each flow opens `casafit://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`, which skips the dev launcher. The first bundle takes about a minute, so the launch step waits up to two minutes.

## Notes

- The dev sign-in button only exists in development builds with the dev token set. Release builds cannot run these flows as written.
- The session flow taps "Next move" and "Skip rest" until the finish screen; it does not wait out the 15 minutes.
- If a selector fails, run `maestro studio` to see what text or label the screen exposes. Screens use visible text and accessibility labels; add a `testID` to a shared UI component only when text is ambiguous.
