# CasaFit · Implementation plan

Status: draft v1, 2026-10-26. Source material: the 71 designed screens in `project/m3-*.dc.html`, the four screen specs in `docs/plans/screens/`, `docs/tech-stack.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/decisions.md`.
Owner of this plan: team-lead. Read `docs/MEMORY.md` first, then this file, then the spec for your lane.

## 1 · What we are building

A phone app (React Native + Expo, TypeScript) and an API (ASP.NET Core, .NET 10 LTS). 71 design files become about 68 routes (the people board is an asset sheet, `otperror` is a state of `Verify`, `lapsed` is a variant of `Home`).

| Lane | Routes | Spec |
|---|---|---|
| Onboarding | Splash, Welcome, Age, Verify (+ code error), Offline, WelcomeBack, Goals, About, Mix, Health, Building, WeekOne, Home (lapsed) | `screens/onboarding.md` |
| Plan and session | Home, HomeRest, WeekPlan, Why, Library, BodyPart, Plan, Player, Rest, Paused, EndSession, Editor, Picker, Parts, Lunge, Complete, Yoga, Dance, Desk, Exercise, SessionSettings, Feel, CheckIn | `screens/session.md` |
| Form check and Pro | CameraPermission, FormCheck, LiveCheck, FormResult, CameraDenied, NoCredits, Paywall, ManagePro, ProWelcome | `screens/camera-pro-nutrition.md` |
| Nutrition | Nutrition, NutriProfile, NutriPlan, FoodSearch, Meal, FoodEmpty | `screens/camera-pro-nutrition.md` |
| Steps, progress, learn | Steps, StepsPermission, Reverse, ReverseTimer, Progress, ProgressEmpty, Recap, Learn, Myth, Concepts | `screens/steps-learn-settings.md` |
| Settings and privacy | Settings, Notify, Language, Privacy, Profile, EditProfile, Help, DeleteAccount | `screens/steps-learn-settings.md` |

The earlier neo-brutalist files (`Main`, `Verify`, `Goals`, ...) are reference only. Do not build from them.

## 2 · Defaults adopted (the specs found 50+ conflicts; these unblock the build)

Each default is the smallest change that makes the design and the PRD agree. They are assumptions until the product owner overrides them; the cost of changing one is lowest now. Agents must follow them and must not re-litigate.

| # | Topic | Default |
|---|---|---|
| D1 | Session timing | Warm-up 2:00 (4 steps x 30 s). Work 11:00 = 5 slots; one slot = 2 sets of (work + rest) = 2:00 at every intensity (30/30, 40/20, 45/15), plus a 12 s transition into each slot (5 x 12 s = 1:00). Cool-down 2:00 (4 x 30 s). Total is exactly 15:00. A move done on both sides uses its two sets as right then left. Editor add or remove changes the total by 2:12 and shows the new total. |
| D2 | Health consent | One consent, on `Health` only, unticked by default. The tick on `About` is removed. |
| D3 | Where the plan is built | On the phone (rules engine, works offline). The server receives only goal, styles, days per week, experience and the derived plan variant. Health flags and pain areas stay on the phone unless the user turns health sync on. |
| D4 | Onboarding order and fields | `Age -> Verify -> Goals -> About -> (Mix if three styles) -> (Health if a flag) -> Building -> WeekOne`. Birth year is asked once (`Age`); `About` drops the age field and asks days per week, so `Mix` can split those days. Progress shows "1 of 2" on Goals and "2 of 2" on About; Mix and Health are unnumbered sub-steps. After Verify the stack is reset so Back never returns to Verify. |
| D5 | Free form-check credit | Spent when rep 3 is reached, with one idempotency key per attempt. If the connection is down, spend from the cache and queue the call with the same key. A refund is legal only before rep 3. |
| D6 | Form-check result | Held in memory only and not saved. The screen copy "nothing was saved" stands; the PRD offline rule is updated to match. |
| D7 | Hide calories | One global preference. Every kcal surface (Home, Nutrition, NutriPlan, FoodSearch, Meal) reads it through a single `useShowCalories()` guard. |
| D8 | Pro states | Implement all six: free, trial, active, active-cancelled, billing-issue, lapsed. Prices come from RevenueCat offerings, never hard-coded. UX must design the four undrawn states. |
| D9 | Android step counting | Health Connect is primary where installed; otherwise a background sampler on the step counter. iOS uses the CoreMotion pedometer with history. A spike confirms before lane L5 starts. |
| D10 | Reminders | Local scheduled notifications (`expo-notifications`), one daily slot shared by reminder, Sunday recap and welcome-back. No server push in v1. |
| D11 | Languages | English (en-IN) at launch with full i18n scaffolding. Hindi next. The language screen lists the other four Indic languages as "coming soon". |
| D12 | Effort vocabulary | Player "easier / as planned / harder" is a rung (difficulty) change. Feel "easy / good / hard" and Complete "too easy / about right / too hard" are felt effort and both map to the stored `felt` enum `easy | about_right | hard`. |
| D13 | Early end | Add `status: complete | unfinished` to `session_log`. A paused session resumes within 24 h; Home shows a Resume card (UX must draw it). |
| D14 | Lapsed threshold | 7 days (PRD). The copy "10 days" is corrected. |
| D15 | Navigation | React Navigation 7 (native-stack and bottom-tabs) with three tabs: Workout, Nutrition, Progress. `app/package.json` `main` changes from `expo-router/entry` to a root `index.ts`. |
| D16 | Streak | Consecutive planned training days completed. Planned rest days do not break it. Micro sessions count to active minutes, not the streak. |
| D17 | Exercise demos | v1 uses the two-frame SVG loops from the people board (`demo.frames[2]`). `videoUrl` is reserved in the schema. |
| D18 | Motion | One orchestrated moment per screen. Infinite loops are allowed only inside illustrations. Splash and Lapsed loops become one-shots. All motion goes through `useMotion()` and respects reduce-motion. |
| D19 | Week-one start | The first plan day is the day the user finishes onboarding; labels are rolling seven days, not Monday-anchored. |
| D21 | Mobile platform version | Start on the current Expo SDK (58 at time of writing, React Native 0.88, vision-camera 5, Reanimated 4), not the scaffold's Expo 52 / RN 0.76, which is about two years old. Nothing is built yet, so the upgrade is cheapest now. Versions are pinned exactly after W0-shell proves the library set builds and `docs/tech-stack.md` section 1 is updated to match. |
| D20 | Server endpoints to add | `POST /v1/me/consents`, `POST /v1/me/export`, `DELETE /v1/me`, `POST /v1/me/sync/{steps,sessions,food}`. Add `consent_record` to `docs/data-model.md`. The delete dialog copy must mention the 180-day identifier hash. |

Still needs the product owner (cannot be defaulted safely): pricing per region on `Paywall`; whether Hindi voice cues ship at launch; content review (myths, exercise safety, food values) by a qualified person before release; legal review of the DPDP notice and consent wording.

## 3 · Code architecture

```
app/
  index.ts, App.tsx                     entry, providers
  src/
    app/                                navigation (typed route map for every route), linking, providers
    ui/                                 design system: tokens, Paper theme, useTokens, useMotion, atoms, molecules, dev gallery
    features/<lane>/                    screens, hooks, components, tests per lane (see ownership)
    engine/                             pure TypeScript, no React: plan engine, session timeline, nutrition targets, brisk-minute maths
    db/                                 Drizzle schema, migrations, repositories, seed loader
    content/                            catalogue loader and types; JSON lives in app/assets/content
    services/                           audio cues, haptics, keep-awake, notifications, step counter, pose runner, purchases, offline queue, consent, analytics
    api/                                client, OpenAPI-generated types (shared/), offline queue integration
    i18n/                               string tables, formatters
    testing/                            factories, render helpers
```
Rules: features import from `ui`, `engine`, `db`, `services`, `content`; never from another feature. A feature that needs another feature's data goes through `db` or `services`. `engine` imports nothing but its own types. Types for server calls come from `shared/` (generated from `api/openapi.json`).

Local storage: Op-SQLite + Drizzle for entities; Zustand with persist for small preferences; expo-secure-store for tokens only.

## 4 · How the agents work

The repo already has twelve role agents (`.claude/agents/`). This plan uses them as follows, and follows the worktree pattern the owner asked for (one worktree and branch per agent, merged one at a time).

- **Isolation.** Every write agent runs in its own git worktree on its own branch (`wave-lane-topic`). Two agents never edit the same files. Ownership is by folder, listed in section 5.
- **Concurrency.** At most five write agents at once. Read-only agents (spikes, reviewers) do not count.
- **Contract first.** Specs in `docs/plans/screens/` and the defaults in section 2 are the contract. An agent that finds a conflict records it in its report; it does not invent a different rule.
- **Dependencies.** Agents never add dependencies or edit `app/package.json` outside the shell lane. Shell installs the full dependency set once; other lanes use what is there and report a missing one.
- **Report shape.** Changed files, tests run with counts, open questions, anything blocked. Agents do not commit to `main`, push, or publish.
- **Gate before merge.** reviewer agent (read-only: design rules, privacy, types, tests) then qa-engineer where a flow crosses lanes. The integrator merges one branch at a time in the order below, runs `pnpm -r lint`, `pnpm -r test`, `python tools/check.py` after each, and only then continues.
- **Coordinator.** team-lead (this session) launches waves, checks reports against the diff before trusting them, resolves conflicts, and records decisions through docs-keeper.

## 5 · Waves

Sizes are relative effort: S under a day for one agent, M about two days, L about four.

### Wave 0 · Foundations

**Baseline finding (2026-10-26).** The scaffold has never run: `pnpm install` fails because `app/package.json` lists a non-existent package `op-sqlite` (the real one is `@op-engineering/op-sqlite`); with that fixed, Jest crashes on React Native's Flow syntax and `tsc` reports three errors (`App.tsx` navigation theme type, missing `expo-constants`, `theme/index.ts` token typing). Node 25 is installed while `engines` pins Node 20. So the first job is a working, upgraded baseline.

**Wave 0a (now, in parallel):** W0-shell (makes the baseline green on the upgraded SDK), the two spikes and ux-gaps. **Wave 0b (after W0-shell is merged, so every worktree branches from a baseline that installs and tests):** W0-ui, W0-data, W0-engine, W0-content, run together.

| Id | Agent | Branch | Owns (only these paths) | Delivers | Size |
|---|---|---|---|---|---|
| W0-shell | mobile-engineer | `w0-shell` | `app/index.ts`, `app/App.tsx`, `app/package.json`, `app/app.json`, `app/tsconfig.json`, `app/babel.config.js`, `app/jest.config.*`, `app/src/app/**`, `app/src/theme/index.ts`, `app/src/api/client.ts`, `.nvmrc` | Install works; upgrade to the current Expo SDK per D21 with exact pins; the full dependency set from `docs/tech-stack.md` installed; Jest and `tsc` green; root entry per D15; typed route map for every route in section 1 with a `PlaceholderScreen` per route; three tabs; providers; proof that a dev build compiles for Android and iOS | M |
| W0-ui | mobile-engineer | `w0-ui` | `app/src/ui/**` | Tokens finalised, Paper MD3 theme, `useTokens`, `useMotion`; roughly 40 shared components from the four specs (buttons, TopBar, BottomNav, chips, fields, rings, bars, sheets, rows, banners, illustration host); a dev-only gallery screen; tests | L |
| W0-data | mobile-engineer | `w0-data` | `app/src/db/**`, `app/src/services/offline-queue/**`, `app/src/state/**` | Drizzle schema for every local entity in the specs, migrations, repositories, onboarding draft store, preferences store, consent store, offline queue with idempotency keys; tests | M |
| W0-engine | general-purpose | `w0-engine` | `app/src/engine/**` | Plan engine (rules, exclusions, ladder, cooldown rebuild), session timeline builder honouring D1 to the second, nutrition target maths, brisk-minute maths, streak maths; heavy unit tests including a property test that every generated session totals 15:00 | L |
| W0-content | general-purpose | `w0-content` | `app/assets/content/**`, `app/src/content/**`, `app/scripts/validate-content.ts` | Exercise catalogue (about 60), substitutions, ready-made plans, Indian food pack (about 250 items with katori and chamach units), 10 myth and 8 concept cards, voice-cue scripts, JSON schema and a validator; marked "needs expert review" | L |

Research, read-only, in parallel: **spike-pose** (vision-camera + MediaPipe on RN 0.76 and Expo 52, iOS and Android), **spike-steps** (Health Connect and pedometer on Android and iOS), **ux-gaps** (ux-designer on branch `w0-ux-gaps`: draws the states the specs found missing: Resume card, hidden-calories, Pro trial / lapsed / billing issue, permission-denied states, Learn form tips, FAQ answers, consent sheet).

Merge order: shell, ui, data, engine, content. Exit: `pnpm -r test` green, gallery renders on a device, engine and content validators green.

### Wave 1 · Feature lanes (five write agents in parallel, after Wave 0)

| Id | Agent | Branch | Owns | Delivers | Size |
|---|---|---|---|---|---|
| L1-onboarding | mobile-engineer | `w1-onboarding` | `app/src/features/onboarding/**` | Splash to WeekOne per D2 to D4, Verify against the live API, Offline and WelcomeBack, plan built on the phone, draft survives app kill | M |
| L2-player | mobile-engineer | `w1-player` | `app/src/features/session/**`, `app/src/services/audio-cues/**`, `app/src/services/keep-awake/**` | Player family (Player, Rest, Paused, EndSession, Feel, SessionSettings, Yoga, Dance, Desk, Complete) on one store driven by the monotonic clock; voice cues, haptics, interruptions, snapshot and resume | L |
| L3-formcheck-pro | mobile-engineer | `w1-formcheck-pro` | `app/src/features/formcheck/**`, `app/src/features/pro/**`, `app/src/services/pose-runner/**`, `app/src/services/purchases/**` | Camera flow end to end per D5 and D6 on the spike's result; paywall, entitlement states, RevenueCat | L |
| L4-nutrition | mobile-engineer | `w1-nutrition` | `app/src/features/nutrition/**` | Nutrition, profile, plan, search, meal, empty state; katori and chamach picker; D7 | M |
| L5-steps-progress | mobile-engineer | `w1-steps` | `app/src/features/steps/**`, `app/src/features/progress/**`, `app/src/features/learn/**`, `app/src/services/step-counter/**` | Steps, permission states, Reverse, Progress, Recap, Learn on the spike's result | M |

Backend, in parallel from Wave 0: **B1** port of the auth slice (running in its own session); then **B2** plan, entitlements (consume, refund, RevenueCat webhook), content pack; **B3** the D20 endpoints and `consent_record`; **B4** Dockerfile, CI, EF migrations against Supabase, host decision. Owner for all: backend-engineer, folder `api/**` only.

Merge order inside Wave 1: onboarding, player, nutrition, steps-progress, formcheck-pro.

### Wave 2 · Remaining lanes and integration

| Id | Agent | Branch | Owns | Delivers | Size |
|---|---|---|---|---|---|
| L6-plan-surfaces | mobile-engineer | `w2-plan` | `app/src/features/home/**`, `app/src/features/plan/**`, `app/src/features/library/**` | Home (all variants incl. Resume, rest, lapsed), WeekPlan, Why, Library, BodyPart, Plan, Editor, Picker, Parts, Lunge, Exercise, CheckIn | L |
| L7-settings-privacy | mobile-engineer | `w2-settings` | `app/src/features/settings/**`, `app/src/services/notifications/**`, `app/src/services/consent/**` | Settings, Notify, Language, Privacy, Profile, EditProfile, Help, DeleteAccount; DPDP export and delete against B3 | M |
| W2-ux-gaps-build | mobile-engineer | `w2-gaps` | per ux-gaps output | Implement the gap states in the lanes' folders after those lanes merge | S |
| W2-e2e | qa-engineer | `w2-e2e` | `tests/maestro/**` | Maestro flows: first run, returning user, offline, a full session, form check free and Pro, paywall, delete account | M |

### Wave 3 · Hardening and release

Accessibility audit (`design:accessibility-review` on built screens and a TalkBack pass), performance profile on a mid-range Android phone (cold start, player timer drift, pose frame rate), DPDP and privacy review, security review of the API (`/security-review`), load test of auth and entitlements, EAS builds for Android internal track and TestFlight, store screenshots and preview video (goldie), beta.

## 6 · Spikes and risks to retire early

| Risk | Retired by | Fallback |
|---|---|---|
| MediaPipe pose frame processor on RN 0.76 New Architecture, especially iOS | spike-pose before L3 | Thin native Vision wrapper as an Expo module |
| Android all-day step counting | spike-steps before L5 | Health Connect only; show "needs Health Connect" state |
| App Attest validator in C# (no official library) | B1 follow-up spike | Gate OTP sends on Play Integrity only on iOS until done; keep rate limits |
| Timer drift and cues with screen off | L2 uses a monotonic clock, foreground service on Android, background audio on iOS | Haptic-only cues in quiet mode |
| Two languages share normalisation logic | shared JSON vectors, run in Jest and xUnit (see B1) | none needed |
| Node 25 installed vs `engines` Node 20 | W0-shell pins Node 20 via `.nvmrc`; agents use `--ignore-engines` only if needed | n/a |
| Content accuracy (exercise safety, myth evidence, food values) | expert review before release | Ship with the bundled content flagged "reviewed on" per card |

## 7 · Definition of done (every lane)

1. Every route in the lane renders from the design: tokens only, 12 px minimum, 44 px targets, focus rings, no dumbbell icon, sentence case.
2. Every state the spec lists is reachable and tested; offline works unless the spec says otherwise.
3. Tests: Jest unit for logic and hooks, @testing-library/react-native for each screen's main states, no skipped tests. API work: xUnit plus `WebApplicationFactory` per endpoint.
4. No health value in a log, analytics event or network call beyond what D3 allows.
5. `pnpm -r lint`, `pnpm -r test` and `python tools/check.py` pass on the branch.
6. Report lists deviations from the spec; the reviewer agent has no blocking findings.

## 8 · Milestones

| M | Exit | After |
|---|---|---|
| M0 | Foundations merged: shell, design system, data layer, engine, content, spikes written | Wave 0 |
| M1 | Onboarding to first session runs end to end on a device against the live API: sign up, build plan, play a 15:00 session, log it | Wave 1 L1 + L2 + B1/B2 |
| M2 | All routes built; form check and Pro work; nutrition and steps work | Wave 1 + 2 |
| M3 | Internal beta: Maestro green, accessibility pass, privacy review, DPDP export and delete live | Wave 3 |
