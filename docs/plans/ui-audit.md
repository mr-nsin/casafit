# UI audit: tap every control

Generated 2026-11-11 by `npm run audit` (`app/src/__audit__`). Machine-readable copy: `app/audit-report.json`. Known issues live in `app/src/__audit__/allowlist.json`; a finding that is not listed there fails the audit test.

## How it works

Each screen is rendered on its own in Jest with the same wiring as `bootstrap` (real database on SQLite, real stores, fakes for network, camera, purchases, step counter, notifications). Every pressable (buttons, rows, chips, tabs, switches, accessibility actions, text fields) is found in the rendered tree and pressed on a fresh copy of the screen. After each press the audit looks for: a navigation call, a store change, a changed screen, an opened overlay, a call into a dependency (database write, API, share, link), or an error. A press that does none of these is reported. Controls that open a sheet or dialog, or reveal new controls, are followed one level and their controls are pressed too.

Severity: **broken** (no handler, throws, screen crash, navigates to a route that is not registered or needs a param it did not get), **suspicious** (press changes nothing observable, console errors, hit area under 44 px, no controls on a screen), **ok-but-unlabelled** (works, but a screen reader has no name for it).

Limits: Jest cannot see layout, so hit areas are only checked where a size is written in the style. It cannot feel gestures, native prompts or the camera (see "Needs device"). A "nothing happens" result can be a false alarm when the press is meant to be a no-op in that state; check the cause line.

## Summary

- Routes covered: 68 (148 screen states)
- Controls found: 1519; pressed: 1476
- Findings (distinct screen, control and issue): 39
- By severity (control results): ok 1465, suspicious 36, broken 9, ok-but-unlabelled 9
- By outcome: navigated 955, opened-overlay 13, state-changed 432, disabled 32, called-dep 41, nothing 4, no-handler 9, noop-expected 31, skipped-hidden 2
- Findings by issue: keyboard-swallows-first-tap 4, no-handler 2, disabled-no-hint 21, no-exit 2, nothing-happens 4, no-accessible-label 6

## Broken (6)

| Screen | Control | Issue | Seen in | Detail | Likely cause |
|---|---|---|---|---|---|
| EditProfile | (ScrollView with 8 controls and a text field) | keyboard-swallows-first-tap | edit | ScrollView has no keyboardShouldPersistTaps="handled". With the keyboard open, the first tap on a control inside it only closes the keyboard. Confirm on a devic | `src/features/settings/Page.tsx:36` |
| FoodSearch | (ScrollView with 40 controls, text field outside it) | keyboard-swallows-first-tap | lunch; no slot | ScrollView has no keyboardShouldPersistTaps="handled". With the keyboard open, the first tap on a control inside it only closes the keyboard. Confirm on a devic | `src/features/nutrition/screens/FoodSearchScreen.tsx:54` |
| Help | (ScrollView with 8 controls and a text field) | keyboard-swallows-first-tap | closed; privacy open | ScrollView has no keyboardShouldPersistTaps="handled". With the keyboard open, the first tap on a control inside it only closes the keyboard. Confirm on a devic | `src/features/settings/Page.tsx:36` |
| Picker | (ScrollView with 7 controls, text field outside it) | keyboard-swallows-first-tap | add; swap | ScrollView has no keyboardShouldPersistTaps="handled". With the keyboard open, the first tap on a control inside it only closes the keyboard. Confirm on a devic | `src/features/session/browse/EditScreens.tsx:482` |
| Settings | Account, Signed in with Google as p***@gmail.com | no-handler | free user; Pro user | Looks pressable (role or touch responder) but no onPress, onLongPress, onPressIn or onPressOut reaches it. | `src/features/settings/SettingsScreen.tsx:114` |
| WeekOne | Thu, Today, today | no-handler | after build | Looks pressable (role or touch responder) but no onPress, onLongPress, onPressIn or onPressOut reaches it. | `src/features/onboarding/screens/Finish.tsx:161` |

## Suspicious (6)

| Screen | Control | Issue | Seen in | Detail | Likely cause |
|---|---|---|---|---|---|
| Offline | (whole screen: no way out) | no-exit | offline | No control on this screen (or in what it opens) navigates anywhere. The user can only leave with the system back gesture, if the screen allows it. | unknown |
| Player | Previous move | nothing-happens | warm-up (real plan) | Pressed with a handler present, but no navigation, store, screen, dependency or overlay change followed. | `src/features/session/screens/StageScreen.tsx:135` |
| ReverseTimer | (whole screen: no way out) | no-exit | no bout | No control on this screen (or in what it opens) navigates anywhere. The user can only leave with the system back gesture, if the screen allows it. | unknown |
| ReverseTimer | Close | nothing-happens | no bout | Pressed with a handler present, but no navigation, store, screen, dependency or overlay change followed. | `src/features/steps/ReverseScreens.tsx:167` |
| ReverseTimer | Stop bout | nothing-happens | no bout | Pressed with a handler present, but no navigation, store, screen, dependency or overlay change followed. | `src/features/steps/ReverseScreens.tsx:168` |
| Verify | Continue with email > One-time code, 0 of 6 digits entered | nothing-happens | email prefilled | Pressed with a handler present, but no navigation, store, screen, dependency or overlay change followed. | `src/features/onboarding/screens/Verify.tsx:277` |

## Disabled with no explanation (review: usually correct for that state) (21)

| Screen | Control | Issue | Seen in | Detail | Likely cause |
|---|---|---|---|---|---|
| Age | Continue | disabled-no-hint | empty; under 18 | Disabled with no hint saying why (may be correct for this state). | unknown |
| Editor | Move Donkey kick later | disabled-no-hint | today; from plan | Disabled with no hint saying why (may be correct for this state). | unknown |
| Editor | Move Forearm plank earlier | disabled-no-hint | today; from plan; add a move | Disabled with no hint saying why (may be correct for this state). | unknown |
| Editor | Move Squat later | disabled-no-hint | add a move | Disabled with no hint saying why (may be correct for this state). | unknown |
| Editor | Save to my plan | disabled-no-hint | today; from plan | Disabled with no hint saying why (may be correct for this state). | unknown |
| Exercise | Harder: This is the hardest | disabled-no-hint | plank (hold) | Disabled with no hint saying why (may be correct for this state). | unknown |
| FoodEmpty | Same as yesterday | disabled-no-hint | nothing logged | Disabled with no hint saying why (may be correct for this state). | unknown |
| FormCheck | Lunge | disabled-no-hint | pick a move, free; pick a move, Pro; no free checks left | Disabled with no hint saying why (may be correct for this state). | unknown |
| Goals | Next: about you | disabled-no-hint | empty | Disabled with no hint saying why (may be correct for this state). | unknown |
| Mix | Increase Dance days | disabled-no-hint | three styles | Disabled with no hint saying why (may be correct for this state). | unknown |
| Mix | Increase Normal days | disabled-no-hint | three styles | Disabled with no hint saying why (may be correct for this state). | unknown |
| Mix | Increase Yoga days | disabled-no-hint | three styles | Disabled with no hint saying why (may be correct for this state). | unknown |
| Notify | Sunday recap | disabled-no-hint | permission denied | Disabled with no hint saying why (may be correct for this state). | unknown |
| NutriProfile | Build my food plan | disabled-no-hint | new | Disabled with no hint saying why (may be correct for this state). | unknown |
| Nutrition | Same as yesterday | disabled-no-hint | no profile; profile and plan; calories hidden | Disabled with no hint saying why (may be correct for this state). | unknown |
| Reverse | Start a bout | disabled-no-hint | ready | Disabled with no hint saying why (may be correct for this state). | unknown |
| Verify | Continue with email | disabled-no-hint | email step | Disabled with no hint saying why (may be correct for this state). | unknown |
| Verify | Continue with email > Verify and continue | disabled-no-hint | email prefilled | Disabled with no hint saying why (may be correct for this state). | unknown |
| WeekPlan | Next week | disabled-no-hint | this week; rest day today | Disabled with no hint saying why (may be correct for this state). | unknown |
| WeekPlan | Previous week | disabled-no-hint | this week; rest day today | Disabled with no hint saying why (may be correct for this state). | unknown |
| WeekPlan | Start today | disabled-no-hint | rest day today | Disabled with no hint saying why (may be correct for this state). | unknown |

## Works but has no accessible name (6)

| Screen | Control | Issue | Seen in | Detail | Likely cause |
|---|---|---|---|---|---|
| Notify | (no label switch/switch, near "recapYour week in one card, inside this ") | no-accessible-label | permission granted; permission denied; not asked |  | unknown |
| Privacy | (no label switch/switch, near "answersPain areas and health flags, to k") | no-accessible-label | consents |  | unknown |
| Privacy | (no label switch/switch, near "countFrom your phone's sensor or Health ") | no-accessible-label | consents |  | unknown |
| Privacy | (no label switch/switch, near "for form checksOnly while a check runs. ") | no-accessible-label | consents |  | unknown |
| Privacy | (no label switch/switch, near "improvementAnonymous usage counts. No he") | no-accessible-label | consents |  | unknown |
| Settings | (no label switch/switch, near "caloriesShow protein only") | no-accessible-label | free user; Pro user |  | unknown |

## Coverage by screen

| Screen | States | Controls | Pressed | Broken | Suspicious | Unlabelled |
|---|---|---|---|---|---|---|
| Splash | signed out | 0 | 0 | 0 | 0 | 0 |
| Welcome | first visit; session ended note | 4 | 4 | 0 | 0 | 0 |
| Age | empty; adult confirmed; under 18 | 27 | 25 | 0 | 1 | 0 |
| Verify | email step; email prefilled; send fails | 25 | 23 | 0 | 3 | 0 |
| Offline | offline | 3 | 3 | 0 | 1 | 0 |
| WelcomeBack | returning user | 1 | 1 | 0 | 0 | 0 |
| Goals | empty; body part goal | 25 | 24 | 0 | 1 | 0 |
| About | filled; empty | 60 | 60 | 0 | 0 | 0 |
| Mix | three styles | 8 | 5 | 0 | 3 | 0 |
| Health | none ticked; flag ticked | 8 | 8 | 0 | 0 | 0 |
| Building | building | 1 | 1 | 0 | 0 | 0 |
| WeekOne | after build | 9 | 2 | 1 | 0 | 0 |
| Workout | training day; training day, Pro; training day, steps and food logged; calories hidden; rest day, walk; rest day, stretch; resume card; finished but not saved; comeback after 9 days; no plan; plan load error | 276 | 276 | 0 | 0 | 0 |
| HomeRest | rest layout | 13 | 13 | 0 | 0 | 0 |
| WeekPlan | this week; rest day today; no plan | 40 | 35 | 0 | 3 | 0 |
| Why | answers; no pain areas | 15 | 15 | 0 | 0 | 0 |
| Plan | today; stretch day; walk day; ready-made; day not found | 26 | 26 | 0 | 0 | 0 |
| Library | all plans; knee pain | 38 | 38 | 0 | 0 | 0 |
| BodyPart | core; arms with wrist pain | 35 | 35 | 0 | 0 | 0 |
| Editor | today; from plan; add a move; no session on day | 89 | 81 | 0 | 4 | 0 |
| Picker | add; swap | 78 | 76 | 1 | 0 | 0 |
| Parts | cool-down; warm-up; work | 18 | 18 | 0 | 0 | 0 |
| Lunge | default; with excluded move | 6 | 6 | 0 | 0 | 0 |
| Exercise | squat; plank (hold); Pro user; unknown move | 22 | 21 | 0 | 1 | 0 |
| CheckIn | weekly check-in; no sessions | 24 | 24 | 0 | 0 | 0 |
| Player | warm-up (real plan); work set; form-checkable move; form-checkable move, Pro; no session | 43 | 43 | 0 | 1 | 0 |
| Yoga | work pose | 8 | 8 | 0 | 0 | 0 |
| Dance | work move | 7 | 7 | 0 | 0 | 0 |
| Rest | between sets | 4 | 4 | 0 | 0 | 0 |
| Paused | paused by user; paused for camera | 10 | 10 | 0 | 0 | 0 |
| EndSession | confirm end | 3 | 3 | 0 | 0 | 0 |
| Feel | how did it feel | 4 | 4 | 0 | 0 | 0 |
| SessionSettings | settings sheet | 7 | 7 | 0 | 0 | 0 |
| Complete | finished session; finished, Pro | 12 | 12 | 0 | 0 | 0 |
| Desk | desk reset | 3 | 3 | 0 | 0 | 0 |
| CameraPermission | not asked yet; granted | 6 | 6 | 0 | 0 | 0 |
| FormCheck | pick a move, free; pick a move, Pro; no free checks left | 24 | 21 | 0 | 1 | 0 |
| LiveCheck | simulated camera; rep count reached | 3 | 3 | 0 | 0 | 0 |
| FormResult | good result; needs work, no credits left; Pro unlimited; no result in memory | 10 | 10 | 0 | 0 | 0 |
| CameraDenied | permission denied | 3 | 3 | 0 | 0 | 0 |
| NoCredits | free checks used | 3 | 3 | 0 | 0 | 0 |
| Paywall | store offers; offline | 16 | 16 | 0 | 0 | 0 |
| ManagePro | active, renews; trial; cancelled; billing issue; lapsed | 20 | 20 | 0 | 0 | 0 |
| ProWelcome | after purchase; after restore | 4 | 4 | 0 | 0 | 0 |
| Nutrition | no profile; profile and plan; calories hidden; load error | 10 | 7 | 0 | 1 | 0 |
| NutriProfile | new; existing profile | 36 | 35 | 0 | 1 | 0 |
| NutriPlan | with plan; no profile | 16 | 16 | 0 | 0 | 0 |
| FoodSearch | lunch; no slot | 106 | 106 | 1 | 0 | 0 |
| Meal | dal for lunch; no food chosen | 23 | 23 | 0 | 0 | 0 |
| FoodEmpty | nothing logged | 6 | 5 | 0 | 1 | 0 |
| Steps | granted; needs primer; denied; unavailable | 21 | 21 | 0 | 0 | 0 |
| StepsPermission | primer | 3 | 3 | 0 | 0 | 0 |
| Reverse | ready; blocked by a health flag | 6 | 5 | 0 | 1 | 0 |
| ReverseTimer | bout running; no bout | 4 | 4 | 0 | 3 | 0 |
| Progress | with history; empty; load error | 2 | 2 | 0 | 0 | 0 |
| ProgressEmpty | nothing yet | 1 | 1 | 0 | 0 | 0 |
| Recap | with history; empty | 4 | 4 | 0 | 0 | 0 |
| Learn | myths | 21 | 21 | 0 | 0 | 0 |
| Myth | first myth; unknown id | 5 | 5 | 0 | 0 | 0 |
| Concepts | first concept; no id | 22 | 22 | 0 | 0 | 0 |
| Settings | free user; Pro user | 52 | 50 | 1 | 0 | 1 |
| Notify | permission granted; permission denied; not asked | 53 | 52 | 0 | 1 | 1 |
| Language | languages | 7 | 7 | 0 | 0 | 0 |
| Privacy | consents | 13 | 13 | 0 | 0 | 4 |
| Profile | signed in; no name | 24 | 24 | 0 | 0 | 0 |
| EditProfile | edit | 14 | 14 | 1 | 0 | 0 |
| Help | closed; privacy open | 20 | 20 | 1 | 0 | 0 |
| DeleteAccount | confirm; offline | 9 | 9 | 0 | 0 | 0 |

## Needs device (hand to the Maestro pass)

Jest cannot judge these. Check each on the emulator or a phone.

- Google, Apple and Facebook sign-in open a system browser or native sheet (Verify)
- Email code arrives from Supabase (Verify)
- Tab bar and scroll position are not rendered here (Workout)
- Sound cues and haptics (Player)
- Keep-awake (Player)
- Screen rotation and the backgrounded timer (Player)
- Beat timing against the music tempo (Dance)
- The real Android and iOS camera permission prompt (CameraPermission)
- Camera preview and framing guide (FormCheck)
- Real pose landmarks, frame rate and heat (casafit-pose module) (LiveCheck)
- Camera preview, mirrored front camera (LiveCheck)
- Opening system settings and coming back (CameraDenied)
- The Play Store or App Store purchase sheet (Paywall)
- Restore purchases against a real store account (Paywall)
- The Health Connect permission screen (Steps)
- Health Connect and motion permission prompts (StepsPermission)
- Live step count, screen kept awake, haptic at the end (ReverseTimer)
- The real notification permission prompt and scheduled delivery (Notify)
- Server-side delete and sign-out (needs the real API) (DeleteAccount)
- Drag to reorder moves in the Editor (gesture-handler pan on the drag handle; the up and down buttons are audited)
- Scrolling, pull to refresh, swipe-back and the Android back button
- Real hit areas, overlap and anything off screen (Jest has no layout)
- Keyboard: opening, autofocus on the code boxes, "next" and "done" keys, screen resize
- Bottom tab bar taps and tab state (rendered by React Navigation, outside the screens)
- Status bar colour, safe areas, notches
- Sound, haptics, keep-awake, notifications arriving
- Dark theme and font scaling

## Not audited, and why

- Splash has no controls and leaves by itself on a timer. Building runs a build on a timer and navigates by itself; only its one button is pressed.
- Tab bar buttons and the native-stack header: owned by React Navigation, not by a screen. Maestro covers them.
- Drag-to-reorder in the Editor: a native gesture. The up and down buttons are pressed.
- Anything behind a native prompt (camera, Health Connect, notifications, store purchase sheet, Google or Apple sign-in): the audit presses the button and checks the app asks, but cannot answer the prompt.
- Screens reached only through a state the seed cannot reach (for example a live pose stream with real landmarks).

## Known issues (allowlist)

12 entries in `app/src/__audit__/allowlist.json`. Remove an entry when its control is fixed; the audit prints entries that no longer match.

