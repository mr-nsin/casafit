# Session lane screen spec (23 screens)

Source: `project/m3-*.dc.html` (390 px, static; the only script is a `dark` prop -> `.dark` class, so there is **no inline state logic** to port). Every state below is read from markup. Rules: `CLAUDE.md`, PRD (section numbers per the PRD's own "Section N" labels), `docs/data-model.md`. Existing code: `app/src/theme/tokens.ts` (light/dark M3 roles `p, pc, sc, tc, bg, c1..c4, er...`, `type`, `space`, `radius`), `app/src/screens/Home.tsx` is a placeholder.

Conventions used below
- Route = React Navigation name. "Sheet" = modal bottom sheet over the previous route. "Dialog" = centred alert dialog.
- Dark default (`dark` prop true): Player, Rest, Paused, EndSession, Feel, SessionSettings. All others default light. See A3.
- Reduced motion (design rule, one line in every file): all animation and transition off, final state shown; looping demos show first frame (`.fa` visible, `.fb` hidden). RN: `useReducedMotion()` gate in a single `useMotion()` hook.
- A11y baseline in every screen: touch targets 44+ (most 48/56), `aria-label` on icon-only buttons, `aria-current` on current day/tab, decorative icons and blobs `aria-hidden`. RN mapping: `accessibilityLabel`, `accessibilityRole`, `accessibilityState={{selected|checked}}`, decorative -> `importantForAccessibility="no"`.
- Offline: every screen here must work with no network once week one is downloaded (architecture 2.3). Only exceptions: Paywall/Camera links (other lane) and content catalogue download.

## 1. Screen specs

### 1.1 Home (`m3-home`) route `Home` (tab: Workout)
- Purpose: one decision for today, then optional paths. Scroll page (1380 px design height) + fixed BottomNav.
- Variants in file: training day (Monday, session 1 of 4). Sibling `HomeRest` is the rest-day variant (1.2). **Not designed**: session already done today, paused session to resume, comeback (7+ days), 0 form checks left, hidden calories (CLAUDE.md says user can hide), gentler plan.
- Layout top to bottom: TopBar variant `greeting` (date line "Monday · Week 1", h1 "Let's move, Priya", `FormCheckChip` "2 left", profile avatar button) -> `WeekStrip` of 7 `DayPill` -> "Today is session 1 of 4" + "Full plan" -> `TodayCard` -> "Ready-made plans" carousel (`PlanTile` x7 incl. Desk reset, 148 px, snap-x) -> "Train a body part" 3x3 grid (`BodyPartTile` x9: arms, chest, back, shoulders, core, glutes, legs, full body, stretch; shaded = user focus) -> "Today so far" (`StepsCard` ring 4,820/7,000 + 12 brisk min; `FoodCard` 1,240 kcal bar, 52/70 g protein, add button) -> `MythCard` "Do crunches burn belly fat?" -> BottomNav.
- DayPill states: `today` (filled p, double ring, filled icon), `planned` (c4 fill, p icon), `yoga` (tc fill), `optional` (dashed outline: walk, stretch), `rest` (no fill, bedtime), `done` (check; HomeRest). Icons per style: `sports_gymnastics` normal, `self_improvement` yoga, `accessibility_new` full body, `directions_walk`, `spa`, `bedtime`.
- TodayCard: label "Today", title (40/44 px 800), meta "Normal . 5 moves . no equipment . knee-friendly", `SegmentedProgress` variant `shape` (2 / 11 min work / 2 flex 2:11:2) with labels Warm-up / 15 min total / Cool-down (the two labels are links), FilledButton Start (56 px), two square TonalIconButtons swap_horiz and tune.
- Data read: Plan, today's PlanDay (title, style, move count, flags: equipment, knee-friendly), week PlanDays for pills, `FormCheckBalance` (cached entitlements), step summary, food totals + hide-calories pref, user first name, weekly Learn myth. Writes: none.
- Nav: Form chip -> `Paywall`; avatar -> `Profile`; today pill -> `PlanDetail`; other pills -> `WeekPlan`; Sun pill -> `HomeRest`; "Full plan" -> `WeekPlan`; Warm-up/Cool-down labels -> `SessionParts`; **Start -> `Player` directly** (skips PlanDetail); swap_horiz **and** tune -> `Editor`; "Ready-made plans / See all" -> `Library`; tiles -> `PlanDetail` (Yoga flow -> `Yoga`, Dance cardio -> `Dance`, Desk reset -> `Desk`); body-part tile -> `BodyPart`; steps card -> `Steps`; food card -> `Nutrition`; myth -> `Learn`; nav tabs Workout/Nutrition/Progress.
- Motion (all on mount): DayPill `pop` stagger .05-.47 s; shape bar `reveal` 1 s @.5 s; steps ring `grow` 1.3 s; food bar `fillbar` 1 s; hero illustration `fa/fb` crossfade 1.8 s loop. Reduced: none.
- A11y: pill labels read "Monday, today: Core and Glutes"; steps ring `role=img` "4,820 of 7,000 steps"; form chip label "2 free form checks left. See Pro".
- Offline: fully local. Ambiguities: A1 (5 stagger/loop animations vs "one orchestrated moment"), A8 (swap and edit go to same route), 3 bottom tabs vs PRD "two tabs" (A12).

### 1.2 HomeRest (`m3-homerest`) route `HomeRest` (same tab; render of `Home` when today's PlanDay.kind = rest)
- Header "Sunday . Week 1" / "Rest well, Priya"; no form chip; strip shows `done` check for Mon-Sat, Sunday `today` bedtime; line "4 of 4 workouts done this week. Nicely paced."
- Rest card (`RestCard`): breathing bedtime icon, "Rest day", one line on why rest matters; two suggestion rows (`SuggestionRow`, 64 px): 10-min easy walk (about 1,200 steps toward 7,000) -> `Steps`; Gentle stretch (8 min, easy, optional) -> `PlanDetail`. Then `RecapCard` "Week 1 recap: 4 sessions, 60 minutes, 6,240 steps a day" -> `Recap`; "Tomorrow" row (Legs + Core 15, Monday, knee-friendly) -> `PlanDetail`.
- Data: week PlanDays + completion from SessionLog, step summaries, next PlanDay. Motion: `breathe` 4 s loop on icon only.
- Conflicts: strip shows 6 checks but copy says 4 of 4 (Tue walk, Fri stretch counted as done?); "Tomorrow: Legs + Core 15" vs Home/WeekPlan "Core + Glutes 15" (sample content). PRD "rest day: walk or stretch suggestion + one line why" matches.

### 1.3 WeekPlan (`m3-weekplan`) route `WeekPlan`
- Purpose: whole-week plan, swap days. Components: TopBar `back` + text action "Why this plan"; `WeekTabs` (Week 1 selected, 2, 3; 44 px chips); summary "4 workouts . 60 minutes . 3 Normal, 1 Yoga"; 7 `PlanDayRow` (68 px): today (Mon) is a link row; Tue-Sat show title + sub + 48 px swap_horiz button; Sun "Rest day" link row. Sticky footer: Tonal "Change mix", Filled "Start today".
- Rows: Mon Core + Glutes 15 (Today, Normal, 5 moves); Tue Easy walk (aim 7,000 steps); Wed Yoga flow 15 (9 poses, knee-friendly); Thu Full body 15; Fri Gentle stretch (8 min, optional); Sat Glutes 15 ("lunges skipped").
- Nav: back -> `Home`; Why -> `Why`; Mon row -> `PlanDetail`; swap buttons -> `Editor` (no swap picker exists); Sun -> `HomeRest`; Change mix -> `Mix` (onboarding lane); Start today -> `Player`.
- Data: Plan, PlanDay[] for weeks 1-3 (weeks 2-3 imply pre-computed or preview; see A9). No writes here.
- Ambiguous: week chips are non-interactive spans (no tab role); Tue-Sat rows have no tap-to-open; "Yoga" free taster gating not shown (PRD idea 12).

### 1.4 Why (`m3-why`) route `Why`
- Explains the rule-based plan (PRD: each plan carries a "Why this plan" line). Sections: intro "Rules on your phone built this week from your answers. Nothing is guessed."; "What we used" 4 `AnswerRow` (Focus: core and glutes -> `Goals`; Days: 4 a week, 15 min -> `About`; Experience: on and off -> `About`; Style: 3 Normal, 1 Yoga -> `Mix`), each with "Change" 48 px link; "What we left out, and why": Lunges row -> `Lunge`; "How it changes" info box (felt easy/hard adjusts next week); footer FilledButton "Got it" -> `WeekPlan`.
- Data read: onboarding answers (Plan.goal, styles, daysPerWeek, experience, flags) and `PlanDay.exclusions[]` (exercise, flag, replacement). Read-only. Motion none.

### 1.5 Library (`m3-library`) route `Library`
- Ready-made plans list. Filter chips (role tablist, no panel): All (selected, check icon), Normal, HIIT, Yoga, Dance, Stretch. Rows (`PlanListRow`, 80 px): icon tile, title, meta "style . level . extra", trailing add_circle (48 px): Full body 15, Abs and core, Beginner HIIT, Yoga flow, Dance cardio, Morning stretch, Desk reset (4 min, no sweat).
- Nav: back -> `Home`; row -> `PlanDetail` (Yoga -> `Yoga`, Dance -> `Dance`, Desk -> `Desk`); add_circle -> undefined (PRD: "Add to my plan").
- Data: catalogue `ReadyMadePlan[]` {id, title, style, level, tags, durationMin, moves}. Writes (implied): add to plan -> new PlanDay.
- Flags: HIIT and Stretch are not Styles (data model enum is normal/yoga/dance); add_circle lives inside the row anchor (nested tap target); Pro gating for yoga/dance taster absent; Home carousel shows same 7 though PRD lists 6.

### 1.6 BodyPart (`m3-bodypart`) route `BodyPart` (param `part`)
- Example "Core". Header card with body figure (highlighted region) + "6 moves for your abs, back and hips. All knee-friendly."; style filter chips Normal (selected), Yoga, Easy first (multi/single select unclear); `ExerciseRow` (72 px, 56 px thumbnail `ExerciseIllustration`): Dead bug, Bird dog, Plank (Medium, "form check" tag), Side plank, Cat-cow (icon thumb, 8 slow breaths); trailing add_circle (aria "Add to session"); hidden row `HiddenByFlagRow` "Mountain climbers are hidden: they load your knees." Sticky CTA "Start a 15-minute core session" -> `Player`.
- Nav: back -> `Home`; row -> `PlanDetail` (should likely be `Exercise`; see A10). Data: Exercise[] filtered by bodyPart, style, flags; difficulty; `formCheckable`. Writes: add -> in-memory draft session.
- Flags: copy says 6 moves, 5 shown + 1 hidden; "Start a 15-minute session on this" must build a SessionPlan on the spot (PRD) - needs engine entry point `buildBodyPartSession(part, filters)`.

### 1.7 PlanDetail (`m3-plan`) route `PlanDetail` (param `planDayId | readyMadeId`)
- Overview before a session. TopBar back only; hero (label "Ready-made plan", title "Core + Glutes 15", chips 15 min / No equipment / Normal); `SegmentedProgress` shape (2 / 11 min of work / 2); "5 moves"; 5 `MoveRow` (64 px; icon, name, cue, "2 x 30s"): Glute bridge, Bird dog, Dead bug, Plank, Side plank; footnote "Lunges are skipped for your knees. See why . Why this plan . Warm-up and cool-down". Footer: Tonal "Edit", Filled "Start session".
- Nav: back -> `Home` (always, even from Library); Glute bridge name -> `Exercise` (others not linked); See why -> `Lunge`; Why -> `Why`; parts -> `SessionParts`; Edit -> `Editor`; Start -> `Player`.
- Same route serves today's plan and generic ready-made plans (label says "Ready-made plan" even for today's personalised one). No "Add to my plan"/"Start now" pair that PRD asks for ready-made plans.

### 1.8 Player (`m3-player`) route `Player` -> see section 2 for the state machine
- Normal-style work screen, dark default, no scroll (844 px). Zones: TopBar (close -> `EndSession`, "Move 3 of 5" in p colour, title, tune -> `Editor`); `SegmentedProgress` variant `session` 7 segments (warm-up tc 2, five moves 2.2 each, cool-down 2; done = p, current = partial gradient 40%, todo = sv); `ExerciseStage` 220 px card tc with 2-frame `ExerciseIllustration` + pill "Set 1 of 2 . Right side"; name (32 px) + cue; big timer 72 px "0:28" (p colour, tabular) + caption "Work . 9:42 left"; `IntensityControl` radiogroup Easier / As planned (selected, check) / Harder + caption "Changes start from the next set and shape next week"; transport row: previous (button, no destination), **Pause 96 px** -> `Paused`, skip_next -> `Rest`; bottom row: "+15s rest", "+30s rest" (outline buttons), "Check form . 2 left" Tonal -> `Camera`.
- Data: SessionPlan step; SessionState; FormCheckBalance (cached); prefs. Writes: SessionSnapshot every transition (resume), intensity signals, SessionLog on end.
- Motion: demo `fa/fb` crossfade 1.8 s loop only. Timer text is not animated.
- A11y: demo `role=img` with full description; intensity is radiogroup; progress bar has only a label (needs value text "move 3 of 5"). Timer should not announce each second; announce on phase change, 10 s, 3-2-1 (voice coach doubles as the screen-off channel).
- Conflicts: Bird dog shows "Check form" but form checks cover only squat, push-up, plank, lunge (Exercise screen says so). "Move 3 of 5" is Bird dog but PlanDetail lists it 2nd and Dead bug 3rd. Timer 0:28 of a 30 s hold with "9:42 left" does not reconcile with 11:00 work minus two finished moves. "+15s rest" while in a work segment: applies to next rest? (A6). Previous button unwired. Warm-up and cool-down UI not designed.

### 1.9 Rest (`m3-rest`) route `Rest`
- Header: close (aria "End session" but links to `Player`) + "Move 3 of 5 done". Title "Rest". `TimerRing` 240 px (r 104, remaining-time arc shrinking, aria "12 seconds of rest left"), centre "0:12" + "of 0:20 rest". "+15s" "+30s" buttons. "Up next" card: thumbnail + "Dead bug" + "Set 1 of 2 . 30 sec". Footer Filled "Skip rest".
- Nav: close -> `Player` (label says End session); **Skip rest -> `Feel`** (rest sheet, then returns to Player). Data: SessionState.rest, next step. Motion: ring `grow` 1.3 s on mount then must tick down. Rest after set vs after move undefined.
- Flags A5, A6.

### 1.10 Paused (`m3-paused`) route `Paused`
- Header close -> `EndSession`, "Move 3 of 5", title. Pause glyph in tonal circle, "Paused", pill `role=timer` "Bird dog . 0:28 left" (breathes 2 s loop), info "You can pick this session up again for the next 24 hours. Your time so far is saved.", row "Sound and voice" -> `SessionSettings`. Actions: Filled "Resume" -> `Player`; Tonal "Skip move" -> `Rest`; outline "End session" -> `EndSession`.
- Entered by user pause or automatic pause (call, app switch; PRD) - **same screen, no reason copy**. Data: SessionSnapshot (24 h TTL). Motion: `breathe` 2 s loop (stops under reduced motion). A11y: timer is frozen, so no live announcements; announce "Paused" once.

### 1.11 EndSession (`m3-endsession`) route `EndSession` (dialog)
- `role=alertdialog` over scrim: flag icon, "End this session?", "You finished 3 of 5 moves in 8:10. Save it and come back within 24 hours, or end it now." Buttons: "Keep going" -> `Player`; "Save and finish later" -> `Home`; "End without saving" -> `Home`. Motion: `pop` .3 s. Focus: initial focus "Keep going", trap, Android back = Keep going.
- Writes: Save -> SessionSnapshot persisted + SessionLog(status `unfinished`) deferred; End -> discard snapshot, optional partial SessionLog (A7). Home has no resume entry design. Copy says "3 of 5 finished" while Player is mid move 3 (A5).

### 1.12 Editor (`m3-editor`) route `Editor`
- "Edit today" (reachable from Home, WeekPlan swap, PlanDetail, Player, Exercise "Add to today", SessionParts). Budget card: "16:00 / 15:00" (er colour) + chip "Over by 1:00" (`nudge` .5 s once @.6 s), `BudgetBar` (warm-up 12.5%, work 75%, cool 12.5%, 15:00 marker at 93.75%), labels "Warm-up 2 . 6 moves 12 . Cool 2". Ordered list: fixed Warm-up row ("matched to core + glutes", 2:00, tc), 6 `EditableMoveRow` (44 px, drag handle, name, 2:00, remove 48 px; "Fire hydrant" tagged NEW +2:00), fixed Cool-down row ("rebuilt for your moves", 2:00). "Add an exercise" outline -> `Picker`. "Fix the extra minute": chips Shorter rests / Replace one / Go 16 min today. Footer: "Just today" and "Save to my plan" (both -> `Player`).
- State variants: over budget (shown); implied but undrawn: exactly 15:00, under budget, min 3 / max 8 moves, last-pusher removed -> cool-down rebuilt, same muscle 3x warning (PRD).
- Data: working copy of SessionPlan; writes PlanDay overrides if "Save to my plan", else ephemeral. Drag reorder via `react-native-reanimated` + gesture-handler; needs non-drag alternative (move up/down actions) for a11y.
- Back -> `Player` (even when entered from Home/WeekPlan: A8).

### 1.13 Picker (`m3-picker`) route `Picker` (sheet over Editor)
- Sheet `role=dialog` "Add an exercise" (rise .45 s). Info "13:00 now. Room for one more move (+2:00) inside 15:00." Search field "Search moves"; filter chips Core (checked), Glutes (checked), Legs, Arms (multi-select). Rows (68 px): Fire hydrant, Donkey kick, Plank (each "Add +2:00" 48 px); disabled row Lunge "Hidden for your knees". Close -> `Editor`; Add -> `Editor` (with exercise appended).
- Data: Exercise[] filtered by flags/style/body part; time cost per row. When no room (>=15:00) behaviour undefined; "13:00 now" conflicts with Editor 16:00 base (A2). Offline search over bundled catalogue.

### 1.14 SessionParts (`m3-parts`) route `SessionParts`
- Segmented radiogroup Warm-up / Work / Cool-down (Cool-down selected). Header "Cool-down 2:00". Info "Rebuilt for today. You trained core and glutes, so we stretch those." 4 numbered rows (Child pose, Figure-four stretch, Cat-cow, Deep breathing; 30s each). Note "Warm-up and cool-down are always 2 minutes each...". "Swap a move" -> `Editor`; "Back to my session" -> `Editor`. Only the Cool-down tab drawn; Warm-up and Work tabs undefined. Data: cool-down steps derived from worked muscle tags.

### 1.15 Lunge (`m3-lunge`) route `ExerciseSwapReason` (param `excludedExerciseId`)
- "We swapped a move for your knees": Lunge (blocked, "Skipped") -> arrow -> Glute bridge ("Works the same muscles, no knee load"); info "If a move hurts at any point, stop... Lunge is also hidden in the form camera." Buttons "Got it" -> `PlanDetail`; "Change pain areas" -> `About`. Generic template for any substitution-by-flag; data from ExerciseSubstitution (reason = flag). Back -> `PlanDetail`. Static.

### 1.16 Complete (`m3-complete`) route `Complete`
- Close -> `Home`. Confetti-like decorative circles, check (`pop` .6 s), "Session done", "Core + Glutes 15 . Monday". Stat trio staggered `rise` .5 s @.35/.50/.65 s: total time 15:00, moves 5, "+1 Streak days". "How did it feel?" radiogroup Too easy / About right (preselected) / Too hard + "This shapes next week. You can change it later." "Next up: Wednesday, Legs + Core 15" row. Footer: "Done" -> `Home`; "Log a meal" -> `Nutrition`.
- Writes: SessionLog {felt, durationS, movesDone, completedAt}; updates streak; triggers next-week volume rule. Preselected "About right" means a log is written even if user never taps (decide). Variants undrawn: yoga/dance/partial summary, personal-best, comeback. Conflict: Next up Wednesday vs WeekPlan (Wed = Yoga flow). Sample "+1 streak" vs "never shame" fine; ensure break never shown negatively.

### 1.17 Yoga (`m3-yoga`) route `Player` with `style=yoga` (own layout `YogaStage`)
- Header "Pose 4 of 9 / Yoga flow 15", close -> `EndSession`, tune -> `Editor`. 9-segment progress (poses only). Stage: figure SVG (Warrior II, "Right side" pill, `hold` 6 s scale loop + `breathe` 8 s halo). Name + cue. `HoldTimer`: ring (r 34, remaining 34 of 45 s) + "0:34" + "Hold / Breathe in for 4 / Then out for 6". radiogroup "Pose depth" Gentler / As planned / Deeper. Transport: previous, **pause 80 px** -> `Paused`, next (prev/next point back to the same file).
- No rest segments, no per-pose count-in; breath cue 4+6 = 10 s vs `breathe` 8 s animation (A13); warm-up (cat-cow/sun salutation) and rest pose segments not distinguished (PRD yoga shape: warm-up 2, 8-10 poses, cool-down 2). Both sides: "Right side" then left implied (a pose with sides = two holds or one 45 s each?).

### 1.18 Dance (`m3-dance`) route `Player` with `style=dance` (`DanceStage`)
- Header "Step 2 of 6 / Dance cardio 15"; 6-segment "Routine progress"; stage: grapevine figure, `fa/fb` 2-frame crossfade, pill "Beat 112" (BPM), 8 equaliser bars `beat` .54 s each with .09 s stagger (= 112 BPM beat period 0.536 s); name + cue; timer "0:48" and "Routine . 7:20 left"; radiogroup Impact: Low impact (selected) / High impact + "Low impact has no jumping. Switch any time."; transport previous/pause/next.
- Needs music track + beat clock: step changes should snap to bars, not arbitrary seconds (A13). Licensing risk per PRD. Low-impact default honours Quiet mode.

### 1.19 Desk (`m3-desk`) route `DeskReset`
- Micro-session (4 min, 4 moves), close -> `Home`, "Move 2 of 4 / Desk reset . 4 min". Stage: seated neck release figure (`tilt` 3 s loop), badge "Quiet . no sweat". Name + cue, `HoldTimer` ring (20 of 30 s) + "Left side / Then switch sides". Info "Short breaks add up. They count toward your active minutes, not your 15-minute session." Actions: "Skip" -> `Home`; "Next move" -> self. No pause, no progress bar, no end dialog, no warm-up or cool-down (correctly, per PRD idea 3). Writes: MicroSessionLog (active minutes only; must not count as SessionLog/streak).

### 1.20 Exercise (`m3-exercise`) route `Exercise` (param `exerciseId`)
- Back -> `PlanDetail`; bookmark toggle (aria "Save to favourites", off state drawn). Demo card (2-frame loop, "Demo loop" pill). h1 "Glute bridge"; chips Easy / Glutes . Core / No equipment / Knee-friendly. 3 numbered steps. Ladder: Easier "Smaller lift", Harder "Single-leg bridge" (no third "no equipment" rung drawn). Note "No camera check for this move. Form checks work on squat, push-up, plank and lunge." Footer "Add to today" -> `Editor`; "Try 30 seconds" -> `Player` (a single-move trial mode is not defined).
- Data: Exercise + ExerciseSubstitution + Favourite (local). Motion: demo loop only.

### 1.21 SessionSettings (`m3-sessionsettings`) route `SessionSettings` (sheet over Paused)
- Sheet "Sound and voice" (slide `up` .4 s), close -> `Paused`. Rows: Voice coach switch (on; "Cues and count-ins, screen off too"); Coach language "English" -> `Language`; "Lower music while the coach talks" switch (on); Quiet mode switch (off; "No jumping moves. Vibration instead of beeps."); "Rest between sets" radiogroup 15 s / 20 s (selected) / 30 s + "Longer rests may push today past 15 minutes. We show the new total before you start."
- Persist to `SessionPrefs` (local, synced as account setting). Reachable only from Paused (A15); changing quiet mode mid-session requires re-resolving remaining steps (high-impact -> low-impact rungs) and recomputing totals. Switch = RN Paper `Switch` with `accessibilityRole="switch"`.

### 1.22 Feel (`m3-feel`) route `Feel` (sheet over Rest/Player)
- Dimmed (aria-hidden) Rest backdrop ("Move 3 of 5 done"). Sheet `role=dialog` "How does this feel?" (slide `up` .45 s): "One tap changes your next set. Your answer also shapes next week." Three options: Easy (Go harder), Good (Keep it), Hard (Ease off); "Skip". All -> `Player`.
- Maps to intensity: easy -> harder rung, good -> keep, hard -> easier, from next set; writes `FeelSignal {sessionId, stepIdx, value}`. PRD: shown after the middle exercise, dismissable by swipe, never over timed intervals, skipped on sessions < 8 min. Vocabulary clash A11.

### 1.23 CheckIn (`m3-checkin`) route `WeeklyCheckIn`
- Not a session screen (entered from Profile/Recap). Close -> `Profile`. Intro "Two minutes, once a week. Every question is optional, and only you see the answers." "How did this week feel?" 3 toggle buttons Tough / Good (pressed) / Great. "Weight . optional": stepper -/+ 0.1 kg around "61.2 kg". Trend card: 4-week sparkline `role=img` + "We show a trend, never one day's number. Weight moves 1 to 2 kg a day with water alone." "Waist . optional, monthly": button "Add a waist measurement" (target undefined). Footer "Skip this week" -> `Profile`; "Save" -> `Recap`.
- Writes `WeeklyCheckin` (local; health data, off server unless sync on). Not in data-model.md. Stepper needs long-press repeat + direct numeric entry. No `Weight` on Home per PRD.

## 2. Session player: state machine and types

Applies to Player, Rest, Paused, EndSession, Feel, SessionSettings, Yoga, Dance (Desk is a reduced variant). All are **one route family driven by one store** (`useSessionStore`, Zustand) so the screens above are views of `SessionState`, not separate timers.

### 2.1 Types
```ts
type Style = 'normal' | 'yoga' | 'dance';
type Phase = 'warmup' | 'work' | 'cooldown';
type StepMode = 'timed' | 'hold' | 'reps' | 'routine_step';      // reps: rep-based, user taps Done
type Rung = -1 | 0 | 1;                                          // easier | as planned | harder (yoga gentler/deeper, dance low/high)

interface PlanStep {
  id: string; phase: Phase; exerciseId: string; variantId: string; // variant = resolved ladder rung
  name: string; cue: string; mode: StepMode;
  sets: number; workS: number;               // e.g. 2 x 30
  restAfterSetS: number | null;              // null = use prefs.restS
  sides: 'none' | 'each';                    // 'each' => R then L within a set (order: right first)
  targetReps?: number; bpm?: number;         // dance; reps
  breath?: { inS: number; outS: number };    // yoga cue (4/6)
  formCheckable: boolean; lowImpact: boolean;
  rung: Rung; rungsAvailable: Rung[];
}
interface SessionPlan {
  id: string; planDayId: string | null;
  origin: 'plan_day' | 'ready_made' | 'body_part' | 'micro' | 'resume';
  title: string; style: Style; kind: 'full15' | 'stretch' | 'micro';
  budgetS: number;                           // 900 default; user override allowed (editor "Go 16 min")
  prefs: SessionPrefs;                       // snapshot at start
  steps: PlanStep[];                         // flat, ordered: warm-up (2 min) + work (~11) + cool-down (2 min)
  exclusions: { exerciseId: string; flag: HealthFlag; replacedBy?: string }[];
  engineVersion: string; catalogueVersion: number;
}
interface SessionPrefs { voice: boolean; duck: boolean; lang: string; quiet: boolean; restS: 10 | 15 | 20 | 30; }

interface Cursor { stepIdx: number; set: number; side: 'R' | 'L' | null }
type Segment = 'countin' | 'work' | 'switch' | 'rest' | 'transition';

type SessionState =
  | { status: 'preview' }
  | { status: 'active'; cursor: Cursor; segment: Segment; segmentEndsAtMono: number; segmentS: number;
      elapsedS: number; extraRestS: number; feelShown: boolean }
  | { status: 'paused'; cursor: Cursor; segment: Segment; remainingMs: number; reason: 'user' | 'call' | 'background' | 'headset' | 'audio_focus'; pausedAt: number; resumeBy: number /* +24h */ }
  | { status: 'confirm_end'; resume: Extract<SessionState, { status: 'active' | 'paused' }> }
  | { status: 'ended'; outcome: 'saved_for_later' | 'discarded' }
  | { status: 'complete'; durationS: number };
```
Clock source: monotonic (`performance.now`/`SystemClock.elapsedRealtime`), store `segmentEndsAtMono`; UI ticks at 4 Hz and derives `remaining`. Never count `setInterval` ticks (backgrounding drifts). Displayed total must equal warm-up + work + rest + cool-down to the second (PRD acceptance).

### 2.2 Transitions (text diagram)
```
preview --Start--> active(step0, set1, side=first, segment=countin 3s)        [warm-up phase, step 0]
countin --clock--> work
work    --clock--> (sides=each & side=R) switch(~3s, cue "switch sides") --clock--> work(side=L)
work    --clock, last side--> (set < sets) rest(restS+extraRestS) --clock--> countin->work(set+1)
                              (set == sets) rest(restS) [between moves] --clock--> next step
                              (last step of phase) --clock--> next phase (warmup->work->cooldown); no rest at phase edge (assumed)
last step done --clock--> complete
any active --user Pause / call / app background / headset unplug--> paused(reason)
paused --Resume--> active(same cursor, remainingMs restored, 3 s countin optional)
paused --24h elapsed--> SessionLog(status=unfinished) + snapshot deleted (checked on app open)
active|paused --Close(X)--> confirm_end
confirm_end --Keep going--> previous state | --Save--> ended(saved_for_later) | --End--> ended(discarded)
work --Skip (skip_next)--> rest (then next step; skipped step logged skipped)
rest --Skip rest--> next step countin (design wires this to Feel: see A5)
work|rest --Prev--> restart previous step at set 1 (design leaves unwired)
rest(first time at mid move) --prompt--> Feel sheet (non-blocking: timer keeps running; swipe/Skip dismisses)
```
- **Clock-driven**: countin, work, switch, rest, phase and step advance, Feel auto-dismiss at rest end, 24 h expiry, voice cues at 10 s / 3-2-1, warm-up -> work -> cool-down change.
- **User-driven**: Pause/Resume, Skip move, Skip rest, Prev, +15/+30 s (adds `extraRestS`, capped 90 s; applies to the current rest if resting, else next rest: A6), intensity radiogroup (takes effect at next set boundary, never mid-rep; recompute remaining time and re-resolve variants), Done tap for `reps` steps, End/Keep/Save, Check form (suspends clock, see below), Feel answer.
- **Check form**: for the 4 analysed exercises only; consumes entitlement (idempotent consume/refund per architecture 4.2) then opens `Camera`; the timer pauses while camera runs (assumed, not designed); returns to `paused`/`active` same cursor.
- **Intensity table (PRD)**: timed circuit easier 30/30, planned 40/20, harder 45/15 (work/rest); reps +-; holds +-10 s; dance low/high impact. Design shows 2 x 30 s with 20 s rest, so the engine default and the table disagree (A3).

### 2.3 Cues, device behaviour
| Concern | Implied by design/PRD | Implementation note |
|---|---|---|
| Voice coach | Settings: cues and count-ins work with screen off; language selectable | Pre-rendered clips per language in catalogue (Hindi later); queue by event: step start, "switch sides", 10 s, 3-2-1, rest start, "up next: X", halfway, done |
| Beeps / haptics | Quiet mode: vibration instead of beeps, no jumping moves | `expo-haptics` for taps and 3-2-1; short beep sample otherwise; quiet mode = haptic only + low-impact rungs |
| Music | "Lower music while coach talks"; "Your music keeps playing" | Audio session mixWithOthers + duck; dance mode plays its own track at `bpm` |
| Keep-awake | Not designed. PRD: works with screen off, face-down | Hold `expo-keep-awake` while screen is visible and status active/rest; do not rely on it for cues; Android foreground service (media/health type) + iOS background audio for cues |
| Interruptions | PRD: calls and app switches pause automatically; resume restores same exercise and set | `AppState` + audio-focus/interruption events -> `paused(reason)`; persist `SessionSnapshot` on every transition and every 5 s |
| Process kill | 24 h resume window | Snapshot restore on launch -> Home shows "Resume" card (undrawn) |
| Orientation, DND | n/a | Lock portrait |

### 2.4 Plan engine -> player contract
Engine (rules, on device) outputs `SessionPlan` once per PlanDay and caches it in `plan_day.session_json`. Rules: 2 min warm-up matched to today's muscles + ~11 min work (5 slots; min 3, max 8) + 2 min cool-down rebuilt from the muscles actually worked; Exclusions by `HealthFlag`; rung from experience and last week's `felt`. Editor mutates a working copy and re-runs `rebuildCooldown(plan)` and `totalS(plan)`; "Just today" -> run-only copy, "Save to my plan" -> persists to PlanDay. The player never decides content; it only walks `steps`.
`totalS(step) = sets * (workS * (sides=='each' ? 2 : 1)) + (sets-1) * restS + (transitionS)`; see A2 for why the design's "2:00 per move" does not follow from 2 x 30 s.

## 3. Ambiguities and conflicts (flag only)
- **A1** One orchestrated motion per screen (CLAUDE.md) vs Home (pill stagger, bar reveal, ring grow, bar fill, hero loop), Yoga (hold, breathe, ring grow), Complete (pop + three rises).
- **A2** Timing arithmetic. PRD: 5 slots x "2 sets of 40 on / 20 off" = 10 min vs "about 11 min work". Design: 2 x 30 s per move listed as 2:00 slot, 5 moves, work header "11 min"; Editor: 6 moves = "12", total 16:00; Picker "13:00 now"; Player "9:42 left" at move 3. Exact per-move time, whether sides double it, and whether rest counts inside "2:00" must be fixed before the engine is written.
- **A3** Intensity table (30/30, 40/20, 45/15) vs "2 x 30 s, 20 s rest" vs Settings rest 15/20/30 vs Editor "Shorter rests" (never below 10 s). Also whether dark theme is forced in-session or follows system (dark prop is only a canvas default).
- **A4** Move order/identity differs per screen (PlanDetail: Glute bridge, Bird dog, Dead bug, Plank, Side plank; Player move 3 = Bird dog; Rest up next = Dead bug; Editor 6 moves). Sample content, but needs one source of truth.
- **A5** Wiring: Rest "Skip rest" -> Feel; Rest close labelled "End session" -> Player; EndSession counts "3 of 5 moves" while Player is mid move 3; Player previous button has no target; Yoga/Dance prev/next link to themselves.
- **A6** "+15s/+30s rest" lives on the work screen and the rest screen; target segment unclear; Settings says rest chosen "between sets" but Rest screen is shown between moves.
- **A7** Early end: SessionLog schema has no `status`; "Save and finish later" vs "End without saving" persistence of partial minutes; Home has no resume or unfinished state.
- **A8** Home swap_horiz and tune both -> Editor; WeekPlan swap -> Editor (no swap picker); Editor back always -> Player.
- **A9** WeekPlan Weeks 2-3: precomputed or projected? Data model says `week_number` advances automatically; no PlanDay table exists.
- **A10** BodyPart/Library rows open PlanDetail rather than Exercise; add_circle targets undefined (nested in link).
- **A11** Three effort vocabularies: Easier/As planned/Harder (Player), Easy/Good/Hard (Feel), Too easy/About right/Too hard (Complete); PRD idea 4 also says Energised/OK/Drained at end; data model `felt` = easy/about_right/hard.
- **A12** Bottom bar has 3 tabs (Workout, Nutrition, Progress) vs PRD "two tabs"; Home shows food calories while CLAUDE.md says calories can be hidden (no hidden state drawn). PRD: intensity change updates calories on screen; Player shows none.
- **A13** Yoga breath cue 4+6 s vs 8 s breathe animation; Yoga/Dance lack warm-up/cool-down segments the PRD requires for all styles; dance 11-min routine with step/beat sync undefined; free taster (3 yoga, 2 dance) gating not shown.
- **A14** Form check button on Bird dog (not an analysed exercise); "Try 30 seconds" on Exercise has no defined player mode; camera pause semantics.
- **A15** Quiet mode: PRD says session overview switch; design only has it inside Paused sound sheet. Settings promise "we show the new total before you start"; no such surface exists.
- **A16** Demos are 2-frame SVG loops in design; architecture assumes `react-native-video` demo clips. Decide catalogue field (`demoFrames[2]` vs `demoVideoUrl`).
- **A17** Library filters HIIT and Stretch are not Styles; weekly check-in (weight, waist, mood) has no data-model entity and weight is health data.

## 4. Shared components needed
| Component | Key props | Used by |
|---|---|---|
| `TopBar` | `variant: 'greeting'\|'back'\|'close'\|'session'`, `title`, `subtitle`, `leading`, `trailing[]` (48 px IconButtons or text link) | all |
| `BottomNav` | `current: 'workout'\|'nutrition'\|'progress'` (80 px, c2, filled icon when selected) | Home, HomeRest |
| `IconButton` | `icon`, `label`, `size 48\|56\|96`, `tone 'tonal'\|'plain'\|'filled'`, `onPress` | TopBar, Player family, Editor, Exercise |
| `FilledButton` / `TonalButton` / `OutlineButton` | `label`, `icon?`, `onPress`, `height 48\|52\|56`, `disabled` (wraps Paper Button, radius 28/16) | Home, WeekPlan, Plan, Rest, Paused, Editor, Complete, Why, Lunge, Exercise, Parts, Checkin |
| `DayPill` / `WeekStrip` | `day`, `state: today\|planned\|yoga\|optional\|rest\|done`, `icon`, `label`, `onPress` | Home, HomeRest |
| `TodayCard` | `title`, `meta`, `shape`, `onStart`, `onSwap`, `onEdit`, `illustration` | Home |
| `SegmentedProgress` | `variant: 'shape'\|'session'\|'budget'`, `segments[{weight, state: done\|current\|todo, fill?: 0..1, tone}]`, `marker?`, `label` | Home, Plan, Player, Yoga, Dance, Editor |
| `ExerciseIllustration` | `exerciseId` / `frames[2]`, `size`, `loop`, `static` (first frame when reduced motion), `description` | Player, Rest, Yoga, Dance, Desk, Exercise, BodyPart |
| `TimerRing` | `remainingMs`, `totalMs`, `size 240\|84\|56`, `tone`, `label`, `centerText` | Rest, Yoga, Desk, Home steps ring |
| `BigTimer` | `seconds`, `caption` (72 px tabular, polite live region off) | Player, Dance |
| `IntensityControl` | `options[3\|2]`, `value`, `onChange`, `caption`; radiogroup semantics | Player, Yoga, Dance, Complete (felt), SessionSettings (rest) |
| `TransportRow` | `onPrev`, `onPause`/`onResume`, `onNext`, `pauseSize` | Player, Yoga, Dance |
| `ChipFilter` | `options`, `selected[]`, `multi`, `onChange`, `scrollable` (44 px) | Library, BodyPart, Picker, WeekPlan tabs |
| `PlanTile` (carousel) / `PlanListRow` | `title`, `meta`, `icon`, `tone`, `onPress`, `onAdd` | Home, Library |
| `BodyPartTile` | `part`, `focus`, `onPress` | Home |
| `ExerciseRow` / `MoveRow` | `exercise`, `meta`, `trailing: add\|remove\|duration\|none`, `blocked?`, `onPress` | BodyPart, Plan, Picker, Editor, Parts |
| `PlanDayRow` | `day`, `title`, `sub`, `onPress`, `onSwap` | WeekPlan |
| `AnswerRow` | `icon`, `label`, `value`, `onChange` | Why |
| `HiddenByFlagRow` | `exerciseName`, `reason` | BodyPart, Picker, Lunge |
| `BottomSheet` / `AlertDialog` | `title`, `onDismiss`, focus trap, `variant`, motion `rise\|up\|pop` | Picker, SessionSettings, Feel, EndSession |
| `SettingSwitchRow` | `icon`, `title`, `sub`, `value`, `onChange` (min 64 px) | SessionSettings |
| `FormCheckChip` | `remaining`, `onPress` | Home, Player |
| `StatTile`, `InfoNote` | value+caption; icon+text on c3 | Complete, Why, Paused, Lunge, Exercise, Desk |
| `Stepper` (decimal) | `value`, `step 0.1`, `unit`, long-press repeat | CheckIn |
| `useMotion` hook | returns `reduced`, durations, easing (cubic-bezier(.2,0,0,1)) | all |

Theme: map `tokens.ts` roles into Paper MD3 theme + a `useTokens()` returning `p, pc, sc, tc, c1..c4, er` etc.; never hard-code hex (only camera view; note the skin tone `#D49A6A`/`#2A1A12` inside illustrations is hard-coded in the SVGs - treat as asset colours, not UI).

## 5. Data and state
```ts
type HealthFlag = 'knee' | 'back' | 'shoulder' | 'wrist' | 'other_pain' | 'heart_bp' | 'pregnancy' | 'recent_surgery';
interface Style { id: 'normal' | 'yoga' | 'dance'; proOnly: boolean; tasterIds?: string[]; }   // static, bundled
interface Exercise {                                  // content catalogue (bundled / Wi-Fi download)
  id: string; name: string; style: Style['id']; bodyParts: string[]; muscles: string[]; difficulty: 'easy' | 'medium' | 'hard';
  equipment: 'none' | string[]; formCheckable: boolean; lowImpact: boolean; seatedOk: boolean;
  excludedByFlags: HealthFlag[]; cue: string; steps: string[]; defaultSets: number; defaultWorkS: number; sides: 'none' | 'each';
  mode: 'timed' | 'hold' | 'reps' | 'routine_step'; breath?: { inS: number; outS: number }; bpm?: number;
  demo: { frames: string[]; videoUrl?: string; alt: string }; voiceClips: Record<string /*lang*/, string>;
  proOnly: boolean; catalogueVersion: number;
}
interface ExerciseSubstitution { exerciseId: string; kind: 'easier' | 'harder' | 'no_equipment' | 'low_impact' | 'seated' | 'flag_swap'; toExerciseId: string; flag?: HealthFlag; reason: string }
interface Plan { accountId: string; goal: 'stay_fit' | 'body_part' | 'gentler'; styles: number /*bitmask*/; daysPerWeek: number; experience: 'new' | 'on_and_off' | 'regular'; flags: HealthFlag[]; focusParts: string[]; weekNumber: number; engineVersion: string; updatedAt: string }
interface PlanDay { id: string; planWeek: number; dayIndex: number /*0=Mon*/; kind: 'workout' | 'walk' | 'stretch' | 'rest'; style?: Style['id']; title: string;
  session?: SessionPlan /*cached engine output*/; overridden: boolean; exclusions: SessionPlan['exclusions']; status: 'upcoming' | 'today' | 'done' | 'skipped' }
interface Session { id: string; planDayId: string | null; startedAt: string; plan: SessionPlan; state: SessionState; snapshotAt: string }   // live row; one at a time
interface SessionLog { id: string; accountId: string; planWeek: number; planDay: number; style: Style['id']; status: 'complete' | 'unfinished'; durationS: number; movesDone: number; movesPlanned: number;
  felt?: 'easy' | 'about_right' | 'hard'; rungChanges: { stepIdx: number; rung: Rung }[]; feelSignals: { stepIdx: number; value: 'easy' | 'good' | 'hard' }[]; warmupSkipped: boolean; formChecks: number; quiet: boolean; completedAt: string }
interface MicroSessionLog { id: string; planId: 'desk'; activeS: number; at: string }       // counts to active minutes, not streak
interface Favourite { exerciseId: string; at: string }
interface WeeklyCheckin { weekStart: string; mood?: 'tough' | 'good' | 'great'; weightKg?: number; waistCm?: number }
```
| Entity | Local SQLite (Op-SQLite + Drizzle) | Server sync |
|---|---|---|
| Exercise, ExerciseSubstitution, Style, ReadyMadePlan | Bundled seed + versioned pack (content catalogue) | Pack download from CDN; read-only |
| Plan | Yes (source of edits) | Yes: metadata only (`PUT /me/plan`, data-model `plan`); `flags`, `focusParts` only if health sync on |
| PlanDay (+ cached `SessionPlan`) | Yes; regenerated on device | Not synced (derivable); `session_json` never leaves device |
| Session (live snapshot) | Yes, one row, 24 h TTL | Never |
| SessionLog | Yes | Yes (batch, `session_log` table; add `status`, `moves_done`; `duration_s` clamp 60..3600 conflicts with 24 h-resumed or <60 s unfinished sessions) |
| MicroSessionLog | Yes | Yes with SessionLog batch (new table needed) |
| SessionPrefs, Favourite | Yes (key-value) | Prefs sync as account settings; favourites optional |
| WeeklyCheckin | Yes, encrypted | Only if health sync on (new table; health data) |
| FormCheckBalance cache | Entitlements cache (Zustand + SQLite) | Server is source of truth (consume/refund, idempotency key) |
State layers: Zustand `useSessionStore` (live player, persisted via snapshot), `usePlanStore` (draft/working copy for Editor), TanStack Query only for server-backed reads (entitlements, content pack, sync) - player and plan reads come straight from Drizzle live queries.
