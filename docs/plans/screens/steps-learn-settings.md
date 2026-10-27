# Spec: steps, learn, progress, settings, privacy, profile screens

Source: `project/m3-*.dc.html` (19 files, 390 px, all light+dark via `.dark` class = `dark` prop). Stack: RN 0.76, Expo 52, react-native-paper M3, Zustand, TanStack Query, Op-SQLite + Drizzle. Tokens: `app/src/theme/tokens.ts` (`p,pc,sc,tc,sv,c1..c4,er,erc...`). All sample numbers are placeholders.
Legend: **FLAG** = ambiguity or conflict with CLAUDE.md / PRD / docs; not fixed here. Offline = works with no network unless stated.

## 0. Cross-cutting findings

- **Nav**: BottomNav has 3 tabs (Workout, Nutrition, Progress). Steps, Learn, Concepts mark *Workout* as current (they live under Workout). Progress marks *Progress*. Settings and Profile are not tabs; Settings shows the nav with nothing current; Profile has no nav.
- **Back arrow**: 48 px target, `arrow_back`, 22/28 semibold title. Used on all but Stepsperm (close), Recap (close), Reversetimer (close), Progressempty (no back, tab root), Deleteacct (dialog).
- **Tap targets** (<44 px, CLAUDE.md warning only): Learn filter chips 40 px; Notify time chips 40 px; Learn "Myths" chip is non-link, Concepts is link, "Form tips" is inert.
- **Motion** (one moment per screen): Steps ring `grow 1.3s`; Reversetimer ring `grow`; Myth verdict `pop .4s`; Recap bars `grow` staggered + cards `rise`; Notify preview `rise`; Deleteacct `pop`; Profile avatar `pop` + 3 `rise`; Progressempty 3 `shimmer 2.4s infinite` (looping, FLAG: only demo illustrations may loop per people board rules). All gated by `prefers-reduced-motion` in CSS; RN needs `AccessibilityInfo.isReduceMotionEnabled` / Reanimated `ReduceMotion.System`.
- **Dead links**: many rows have no `href` (Settings: Pain areas, Daily steps goal, Verified number, Download my data; Help: all 5 FAQ bodies but one, Chat, Email; Privacy: Download my data, Read the privacy notice route to wrong screens). Treat as undesigned screens.
- **Sample-data inconsistency** (derive from data, do not hard-code): minutes trained 150 (Progress) vs 60 (Profile, Recap); sessions 10 in 4 weeks vs 4 (Profile); streak 3 with alternating tick days.

## 1. Step counting design notes (a)

| Topic | Design shows | Implementation note |
|---|---|---|
| Source | "Phone's step sensor or Health Connect" (Steps footer, Stepsperm, Privacy) | tech-stack 1.4: `expo-sensors` Pedometer + `react-native-health-connect` (Android fallback). iOS: Pedometer (CoreMotion). Copy says Health Connect only, no iOS wording. FLAG. |
| Permission primer | Stepsperm: "Allow step counting" / "Not now" | "Allow" must trigger OS prompt: Android 10+ `ACTIVITY_RECOGNITION` runtime perm (Pedometer) or Health Connect `READ_STEPS` flow (own permission sheet; on Android 13 and below needs the HC app). iOS: Motion and Fitness prompt. |
| Denied / revoked / HC missing | **Not designed.** "Not now" goes straight to Home | Need states: denied once (retry), permanently denied (open settings), HC unavailable/outdated (store link), counting paused. FLAG. |
| Background counting | "Counted all day in the background" | Android `TYPE_STEP_COUNTER` is cumulative since boot; Expo Pedometer has no history query on Android (history only on iOS). Reliable all-day counts on Android need Health Connect aggregate reads, or a periodic background task diffing the counter. Needs a spike. FLAG (architecture risk, not in tech-stack risks). |
| Brisk minutes | "12 / 20", rule "about 100 steps a minute or faster" | Needs per-minute step buckets (HC `StepsRecord` intervals, or sampled counter). A minute is brisk if steps >= 100. Target 20 min is not in PRD ("smaller second goal", no number). FLAG. |
| Daily summary | Ring, week bars, avg steps | Local `step_summary(on_date, steps, brisk_minutes)` per local date; rebuilt from sensor/HC on app open, on foreground, and by a background task (expo-background-fetch, >= 15 min, OS-throttled). Server copy via "daily batch sync" (data-model 4/5) but **no endpoint in tech-stack 2.5**. FLAG. |
| Dedup | n/a | HC returns multiple sources (watch + phone). Use HC aggregate API (`aggregate` with origin priority), never sum raw records. No manual step entry (PRD 12). |
| Reverse walk | Declared bout timer | Sensors count steps regardless of direction (PRD 12 risk). Bout is the only signal. Steps in bout count toward daily total, excluded from brisk. Store a `ReverseBout` row; subtract bout minutes from brisk calc. |
| No GPS | Footer "No GPS" with `location_off` | Do not request location perms. HC does not need location. |

## 2. Screens

### 2.1 `Steps` (m3-steps) - Daily steps

- **Purpose**: today's ring vs goal, brisk minutes, 7-day bars, three walk modes.
- **States in file**: single populated state (4,820 of 7,000; 2,180 to go; 12/20 brisk; Normal on; Brisk on; Reverse off with "Try"). Not designed: zero steps, goal met (celebrate, no confetti spam), permission denied/paused, HC unavailable, loading, reverse hidden (health flag).
- **Components**: `TopBar`(back, title), `StepRing`(value, goal, size 192, stroke 20), `StatTile`("Brisk minutes" 12/20, tone `tc`), `Chip`(flag icon "2,180 to go"), `WeekBars`(7 bars, goal line dashed, bar colour p when goal met, `s` for today), `WalkModeRow`(icon, title, subtitle, trailing: `StatusSwitch` | `Button`), `InfoNote`(icon+text), `BottomNav`.
- **Data**: reads `StepSummary` (today + last 7 days), `NotificationPrefs` no, `Profile.stepGoal` (7,000, ramped from user average per PRD 12), `Profile.healthFlags` (hides reverse row). Writes none (counter service writes StepSummary).
- **Nav in**: Home steps card, Stepsperm "Allow", Reversetimer "Stop bout". **Out**: back to Home; "Try" to `Reverse`; BottomNav.
- **Motion**: ring sweep 1.3 s once. Reduced motion: render final arc.
- **A11y**: ring has `role=img` label "4,820 of 7,000 steps today"; week bars have one label and no per-day values (FLAG: give each bar an `accessibilityLabel` "Tue 5,200 steps"); met-goal vs not is colour only, add pattern or label. Dark mode via tokens.
- **Offline**: fully local.
- **FLAG**: Normal and Brisk switches are `role=img` "On" (not interactive) and both show "on" with a check; unclear whether they can be turned off, and what "off" does (stop counting? hide?). Day labels start at "T" (Tue) and end "Today" = rolling 7 days; Recap uses Mon-Sun. Weekly bars labels T/W/T/F/S/S duplicate letters; use weekday short names for screen readers.

### 2.2 `StepsPermission` (m3-stepsperm)

- **Purpose**: pre-permission primer before OS prompt. Illustration: walk demo (two-frame flip, 1.2 s infinite, `.fa/.fb`).
- **States**: single. Not designed: denied, HC missing, iOS wording.
- **Components**: `CloseButton`, `PeopleIllustration`(walk), `InfoCard`(sensors, location_off), `PrimaryButton`("Allow step counting"), `TextButton`("Not now").
- **Data**: writes consent via `ConsentRecord(purpose="steps")` on Allow (see Privacy), then OS permission result into `Permissions` state (Zustand, not persisted as truth: re-read from OS on launch).
- **Nav in**: first Home visit / Steps when not permitted. **Out**: Allow -> `Steps`; Not now -> `Home`; close -> `Home`.
- **Motion**: demo loop only (allowed illustration).
- **A11y**: illustration label "A person walking"; reduced motion shows frame 1.
- **Offline**: local.
- **FLAG**: Allow navigates to Steps without any permission result handling. Copy "7,000 steps ... most of the benefit" is a health claim; keep the PRD source (Lancet meta-analysis).

### 2.3 `Reverse` (m3-reverse) - safety check

- **Purpose**: opt-in gate before a reverse-walk bout.
- **States**: 3 checkboxes all ticked + enabled Start. Not designed: unticked (Start must disable until all three ticked), health-flag block, daily cap reached ("second bout same day is blocked", PRD 12), balance concern.
- **Components**: `TopBar`, `InfoCard`(pc, undo icon), `CheckRow`x3 (label wrapping hidden `Checkbox`, 64 px), `StatTile`x2 ("15 min / Most per day", "5 to 10 / Minutes per bout"), `InfoNote`, `PrimaryButton`("Start a bout", play icon).
- **Data**: reads `Profile.healthFlags`, `ReverseBout` for today (minutes used). Writes none until start.
- **Nav in**: `Steps` "Try". **Out**: back to `Steps`; Start -> `ReverseTimer`.
- **A11y**: checkbox inputs are visually hidden 1 px with aria-label shortened vs visible text (use visible text as label). Focus ring on label.
- **Offline**: local.
- **FLAG**: Footnote says hidden for "heart, blood pressure or balance concern"; PRD 12 says "health flag"; data-model flags are `heart_bp, pregnancy, recent_surgery` plus pain areas, no "balance". Define the exact set. Evidence copy "research is small" is correct per PRD. No bout-length picker though "5 to 10" is stated and timer shows 10:00.

### 2.4 `ReverseTimer` (m3-reversetimer)

- **Purpose**: running bout, 10:00 target.
- **States**: running (5:42 of 10:00, 412 steps, 9:18 left today of 15). Not designed: paused, completed, auto-stop at 15 min daily cap, app backgrounded, sensor unavailable, dizziness stop confirmation.
- **Components**: `TopBar`(close, centred title), `TimerRing`(progress, `role=timer`), `StatTile`x2, `WarningBanner`(erc, warning icon), `PrimaryButton`("Stop bout").
- **Data**: writes `ReverseBout{startedAt,endedAt,steps}`; adds steps to today's `StepSummary`, excluded from brisk. Reads today's used minutes (15 cap).
- **Nav in**: `Reverse`. **Out**: Stop -> `Steps`; close (X) -> `EndSession` (a workout screen, FLAG: wrong destination/semantics).
- **Motion**: ring sweep once; ring then updates each second (drive from timestamps, not setInterval drift).
- **A11y**: `role=timer` needs live-region throttling (announce each minute, not each second). Keep screen awake (`expo-keep-awake`), haptic on stop. Warning uses error colours for a hint, not an error (tone ok, "never shame" respected).
- **Offline**: local. Timer must survive backgrounding (store start timestamp).
- **FLAG**: "Left today (15 max)" = 15:00 - 5:42, implying elapsed bout time counts immediately; confirm.

### 2.5 `Learn` (m3-learn) - Myths tab

- **Purpose**: Learn hub, Myths list.
- **States**: tab Myths (3 `MythCard`s coloured pc/tc/sc). Not designed: Form tips tab (inert chip, not in PRD 13 which has only Myths + Concepts, FLAG), empty, search.
- **Components**: `TopBar`, `SegmentChips`(Myths|Concepts|Form tips), `MythCard`(label "Myth" with close icon, title link, "What is true" body, tone), `BottomNav`.
- **Data**: reads `LearnCard[]` kind=myth. Writes optional `read` flag (local).
- **Nav in**: Home "Learn". **Out**: card title -> `Myth`; Concepts chip -> `Concepts`; back -> Home.
- **A11y**: only the title is a link (card body not tappable, small target); make whole card pressable. Tabs on Concepts use `role=tablist` but here chips are links; unify as one route with tabs.
- **Offline**: yes (bundled).
- **FLAG**: card preview shows no verdict word (False / Partly true); `close` icon implies False for all cards, wrong for "Partly true" myths. Design count (3 myths, 6 concepts) vs PRD (10 myths, 8 concepts at launch, P2 M2). Labels 12 px bold on tinted bg fine.

### 2.6 `Concepts` (m3-concepts)

- **Purpose**: Concepts tab (60 to 90 s reads). Copy: "They work offline."
- **States**: list of 6 `ListRow`s (icon in tonal circle, title, meta "N min read"). First row "start here".
- **Components**: `TopBar`, `Tabs`(`role=tablist`, selected Concepts), `ListRow`(leading icon, title, subtitle, chevron), `BottomNav`.
- **Data**: `LearnCard[]` kind=concept.
- **Nav**: all six rows link to `m3-myth` (placeholder). **FLAG**: no concept detail screen; needs `ConceptDetail` (or generalise `Myth` to `LearnDetail`). Meta text mixes "1 min read" and "1 min".
- **Motion**: none. **A11y**: rows are links with 64 px height; tab links lack `aria-controls`. **Offline**: yes.

### 2.7 `Myth` (m3-myth) - detail

- **Purpose**: one myth with verdict, truth, evidence, CTA, source and review date.
- **States**: verdict False (pop animation). Not designed: Partly true / True variants (PRD verdicts), long content, missing source.
- **Components**: `TopBar`(back, label "Myth"), `VerdictChip`(False|Partly true|True + topic), `Callout`(What is true), `EvidenceNote`(science icon), `ListRow`("Try a full-body session", links to Library), `SourceFooter`(source, last reviewed date), `PrimaryButton`("Next myth").
- **Data**: one `LearnCard` (fields incl. `source`, `reviewedOn`, `ctaRoute`).
- **Nav in**: Learn, Concepts. **Out**: back -> `Learn`; CTA -> `Library`; "Next myth" -> `m3-concepts` (FLAG: should be next card in list, not Concepts).
- **A11y**: verdict is text + icon, not colour only; H1 is the myth statement.
- **Offline**: yes. Source text: PRD marks this paper "confirm original"; do not ship unsourced cards (PRD 13: each card needs a source and a trainer review).

### 2.8 `Progress` (m3-progress)

- **Purpose**: streak, this week, 28-day heatmap, totals.
- **States**: populated (3 day streak, best 6; week ticks Tue/Thu/Sat; 10 sessions in 4 weeks; 150 min; 6,240 avg steps). Empty -> `ProgressEmpty`.
- **Components**: `TopBar`, `StreakCard`, `WeekDots`(7, check/empty), `Heatmap`(28 cells, `role=img`), `StatTile`x2, `BottomNav`.
- **Data**: reads `ProgressStats` (derived from `session_log` + `step_summary`); local Drizzle query, no endpoint.
- **Nav in**: BottomNav. **Out**: back -> Home.
- **A11y**: heatmap is one image label with no values (FLAG: give a text summary); week dots lack day state text ("Tue done").
- **Offline**: yes.
- **FLAG**: back arrow on a tab root (Progressempty has none). Streak 3 vs alternating ticks: define streak on planned days (rest days must not break it, never shame). Weight trend promised in Progressempty copy ("Weight is optional and shown only as a trend") but absent here. Week order Tue to Mon (rolling) vs Mon-Sun in Recap.

### 2.9 `ProgressEmpty` (m3-progressempty)

- **Purpose**: zero-sessions state. Same route as `Progress`, rendered when `session_log` is empty.
- **Components**: `EmptyState`(flag icon, title, body), `SkeletonPreview`(3 tiles + 7 bars, shimmer), `PrimaryButton`("Start today's session" -> `Player`), `BottomNav`(Progress current).
- **Motion**: 3 infinite shimmer loops (FLAG vs "one moment, loops only for demos"). `aria-hidden` skeletons.
- **Offline**: yes. Copy "starts with session one" is encouraging (ok).

### 2.10 `WeekRecap` (m3-recap)

- **Purpose**: Sunday recap card; opened from the single daily notification (PRD recap + welcome rules) and from Home rest.
- **States**: "Week 1" strong week. Not designed: weak/zero week (never shame), week N, no-step-permission variant.
- **Components**: `TopBar`(close, title), `StatTile`x3 (4 Workouts, 60 Active minutes, 6,240 Steps a day), `WeekBars`(M-S), `InsightCard`x2 (trending_up "Something got easier", event "Next week"), `PrimaryButton`("See next week").
- **Data**: reads `session_log` (felt about_right x2 drives "adds a few reps"), `StepSummary`, plan next-week. Pure local.
- **Nav in**: notification deep link (`casafit://recap/week/:n`), Home rest. **Out**: close -> `HomeRest`; CTA -> `WeekPlan`.
- **Motion**: bars `grow` stagger .2-.68 s, 3 `rise`. One orchestrated moment; ok.
- **A11y**: bars lack values; stat tiles 12 px labels fine. **Offline**: yes.
- **FLAG**: "moved on rest days too" static, should be conditional.

### 2.11 `Settings` (m3-settings)

- **Purpose**: app settings list in four groups.
- **Rows**: Plan: Edit my plan (link `WeekPlan`, "4 days a week . Core and Glutes"), Pain areas (Knees, dead). Food and steps: Hide calories (switch), Daily steps goal (7,000, dead), Daily reminder (link `Notify`, "7:30 am . Sunday recap on"). Form camera: Free checks (link `Paywall`, "2 left . Unlimited in Pro"). Privacy and account: Verified number (+91 ..... 48210, dead), Download my data (dead), Delete my account and data (link `DeleteAccount`).
- **Components**: `TopBar`, `SectionHeader`, `ListRow`, `ToggleRow`, `BottomNav`.
- **Data**: reads `Profile`, `NotificationPrefs`, entitlement cache (`GET /v1/me/entitlements`, cached), `Settings.hideCalories`. Writes `Settings.hideCalories`, goal.
- **Nav in**: Profile gear icon, Home. **Out**: rows above; back -> Home.
- **A11y**: toggle is `role=img` aria-label "Off" (FLAG: must be `switch` with label "Hide calories"). Delete row styled destructive, text only (check contrast).
- **Offline**: yes except entitlement refresh.
- **FLAG**: Settings duplicates Profile/Privacy/Editprofile (Pain areas, Delete, Download). No Language, Privacy, Help, Sign out, Terms, version. "Hide calories" subtitle "Show protein only" is the effect when ON, but the switch is Off; wording ambiguous. Calories hidden by user is a CLAUDE.md rule: global flag must reach Nutrition, Meal, Foodsearch, Recap.

### 2.12 `Notify` (m3-notify) - Daily reminder

- **Purpose**: pick one daily reminder time; Sunday recap switch; also acts as notification permission primer.
- **States**: 7:30 am selected; preview card; Sunday recap on. Not designed: "Other" time picker, OS permission denied (Android 13+ `POST_NOTIFICATIONS`), already-allowed state, reminders off, time-zone change.
- **Components**: `TopBar`, `TimeChipGroup`(6:30, 7:30, 12:30, 6:00 pm, 8:00 pm, Other with schedule icon), `NotificationPreview`(app name, time, title "Core + Glutes is ready", body), `ToggleRow`(Sunday recap, `switch`), `PrimaryButton`("Allow reminders at 7:30 am"), `TextButton`("Not now").
- **Data**: writes `NotificationPrefs{time,sunday,enabled}`; reads plan name for preview.
- **Nav in**: Settings "Daily reminder"; post-first-session prompt (PRD 6: notifications asked after first session). **Out**: back -> Settings; both CTAs -> `Home` (FLAG: from Settings, primary should read "Save" and return to Settings).
- **Motion**: preview `rise`. **A11y**: time chips need `radio` semantics; chips 40 px (<44).
- **Offline**: local.
- **Scheduling (b)**: architecture 3.6 says FCM/APNs push, one reminder/day max. Preview content ("Core + Glutes is ready") is derived from the on-device plan (health-adjacent), so use **local scheduled notifications** (`expo-notifications` daily calendar trigger), re-scheduled when the plan or time changes. Keep FCM/APNs for server-driven only (welcome-back, restore). FLAG: docs and design disagree; decide in `decisions.md`.
- **Channels (Android)**: one channel `daily_reminder` (default importance, no sound override). Create it before the permission prompt (Android 13 requires a channel to exist first). Do not add a streak/missed-workout channel (design: "no guilt, no streak warnings"). One daily slot shared by reminder, Sunday recap, welcome-back (PRD ideas, stop after two unanswered).
- **Quiet mode**: no notification quiet hours exist in the design. PRD "Quiet mode" = low-impact workout switch for apartments (unrelated). FLAG: do not conflate.
- **Android 13+**: runtime `POST_NOTIFICATIONS`; ask only on "Allow reminders" tap; if denied, show inline settings deep link. Android 12 and below: no prompt. Exact alarms not required (inexact delivery up to a few minutes ok).

### 2.13 `DeleteAccount` (m3-deleteacct)

- **Purpose**: modal alert dialog over a scrim.
- **States**: single confirm. Not designed: in-progress, failure/offline, success, re-auth, export-in-progress.
- **Components**: `ConfirmDialog`(`role=alertdialog`, icon delete_forever, title, body, three actions: filled "Keep my account", tonal "Export my data first" with download icon, destructive "Delete everything").
- **Data**: calls `DELETE /v1/me` (not in tech-stack 2.5, FLAG). Local: wipe Op-SQLite, secure-store tokens and free-check cache, cancel scheduled notifications, clear Query cache, reset Zustand.
- **Nav in**: Settings, Privacy. **Out**: Keep/Export -> `Settings` (FLAG: Export has no target flow); Delete -> `Welcome`.
- **A11y**: dialog labelled/described; focus trap, initial focus on "Keep my account".
- **Offline**: must **block** with a clear message (server delete needs network); do not wipe local first.
- **Server retention (c)** (data-model 7, 1): server sets `deleted_at`, removes personal rows (plan, session/food/step logs, flags, consent), writes `account_identifier_hash` (HMAC-SHA256 of normalised phone/email, 180 days) to stop credit re-farming; free-check balance forgotten. Analytics events 13 months (anonymous). **FLAG**: dialog body says nothing about the retained hash or analytics; DPDP notice should disclose. Body lists "plan, food log, step history, free-check balance" but omits consent records, session logs. Store subscription (Play/App Store) is not cancelled by deletion: add a line. No identity re-check (OTP) before delete: recommended.

### 2.14 `Profile` (m3-profile)

- **Purpose**: account hub.
- **Components**: `TopBar`(back, title, settings icon), `ProfileHeader`(`Avatar` initials PS with edit badge, name, masked phone "since Oct 2026", `Chip` "Free . 2 form checks left" -> Paywall), `StatTile`x3 (Day streak, Sessions, Minutes), `FeatureRow`(My goal -> `Why`; Weekly check-in "only you see this", Due Sunday -> `CheckIn`), `ListRow` nav group (My plan -> `WeekPlan`, Food plan -> `NutriPlan`, Language and voice [English] -> `Language`, Privacy and data -> `Privacy`, Help and support -> `Help`).
- **Data**: `Profile`, `ProgressStats` (streak, sessions, minutes), entitlements cache, `account.created_at`.
- **Nav in**: Home avatar (not shown in this file). **Out**: rows above; edit avatar -> `EditProfile`; gear -> `Settings`; back -> Home.
- **Motion**: avatar pop + 3 rises. **A11y**: avatar link label "Edit profile and photo". **Offline**: yes.
- **FLAG**: Profile vs Settings overlap; where Profile is entered from is not shown. `CheckIn` screen outside this group. PRD: export and delete reachable in two taps from Profile: Profile > Privacy > row = 2 taps (ok), but Export target is missing.

### 2.15 `EditProfile` (m3-editprofile)

- **Purpose**: edit local profile and pain flags.
- **States**: name filled, born 1998, height 162, weight empty (Optional), pain chips (None, Knees selected, Back, Shoulders, Wrists). Not designed: validation errors, unsaved-changes prompt, photo picker permission.
- **Components**: `Avatar`, `Button`s ("Add a photo", "Use initials"), `TextField`(Paper `TextInput` outlined) x4, `ChipGroup`(multi, "None" exclusive), `InfoNote`, `PrimaryButton`("Save changes").
- **Data**: writes `Profile` (local); pain flags -> `plan.flags` then `PUT /v1/me/plan` (metadata only; health flags go to server only if user opted into sync, data-model 5). Photo: local file only (`expo-image-picker`, copy into app sandbox), never uploaded.
- **Nav**: from Profile; Save/back -> `Profile`. Saving flags rebuilds next week's plan (note on screen).
- **A11y**: labels are visible, units in label ("Height . cm"); numeric keyboards.
- **Offline**: yes; plan metadata sync queued.
- **FLAG**: "Born" (year only) vs 18+ gate: validate >= 18. PRD lists age, sex, height, weight; **sex field missing**. `account` table has no name/height/born; confirm these stay device-only. PRD 6 says name is asked after the first session; no screen captures it before here.

### 2.16 `Privacy` (m3-privacy) - Privacy and data

- **Purpose**: per-purpose consent switches, data export, notice, delete.
- **Rows (switch)**: Health answers (on), Step count (on), Camera for form checks (on), App improvement (off, analytics default off).
- **Rows (link)**: Download my data (-> Profile, stub), Read the privacy notice (-> Help, stub), Delete my account and data (-> `DeleteAccount`).
- **Components**: `TopBar`, `InfoBanner`(verified_user), `ConsentRow`/`ToggleRow` (icon, title, subtitle, switch; 68 px), `ListRow`, `ConsentSheet` (undesigned confirm for withdrawal).
- **Data**: reads/writes `ConsentRecord` per purpose (append-only history, latest wins); Accounts module owns "consent records" (tech-stack 2.2, architecture 3.x) but **data-model.md has no consent table** and 2.5 has no consent endpoint. FLAG.
- **Behaviour**: banner says "Turn one off and we stop using that data and delete what we hold": withdrawal = purge. Health answers off -> delete `plan.flags` locally+server (plan safety degraded; warn); Step count off -> stop counter, delete `step_summary` local + server; Camera off -> revoke in-app consent (OS perm separate); Analytics off -> stop PostHog, opt-out id. Needs a confirm sheet (undesigned) and a purge job. DPDP: specific, unbundled, withdraw as easy as grant; keep notice version in each record.
- **Export (c)**: data-model 7: JSON and CSV in a signed URL (R2, 24 h). Flow undesigned: request -> "preparing" -> share sheet/download; needs endpoint (e.g. `POST /v1/me/export`), not in 2.5. FLAG. Local-only data (photo, health answers if unsynced) should be included from the device.
- **A11y**: switches are `role=switch` with aria-label (good). **Offline**: toggles work offline (queue server purge).
- **FLAG**: no row for notifications consent (OS-level, ok) or terms/age confirmation; where the privacy notice lives (web URL vs in-app) is undecided.

### 2.17 `Language` (m3-language) - Language and voice

- **Purpose**: pick app and voice-coach language.
- **Options**: English (app+voice), Hindi (New, app+voice), Tamil, Telugu, Marathi, Bengali (app only, voice coming soon). Native names rendered with `lang` attr. Preview line: Hindi "घुटनों को बाहर रखें . Knees out" with `record_voice_over` icon.
- **Components**: `TopBar`, `RadioList`(`role=radiogroup`, rows `role=radio`, native label + English subtitle + optional `Badge`), `VoicePreview`(text only, no play control).
- **Data**: writes `Settings.locale` (BCP 47: `en-IN`, `hi-IN`...) and syncs `account.locale` (data-model 1) on next online call; voice follows locale where available.
- **i18n (d)**: `i18next` + `react-i18next` (tech-stack 1.4). Propose `app/src/i18n/locales/{en,hi,ta,te,mr,bn}/{common,home,session,steps,learn,settings,nutrition}.json`, keys by screen, ICU plurals for counts, numerals via `Intl` (en-IN grouping 4,820; use tabular figures). Device locale default then user override. Exercise names stay English (+ local explanation as separate key). Fonts: tech-stack lists Roboto Flex + Noto Sans Devanagari only; Tamil, Telugu, Bengali need Noto Sans families (bundle size). Learn content is **per-locale content**, not UI strings (see 2.18).
- **A11y**: Roboto Flex has no Indic glyphs: fallback fonts per script; set `accessibilityLanguage` (iOS) for native labels; radios 44+ px.
- **Offline**: strings bundled; voice packs download (R2) need network and storage handling (not designed).
- **FLAG**: PRD: English at launch, Hindi soon after, voice Hindi first then 2 to 3 regional (Idea 8, not yet scoped); the design offers five Indic languages with "New" and "coming soon". Tamil/Telugu/Marathi/Bengali app-only means translated UI without audio: scope and translation owner undefined. Selected "English" row only: choosing others needs reload behaviour (RTL not needed).

### 2.18 Learn content storage (e)

- PRD 13: "all bundled in the app so they work offline"; concepts screen says "They work offline". Use **bundled JSON** per locale (`app/src/content/learn/{locale}/cards.json`), loaded to memory; no DB table needed. Optional later: remote hot-update via `GET /v1/content/pack/latest`-style pack (today only the food pack exists, FLAG) so a wrong myth can be fixed without a release (PRD risk: wrong myth damages trust).
- Required per card: id, kind, title, verdict (myths), truth text, evidence text, source, `reviewedOn`, reviewer, CTA route, icon, tone, order. Review date and source shown on Myth.
- Read state / bookmarks: local only (Op-SQLite `learn_read`), never synced.

### 2.19 `Help` (m3-help)

- **Purpose**: searchable FAQ + contact.
- **States**: search field, 5 `details` accordions (first open with body about 2 free checks for life, 3 analysed reps, Pro unlimited, nothing recorded; others empty), contact buttons (Chat, Email), version footer "CasaFit 1.0.0 . [build number]" (placeholder token to replace via `expo-application`).
- **Components**: `TopBar`, `SearchField`, `Accordion`/`FaqItem`, `SectionHeader`, `Button`x2, `VersionFooter`.
- **Data**: FAQ bundled JSON (search local, per locale). Contact: `mailto:` and a chat vendor (undecided).
- **Nav in**: Profile; Privacy notice stub. **Out**: back -> Profile; Chat/Email currently link to itself (FLAG: channel, vendor and hours undecided; chat needs network and sends user data, check DPDP).
- **A11y**: use native disclosure semantics (`accessibilityState.expanded`); search has label via placeholder only (add explicit label).
- **Offline**: FAQ yes; chat/email need network.
- **FLAG**: "3 analysed reps" is not in CLAUDE.md or PRD summary; verify against PRD 14. Missing FAQ bodies. Privacy notice is not hosted here.

### 2.20 `PeopleBoard` (m3-people) - not an app screen

- Design reference board for the illustration system: faceless figures, skin tones Deep #8D5524 / Medium #B07445 / Light #D49A6A, hair #2A1A12, top = primary, legs = on-secondary.
- Illustrations: Squat, Bird dog, Glute bridge, Walk, Warrior II (held, `breathe` 6 s), Grapevine, Dead bug (static), Neck release (tilt 3 s).
- Motion tokens: Emphasised 500 ms `cubic-bezier(.2,0,0,1)`; Standard 200-300 ms; Demo flip 1.8 s hard cut; Hold/breathe 4-8 s. Rules: one orchestrated moment per screen (demos may loop); reduced motion shows frame 1 only; photos/video later replace in same frames.
- **Implementation**: `PeopleIllustration` component (props below) rendering `react-native-svg` frames from a data file; Reanimated `useFrameCallback` or two-frame opacity toggle; skip board as a route (dev-only Storybook screen).
- **FLAG**: hex colours in SVG (skin, hair) break the "no hard-coded hex" rule except camera; treat as an illustration palette in tokens. Steps uses walk with 1.2 s loop but board says 1.8 s.

## 3. Shared components needed

| Component | Props (summary) | Used by |
|---|---|---|
| `TopBar` | `title`, `onBack`/`leading: 'back'\|'close'\|'none'`, `trailing?` (gear), `centerTitle?` | all except DeleteAccount, ProgressEmpty (no back) |
| `BottomNav` | `current: 'workout'\|'nutrition'\|'progress'\|null` | Steps, Learn, Concepts, Progress, ProgressEmpty, Settings |
| `StatTile` | `value`, `label`, `suffix?`, `tone: 'tc'\|'sc'\|'pc'\|'c3'`, `size` | Steps, Reverse, ReverseTimer, Progress, Recap, Profile |
| `StepRing` / `TimerRing` | `value`, `max`, `size`, `stroke`, `center: ReactNode`, `animate`, `a11yLabel` | Steps, ReverseTimer |
| `WeekBars` | `values[7]`, `labels[7]`, `goal?`, `highlightIndex?`, `height`, `a11yLabels` | Steps, Recap |
| `WeekDots` | `days: {label,done}[]` | Progress |
| `Heatmap` | `cells[28]`, `summary` | Progress |
| `ListRow` | `icon`, `title`, `subtitle?`, `trailing: 'chevron'\|value\|node`, `onPress`, `tone`, `destructive?` | Settings, Profile, Concepts, Myth, Privacy |
| `ToggleRow` | `icon?`, `title`, `subtitle?`, `value`, `onChange`, `a11yLabel` (renders `Switch` role) | Settings, Notify, Privacy |
| `ConsentRow` (extends `ToggleRow`) | `purpose`, `grantedAt?` | Privacy |
| `ConsentSheet` | `purpose`, `consequence`, `onConfirm`, `onCancel` (bottom sheet, withdraw = purge) | Privacy, StepsPermission, Camera flows |
| `WalkModeRow` | `icon`, `title`, `subtitle`, `tone`, `trailing: switch\|button`, `state` | Steps |
| `CheckRow` | `label`, `checked`, `onChange` (64 px) | Reverse |
| `InfoCard` / `InfoNote` | `icon`, `text`, `tone` | Stepsperm, Reverse, Steps, EditProfile |
| `WarningBanner` | `text`, `icon` | ReverseTimer |
| `InsightCard` | `icon`, `html bold lead`, `text` | Recap |
| `MythCard` | `tone`, `title`, `truth`, `verdict`, `onPress` | Learn |
| `VerdictChip` | `verdict: 'false'\|'partly'\|'true'`, `topic` | Myth |
| `Callout`/`EvidenceNote`/`SourceFooter` | `title`, `body`, `source`, `reviewedOn` | Myth |
| `SegmentChips` / `Tabs` | `items`, `selected`, `onSelect`, min height 44 | Learn, Concepts |
| `ChipGroup` | `options`, `selected[]`, `exclusive?: 'none'`, `multi` | EditProfile, Notify (`TimeChipGroup` single), Steps (`Chip`) |
| `TextField` | `label`, `value`, `keyboard`, `placeholder`, `error` | EditProfile, Help search |
| `Avatar` | `initials`, `uri?`, `size`, `onEdit` | Profile, EditProfile |
| `ConfirmDialog` | `icon`, `title`, `body`, `actions[]` with `variant: filled\|tonal\|destructive`, `scrim` | DeleteAccount (and others) |
| `NotificationPreview` | `appName`, `time`, `title`, `body` | Notify |
| `RadioList` | `options: {id,native,label,badge?,disabled?}`, `value`, `onChange` | Language |
| `Accordion`/`FaqItem` | `question`, `answer`, `expanded` | Help |
| `EmptyState` | `icon`, `title`, `body`, `skeleton?`, `cta` | ProgressEmpty |
| `PrimaryButton` / `TonalButton` / `TextButton` | `label`, `icon?`, `onPress`, `loading`, 56 px | all |
| `PeopleIllustration` | `pose`, `frames: 1\|2`, `skin`, `loop`, `size`, `a11yLabel`, reduced-motion aware | Stepsperm, Steps (optional), Home etc., PeopleBoard |
| `SectionHeader` | `title` | Settings, Privacy, Help, Reverse |

Hooks/services: `useStepSummary(range)`, `StepCounterService` (HC/Pedometer adapter), `useReverseBout()`, `useNotificationPrefs()` (schedules local notifications), `useConsent(purpose)`, `useLearnCards(kind)`, `useLocale()`.

## 4. Data and state

```ts
type ISODate = string; // 'YYYY-MM-DD' local date
type Locale = 'en-IN' | 'hi-IN' | 'ta-IN' | 'te-IN' | 'mr-IN' | 'bn-IN';

interface StepSummary {            // per day; no GPS, no location
  onDate: ISODate; steps: number; briskMinutes: number;
  source: 'pedometer' | 'health_connect' | 'healthkit'; updatedAt: number;
  syncedAt?: number;               // server batch sync (endpoint TBD)
}
interface ReverseBout { id: string; startedAt: number; endedAt?: number; steps: number; stoppedBy: 'user' | 'cap' | 'app'; }

interface ProgressStats {          // derived, never stored as truth (cache ok)
  streak: number; bestStreak: number;
  weekDays: { date: ISODate; done: boolean }[];
  last28: number[]; sessions28: number; minutesTrained: number;
  avgStepsPerDay: number; weeklyRecap?: { week: number; workouts: number; activeMinutes: number; stepsPerDay: number; insight?: string };
}

interface NotificationPrefs {
  enabled: boolean; time: string;          // 'HH:mm' local
  sundayRecap: boolean; osPermission: 'granted' | 'denied' | 'undetermined';
  channelId: 'daily_reminder'; lastScheduledAt?: number;
}

type ConsentPurpose = 'health_answers' | 'steps' | 'camera' | 'analytics' | 'terms_privacy';
interface ConsentRecord { id: string; purpose: ConsentPurpose; granted: boolean; noticeVersion: string; at: number; source: 'onboarding' | 'privacy_screen' | 'permission_primer'; }

interface Profile {
  name?: string; birthYear?: number; heightCm?: number; weightKg?: number; // device only unless sync opted in
  painAreas: ('knees' | 'back' | 'shoulders' | 'wrists')[]; healthFlags: ('heart_bp' | 'pregnancy' | 'recent_surgery')[];
  photoUri?: string;               // sandbox file, never uploaded
  stepGoal: number; hideCalories: boolean; locale: Locale; theme: 'system' | 'light' | 'dark';
}

interface LearnCard {
  id: string; kind: 'myth' | 'concept'; locale: Locale; order: number;
  title: string; truth: string; evidence?: string; verdict?: 'false' | 'partly_true' | 'true';
  icon: string; tone: 'pc' | 'tc' | 'sc'; readMinutes?: number;
  cta?: { label: string; sub?: string; route: string };
  source: string; reviewedOn: ISODate; reviewer: string;
}
```

| Entity | Persisted where | Server | Notes |
|---|---|---|---|
| `StepSummary` | Op-SQLite `step_summary` (Drizzle) | `step_summary` table via daily batch (no endpoint yet) | 2-year retention then monthly rollup; purge on steps-consent withdrawal and on delete |
| `ReverseBout` | Op-SQLite `reverse_bout` | not synced (FLAG, decide) | enforces 15 min/day, one bout/day block |
| `ProgressStats` | Derived via TanStack Query selectors over `session_log` + `step_summary` | none | no table; memoised |
| `NotificationPrefs` | MMKV/AsyncStorage-equivalent (Zustand persist) + OS scheduled notifications | device push token only if server push used | re-schedule on boot, tz change, plan change |
| `ConsentRecord` | Op-SQLite `consent_record` (append-only) | Accounts module consent records (table missing in data-model, endpoint missing) | needed as evidence for DPDP; survives withdrawal as a record of withdrawal, purged only on account delete (confirm legally) |
| `Profile` | Op-SQLite `profile` + `expo-secure-store` for tokens; photo in app sandbox | `account.locale`; plan metadata via `PUT /v1/me/plan`; health flags only if sync opted in | `account` has no name/height/born |
| `LearnCard` | Bundled JSON (read-only) per locale; read flags in Op-SQLite | none (optional remote pack later) | review date required |
| `Settings` (`hideCalories`, `locale`, goal) | Zustand persist | `account.locale` | |
| Export / delete | n/a | export: signed R2 URL 24 h; delete: `deleted_at`, personal rows purged, `account_identifier_hash` 180 d | endpoints not in tech-stack 2.5 |

## 5. Top open questions

1. Android all-day step counting: Pedometer has no history; decide Health Connect-primary vs background sampling, and iOS copy.
2. Reminder delivery: local scheduled (recommended) vs FCM/APNs push; one daily slot shared by reminder, recap, welcome-back.
3. Privacy backend gap: no consent table/endpoint, no export or delete endpoints, no step sync endpoint in tech-stack 2.5; delete copy omits the 180-day identifier hash.
4. Language scope: five Indic languages shown vs PRD "English then Hindi"; fonts, voice and translation owners.
5. Learn: Form tips tab and Concept detail screen undesigned; counts differ from PRD (10 myths, 8 concepts).
6. Streak definition vs rest days; Progress back arrow on a tab root; Settings/Profile duplication.
