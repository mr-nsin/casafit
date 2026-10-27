# Spike: all-day step and brisk-minute counting, no GPS

Date: 2026-10-26. Target: Expo SDK 58 (RN 0.88, New Architecture only), Android-first (India), iOS second.
Status tags: **[V]** verified in an official source read today; **[S]** secondary source (blog, search summary); **[U]** unverified or from general knowledge, test in the spike.

## 0. Verdict on D9

**D9 is confirmed in direction, overturned in two details.**

| D9 says | Spike finding | Change |
|---|---|---|
| "Health Connect (HC) primary where installed" | Having HC installed is not enough. HC only has phone steps if the device is **Android 14+ with SDK extension >= 20** and some app holds `READ_STEPS` (HC then records from `TYPE_STEP_COUNTER` itself). On Android 13 and lower, HC is a separate Play app with **no native counter**; it is empty unless Samsung Health, Google Fit, Mi Fitness or a watch writes into it. [V] | Primary condition becomes "HC available **and** on-device tracking supported (API 34 + ext >= 20)", else a fallback. |
| "else a background sampler on the step counter" (our own WorkManager diff) | Google now ships the **Recording API** (Play services, `LocalRecordingClient`): subscribe once, the system keeps up to 10 days of step deltas, battery-efficient, needs only `ACTIVITY_RECOGNITION`. [V] Better than a hand-rolled sampler, which only yields day totals and dies on OEM killers. | Fallback 1 = Recording API through a small custom Expo module (Kotlin). Fallback 2 = live-only `expo-sensors` Pedometer (app open only, honest "partial" label). The WorkManager sampler is dropped. |
| iOS: CoreMotion with history | Confirmed. 7-day history, per-minute queries possible. No HealthKit needed. | None. |

Key insight: **all-day counting is done by the OS** (hardware step counter, HC module, Play services, CoreMotion). Our app never needs to run in the background to count. It only needs to *read* on open and foreground. That removes most of the Xiaomi/Oppo/Vivo/Realme background-killer risk from the critical path.

Reach: StatCounter India, July 2026 (mobile): Android 15 23.7%, 16 23.4%, 13 14.0%, 14 12.3%, 12 9.4%, 11 8.8%. [S, gs.statcounter.com] So Android 14+ is roughly 60% of devices; Android 13 and lower is a large minority that needs the Recording API fallback. The share of devices that actually have SDK extension >= 20 is **not published** [U]; measure on the test devices.

## 1. Android facts

### 1.1 `TYPE_STEP_COUNTER` [V via Google HC page; semantics from Android sensor docs, partly general knowledge]

| Topic | Fact |
|---|---|
| Semantics | Cumulative steps since last reboot while the sensor is registered; on-change, low-power hardware; you diff against a stored baseline. |
| Reboot | Value resets to 0 (or near) on reboot. If new value < baseline, treat as reboot and start a new baseline; steps taken between the last sample and the reboot are lost for a self-sampler. |
| Batching | `registerListener(..., maxReportLatencyUs)` batches in the sensor FIFO; events arrive in bursts. |
| Permission | `ACTIVITY_RECOGNITION` runtime permission since Android 10 (API 29). [U on exact wording, widely documented] |
| Limitation | No history and no per-minute data on its own. A self-sampler only gets day totals at the moments it happens to run. |
| Expo | `Pedometer.watchStepCount` works on Android and iOS, but updates **are not delivered in the background**. `getStepCountAsync(start, end)` is **iOS only**. Docs point to Health Connect for background data on Android. [V, docs.expo.dev SDK 58 Pedometer page, read today] |

### 1.2 Health Connect

| Topic | Fact | Source |
|---|---|---|
| Availability | Android 14+ (API 34): framework module, nothing to install. Android 13 and lower: user installs the HC app (`com.google.android.apps.healthdata`), needs Android 9+. SDK supports API 26+. `getSdkStatus` returns available, unavailable, or provider-update-required. | [V] developer.android.com get-started, read 2026-10-26 |
| Native phone steps | Needs API 34 + SDK extension >= 20. Tracking is active only while at least one app has `READ_STEPS`. Phone steps appear automatically in Steps. Data is batched and written **at most once per minute**. Record interval length is not documented. User can switch phone tracking off under Devices in HC; phone steps have the **lowest default priority**. | [V] developer.android.com/health-and-fitness/health-connect/features/steps (updated 2026-10-21); [V] support.google.com/android/answer/16786157 |
| June 2026 change | Native steps now carry a device-specific, app-scoped Synthetic Package Name (SPN) instead of `android`. Older data keeps `android`. Aggregates **without** a `DataOrigin` filter include them automatically. Do not hardcode SPNs. | [V] same page |
| Cold start | No history before the first `READ_STEPS` grant by any app. A user with no other app holding it starts at zero and the chart is useful after about a day. | [S] sahha.ai, 2026-08-20 |
| Aggregate | `aggregate(StepsRecord.COUNT_TOTAL)` returns a de-duplicated total (highest-priority source wins; users order priorities). `aggregateGroupByDuration` with a 1-minute slicer gives per-minute totals; sparse (empty buckets omitted). Never sum raw `readRecords`. | [V] developer.android.com aggregate-data, read-data |
| Dedup scope | Priority-based dedup applies to Activity and Sleep types; Steps is an activity type. | [V] aggregate-data |
| History window | Default: data up to 30 days before first permission grant. Android 14+ own data: no limit. Reinstall resets the window. | [V] read-data |
| Background reads | Need `READ_HEALTH_DATA_IN_BACKGROUND` plus a feature-status check. Not needed for foreground reads. | [V] read-data |
| Permissions | Manifest `READ_STEPS` (we never write; drop `WRITE_STEPS`). Needs a rationale activity (`ACTION_SHOW_PERMISSIONS_RATIONALE`, and `VIEW_PERMISSION_USAGE` alias on 14+) showing the same privacy policy as Play Console. Users can revoke any time, so check before each read. | [V] get-started |
| Play Console | Health apps declaration on App content page, per data type, with justification; data types in manifest must match what is declared. Allow-list is per package name, so app version bumps do not need a new request. README of the RN library warns approval can take up to 7 days plus 5-7 business days. | [V] developer.android.com declare-access; [V] library README |
| Location | HC steps need **no location permission**. | [V] (no location permission in step flow) |

### 1.3 Recording API (new finding, not in current docs/plans) [V, developer.android.com/health-and-fitness/recording-api]

- `play-services-fitness` `LocalRecordingClient`; types `TYPE_STEP_COUNT_DELTA` etc.; accountless, on-device.
- Stores **up to 10 days**; data exists **only while subscribed** (no backfill before first subscribe). Docs recommend WorkManager to collect periodically.
- `readData` with `bucketByTime(n, unit)`. Minute buckets are very likely allowed [U]; test on day 1.
- Needs `ACTIVITY_RECOGNITION` and Play services at a minimum version (`LOCAL_RECORDING_CLIENT_MIN_VERSION_CODE`, value not published).
- Risk: the page says Google Fit APIs are supported "until the end of 2026" and links the Fit migration guide. Whether the Recording API shares that sunset is not stated. [U] Treat as a fallback with a kill switch, and re-check the Google page before launch.
- No React Native or Expo wrapper found. [U, one search] Cost: a Kotlin Expo module, about 150 lines (subscribe, isSubscribed, readMinuteBuckets).

### 1.4 Background execution, OEMs

- `expo-background-task` (SDK 58, v58.0.0): WorkManager on Android, BGTaskScheduler on iOS; Android minimum 15 minutes, default 12 hours; runs only with enough battery or charging, and network; "timing is never guaranteed"; killing the app stops tasks; vendor behaviour varies. [V, docs.expo.dev]
- dontkillmyapp.com rank (higher is worse): Xiaomi 5, OnePlus 5, Samsung 5, Oppo 4, Vivo 3, realme 3. No date on page. [V for rank, U for date]
- Consequence: do **not** make the step total depend on our own background job. Use background work only for (a) the evening "X steps to go" nudge (local notification) and (b) opportunistic server sync. If it never runs, the next app open rebuilds everything from HC / Recording API / CoreMotion.
- Whether OEM killers also stall HC's native recorder or Play services' Recording client is **unverified** [U]. This is the single most important device test (section 7).

## 2. iOS facts

| Topic | Fact | Source |
|---|---|---|
| CoreMotion history | `CMPedometer.queryPedometerData(from:to:)` returns data for about the **past 7 days**; earlier start returns what is available. | [V] Expo Pedometer page ("seven days"); Apple page itself did not load, details [U] |
| Permission | Motion & Fitness prompt, needs `NSMotionUsageDescription`. Expo `expo-sensors` plugin option `motionPermission` sets it. | [V] docs.expo.dev sensors |
| Background | OS collects steps continuously in the motion coprocessor; our app is not needed. Live updates stop when suspended; history query on open fills the gap. | [V Expo: no background updates]; coprocessor behaviour [U, widely documented] |
| Per-minute data | Call `queryPedometerData` for each 1-minute window (up to 1,440 calls a day; batch the day on a background queue). Throttling behaviour [U]; test cost. Fallback: query 5-minute windows and only mark a window brisk when the average is >= 100/min (coarser). | [U] |
| Expo support | `Pedometer.getStepCountAsync(start, end)` is iOS only and covers this. No extra native module needed. | [V] |
| HealthKit alternative | Gives more than 7 days and watch steps (`HKStatisticsCollectionQuery` 1-minute intervals). Costs: HealthKit entitlement, usage strings, App Review scrutiny of health data (no use for ads, privacy policy must say what is read), and a library (`@kingstinct/react-native-healthkit`, has an Expo plugin, needs `react-native-nitro-modules`; version seen 8.4.0 on a possibly stale mirror). | [S/U] |
| Recommendation | CoreMotion for v1. Re-open HealthKit only if "history older than 7 days after reinstall" or Apple Watch users matter. 7 days is enough because we persist `step_summary` locally and rebuild only recent days. | |

## 3. Brisk minutes

**Rule (defensible, matches PRD section 12):** a clock minute is *brisk* when it contains >= 100 steps (about 100 steps a minute is the commonly used moderate-intensity cadence threshold, as the PRD already states), **and** the minute does not overlap a declared reverse-walk bout. `brisk_minutes` = count of such minutes in the local day.

| Platform | Per-minute buckets | Notes |
|---|---|---|
| Android 14+ (HC) | `aggregateGroupByDuration(COUNT_TOTAL, 1 min)` over the day, or the last N minutes when refreshing | Native records are written at most once a minute and their span is undocumented, so a record can straddle two clock minutes. Whether aggregate pro-rates a partial overlap is **[U]**. Test: walk exactly 3 minutes at a metronome 110 steps/min, compare buckets. |
| Android fallback (Recording API) | `readData` with `bucketByTime(1, MINUTES)` [U] | Same smoothing test. |
| iOS | `queryPedometerData` per minute | Exact. |
| Live (Steps screen open) | `Pedometer.watchStepCount` deltas into a 60 s ring | Used only for the ring animation; the stored value comes from the platform history. |

Quality guards (propose to PM, small and cheap):
- Smoothing: if bucket alignment makes a continuous 105 steps/min walk read 60/45, use a **2-minute sliding window average >= 100** and credit 1 minute per minute covered. Decide after the alignment test; default to the simple 1-minute rule if buckets are clean.
- Ignore minutes with > 200 steps (shake, vehicle vibration artefacts) [U threshold, tune with test data].
- Watch steps in HC may arrive in coarse blocks (for example a 15-minute block of 1,800 steps). Treat blocks longer than 5 minutes as unknown cadence: count the steps, **not** the brisk minutes. State this in the UI footer ("brisk minutes use your phone's counts").

**Reverse bout exclusion.** `ReverseBout{startedAt, endedAt, steps}` is stored locally by `ReverseTimer` (spec 2.4). Steps stay in the daily total. Any clock minute overlapping `[startedAt, endedAt]` is removed from the brisk set (whole-minute exclusion, simple and slightly conservative). Sensors cannot tell direction, so the declared bout is the only signal (PRD section 12 risk). Do not infer reverse walking.

## 4. Libraries for SDK 58

| Library | Status | Config plugin | New Arch | Decision |
|---|---|---|---|---|
| `expo-sensors` Pedometer | SDK 58 docs, maintained by Expo; Expo Go OK. [V] | Yes: `motionPermission` (iOS). Android `ACTIVITY_RECOGNITION` handling not documented on the page [U]; add via `android.permissions` if missing. | Yes (SDK 58 is New Arch only) | Use for iOS history (`getStepCountAsync`) and live count on both platforms. |
| `react-native-health-connect` (matinzd) | **4.1.3, 2026-08-06**; releases 4.0.0 / 4.1.x on 2026-08-01 and 08-02. 4.0.0 bundled the Expo module and removed `expo-health-connect` (keep only one or the build fails with a duplicate class). README: supports old and new architecture; needs `compileSdk/targetSdk 36`, `minSdk 26` via `expo-build-properties`; not in Expo Go; `expo prebuild --clean` after migration. [V GitHub releases and README, read today] | Yes, built in | Yes (README) | Use. Needs a dev build. Maintenance looks active (4 releases in a week), but 50 open issues; single maintainer risk [U]. |
| Recording API wrapper | None found. [U] | n/a | n/a | Write a small Expo module (Kotlin, Expo Modules API). |
| `@kingstinct/react-native-healthkit` | Exists, Expo plugin, Nitro modules. [S] | Yes | Yes [U] | Not v1. |

Package-level compatibility between 4.1.3 and SDK 58 specifically was **not found stated**; verify by installing in the spike [U]. Library API (`aggregateRecord`, `aggregateGroupByDuration`, `getSdkStatus`, `getGrantedPermissions`, `openHealthConnectSettings`) exists in 3.5.3 typings [S]; confirm the same names in 4.1.3. The `tech-stack.md` section 1.4 wording "expo-sensors + react-native-health-connect (Android fallback)" inverts the real order on Android; fix it (see section 8).

**Recommendation:** Android 14+ with ext >= 20: HC. Android below that: Recording API module. Any Android where both fail: live Pedometer only and show the "partial" state. iOS: CoreMotion. Fallback chain is chosen once at startup and re-evaluated on each foreground (users update Android or install HC).

## 5. Design

### 5.1 Interface (TypeScript, in `app/src/services/steps/`)

```ts
type StepSource = 'health_connect' | 'recording_api' | 'coremotion' | 'live_only' | 'none';

type StepPermissionState =
  | 'unknown'              // not yet read from OS
  | 'needs_primer'         // never asked; show StepsPermission
  | 'denied_can_ask'       // denied once, OS will still prompt
  | 'denied_permanent'     // user chose don't ask again; open settings
  | 'hc_unavailable'       // no HC and no fallback (Android <= 13, no Play services)
  | 'hc_update_required'   // SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED; Play link
  | 'hc_tracking_off'      // HC present but phone steps toggled off, or no data written yet
  | 'granted';

interface StepCounterService {
  detectSource(): Promise<{ source: StepSource; reason?: string }>;
  getPermissionState(): Promise<StepPermissionState>;   // always re-read from OS
  requestPermission(): Promise<StepPermissionState>;    // only after ConsentRecord('steps')
  openSystemSettings(): Promise<void>;                  // app settings or HC settings
  readDay(localDate: string): Promise<{ steps: number; minuteBuckets: number[] | null }>;
  syncRange(fromDate: string, toDate: string): Promise<SyncResult>; // rebuilds step_summary rows
  subscribeLive(cb: (todaySteps: number) => void): () => void;      // Pedometer, foreground only
  registerBackgroundSync(): Promise<void>;              // optional nudge + upload task
}
```

Adapters: `HealthConnectAdapter`, `RecordingApiAdapter`, `CoreMotionAdapter`, `LiveOnlyAdapter`. `StepCounterService` picks one; UI never sees the source except through the footer text and the state machine.

### 5.2 Sync points and rebuild

| Trigger | Action |
|---|---|
| App cold start / foreground (debounce 60 s) | `syncRange(today-2, today)` (cheap), update `step_summary` for those days, then refresh Zustand. |
| Steps screen visible | Live ring from `subscribeLive` for smoothness; every 60 s re-read `readDay(today)` (HC lags up to a minute). |
| First grant | `syncRange(today-29, today)` on Android HC (30-day window), `today-6` on iOS, `today-9` on Recording API, so the 7-day bars are not empty. |
| Daily background task (`expo-background-task`, 15 min minimum, OS decides) | Evening nudge decision and `syncRange(today-1, today)`; optional server upload. Failure is silent. |
| Settings or midnight rollover while open | Re-run for yesterday and today. |

Rebuild is **idempotent and total**: for each date, `step_summary.steps` = source aggregate for that local day (overwrite, never add), `brisk_minutes` = bucket rule minus bout minutes. Persist a local `last_synced_at` per date. A past day is frozen after two syncs 24 h apart.

### 5.3 Edge cases

| Case | Handling |
|---|---|
| Timezone change or travel | HC records carry zone offsets; compute each date's UTC range from the device timezone **at sync time**, and never re-bucket frozen days. Add `tz` (IANA) to `step_summary` locally (data-model change, small). A flight can create a 23 h or 25 h day; accept it. |
| Device reboot | HC, Recording API and CoreMotion are unaffected (they persist). Only a self-sampler would care, hence no self-sampler. Live Pedometer baseline: reset the in-memory baseline on each subscribe. |
| Permission revoked | Detect on each foreground via `getPermissionState()`; keep existing summaries, show "Counting paused" (state `denied_*`), stop writing zero for new days (write nothing, not 0). |
| HC missing or outdated | `getSdkStatus`: unavailable on API <= 33 -> use Recording API; provider update required -> store link CTA; keep fallback running meanwhile. |
| HC present, no phone data | If API 34+ ext >= 20 and 0 steps but permission granted: probably first day or phone steps off; show `hc_tracking_off` hint after 24 h with a deep link to HC Devices. |
| Multiple writers in HC (phone + watch + Samsung Health) | Use the **un-filtered aggregate**; HC de-duplicates by user priority. Never filter by `DataOrigin` for the total. For attribution text only, use `metadata.device`. Disclose "includes steps from your other connected apps". |
| Multiple devices on one account | `step_summary` is per account per date: server upsert policy **max(steps) per date, not sum**; brisk follows the row with max steps. Local DB keeps its own device's view. |
| Manual entries | HC allows apps to write steps; PRD says no manual entry. Mitigate by reading with the aggregate and, if abuse appears, excluding records with `recordingMethod = manual` [U field availability]. |
| No sensor (rare cheap phones) | `Pedometer.isAvailableAsync()` false and no HC: state `none`, hide the Steps card, no shame copy. |
| Reinstall | Android 14+ HC own data unlimited; Android <= 13 30-day window resets; iOS 7 days; server `step_summary` is the long-term source and should win for dates older than the platform window. |

### 5.4 Permission state machine (UI)

```
needs_primer --Allow--> (ConsentRecord 'steps' written) --> OS prompt
  HC path:  requestPermission(READ_STEPS)          -> granted | denied_can_ask
  RA path:  ACTIVITY_RECOGNITION + subscribe       -> granted | denied_can_ask | denied_permanent
  iOS:      Motion prompt on first query           -> granted | denied_permanent (iOS asks once)
denied_can_ask --Retry--> OS prompt (max 2 in app, then treat as permanent: Android blocks after 2 denials, behaviour per version [U])
denied_permanent --Open settings--> returns -> getPermissionState() on foreground
hc_unavailable | hc_update_required --> store/settings link, fallback keeps counting if possible
granted --revoked in OS--> next foreground detects -> denied_*
```

UI contract for the undesigned states (flagged in the screen spec): one `StepsPausedCard` with title, one sentence, one button, per state; never red, never shaming; "Not now" leaves Home working. The Steps ring shows last known value, greyed, with the card above it.

### 5.5 Privacy and DPDP

- **No location permission anywhere.** HC steps, Recording API, CoreMotion need none. CI check: manifest and `Info.plist` must not contain location keys.
- Android manifest adds only `READ_STEPS`, `ACTIVITY_RECOGNITION` (fallback path), and later `READ_HEALTH_DATA_IN_BACKGROUND` only if background reads are shipped (recommend not for v1; avoids an extra declaration).
- Order matters: show the primer, write `ConsentRecord(purpose="steps", version, timestamp)`, **then** trigger the OS prompt. Withdrawal in Settings: stop reading, keep or delete history per the user's choice, call `Recording API unsubscribe`.
- Step counts are health-adjacent personal data; the PRD already treats health answers as special-category. Server upload of `step_summary` should be behind the existing consent and Privacy toggle; daily aggregates only, no minute buckets leave the phone (minute buckets are a transient computation). Verify the DPDP Act and Rules wording on "consent notice" and "withdrawal" with counsel. [U, not researched here]
- Play Data safety form: declare "Health and fitness: steps" collected, purpose app functionality, encrypted in transit, deletable. HC rationale activity must show the same policy. [V requirement, content U]
- Analytics (PostHog): no step values, only "steps_screen_viewed" and state transitions. Matches architecture rule.

## 6. Risks (ranked)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Android 13 and lower (about 40% of India devices per StatCounter July 2026 [S]) have no HC native counter, so reliability depends on the **Recording API**, which is unproven for us, has no RN wrapper, is not backfilled, and may share the Google Fit sunset (end 2026). | High | High | Day-1 spike on it; kill switch; live-only graceful state; ask for step data to be "approximate" in copy on that path. |
| 2 | Health Connect Play declaration and review time (up to about 2 weeks, [V library README]) lands on the launch critical path. | Med | Med | File the declaration with the first internal-track build; ship v1 without HC if late, via Recording API. |
| 3 | OEM killers (Xiaomi, Oppo, Vivo, realme) stall HC's recorder or Play services' client. Unverified. | Med | High | Device test 7.3; add an in-app "keep counting" help page only if proven necessary. |
| 4 | Minute-bucket alignment in HC makes brisk minutes noisy. | Med | Low-Med | Alignment test; 2-minute window rule; coarse-block rule. |
| 5 | Single-maintainer `react-native-health-connect`; fast 4.x churn. | Low-Med | Med | Pin exact version; keep adapter interface; Kotlin module is small enough to fork. |
| 6 | SDK extension 20 coverage on Indian OEM Android 14/15 phones unknown. | Med | Med | Log `SdkExtensions` level in the spike on 8 devices; adapter picks per device. |

## 7. Two-day device test checklist

Devices (minimum): Pixel or other Android 15/16 (reference); Samsung Android 14; Xiaomi/Redmi (HyperOS or MIUI) Android 13 or 14; Oppo or realme (ColorOS); Vivo (Funtouch/OriginOS); one Android 12 or 13 budget phone with Play services; one iPhone (iOS 17+). Record per device: model, Android build, `SdkExtensions.getExtensionVersion(34)`, Play services version, HC version.

**Day 1 (build and truth data)**
1. Build a dev client: SDK 58, `react-native-health-connect` 4.1.3 with `expo-build-properties` (compile/target 36, min 26), `expo-sensors`; confirm it builds and links under New Architecture. Note any errors.
2. For each device: `getSdkStatus`, extension level, request `READ_STEPS`, read `aggregate` for today and `aggregateGroupByDuration` per minute. Walk 100 counted steps (manual tally) and compare.
3. Walk 3 minutes at a metronome of 90, 100 and 115 steps/min; capture minute buckets. Check bucket alignment and whether partial overlaps are pro-rated. Decide 1-minute vs 2-minute rule.
4. Android <= 13 phone: write the Recording API module skeleton (subscribe, read minute buckets). Confirm `bucketByTime(1, MINUTES)` works and min Play services version.
5. iOS: `getStepCountAsync` for the last 7 days and per-minute windows; time 1,440 queries.
6. Cold start: with no other app holding `READ_STEPS`, confirm HC starts recording only after our grant and how soon the first minute record appears.
7. De-dup: on a phone with Samsung Health or Mi Fitness and a second source (watch if available), compare unfiltered aggregate with the sum of raw records.

**Day 2 (the hard cases)**
1. All-day carry: phone in pocket, app force-stopped and removed from recents, battery saver on, screen off. After 8 hours open the app: does the total match a manual or reference count (within about 10%)? Do this on every Chinese-OEM phone with default battery settings (no manual whitelist).
2. Reboot mid-day: total before and after reboot continuous? (HC and Recording API.)
3. Permission flows: deny once, deny twice (Android permanent), revoke in settings while app is backgrounded, HC missing (Android 13 phone with HC uninstalled), HC outdated; verify each state in the machine and screens.
4. Timezone: change the device timezone by 5 hours; resync; confirm no double-count and the day boundary behaviour.
5. Reverse bout: run a 5-minute declared bout; confirm steps counted and minutes removed from brisk.
6. Battery: 24 h drain with HC read on open only vs Recording API subscription; target under 1-2 percent a day attributable [U target].
7. Privacy: dump the final manifest and `Info.plist`; confirm no location permission; capture the HC permission screen and rationale screen.
8. Output of the spike: table of device vs (source used, total error vs reference, brisk error, survives OEM kill yes/no, extension level), plus go/no-go on the Recording API and on the 2-minute smoothing rule.

## 8. Follow-ups for other documents (not done here, no file edited)

- `docs/plans/implementation.md` D9: replace "background sampler" with "Recording API module (Android <= 13 or ext < 20)"; add "HC primary only on API 34+ ext >= 20".
- `docs/tech-stack.md` 1.4: step counter row should read "Android: HC (API 34+) then Recording API (custom module); iOS: CoreMotion via expo-sensors".
- `docs/data-model.md` `step_summary`: consider `tz`, `source`, and upsert rule `max(steps)` for multi-device; keep "no minute buckets stored".
- Screen spec section 1 FLAGs: undesigned states are now defined in 5.4; "Counted all day in the background" copy is true only because the OS counts, keep wording but do not promise exactness on Android 13 and lower.
- Expo SDK/RN version in the screen spec header (Expo 52, RN 0.76) is outdated against the target (SDK 58, RN 0.88).
- Add Play Console HC declaration and Recording API sunset check to the launch checklist.

## 9. Sources (all read 2026-10-26 unless noted)

- Expo Pedometer docs, SDK 58: https://docs.expo.dev/versions/latest/sdk/pedometer/
- Expo Background Task docs, v58.0.0: https://docs.expo.dev/versions/latest/sdk/background-task/
- Expo sensors config plugin: https://docs.expo.dev/versions/v58.0.0/sdk/sensors/
- Expo SDK 58 announcement (RN 0.88, 2026-10-21): https://expo.dev/blog/how-to-upgrade-to-sdk-58
- Health Connect steps (page updated 2026-10-21): https://developer.android.com/health-and-fitness/health-connect/features/steps
- Health Connect aggregate: https://developer.android.com/health-and-fitness/health-connect/aggregate-data
- Health Connect read data: https://developer.android.com/health-and-fitness/health-connect/read-data
- Health Connect get started: https://developer.android.com/health-and-fitness/health-connect/get-started
- Health Connect declare access: https://developer.android.com/health-and-fitness/health-connect/declare-access
- Recording API: https://developer.android.com/health-and-fitness/recording-api
- Google help, Track steps with Health Connect: https://support.google.com/android/answer/16786157
- react-native-health-connect releases (4.1.3, 2026-08-06) and README: https://github.com/matinzd/react-native-health-connect
- Sahha blog (secondary), 2026-08-20: https://sahha.ai/blog/health-connect-without-a-wearable/
- StatCounter India Android versions, July 2026 (secondary): https://gs.statcounter.com/android-version-market-share/mobile/india
- dontkillmyapp.com (no date): https://dontkillmyapp.com/
- Not loaded: Apple CMPedometer page (content empty), Android `Sensor` reference (truncated), npm page (403). Related claims are marked [U].
