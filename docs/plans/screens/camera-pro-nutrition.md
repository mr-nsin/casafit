# Screen specs: form check, Pro, nutrition (15 screens)

Source: `project/m3-*.dc.html` (390x844, light unless noted). All screens are single-state in the file except where "States" lists inferred variants (marked **inferred**, not drawn). Routes are PascalCase React Navigation names. Endpoints are from `docs/tech-stack.md` 2.5. "Flag" = conflict or gap, not fixed here.

Legend: PB = in-file placeholder link (wrong destination in the mock, real behaviour differs).

## Part A. Form-check flow

### Flow, as a sequence (free account)
1. Player (`Player`) -> tap Check form -> `CameraPermission` only if OS permission is `undetermined`; if `granted` skip to 3; if `denied` -> `CameraDenied`.
2. `CameraPermission` "Allow camera" -> OS prompt -> granted: `FormCheck`; denied: `CameraDenied`.
3. `FormCheck`: reads cached balance. Balance 0 and not Pro -> `NoCredits` (before camera opens). Else user picks exercise; optional free framing preview (no spend, no network).
4. "Start analysis": confirm copy is already on screen (no extra dialog). Client creates `idempotencyKey = uuid` for this attempt, persists `{attemptId, key, state:'armed'}` locally, then opens `LiveCheck`.
5. `LiveCheck`: pose runner (vision-camera frame processor + MediaPipe) runs in memory. Counts analysed reps (hold exercises: seconds, 10 s = threshold).
6. Spend point: **flag A1** (PRD says spend after rep 3 + user confirmation; architecture 4.2 says consume at start, refund if <3 reps). Recommended reading that satisfies both: call `POST /v1/entitlements/consume {key}` when rep 3 is reached (screen text "3 reps done. This check now counts."). If product wants server-side reservation first, consume at Start and `refund` with the SAME key on any exit before rep 3 (cancel, camera error, thermal stop, app killed, framing lost). Either way: same key for consume and refund, server unique `(account_id, kind, key)`, so retries are safe.
7. Run ends (user taps See result, or set auto-completes) -> `FormResult` shows rating and corrections computed locally. Free balance cache decremented once.
8. If balance is now 0: show `FormResult` first, then Pro offer (PRD 14). "Unlimited in Pro" CTA -> `Paywall`.
9. Camera session closes on screen blur/unmount/background. No frame, image, audio or landmark is written to disk or sent.

### State machine (text)
```
Idle(no perm) --allow--> PermGranted --open--> Gate
Idle --deny--> Denied (CameraDenied)  [no spend]
Gate --pro--> Ready
Gate --free,balance>0--> Ready
Gate --free,balance=0--> NoCredits
Ready(framing preview, free) --start--> Armed(key generated, nothing spent)
Armed --camera error|close|framing lost--> Cancelled (no spend, nothing to refund)
Armed --rep>=3 (or hold>=10s)--> Counted --consume ok--> Spent
Counted --consume offline--> SpentLocal (cache--, queue consume w/ key)
Counted --consume {ok:false,reason:no_credits}--> SpentLocal+Overdrawn (keep result, mark would-have-been-charged, balance=0)
Spent|SpentLocal --end--> Result(shown once, in memory) --done--> Player
Spent --crash/kill before Result--> on next launch: queue says Spent without result => keep spent (rep>=3 was met), no refund
Armed/Counted --pose runner failure after consume (if consume-at-start model)--> refund(key) --> Ready
Pro: same machine, consume and refund calls skipped, "Spent" state is a no-op
```
Idempotency rules: one key per attempt, stored in Op-SQLite `form_check_attempt` before the first network call; retry on reconnect re-sends the identical key; refund uses the key of the consume it reverses; refund only legal if the attempt never reached Counted (or consume-at-start model and <3 reps); never refund after a result was shown. Offline: spend from cache, sync later (PRD 14, data-model 3).

### What is stored / uploaded
| Item | Phone | Server |
|---|---|---|
| Camera frames, landmarks, audio | Memory only, no file | Never |
| Rep counts, per-rep ratings, corrections text | In memory for the result screen. Persisting is **flag A2** (screen says "Nothing was recorded or saved"; PRD offline rule says "the result is kept") | Never |
| Attempt record (key, exercise, state, timestamps) | Yes (needed for idempotent sync) | consume/refund events only (`form_check_event`) |
| Balance | Cache | Source of truth (`form_check_balance`) |
| Analytics | Event names + counts only, no health values | Yes |

---

### 1. CameraPermission (`m3-camera`)
- **Purpose:** pre-permission rationale before the OS camera prompt (PRD: ask at first use, with a separate consent line, section 15).
- **States:** single. **Inferred:** permission already granted (skip), blocked (route to `CameraDenied`).
- **Components:** BackButton (48 px), PrivacyHero (illustration: videocam + lock), PrivacyPoint x3 (videocam_off "Nothing is recorded", cloud_off "Nothing is uploaded", power_settings_new "Off when you leave"), BottomActions (primary Button + outlined Button).
- **Data:** reads OS camera permission (vision-camera `Camera.getCameraPermissionStatus`); writes a consent record (**flag A3**: no consent checkbox or ledger drawn; DPDP asks for specific consent, caption "You can change this any time in Settings" implies a Settings toggle that is not in any screen).
- **Nav in:** Player (Check form). **Out:** back arrow -> `Player`; "Allow camera" -> OS prompt -> `FormCheck` (PB: direct link); "Not now" -> `Player`.
- **Motion:** none. **A11y:** h1 is the screen title; decorative icons `aria-hidden`; buttons 56 px; focus ring.
- **Offline:** fully works. **Flags:** h1 32/800 with -0.4 px letter-spacing vs "no tracked letter-spacing" in CLAUDE.md (applies to all h1 here); pre-prompt must not be shown to Pro users twice.

### 2. FormCheck (`m3-form`) dark by default (camera exception for hex)
- **Purpose:** choose exercise, check framing, confirm spend, start.
- **States drawn:** exercise chips (Squat selected, Push-up, Plank, Lunge disabled "unavailable because of your knee"); framing guide with 4 corner brackets, dotted body outline, 6 joint dots, status chips: "Whole body in frame" (ok), "Light OK" (ok), "Step back a little" (arrow_back, hint); privacy line; footer sheet with spend notice and two actions.
- **Inferred:** Pro header ("Unlimited" instead of "2 free checks left", spend notice hidden); balance 1 ("1 free check left", "This will use your last free form check."); framing fail variants (too dark, partial body, too close); preview running vs idle; keyboard/landscape not designed.
- **Components:** TopBar (back + CreditBadge), ExerciseChipGroup (aria-pressed, 44 px), SkeletonOverlay (corners + outline + joints), FramingStatusChip, PrivacyNote, SpendConfirmSheet, Button.
- **Data:** reads `FormCheckBalance` cache, `Entitlement.isPro`, plan `flags` (pain areas) to disable exercises (knee -> lunge, and squat? **flag A4**: which exercises each pain flag blocks is unspecified). Writes attempt record on Start.
- **Nav in:** Player, `CameraPermission`, `ProWelcome` ("Try a form check"). **Out:** back -> `Player`; "Check framing (free)" is a `button`, runs preview in place (no nav); "Start analysis" -> `LiveCheck` (PB link).
- **Motion:** none on screen. **A11y:** SVG has role img + label; status chips need `aria-live=polite` as they change; disabled chip has explanatory label; chip text 13 px, status 12 px (min OK).
- **Offline:** works (cache). **Flags:** copy "only spent after 3 analysed reps" matches PRD; spec says "confirms before the camera starts" (PRD 14) but notice is passive text, not an explicit confirm tap (A1). Hold exercises: "3 reps" wording must become "10 seconds" for Plank.

### 3. LiveCheck (`m3-live`) dark, full-bleed camera
- **Purpose:** live analysis with one spoken/visual cue at a time.
- **States drawn:** header chip "Squat · free check 1 of 2"; skeleton with a flagged joint (red, pulsing) and good joints (yellow-green); cue pill (role=status, aria-live polite) "Knees out a little"; rep card "Reps analysed 4" with "3 reps done. This check now counts."; "See result"; footer "Nothing is recorded or saved".
- **Inferred:** pre-3-rep state ("n of 3 to count", no counted message); low-confidence state (no cue, stay quiet, PRD); no-pose-detected / lost framing banner; plank timer variant; Pro variant (chip "Squat · Pro").
- **Components:** CameraSurface (vision-camera), SkeletonOverlay (shared with FormCheck), CueToast, RepCounterCard, PrivacyFooter, TopBar (close, chip).
- **Data:** on-device only until the spend point (see flow step 6). Voice cues: TTS, max one per rep (PRD).
- **Nav in:** `FormCheck`. **Out:** close X -> `FormResult` (PB; **flag A5**: X before rep 3 must discard, cancel the attempt, no spend, return to `FormCheck`, not show a result); "See result" -> `FormResult`.
- **Motion:** knee marker `breathe` 1.6 s infinite; cue pill pop .35 s. Reduced motion: both off (global rule exists). Infinite loop breaks the "one moment per screen" rule only mildly (**flag**).
- **A11y:** skeleton is role img with a text description, cue is a live region, cue must also be spoken; close is 48 px. Colours hard-coded hex (allowed: camera view).
- **Offline:** fully on-device. Battery target under 6% per 15 min. Thermal throttling -> lower fps, show banner.

### 4. FormResult (`m3-formresult`)
- **Purpose:** summary after a run: rating, rep-by-rep, corrections, one tip.
- **States drawn:** ring "4/5" Good form (type "Good form", sentence "4 of 5 reps were clean. Nothing was recorded or saved."), rep chips 1-5 (check or priority_high), three finding rows (Depth ok, Knees warning, Back ok), tip card, actions "Unlimited in Pro" + "Done"; header chip "1 free check left".
- **Inferred:** rating bands (Needs work / Okay / Good), zero-warning variant ("Looks good" only when confident), last-credit variant (chip "No free checks left", Pro CTA emphasised), Pro variant (hide Pro CTA and chip), overdrawn offline variant (**flag A6**: "would have been charged" has no wording).
- **Components:** TopBar, CreditBadge, ScoreRing, RepChipRow, FindingRow, TipCard, ButtonPair.
- **Data:** `FormCheckResult` (in memory; see A2). Writes nothing else.
- **Nav in:** `LiveCheck`. **Out:** back and Done -> `Player` (or the exercise the user came from); "Unlimited in Pro" -> `Paywall`.
- **Motion:** ring `grow` 1.3 s, rep chips `pop` staggered .5 to .98 s: one orchestrated moment. Reduced motion respected.
- **A11y:** ring role img "Form rating: good" (add value text "4 of 5 reps clean"); each rep chip needs a label "Rep 3, knees caved in".
- **Offline:** works. **Flags:** sample numbers conflict with `m3-live` (4 reps analysed vs 5 reps here); rating is "4/5" while rating label wording is not defined in PRD; PRD says show set summary then Pro offer after 2nd credit, but CTA is shown unconditionally.

### 5. CameraDenied (`m3-camdenied`)
- **Purpose:** permission denied/blocked recovery.
- **States:** single (blocked). **Inferred:** "denied once, can ask again" vs "blocked, must use Settings"; iOS vs Android wording (copy says "Allow only while using the app", Android phrasing; iOS says "Allow" under Camera); restricted by device policy.
- **Components:** BackButton, HeroIllustration (videocam_off), InfoRow x2 (settings instructions, "did not use one of your free checks"), Button primary, Button text.
- **Data:** OS permission only; no balance read, none spent.
- **Nav in:** `CameraPermission`, `FormCheck` (when permission found revoked). **Out:** back -> `FormCheck`; "Open Settings" -> `Linking.openSettings()` (PB: link to form), re-check permission on app foreground then go to `FormCheck`; "Continue with voice cues only" -> `Player`.
- **Motion:** hero pop .5 s once. **A11y:** h1 + p order fine; icon decorative.
- **Offline:** works. **Flag:** "voice cues only" fallback has no definition in PRD for the four analysed exercises (player already has voice coach).

### 6. NoCredits (`m3-nocredits`)
- **Purpose:** free balance 0 gate, shown before camera opens.
- **States:** single. **Inferred:** server vs cache disagreement; "This device has used its free form checks" (PRD device-flag state) is not drawn.
- **Components:** CreditBadge-large (two empty photo_camera tiles, label "0 of 2 free form checks left"), ProPitchCard (title, 3 benefits), InfoRow (new phone restore), ButtonPair.
- **Data:** `FormCheckBalance` (cache + a fresh `GET /v1/me/entitlements` when online).
- **Nav in:** `FormCheck` gate, or `Player` Check form when balance 0. **Out:** close -> `Player`; "See Pro" -> `Paywall`; "Keep training with voice cues" -> `Player`.
- **Motion:** two tiles pop (.1 s, .2 s) once. **A11y:** group has aria-label on the container (not a role; add role=img).
- **Offline:** shows cached 0; "See Pro" needs network for offerings (show offline state on `Paywall`).
- **Flag:** "Restores on any phone once you verify" under a Pro list reads as if Pro includes restore only; fine, but benefit list repeats Paywall.

---

## Part B. Pro

### Pro entitlement model (RevenueCat)
Source of truth for UI: RevenueCat `CustomerInfo.entitlements.active['pro']` on device, cached 1 day; server cross-checks via webhook `POST /v1/webhooks/revenuecat` and `GET /v1/me/entitlements` (`{pro, until, creditsRemaining}`).
| State | Trigger | UI |
|---|---|---|
| `free` | never bought, or expired | Paywall offered; 2 lifetime credits as left (PRD Q15 assumed) |
| `trial` | intro offer active (**flag B1**: trial not decided, PRD Q13/Idea 5; no screen shows it) | ManagePro with "Trial ends on ..." |
| `active` | purchased, auto-renew on | ManagePro as drawn |
| `active_cancelled` | `willRenew=false` | "Pro until 14 October 2027, will not renew" (**inferred**) |
| `billing_issue` | grace period / retry | banner "Update your payment method" with store link (**inferred**) |
| `lapsed` | expired | back to free balance; Paywall again |
| `unknown_offline` | no network, cache older than 1 day | keep last known state through the 7-day offline grace (architecture 2.3); never pull Pro mid-session |
Restore: `Purchases.restorePurchases()` then refetch `/me/entitlements`; also automatic on verify (account-linked, `Purchases.logIn(accountId)`). Pro checks never consume or restore free credits.
Pricing display: use `offering.availablePackages[].product.priceString` (store-localised, region-correct, includes GST in India, local currency elsewhere). The mock's "Sample price" Rs 1,499 / Rs 199 must never be hard-coded. Save-percent computed from `price` (yearly vs 12x monthly) in the store currency; hide if not computable. UPI autopay for India (PRD) is a Play Billing capability, not drawn (**flag B2**). Required store disclosures (auto-renew terms, price after trial, Terms/Privacy links) are absent from Paywall (**flag B3**).

### 7. Paywall (`m3-paywall`)
- **Purpose:** sell Pro (unlimited checks).
- **States drawn:** eyebrow "CasaFit Pro", h1, 3 benefit rows (camera, lock, restore), plan radiogroup Yearly (selected, "Best value", price, "Sample price - save 37%") / Monthly, info row "You have used 0 of your 2 free checks. Free checks never expire.", footer: "Start Pro", "Restore purchase", "Maybe later".
- **Inferred:** loading offerings (skeleton cards), offerings failed/offline (message + retry, CTA disabled), purchase in progress (button spinner, disabled), purchase pending (Play pending), user-cancelled (stay), error, already Pro (redirect to `ManagePro`), trial variant (CTA "Start free trial", billing date line), balance variants (1 left, 0 left: swap info row).
- **Components:** TopBar(close), BenefitRow, PaywallPlanCard (role radio, price, badge, sub-label), InfoRow, Button, TextButton.
- **Data:** RevenueCat `getOfferings()`, `purchasePackage()`, `restorePurchases()`; reads `FormCheckBalance` for the info row (the "0 of 2" is a literal in the mock, make it dynamic).
- **Nav in:** `FormResult`, `NoCredits`, Settings. **Out:** close and "Maybe later" -> pop to caller (PB: both go Home); "Start Pro" -> purchase sheet -> `ProWelcome` on success (PB: direct); "Restore purchase" -> restore call, success -> `ProWelcome` or toast "Pro restored", none found -> toast "No purchase found" (PB: links to `ManagePro`).
- **Motion:** none. **A11y:** radiogroup with arrow-key semantic, selected state not by colour alone (add check icon); plan cards 44 px+.
- **Offline:** cannot purchase; show offline state, keep close/Maybe later.
- **Flags:** info row says "0 of 2 used" which conflicts with `NoCredits`/after-spend context; "Start Pro" implies no trial while PRD Idea 5 plans one; yearly-first emphasis vs PRD "Q13 open".

### 8. ManagePro (`m3-managepro`)
- **Purpose:** show and manage the subscription (state `active` only drawn).
- **States drawn:** status card "Active", "Pro - Yearly", "Renews on 14 October 2027 - Rs 1,499"; benefits (Unlimited form checks "12 checks used this month - still on this phone", "Works on any phone you verify - Linked to +91 ••••• 48210"); rows Restore purchase, Switch to monthly, Cancel Pro (open_in_new); footnote.
- **Inferred:** states in the Pro table (trial, cancelled, billing issue, lapsed, monthly plan "Switch to yearly").
- **Components:** TopBar, SubscriptionStatusCard, BenefitRow, ListRow (chevron / external), InfoFootnote.
- **Data:** `Entitlement` (plan, `expiresAt`, `willRenew`, price from `CustomerInfo`), local Pro-check counter (**flag B4**: "12 checks used this month" needs a local monthly counter; a new field not in data-model; harmless, local only), masked identifier from `GET /v1/me`.
- **Nav in:** Settings. **Out:** back -> `Settings`; "Restore purchase" -> restore call in place (PB: `Paywall`); "Switch to monthly" -> store plan-change flow (Play/App Store; effective at renewal) (PB: `Paywall`); "Cancel Pro" -> `Purchases.showManageSubscriptions()` / store deep link (PB: Settings).
- **Motion:** none. **A11y:** rows are links with trailing icon; external indicator needs label "opens store".
- **Offline:** shows cached state with "as of" note; actions disabled.
- **Flags:** renew date 14 Oct 2027 vs `ProWelcome` 19 Oct 2027 (sample inconsistency); footnote promises "2 free checks stay as they were" = assumed Q15.

### 9. ProWelcome (`m3-prowelcome`)
- **Purpose:** post-purchase celebration.
- **States:** single. **Inferred:** trial start ("Your trial ends on ..."), restore success ("Pro is back").
- **Components:** CelebrationBadge (verified), BenefitCard x3 (staggered), ButtonPair.
- **Data:** reads `Entitlement` (plan, renew date). Refresh `/me/entitlements` after purchase.
- **Nav in:** `Paywall` (purchase or restore). **Out:** "Try a form check" -> `FormCheck`; "Back to home" -> `Home`; hardware back -> `Home` (do not return to Paywall).
- **Motion:** pop .7 s, ring pulse x2 (1.4 s), benefits rise .5/.65/.8 s: one orchestrated moment. Reduced motion respected. Add haptic success.
- **A11y:** announce "You're on Pro" via live region on mount.
- **Offline:** works with cached.
- **Flag:** "Thank you for backing CasaFit" tone OK; date mismatch noted above.

---

## Part C. Nutrition

### Nutrition data rules
- Catalogue is bundled (`food_catalogue`, versioned JSON pack from `GET /v1/content/pack/latest`, merged into Op-SQLite) and searched offline (FTS5). Source `IFCT 2017 adapted` (dietitian review pending, PRD M4).
- Portions are native units, not grams: katori (~150 ml small steel bowl), chamach (spoon), roti/piece counts; grams as an option (PRD). Mock only shows the katori picker (1/2, 1, 1 1/2, 2) (**flag C1**: picker for piece, chamach, grams not drawn).
- A `FoodEntry` stores `portions` (numeric) against a catalogue `food_id` whose row defines portion name and per-portion kcal/protein; nutrients are derived at read time (so catalogue corrections flow through) or snapshotted (**flag C2**: data-model stores only `food_id` + `portions`; custom foods and catalogue version changes need a snapshot column).
- Targets: Mifflin-St Jeor x activity factor from age, sex, height, weight (onboarding/health data, local) + workouts per week, adjusted by goal; safe floor and gentle loss cap (copy on `NutriProfile`). Computed on the phone by rules. Floor values undefined (**flag C3**).
- Hide calories: single boolean preference (local Settings store, `hideCalories`). When on, replace all kcal numbers with on-track indicators for protein and portions (PRD). Applies to every nutrition screen (**flag C4**: not drawn; `NutriPlan`, `FoodSearch`, `MealDetail` all show kcal while the toggle only exists on `Nutrition`).
- Sync: pure local write; daily batch sync of the food log (architecture 4.4). Nothing is sent per entry.

### 10. Nutrition (`m3-nutrition`) tab root
- **Purpose:** today's food summary and log.
- **States drawn:** day label "Monday", hide-calories switch (off), summary card (Protein 52 / 70 g primary, Calories 1,240 / 1,800, protein progress bar, "18 g of protein to go today"), quick actions (Same as yesterday, Saved meals, plan icon), search field with mic, meal rows (Breakfast "Poha - 1 katori, Chai - 1 cup" 12 g; Lunch "Dal - 1 katori, Roti - 2, Bhindi - 1 katori" 22 g), add buttons Snack and Dinner, tip card, FAB "Log a meal", BottomNav (Workout, Nutrition current, Progress).
- **Inferred:** hide-calories ON (calories block gone, protein-and-portions on-track indicator); protein target met (positive copy, no shame); over target (neutral); other day selected (no day switcher drawn, **flag C5**); profile not yet created (route to `NutriProfile` first, PRD: asked at first open); empty = `FoodEmpty`.
- **Components:** TopBar-less header, SwitchRow, MacroRing (not drawn here; progress bar used, so `MacroBar`), SummaryCard, QuickActionChip, SearchField, MealRow, AddMealButton, TipCard, Fab, BottomNav.
- **Data:** reads `FoodEntry` for today joined with catalogue, `NutritionProfile` targets, `hideCalories`. Writes `hideCalories`; "Same as yesterday" bulk-copies yesterday's entries; "Saved meals" reads `SavedMeal` (**flag C6**: entity and screen missing).
- **Nav in:** BottomNav, `NutriPlan` "Use this plan", `MealDetail` add, `FoodEmpty`. **Out:** plan icon -> `NutriProfile` (PB; should be `NutriPlan` once a profile exists, **flag C7**); search field and FAB -> `FoodSearch`; Snack/Dinner buttons -> `FoodSearch` with slot; Workout -> `Home`; Progress -> `Progress`; Saved meals and Same as yesterday: no screen (act in place); mic: voice search (**flag C8**: not in PRD; needs microphone permission, conflicts with "no audio" wording on camera screens); meal rows have no tap target (edit/delete missing, **flag C9**).
- **Motion:** protein bar `fillbar` 1 s once. Reduced motion respected. **A11y:** switch is `input role=switch` wrapped in label; progressbar has valuenow/min/max (add text alt "52 of 70 g"); BottomNav `aria-current=page`; tap targets 44 px+.
- **Offline:** fully works.
- **Flags:** sample row proteins (12 + 22 = 34 g) do not match the summary 52 g; kcal on summary but rows show protein only.

### 11. NutriProfile (`m3-nutriprofile`)
- **Purpose:** four-question nutrition profile (diet, allergies, goal, meals a day), first open of Nutrition.
- **States drawn:** Vegetarian selected; allergy "None" selected; goal none selected; meals "4" selected; safety note; CTA "Build my food plan".
- **Inferred:** CTA disabled until goal chosen; selecting any allergy clears None and None clears others; "Other" opens a free-text field (**flag C10**: free text of health data; stays local); edit mode (from `NutriPlan` tune icon) pre-filled with CTA "Save"; Jain/Vegetarian excludes meat/egg foods.
- **Components:** TopBar, ChoiceChip single-select (diet, goal), ChoiceChip multi-select (allergy), SegmentedRadio (meals 3/4/5), InfoRow, Button.
- **Data:** writes `NutritionProfile` (local; synced to account only if health sync is on, architecture 3.2). Reads age/sex/height/weight/workouts-per-week from onboarding data (**flag C11**: confirm those fields exist locally; this screen does not ask them).
- **Nav in:** `Nutrition` plan icon, first open of Nutrition, `NutriPlan` tune. **Out:** back -> `Nutrition`; "Build my food plan" -> `NutriPlan`.
- **Motion:** none. **A11y:** chips are `<span>` in the mock; implement as `radio`/`checkbox` roles with checked state, meals as radiogroup (already `role=radio`), focus ring, 44 px.
- **Offline:** works.
- **Flags:** goal labels "Stay steady / Lose gently / Build muscle" vs PRD "maintain / lose gently / gain"; H2 headings at ~20 px, sentence case ok.

### 12. NutriPlan (`m3-nutriplan`)
- **Purpose:** show the daily target and a one-day sample meal plan, allow swaps.
- **States drawn:** target card ("Every day, for steady weight", 1,800 kcal, 70 g protein, full-width bar, caption "Vegetarian - 4 meals - no allergies. Worked out from your age, size and 4 workouts a week."), day tabs Mon..Sun (Mon selected), 4 meal cards with swap icon (Breakfast 8 am 380 kcal 18 g; Lunch 1 pm 560/22; Snack 5 pm 240/11; Dinner 8 pm 520/24), disclaimer, CTA "Use this plan".
- **Inferred:** other days' content (is it a 7-day rotation or one repeating day? **flag C12**); kcal hidden variant; loading none (computed locally); goal variants (lose gently shows deficit copy, build shows surplus); target at safe floor note.
- **Components:** TopBar (+ tune action), TargetCard, DayTabs (role tablist), MealPlanCard (slot, time, text, nutrients, swap IconButton), Disclaimer, Button.
- **Data:** reads `NutritionProfile`; generates `MealPlan` locally from rules + catalogue (no AI), stores it. Swap writes a `MealPlan` slot override. "Use this plan" sets `MealPlan.active=true`.
- **Nav in:** `NutriProfile`, `Nutrition` plan icon, `FoodEmpty` suggestion. **Out:** back -> `Nutrition`; tune -> `NutriProfile`; swap -> `FoodSearch` in swap mode (slot + day, replaces the planned item; PB generic link); "Use this plan" -> `Nutrition`.
- **Motion:** target bar `fillbar` 1 s once (full width, meaningless as progress, **flag**). Reduced motion respected.
- **A11y:** tabs are `<span role=tab>` in the mock; need keyboard/TalkBack tab behaviour; tablist label "Day".
- **Offline:** works.
- **Flags:** meal sums 380+560+240+520 = 1,700 kcal vs 1,800 target and 75 g vs 70 g protein (sample or logic gap); kcal visible regardless of hide preference (C4); dietitian review required before launch (PRD M4); "not medical advice" wording present, good.

### 13. FoodSearch (`m3-foodsearch`)
- **Purpose:** find a food to log.
- **States drawn:** query "dal", segmented tabs Home-cooked (selected) / Packaged / Restaurant, "Recent" (Dal tadka), "All results" (Moong dal 110 kcal, Dal makhani 210, Masoor dal 120, Dal fry 150, each "1 katori - n g protein - n kcal"), "Can't find it? Add your own dish".
- **Inferred:** empty query (Recent + saved meals + suggestions), no results (add-your-own prominent), packaged tab (barcode? not in v1, search only), restaurant tab, loading none (local).
- **Components:** SearchField (with clear), SegmentedTabs (FoodTypeTabs), SectionLabel, FoodResultRow (name, unit summary, add button), AddCustomDishRow.
- **Data:** reads catalogue (FTS, offline), recent `FoodEntry` distinct foods. No writes here.
- **Nav in:** `Nutrition` (FAB, search, add buttons), `NutriPlan` swap, `FoodEmpty`. **Out:** back -> `Nutrition`; any row -> `MealDetail` (whole row is a link; the "+" button then has no separate action, **flag C13**: quick add at default portion vs open detail); "Add your own dish" -> no screen (**flag C14**: custom food form missing); clear x empties query.
- **Motion:** none. **A11y:** tabs implemented as spans in mock (use tablist semantics), results list as list; 44 px+ rows; tab "Home-cooked" selected by check icon plus fill.
- **Offline:** fully works (bundled pack); Packaged/Restaurant coverage may be sparse offline.
- **Flags:** kcal in results ignores hide-calories (C4); meal slot context not on screen (passed by param, default by time of day).

### 14. MealDetail (`m3-meal`) (title "Add to lunch")
- **Purpose:** pick portion and add a food to a meal slot.
- **States drawn:** header "Add to lunch", search field still showing "dal", tabs, selected food card (Dal tadka, "Per katori - 150 ml", 7 g), "How much?" KatoriPortionPicker (1/2, **1** selected, 1 1/2, 2), helper "1 katori is about a small steel bowl", live total "You will log 7 g protein - 130 kcal", two other suggestions (Dal makhani 9 g, Moong dal 7 g), sticky CTA "Add to lunch".
- **Inferred:** other unit pickers (roti pieces, chamach, grams toggle), hide-calories total ("7 g protein" + on-track), added confirmation (snackbar "Added to lunch. Undo"), editing an existing entry (CTA "Save", delete).
- **Components:** TopBar, SearchField, FoodTypeTabs, SelectedFoodCard, KatoriPortionPicker (generic `PortionPicker` with unit config), NutrientTotalRow, FoodResultRow, Button.
- **Data:** reads catalogue row; on CTA writes `FoodEntry {foodId, portions, meal, loggedOn}` locally.
- **Nav in:** `FoodSearch`. **Out:** back -> `Nutrition` (PB; should go back to `FoodSearch`, **flag C15**); CTA -> `Nutrition` after write; tapping a suggestion swaps the selected food in place.
- **Motion:** none. **A11y:** picker `role=radiogroup`, selected shown by check + fill; live total in `aria-live=polite`; CTA 56 px.
- **Offline:** works.
- **Flags:** screen duplicates search UI of `FoodSearch` (is this a detail sheet or a combined screen?); "Per katori - 150 ml" implies volume-based units while piece foods use counts; no grams option (PRD).

### 15. FoodEmpty (`m3-foodempty`)
- **Purpose:** first-use / nothing logged today state of the Nutrition tab.
- **States drawn:** header "Monday, 7:40 am" (time-aware), h1 Nutrition, steaming empty katori illustration, h2 "Nothing logged yet today", copy, actions "Log breakfast" (primary) and "Same as yesterday", suggestion row "Today's suggestion: moong dal cheela with curd, 18 g protein.", BottomNav.
- **Inferred:** label follows time of day (Log lunch/snack/dinner), "Same as yesterday" hidden or disabled when yesterday empty (new user), no-plan variant (suggestion row -> `NutriProfile` "Set up your food plan"), hide-calories irrelevant.
- **Components:** Header, EmptyStateIllustration (steam), Button x2, SuggestionRow (from `MealPlan`), BottomNav.
- **Data:** reads today's entries (zero), yesterday's entries, `MealPlan` suggestion.
- **Nav in:** BottomNav Nutrition when no entries today. **Out:** "Log breakfast" -> `FoodSearch` (slot breakfast); "Same as yesterday" -> copies and returns to `Nutrition` (PB link); suggestion -> `NutriPlan`; BottomNav as above.
- **Motion:** steam loops (2.4 s, infinite, three staggered) - ambient infinite loop (**flag** vs one-moment rule); reduced-motion CSS present. Replace with a single play-once on mount.
- **A11y:** SVG role img "An empty steel katori with steam"; no FAB and no hide-calories switch on this state (consistency gap with `Nutrition`).
- **Offline:** works.

---

## Shared components needed

| Component | Props | Used by |
|---|---|---|
| TopBar | `title?, onBack, right?: ReactNode, tone?: 'light'|'dark'` (48 px back target) | Camera, Form, Live, FormResult, CamDenied, NoCredits, Paywall, ManagePro, NutriProfile, NutriPlan, FoodSearch, Meal |
| BottomNav | `current: 'workout'|'nutrition'|'progress'` (3 tabs here; shared copy, do not edit per CLAUDE.md) | Nutrition, FoodEmpty |
| CreditBadge | `remaining: number|'unlimited', total=2, variant: 'chip'|'tiles'` (chip in Form/FormResult, tiles in NoCredits) | Form, FormResult, Live (label), NoCredits |
| PaywallPlanCard | `planId, title, price (store string), caption, badge?, selected, onSelect` (radio) | Paywall |
| BenefitRow | `icon, title, body?` | Paywall, ManagePro, ProWelcome, NoCredits (list variant) |
| SubscriptionStatusCard | `status: Entitlement['state'], planLabel, renewalText` | ManagePro |
| ListRow | `icon, label, trailing: 'chevron'|'external', onPress` | ManagePro |
| Button (Filled/Outlined/Text) | `label, icon?, onPress, loading?, disabled?` (56 px) | all |
| InfoRow | `icon, text, tone?: 'neutral'|'success'` | Camera, CamDenied, NoCredits, Paywall, NutriProfile |
| PrivacyNote | `text` (lock icon) | Form, Live, FormResult |
| SkeletonOverlay | `landmarks, flagged: string[], mode: 'guide'|'live'` | Form, Live |
| ExerciseChipGroup | `items:{id,label,disabled?,reason?}, selected` | Form |
| FramingStatusChip | `kind: 'ok'|'hint', text` | Form |
| CueToast | `text, live` | Live |
| RepCounterCard | `count, threshold, counted` | Live |
| ScoreRing | `value, max, label` | FormResult |
| RepChipRow | `reps: {ok:boolean}[]` | FormResult |
| FindingRow | `status: 'ok'|'warn', title, text` | FormResult |
| HeroIllustration | `icon|svg, size, animate` | Camera, CamDenied, FoodEmpty, ProWelcome |
| MacroBar / MacroRing | `value, target, unit, label` | Nutrition, NutriPlan (target bar) |
| SwitchRow | `label, value, onChange` | Nutrition (hide calories) |
| SearchField | `value, onChange, onClear, trailing?: 'mic'|'clear', onFocus` | Nutrition (nav-only), FoodSearch, Meal |
| ChoiceChip (single/multi) / SegmentedRadio | `options, value, multi?, exclusiveValue?` | NutriProfile, FoodSearch tabs, Meal tabs, NutriPlan day tabs |
| MealRow | `slotIcon, slot, summary, protein, kcal?, onPress?` | Nutrition |
| MealPlanCard | `slot, time, items, kcal, protein, onSwap` | NutriPlan |
| FoodResultRow | `food, portionLabel, nutrients, onPress, onQuickAdd?` | FoodSearch, Meal |
| KatoriPortionPicker (generic PortionPicker) | `unit: 'katori'|'chamach'|'piece'|'g', steps:number[], value, onChange, helper?` | Meal |
| NutrientTotalRow | `proteinG, kcal?, hideCalories` | Meal |
| TipCard / SuggestionRow | `icon, text, onPress?` | Nutrition, FormResult, FoodEmpty |
| Fab | `label, icon, onPress` | Nutrition |
| EmptyState | `art, title, body, actions` | FoodEmpty |
| useReducedMotion wrapper | gate all one-shot animations | all |

## Data and state

```ts
type ISODate = string;           // 'YYYY-MM-DD', user-local
type FormExercise = 'squat' | 'pushup' | 'plank' | 'lunge';

// Server truth, device cache. Persist: Postgres form_check_balance; Op-SQLite table entitlement_cache.
interface FormCheckBalance {
  creditsRemaining: 0 | 1 | 2;   // never resets, never < 0
  lastConsumedAt?: string;
  version: number;               // optimistic lock
  fetchedAt: string;             // cache age
  pendingOps: { key: string; kind: 'consume' | 'refund'; at: string }[]; // queued for sync
}

// Local attempt journal (Op-SQLite form_check_attempt). Needed for idempotent consume/refund.
interface FormCheckAttempt {
  id: string; idempotencyKey: string; exercise: FormExercise;
  state: 'armed' | 'counted' | 'spent' | 'spent_local' | 'cancelled' | 'refunded';
  startedAt: string; spentAt?: string; wouldHaveBeenCharged?: boolean;
}

// In memory only by default (A2). Never contains frames or landmark streams.
interface FormCheckResult {
  attemptId: string; exercise: FormExercise; repsAnalysed: number; repsClean: number;
  perRep: { index: number; ok: boolean; issue?: 'depth' | 'knees' | 'back' | 'hips' | 'elbows' }[];
  findings: { area: string; status: 'ok' | 'warn'; text: string }[];
  rating: 'needs_work' | 'okay' | 'good'; tip?: string;
}

// RevenueCat CustomerInfo mapped; server mirror table `subscription`.
// Persist: Op-SQLite entitlement_cache (1-day TTL, honour 7-day offline grace); server `subscription`.
interface Entitlement {
  state: 'free' | 'trial' | 'active' | 'active_cancelled' | 'billing_issue' | 'lapsed';
  planId?: 'pro_monthly' | 'pro_yearly'; platform?: 'play' | 'appstore';
  expiresAt?: string; willRenew?: boolean; priceString?: string; // store-localised
  trialEndsAt?: string; verifiedAt: string;
  proChecksThisMonth?: number;   // local counter for ManagePro (B4)
}

// Bundled pack (SQLite, read-only) + user-added custom rows. Persist: food_catalogue table (versioned pack).
interface FoodItem {
  id: string; name: string; nameHi?: string;
  kind: 'home' | 'packaged' | 'restaurant' | 'custom';
  diet: ('veg' | 'egg' | 'nonveg' | 'jain')[]; allergens: ('peanut' | 'dairy' | 'gluten' | 'other')[];
  units: { unit: 'katori' | 'chamach' | 'piece' | 'g'; label: string; gramsOrMl: number; steps: number[]; default: number }[];
  perDefaultUnit: { kcal: number; proteinG: number; carbsG?: number; fatG?: number };
  source: string; packVersion: number;
}

// Persist: Op-SQLite food_entry (local first), daily batch sync to server.
interface FoodEntry {
  id: string; loggedOn: ISODate; meal: 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';
  foodId: string; unit: FoodItem['units'][number]['unit']; portions: number; // 0.5 steps
  snapshot?: { kcal: number; proteinG: number; packVersion: number }; // C2
  createdAt: string;
}

interface SavedMeal { id: string; name: string; items: Pick<FoodEntry, 'foodId' | 'unit' | 'portions'>[] } // C6, local

// Persist: Op-SQLite nutrition_profile; account service only if health sync is on.
interface NutritionProfile {
  diet: 'veg' | 'egg' | 'nonveg' | 'jain';
  allergies: ('none' | 'peanut' | 'dairy' | 'gluten' | 'other')[]; allergyOther?: string;
  goal: 'maintain' | 'lose_gently' | 'gain';
  mealsPerDay: 3 | 4 | 5;
  target: { kcal: number; proteinG: number; computedAt: string; inputsHash: string };
}

// Persist: Op-SQLite meal_plan (generated by rules on device).
interface MealPlan {
  id: string; active: boolean; profileHash: string;
  days: Record<'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun',
    { slot: FoodEntry['meal']; time: string; items: { foodId: string; unit: string; portions: number }[]; swappedFrom?: string }[]>;
}

// Local preferences (Zustand + persist to Op-SQLite/MMKV)
interface NutritionPrefs { hideCalories: boolean }
```

| Entity | Phone | Server |
|---|---|---|
| FormCheckBalance | Op-SQLite cache + pending queue | `form_check_balance`, `form_check_event` (source of truth) |
| FormCheckAttempt | Op-SQLite (journal) | Only consume/refund events |
| FormCheckResult | Memory (A2 open) | Never |
| Entitlement | Cache 1 day, grace 7 days | `subscription` + RevenueCat webhook |
| FoodItem | Bundled pack + custom rows | Content pack via R2/CDN |
| FoodEntry, SavedMeal | Op-SQLite | Daily batch sync (backup) |
| NutritionProfile, MealPlan | Op-SQLite | Profile only if health sync on; plan device-only |
| NutritionPrefs | Local | No |

Query/state split: TanStack Query for `/me/entitlements`, offerings and pack; Zustand for the live-check state machine, framing status and `hideCalories`; Drizzle for local tables.
