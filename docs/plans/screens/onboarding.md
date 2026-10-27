# Onboarding screens: implementation spec

Source: `project/m3-{splash,welcome,age,verify,otperror,offline,welcomeback,goals,mix,about,health,building,weekone,lapsed}.dc.html`. 14 files, 13 routes (`otperror` = a `Verify` state, see A1). All screens are 390x844, light and dark via `dark` prop, tokens `--p --pc --sc --tc --bg --on --osv --ol --c1..c4 --er --erc`. Navigation is React Navigation 7 native-stack. API paths are from tech-stack 2.5. "Reduced motion" below means: when `AccessibilityInfo.isReduceMotionEnabled` is true, skip every animation and render the end state (the HTML does this with `.m3 *{animation:none!important}`).

## Flow (as linked in the HTML)
`Splash -> Welcome -> Age -> Verify -> Goals -> (Mix if 3 styles) -> About -> (Health if a flag) -> Building -> WeekOne -> Player | Home`
Branches: `Welcome "Log in" -> Verify`; `Verify (returning account) -> WelcomeBack -> Home`; `Verify (no network) -> Offline`; `Lapsed` is a Home variant, not part of the first-run chain.
Existing code: `Welcome.tsx` goes straight to `Verify` (skips `Age`), `Verify.tsx` replaces to `Home` (skips Goals..WeekOne). `RootStackParamList` has only Welcome, Verify, Home.

## Common rules for every screen
- Safe-area padding: top 8 (app bar 56 high), sides 16, bottom 24. Primary CTA is 56 high, full width, pill (r28), pinned to the bottom (absolute in HTML; use a footer View so the keyboard pushes it).
- Back = 48x48 round icon button, label "Back". Hardware back and iOS swipe-back must behave the same as the arrow.
- Focus ring: 3 px `--p`, offset 3 (2 on label rows) on every pressable; implement via `onFocus`/`onBlur` for hardware keyboard and switch access.
- Min text 12 px, sentence case, `fontVariant: ['tabular-nums']`, Roboto Flex. Icons Material Symbols Rounded, filled when selected.
- Selected state is never colour alone: always an added check icon or `check_circle`.

---
## 1. Splash (`Splash`)
- **Purpose**: brand moment while the app hydrates `useAuth` (SecureStore) and opens the local DB.
- **States**: one only (primary-colour background, logo tile, "casafit", "15 minutes, at home", 4 px loading bar).
- **Components**: `SplashLogo`, `ProgressBar` (indeterminate/timed).
- **Data**: reads `useAuth.session` + 7-day grace (`auth.ts` GRACE_MS), `plan` row exists, `lastSessionAt`.
- **Nav out**: HTML links the whole screen to `Welcome`. Real routing: no session or grace expired -> `Welcome`; valid session and plan -> `Home` (or `Home` lapsed variant); valid session, no plan -> `Goals`.
- **Motion**: logo tile "breathe" scale 1 -> 1.06, 2.4 s, infinite; bar fills 0 -> 100% in 1.6 s. Reduced motion: static logo, bar full.
- **A11y**: HTML wraps everything in a link "Open CasaFit"; in RN make it non-interactive, announce "CasaFit, loading". Bar has `role=progressbar` label "Loading" with no value.
- **Offline**: no network calls. Must not block on network.
- **Flags**: tap target covers the screen (accidental skip) A9; two animations at once (A10); `rgba(255,255,255,.3)` track and `opacity:.85` text are not tokens; bar is fake (fixed 1.6 s) not tied to hydration.

## 2. Welcome (`Welcome`)
- **Purpose**: pitch the 15-minute format, start onboarding or log in.
- **States**: single. Decorative blobs (`pc` circle, `tc` rotated square, `sc` circle), brand row, big "15" + "minutes", H1 "A whole workout, at home, with nothing but you.", body line, session bar (Warm-up 2 / Work 11 min / Cool 2 = flex 2:11:2), CTA.
- **Components**: `BlobBackground`, `SessionSegmentBar`, `FilledButton` (leading none, trailing `arrow_forward`), `TextButton` ("Log in").
- **Data**: none. Static copy.
- **Nav out**: "Get my 15-minute plan" -> `Age`. "Log in" -> `Verify` (same destination as the new-user flow, but should set `mode: 'login'` so a not-found account is handled; see A5).
- **Motion**: "15" `pop` (scale .6 -> 1, .8 s) then bar `reveal` (clip-path wipe, 1 s, delay .5 s). Reduced motion: both static.
- **A11y**: "15" + "minutes" are one text group "15 minutes"; blobs hidden. Log in is a 48 px target. Bar: single label "2 minutes warm-up, 11 minutes work, 2 minutes cool-down".
- **Offline**: works offline (no calls).
- **Flags**: `RN Welcome.tsx` uses 128 px for "15", design uses 176 px and letter-spacing -8; two animations in sequence (A10); "Warm-up 2" and "Cool 2" lack "min" while "11 min" has it.

## 3. Age (`Age`)
- **Purpose**: self-declared 18+ gate before any account exists (PRD Q18).
- **States**: shown = year 1998 selected, checkbox ticked, info banner always visible. Not drawn: year empty, checkbox unticked, under-18 result, year picker open.
- **Components**: `TopBar` (back only), `HeroNumber` ("18+" card, r32, `c3` bg), `SelectField` (outlined, floating label "Year of birth", `arrow_drop_down`), `CheckboxRow`, `StatusBanner variant="info"` (`sc`), `FilledButton`.
- **Data**: writes `onboarding.birthYear` (number) and `onboarding.confirmed18` (bool) to the local draft. Not sent until `PUT /v1/me/plan`.
- **Nav out**: Back -> `Welcome`. Continue -> `Verify`.
- **Motion**: none.
- **A11y**: year field is a picker button, role "combobox" or "button", label "Year of birth, 1998"; checkbox row min 48 (44 px box); banner is `role=note`.
- **Offline**: fine.
- **Flags**: year of birth AND a checkbox is redundant; `About` asks "Age" again (A4); Continue has no disabled style and no blocked state for under-18; the banner reads as a warning but is permanent; field in HTML is a div, not a real control.

## 4. Verify (`Verify`) and OtpError (state `codeError` of Verify)
- **Purpose**: phone or email verification with a 6-digit code; the account key.
- **States in `verify`**: tabs Phone (selected) / Email (not drawn); `+91` selector (static); mobile number field focused (2 px `--p`) with value "98765 43210"; code card "Code sent to +91 98765 43210" with timer "0:24", 4 digits filled, 5th box active, 6th empty; thin 42% bar with "Reading the code automatically"; privacy line with `verified_user` icon + "Privacy notice" link; CTA "Verify and continue"; outlined "Continue with Google".
- **States in `otperror`**: title "Enter the code", subtitle with number, 6 red boxes (5 digits filled), `role=alert` "That code is not right. 2 tries left.", "Resend code in 0:24" (disabled row), "Wrong number? Change it", lock banner (`c3`), CTA disabled (12%/38% on-colour).
- **Not drawn (required by onboarding.md task 1, PRD 5)**: Email tab body, empty fields, invalid number, sending spinner, "Resend code" enabled, code expired (5 min), locked after 3 attempts, 5 sends per hour reached, attestation failed, "device used its free checks" line, success transition.
- **Components**: `TopBar`, `SegmentedControl` (2 tabs), `TextField` (phone/email), `SelectField` (country code), `OtpField`, `ProgressBar` (auto-read), `StatusBanner` (info/error/lock), `FilledButton`, `OutlinedButton` (Google), `TextButton`.
- **Data**: `POST /v1/auth/code {phone|email}`, `POST /v1/auth/verify {phone|email, code}` -> `useAuth.save()` (tokens + `freeChecksRemaining` + `pro`). Reads `onboarding.confirmed18`. Normalise identifier with `shared/` before send.
- **Nav out**: Back -> `Welcome` (in `otperror`: Back -> `Verify` phone entry). Verify success: new account -> `Goals`; existing account with plan -> `WelcomeBack`. Google -> `Goals` in HTML (real: same new/returning branch). Network error on send -> `Offline`. "Change it" -> number field, code cleared.
- **Motion**: none in file. `nudge` keyframe exists in the shared CSS (shake on error) but is unused here; adding it would be a second motion, so skip.
- **A11y**: boxes are divs in HTML. Build one hidden `TextInput` (`textContentType="oneTimeCode"`, `autoComplete="sms-otp"`, `maxLength=6`, numeric) with six visual cells; group label "Code, 6 digits"; error is an assertive live region; timer announced at 0:30 start and at 0:00 ("You can resend now") only. Android: SMS Retriever / User Consent API; iOS: OS autofill. Tabs `role=tablist`, each 48 high.
- **Offline**: send and verify need the network. First-run offline -> `Offline`. Already verified user inside grace never reaches this screen.
- **Flags**: A1, A3, A5, A6; heading says "Verify your number" even on the Email tab; Google button bypasses the code and is shown on the Phone tab; error state shows 5 digits and an error already (A6); box height 52 in verify vs 56 in otperror; privacy line appears below the CTA area in the layout but PRD says "above the verify button".

## 5. Offline (`Offline`)
- **Purpose**: first run with no network; explains verification is needed once.
- **States**: single. `cloud_off` badge on 160 circle (`c4`), H1 "Connect to start", body, `StatusBanner` (`wifi_off`, role=status) "No internet connection right now.", "Try again", "Why do you need this?". Not drawn: retrying spinner, back-online auto-advance, send failed on server error.
- **Components**: `IconBadge`, `StatusBanner`, `FilledButton` (leading `refresh`), `TextButton`.
- **Data**: reads NetInfo `isConnected`. No writes.
- **Nav out**: "Try again" -> `Verify` (re-check connectivity first; if still offline stay). "Why do you need this?" -> `Welcome` in HTML (odd; real: a short explainer sheet, see A7). When NetInfo reports online, auto-advance to `Verify`.
- **Motion**: badge `pop` .5 s. Reduced motion: static.
- **A11y**: banner `role=status` (polite). Both buttons 56 high. Title is the first focus target.
- **Offline**: this is the offline screen. Users with a verified session never see it; they can start downloaded sessions.
- **Flags**: no Back; no path to "continue as guest" (correct per PRD 5 but state it in the plan).

## 6. WelcomeBack (`WelcomeBack`)
- **Purpose**: returning verified user, everything restored.
- **States**: single. Waving-hand tile, H1 "Welcome back, Priya", masked number "+91 98765 ••••• 10", three rows (plan and progress, food log and saved meals, tertiary row "1 free form check left"), info line "Free form checks belong to your account...", CTA. Variants not drawn: Pro active (replace third row), 0 checks left, email account (mask email), restore failed/partial, name unknown.
- **Components**: `IconBadge` (waving), `ChecklistItem` (check_circle, tone `c3` or `tc`), `StatusBanner variant="plain"`, `FilledButton`.
- **Data**: reads `GET /v1/me`, `GET /v1/me/entitlements`, restored `plan`, session/food counts; writes local plan, logs (hydrate Op-SQLite), `onboarded=true`.
- **Nav out**: "Go to my home screen" -> `Home` (reset stack). Back disabled (no Back in design).
- **Motion**: one orchestrated moment: tile `pop`, rows `rise` at .2/.35/.5 s. Reduced motion: static.
- **A11y**: rows are a list; "1 free form check left" read as "1 of 2 free form checks left"? (HTML says only "1 free form check left"). CTA 56.
- **Offline**: only reachable right after a successful verify, so online. Data download can continue in background.
- **Flags**: A8 (name "Priya" is never collected); number mask hides 5 digits in the middle in a way that differs from the verify format; the HTML claims "Food log and saved meals" restored but data-model says food logs sync daily (may be up to a day old).

## 7. Goals (`Goals`) - step 1 of 2
- **Purpose**: goal, body parts, styles.
- **States**: shown = goal "Train specific body parts" selected, parts Core + Glutes selected (max 2), styles Normal + Yoga selected, Dance unselected. Not drawn: nothing selected, "Stay fit" selected (parts section hidden per onboarding.md), 3 parts attempted (3rd chip blocked), 0 styles (Next disabled), 3 styles (Next goes to `Mix`).
- **Components**: `TopBar` (back + "1 of 2"), `ProgressBar` (50%, role=progressbar valuenow=50), `ChoiceCard` x2 (96 high, icon + label + check_circle when selected), `Chip` x7 (filter chip, 44 high, check icon when selected), `StyleTile` x3 (112 high, 32 px icon), `SectionLabel` (title + hint), `FilledButton` ("Next: about you" + `arrow_forward`).
- **Data**: writes `goal` (`stay_fit | body_part`), `bodyParts: BodyPart[]` (max 2), `styles: Style[]` (min 1). `gentler` goal is never chosen here; derived from health flags.
- **Nav out**: Back -> `Verify` (HTML) (see A2). Next -> `About`; with 3 styles -> `Mix`. Inline link "you choose the mix" -> `Mix`.
- **Motion**: none.
- **A11y**: goal cards `radio` (one of two); chips and style tiles `checkbox`; `aria-pressed` -> `accessibilityState.selected`. Hint "Up to 2" announced via `accessibilityHint`. Chip row wraps; each chip >= 44x44 with 8 gap.
- **Offline**: fine.
- **Flags**: A2; body-part section is always visible (onboarding.md: only when "specific"); helper text 12 px with an inline link is a small target (needs 44 px hit slop); Mix is reachable only by text link in HTML but PRD says all three styles open it.

## 8. Mix (`Mix`)
- **Purpose**: split training days across three styles.
- **States**: shown = 4 of 4 assigned: Normal 2, Dance 1, Yoga 1. Not drawn: under-assigned (chip becomes neutral, "Use this mix" disabled), over-assigned (plus disabled), a style at 0, days unknown (A2).
- **Components**: `TopBar`, `StatusChip` ("4 of 4 days assigned", `tc`), `StyleStepperRow` x3 (88 high, r24, icon + name + one-line description + `Stepper`), `Stepper` (48 px minus/plus, live count), `WeekStrip` of `DayPill` (7, 40 high), `StatusBanner variant="info"`, `FilledButton`.
- **Data**: reads `daysPerWeek`, `styles`; writes `mix: Record<Style, number>` (sums to `daysPerWeek`). Row backgrounds: Normal `sc`, Dance `pc`, Yoga `tc`.
- **Nav out**: Back -> `Goals`. "Use this mix" -> `About`.
- **Motion**: none.
- **A11y**: stepper buttons labelled "One fewer Normal day"/"One more Normal day"; count is `aria-live=polite`. Disabled plus/minus at bounds with `accessibilityState.disabled`. Week strip: each day labelled "Monday, Normal".
- **Offline**: fine.
- **Flags**: A2 (needs days per week, which `About` asks later); week strip shows Tue walk, Fri stretch, Sun rest as dashed/plain pills, rule for day placement is not specified; example (2N+1D+1Y) disagrees with later screens (3N+1Y) - sample data only.

## 9. About (`About`) - step 2 of 2
- **Purpose**: body basics, experience, days per week, pain, health flags.
- **States**: shown = age 28, height 162, weight empty with dashed border + placeholder "Skip", Sex Woman, Experience On and off, 4 days, pain chip Knees, health flag None, consent ticked. Not drawn: validation errors, height skip, pain "None" vs others exclusivity, health flag selected (jumps to Health), keyboard open.
- **Components**: `TopBar` ("2 of 2"), `ProgressBar` (100%), `TextField` x3 (outlined, floating label, numeric), `SegmentedControl` x2 (Sex: Woman/Man/Other; Experience: New/On and off/Regular; 44 high), `SliderField` (3..7 step 1, 8 px track), `Chip` x6 (pain: None, Knees, Back, Shoulders, Wrists, Other), `Chip` x4 (health: Heart or BP, Pregnancy or postpartum, Recent surgery, None), `CheckboxRow`, `FilledButton` (leading `auto_awesome`, "Build my plan").
- **Data**: writes `age` (see A4), `heightCm?`, `weightKg?`, `sex`, `experience`, `daysPerWeek`, `painAreas[]`, `healthFlags[]`, `healthConsent`. Hint under pain: "We'll skip lunges and tell you why." (shown when Knees selected).
- **Nav out**: Back -> `Goals` (HTML; with 3 styles should be `Mix`; answers must persist). "Heart or BP" chip is an `<a>` -> `Health`. "Build my plan" -> `Building` (if any health flag set, via `Health`).
- **Motion**: none.
- **A11y**: labels programmatically tied to inputs; slider `accessibilityRole="adjustable"` with min 3 max 7 now 4, increment/decrement actions; value text "4 days"; segmented buttons `selected`; scroll content must fit 844 px (it is dense: 14 px gaps; test at 360x640 and 200% font scale).
- **Offline**: fine.
- **Flags**: A4 (age), A5 (consent pre-ticked), A11 (hard-coded hex `accent-color:#9C4400`), health chips: only Heart or BP routes to `Health`, other two are plain buttons; "None" in pain and in health both need mutual exclusion; height has no skip affordance (onboarding.md task 4 wants skip on height and weight); weight placeholder "Skip" is not a label.

## 10. Health (`Health`)
- **Purpose**: explain the gentler plan and take health-data consent.
- **States**: shown for heart or BP, consent ticked. Not drawn: pregnancy or postpartum, recent surgery, multiple flags, consent unticked (CTA disabled), privacy notice open.
- **Components**: `TopBar`, `StatusCard` ("What changes in your plan", `tc`, r28, 4 check_circle bullets), `StatusBanner variant="medical"` (`erc`, `medical_services`, role=note), `CheckboxRow` (outlined card, hidden native input), `TextButton` ("Read the privacy notice"), `FilledButton`.
- **Data**: reads `healthFlags`; writes `healthConsent: { granted: boolean, at: ISO }`, `plan.variant = 'gentler'`. Health data stays on the phone unless sync is on (data-model 5).
- **Nav out**: Back -> `About`. "Build my gentler plan" -> `Building`. Privacy notice -> `Home` in HTML (wrong; open a privacy sheet/webview).
- **Motion**: none.
- **A11y**: banner is `role=note` and is read before the checkbox; consent label = "Health data consent" with full sentence; 64 px row target.
- **Offline**: fine.
- **Flags**: A5 (two consent ticks, both pre-ticked), copy is heart-specific only; checkbox in HTML is custom-drawn over a 1 px hidden input; red container for a doctor note reads as an error while PRD says "does not block".

## 11. Building (`Building`)
- **Purpose**: short progress state while the plan is generated on the phone.
- **States**: shown mid-way: ring 78% built, two done rows ("4 days: 3 Normal, 1 Yoga", "Skipping lunges because of your knee"), one active (spinner, "Matching warm-ups to core and glutes"), one pending ("Building matching cool-downs"), CTA "See my plan" (tonal). Not drawn: 100%, error/retry, gentler variant rows.
- **Components**: `ProgressRing` (224 px, r96, stroke 12), `ChecklistItem` (state `done | active | pending`), `TonalButton`, `BlobBackground`.
- **Data**: reads the full answers draft; runs the local rules engine (no AI); writes `plan` + week-one sessions to Op-SQLite; then `PUT /v1/me/plan` (queue if offline). Sets `onboarded=true`.
- **Nav out**: auto-advance at 100%, or "See my plan" (enable only at 100%) -> `WeekOne`. Back: none.
- **Motion**: one orchestrated moment: ring `grow` 1.3 s, rows `rise` at .3/.7/1.1/1.5 s, spinner rotate .9 s loop. Reduced motion: ring at final value, all rows visible, spinner replaced by static `autorenew` icon.
- **A11y**: ring currently `role=img` "Plan 78 percent built" (static). Use `progressbar` with value and `accessibilityLiveRegion="polite"` updating at 25% steps. Each row labelled "done"/"in progress"/"waiting".
- **Offline**: generation is local; `PUT` is queued. Screen works with no network.
- **Flags**: A12 (local vs server plan), CTA is enabled while the plan is 78% built; the checklist rows are hard-coded to the sample answers and must be generated from them.

## 12. WeekOne (`WeekOne`)
- **Purpose**: plan preview and the single start action.
- **States**: badge "Your plan is ready", H1 "Week one", "Why this plan" line, 7 `DayPill` (Mon Today/Normal, Tue Walk dashed, Wed Yoga, Thu Full, Fri Stretch dashed, Sat Glutes, Sun Rest dashed), today's session card (Core + Glutes, 15:00, bar 2 / 11 min . 5 moves / 2, 5 numbered moves, "Lunges skipped because of your knee"), CTA, "Look around first". Not drawn: other weekdays, gentler variant, long list wrap.
- **Components**: `TopBar`, `Badge` ("Your plan is ready", `tc`), `WeekStrip`/`DayPill` (88 high, r16; states `today | planned | active-rest dashed | rest`), `SessionSummaryCard` (`pc`, r28), `SessionSegmentBar` (32 high), `FilledButton` (leading `play_arrow`), `TextButton` (48 high).
- **Data**: reads `plan`, week-one sessions, `painAreas` (skip reason).
- **Nav out**: Back -> `Building` (should be disabled; plan already built, A12). "Start today's session" -> `Player` (HTML) / `Home` (onboarding.md task 10 says "hand-off to the home screen"). "Look around first" -> `Home`.
- **Motion**: none.
- **A11y**: day pills are non-interactive; each reads "Monday, today, Normal session". Move list is an ordered list. Segment bar labelled like Welcome.
- **Offline**: fully local.
- **Flags**: A13 (hard-coded "Mon/Today" and calendar vs rolling week), A12, "Thu: Full" and "Sat: Glutes" labels are unexplained, 7 columns of ~47 px at 12 px text ("Stretch") is tight at large font scale.

## 13. Lapsed (`Home`, `variant="lapsed"`)
- **Purpose**: comeback variant of Home after a gap (PRD 19, idea 2). Belongs to the session lane's `Home`; spec'd here because it is a returning-user entry.
- **States**: "Thursday" kicker, "Good to see you, Priya", profile avatar, hero card (`tc`) "Welcome back / An easy 10 to start / It has been 10 days. No catching up needed...", "Start easy session", links "Your new week" (3 lighter sessions, then back to 4) and "Or just walk today", bottom nav (Workout selected, Nutrition, Progress). Not drawn: other gap lengths (copy has "10 days" baked in).
- **Components**: `GreetingHeader`, `HeroCard`, `PersonIllustration` (walking, two-frame loop), `FilledButton` (tertiary colours `--t/--ot`), `ListCard` (icon, title, subtitle, chevron; 72 high), `BottomNav` (3 tabs, 80 high, selected = 64x32 pill).
- **Data**: reads `lastSessionAt` (session_log), `plan`, `daysPerWeek`; writes a "lighter week" override on the plan (PRD: "quietly rebuilds the plan").
- **Nav out**: avatar -> `Profile`. "Start easy session" -> `Player` (easy 10-minute variant). "Your new week" -> `WeekPlan`. "Or just walk today" -> `Steps`. Tabs -> `Home`, `Nutrition`, `Progress`.
- **Motion**: stick-figure crossfades two frames every 1.4 s, infinite (`fa`/`fb`). Reduced motion: frame A only. Decorative; hidden from a11y.
- **A11y**: section "An easy restart"; nav `aria-current=page`; tabs 80 px high; list cards >= 72.
- **Offline**: fully local.
- **Flags**: A14 (threshold 10 days vs PRD 7), infinite animation, illustration uses hard-coded hex (`#8D5524`, `#2A1A12`) which breaks the "no hex" rule (people board exception unclear), `Profile` route is not in any lane list.

---
## Ambiguities and conflicts (flagged, not fixed)
| # | Item |
|---|---|
| A1 | `otperror` is a separate layout (no phone field, different title) from `verify`. Build as one `Verify` route with states; confirm the designer agrees. Missing states listed in section 4. |
| A2 | `Mix` says "4 training days" but days per week is asked later on `About`. Order must change, or `Mix` gets its own days stepper. Also `Goals` Back goes to `Verify`, which a user cannot return to once verified (stack should reset after verify). |
| A3 | PRD says exactly two onboarding pages ("1 of 2", "2 of 2"). Design adds `Age` before verify and `Mix`, `Health` in between, none counted. Confirm which count the progress bar shows. |
| A4 | Year of birth on `Age` and a number "Age" on `About` duplicate each other. Proposal: store `birthYear` once, derive age; drop the field on `About`. Server `plan` table has no age/sex/height/weight (onboarding.md task 8 sends them). |
| A5 | Health consent is ticked by default on both `About` and `Health`. PRD 5/14 wants a separate, explicit consent; DPDP needs an active opt-in. Needs unticked default and one consent only. |
| A6 | `otperror` shows an incomplete code (5 of 6) already marked wrong. Error should appear after 6 digits. Also timer 0:24 is resend cooldown (30 s) while code validity is 5 min; neither is labelled in `verify`. |
| A7 | `Offline` "Why do you need this?" goes to `Welcome` and has no content. |
| A8 | "Welcome back, Priya": no screen collects a name. Needs a source (Google profile, Settings) and a fallback ("Welcome back"). |
| A9 | `Splash` is a full-screen link in the HTML; real routing is decided by auth state. |
| A10 | CLAUDE.md allows one orchestrated motion per screen. `Welcome` (pop then reveal), `Splash` (breathe + load), `Building` (ring + rows + spinner) and `Lapsed` (infinite loop) stretch it. |
| A11 | Hard-coded colour: `About` checkbox `accent-color:#9C4400`; `Lapsed` illustration hex; `Splash` rgba. Negative letter-spacing (-0.2 to -8 px) is used for headings; CLAUDE.md bans "tracked" spacing, unclear if negative counts. |
| A12 | `Building` says "Rules on your phone build this, so it works offline"; onboarding.md task 8 says `PUT /v1/me/plan` returns the generated plan. Pick local generation + upload. `WeekOne` Back to `Building` would re-run it. |
| A13 | `WeekOne` shows Mon as "Today"; a real user starts on any weekday. Rolling 7 days from today or calendar week? |
| A14 | `Lapsed` copy says 10 days; PRD says 7 days "to tune". Also `WeekOne` start -> `Player` vs task 10 "hand-off to Home". |
| A15 | Sending health flags to the server in `PUT /v1/me/plan` conflicts with data-model 5 ("Health answers: phone only unless sync is on"). Decide: send only the derived `variant` + pain exclusions, or flags as `plan.flags` with consent. |

## Shared components needed
| Component | Props | Used by |
|---|---|---|
| `TopBar` | `onBack?`, `stepLabel?`, `title?` | Age, Verify, Goals, Mix, About, Health, WeekOne |
| `ProgressBar` | `value?` (0-100, undefined = indeterminate), `label` | Goals, About, Verify (auto-read), Splash |
| `ProgressRing` | `value`, `size`, `label` | Building |
| `FilledButton` | `label`, `onPress`, `leadingIcon?`, `trailingIcon?`, `disabled?`, `loading?`, `tone? ('primary'|'tertiary')` | all |
| `TonalButton` | same as Filled | Building |
| `OutlinedButton` | `label`, `leadingIcon?`, `onPress` | Verify (Google) |
| `TextButton` | `label`, `onPress`, `minHeight 48` | Welcome, Offline, Health, WeekOne |
| `TextField` | `label`, `value`, `onChange`, `keyboardType`, `error?`, `optional?` (dashed), `suffix?` | Verify, About |
| `SelectField` | `label`, `valueLabel`, `onPress` | Age, Verify (+91) |
| `OtpField` | `length=6`, `value`, `onChange`, `state ('idle'|'error'|'filled')`, `autoRead` | Verify |
| `SegmentedControl` | `options[]`, `value`, `onChange`, `height 44/48` | Verify tabs, About (sex, experience) |
| `Chip` | `label`, `selected`, `onPress`, `role ('checkbox'|'radio')` | Goals, About |
| `ChoiceCard` | `icon`, `label`, `selected`, `onPress`, `size ('card'|'tile')` | Goals (goal, styles) |
| `StyleStepperRow` + `Stepper` | `style`, `count`, `min`, `max`, `onChange`, `tone` | Mix |
| `SliderField` | `min`, `max`, `value`, `label`, `onChange` | About |
| `CheckboxRow` | `checked`, `onChange`, `label`, `variant ('plain'|'card')` | Age, About, Health |
| `StatusBanner` | `variant ('info'|'error'|'neutral'|'medical'|'status')`, `icon`, `children`, `role` | Age, Verify, Offline, Health, Welcomeback, Mix |
| `StatusCard` | `title`, `items[]` | Health |
| `ChecklistItem` | `state ('done'|'active'|'pending')`, `icon?`, `tone?` | Building, WelcomeBack |
| `IconBadge` | `icon`, `size`, `shape ('circle'|'squircle')` | Offline, WelcomeBack, Splash |
| `BlobBackground` | `variant` | Welcome, WelcomeBack, Building |
| `SessionSegmentBar` | `warm=2`, `work=11`, `cool=2`, `height` | Welcome, WeekOne |
| `DayPill` / `WeekStrip` | `day`, `kind ('today'|'planned'|'active-rest'|'rest')`, `icon`, `caption` | Mix, WeekOne |
| `SessionSummaryCard` | `title`, `duration`, `moves[]`, `skipNote?` | WeekOne |
| `SectionLabel` | `title`, `hint?` | Goals, About |
| `PersonIllustration` | `pose`, `loop` | Lapsed |
| `GreetingHeader`, `HeroCard`, `ListCard`, `BottomNav` | see session lane | Lapsed |
| `useReducedMotion` hook | returns bool | all animated screens |
| `useNetworkStatus` hook | NetInfo wrapper | Offline, Verify, Splash |

## Data and state
```ts
type Style = 'normal' | 'yoga' | 'dance';
type BodyPart = 'arms' | 'chest' | 'back' | 'shoulders' | 'core' | 'glutes' | 'legs';
type Goal = 'stay_fit' | 'body_part';            // 'gentler' is derived from flags (data-model enum has it)
type Sex = 'woman' | 'man' | 'other';
type Experience = 'new' | 'on_and_off' | 'regular';   // matches plan.experience
type PainArea = 'knees' | 'back' | 'shoulders' | 'wrists' | 'other';   // empty array = "None"
type HealthFlag = 'heart_bp' | 'pregnancy' | 'recent_surgery';          // empty array = "None"

interface OnboardingDraft {
  birthYear: number | null;            // Age; derive age, 4-digit
  confirmed18: boolean;                // Age
  goal: Goal | null;                   // Goals
  bodyParts: BodyPart[];               // Goals; max 2, only if goal = body_part
  styles: Style[];                     // Goals; min 1
  mix: Partial<Record<Style, number>>; // Mix; only when styles.length === 3; sum = daysPerWeek
  heightCm: number | null;             // About; skippable
  weightKg: number | null;             // About; skippable
  sex: Sex | null;                     // About
  experience: Experience | null;       // About
  daysPerWeek: 3 | 4 | 5 | 6 | 7;      // About (default 4)
  painAreas: PainArea[];               // About
  healthFlags: HealthFlag[];           // About -> Health
  healthConsent: { granted: boolean; at: string } | null; // Health (single consent, see A5)
}
interface Plan { variant: 'standard' | 'gentler'; weekNumber: number; sessions: PlannedSession[]; skipped: { move: string; reason: PainArea }[]; }
interface Auth { session: { accessToken; refreshToken; verifiedAt }; freeChecksRemaining: number; pro: { active: boolean; expiresAt: string | null } }
```
| Data | Store | Persisted where | Server |
|---|---|---|---|
| `OnboardingDraft` (in progress) | Zustand `useOnboarding` with `persist` | Op-SQLite table `onboarding_draft` (single row JSON) so Back and app kill keep every answer; cleared when Building finishes | none |
| `birthYear`, `confirmed18` | draft -> `profile` table | Op-SQLite | not sent until Q18 decided (A4) |
| `heightCm`, `weightKg`, `sex`, `painAreas`, `healthFlags`, `healthConsent` | draft -> `profile` / `plan.flags` | Op-SQLite only; never in analytics | A15: only the derived `plan.variant` and exclusions go in `PUT /v1/me/plan` unless sync is on |
| `goal`, `styles`, `mix`, `daysPerWeek`, `experience` | draft -> `plan` table | Op-SQLite | `PUT /v1/me/plan` (goal, styles bitmask, days_per_week, experience, flags) |
| Generated `Plan` and week-one sessions | `usePlan` (TanStack Query over Drizzle) | Op-SQLite | metadata only |
| Session and entitlements | `useAuth` | expo-secure-store (`casafit.session`, `casafit.entitlements`), 7-day offline grace | source of truth: `/v1/auth/verify`, `/v1/me/entitlements` |
| `onboarded` | `useAuth`/profile | Op-SQLite + `account.onboarded` | set when Building completes |
| `lastSessionAt` | derived from `session_log` | Op-SQLite | none |
Queue: failed `PUT /v1/me/plan` is retried by the offline queue; `Building` never waits on it.
