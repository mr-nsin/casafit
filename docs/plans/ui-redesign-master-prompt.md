# CasaFit · UI/UX redesign master prompt

Written 12 November 2026. Version 2 of the redesign brief, rewritten against the real codebase. Paste everything below the line into a fresh session at the repo root. The "Decisions baked in" block is the part to edit if you disagree.

---

# CasaFit redesign: warm, tactile, illustrated

## 0. What this is

CasaFit is a 15-minute home, bodyweight workout app with food and step tracking, built for India (English and Hindi). The app lives in `app/` (Expo SDK 58 dev client, React Native 0.88, New Architecture, TypeScript strict, 68 routes, about 1,040 Jest tests, a tap-every-control audit).

The flows, copy rules and product rules stay exactly as they are. This work changes how the app looks, moves and feels, and puts a picture of the movement wherever an exercise is shown. Today every exercise is a generic icon, which is the biggest gap.

Before anything else, read `CLAUDE.md`, `docs/MEMORY.md`, `docs/progress.md`, `docs/plans/ui-ux-testing-research.md` and `docs/plans/device-findings.md`.

### Decisions baked in (edit before running if wrong)

1. **The new look replaces the Material 3 look.** Fraunces and Plus Jakarta Sans replace Roboto Flex, Lucide replaces Material icons, and the palette in §3 replaces the current values. `CLAUDE.md`'s design rules are updated in Phase 0 to say so. The rules that are about people rather than style do not change (§2).
2. **Scope is two waves.** Wave 1 is the eight most-seen screens: Home, Player (stage, rest, paused), Library, Plan detail, Week one, Complete, Progress, Paywall. Wave 2 is everything else. Stop after Wave 1 for a device review.
3. **Dark theme is kept.** The brief only defines light colours; the existing dark palette in `app/src/ui/tokens.ts` stays, with the new keys added.
4. **The HTML designs become reference only.** `project/m3-*.dc.html` are not redrawn. The app code is the source of truth for the new look.
5. **Exercise animation starts with a three-move spike.** Generated Lottie for human figures is unproven. If the spike fails the review in §6, fall back to the two-pose illustration and report it; do not generate 66 poor animations.

## 1. Design intent

Aim for these qualities. Do not copy any app's layout, artwork or assets.

- **Encouraging and unhurried** (Gentler Streak, Apple Fitness+): rounded organic shapes, clear movement visuals, progress that never scolds.
- **Tactile** (Opal, Headspace): controls that give under the thumb, continuous corners, warm cream and peach depth instead of grey.
- **Precise where it counts** (MacroFactor, Cronometer): timers, streaks and food numbers in crisp tabular figures that do not jitter as they change.

What "generic" means here, so you can avoid it: a tracked all-caps eyebrow above every heading, identical card grids, empty placeholder frames, cold greys, a gradient where a flat tone would do, icon-in-a-circle repeated down a list, and filler copy. One confident idea per screen beats five decorations.

## 2. Rules that do not change

- A 15-minute session is 2 min warm-up, 11 min work, 2 min cool-down. Any timeline bar draws those in a 2 : 11 : 2 ratio.
- Free accounts get 2 form checks for life. Camera analysis stays on the phone.
- Copy: plain, active verbs, sentence case, no all-caps labels, no tracked letter-spacing. Never shame. Calories can be hidden by the user, so no layout may depend on a calorie number being present.
- Text is 12 px or larger. Tap targets are 44 px or larger. Every interactive element keeps its visible focus ring and its accessibility role, label and state.
- Motion: one orchestrated moment per screen at most. Reduced motion turns off scale, loops and entrances.
- No dumbbell icon anywhere (Lucide `Dumbbell` included). No equipment in any illustration.
- No hex colour outside `app/src/ui/tokens.ts`. A test already enforces this for the kit; extend it to `app/src/features`.
- The camera and form-check screens stay dark and are exempt from the palette.
- Local units stay: chamach, piece, grams, ft/in or cm, kg or lb.
- All numbers on screens are sample content.

## 3. Colour

`app/src/ui/tokens.ts` already holds a warm palette as Material role keys (`p`, `pc`, `tc`, `bg`, `c1` to `c4`, `on`, `osv`, `olv`), and 41 files read it through `useTokens()`. **Change the values and add keys there. Do not create `src/theme/tokens.ts` and do not rename existing keys**, or every screen and test has to change for no visible gain.

| Name in this brief | Light value | Existing key | Use |
|---|---|---|---|
| canvas | `#FDFBF7` | `bg` | Screen background |
| surfacePeach | `#F6E6DC` | `c3` | Resting cards, day pills, list containers |
| surfaceApricot | `#FADBC8` | `pc` | Hero workout card, highlighted nutrition card |
| surfaceElevated | `#FFFDFB` | `c1` | Active segment, floating tab bar, secondary buttons |
| brandTerracotta | `#9E4700` | `p` | Primary buttons, today pill, progress fill |
| brandTerracottaPressed | `#7D3800` | new `pp` | Pressed tint |
| accentChartreuse | `#E4EC8A` | `tc` | Warm-up segment, "2 free" badge, cardio highlight |
| coolDown | `#F3D5C0` | new `cd` | Cool-down segment |
| inkPrimary | `#2C221E` | `on` | Headings, hero numbers |
| inkSecondary | `#6E5D54` | `osv` | Subtitles, metadata, inactive tab labels |
| borderSubtle | `#EAD8CC` | `olv` | Hairlines, 1 px card borders |
| warmEdge | `rgba(158,71,0,0.12)` | new `edge` | Card edge on Android, illustration frame |

Walk the remaining keys (`sc`, `sv`, `c2`, `c4`, `ol`, `s`, `t`, error roles) and retune any that now clash; keep `op` and other on-colours passing contrast. Add the three new keys to the dark palette too. Update `paperTheme.ts` and `navigationTheme.ts` to match.

No cold greys, no pure white or pure black surfaces, no blue or purple accents.

**Measured contrast, so nobody has to guess:**

- Safe for text: inkPrimary on canvas 15.0, inkSecondary on canvas 6.1, on peach 5.2, on apricot 4.8; terracotta on canvas 6.1, on peach 5.2, on apricot 4.8; cream text on terracotta 6.1; ink on chartreuse 12.3.
- **Not safe as the only signal:** borderSubtle against canvas is 1.3 and against peach 1.1. Chartreuse against canvas is 1.2 and against apricot 1.04. coolDown against peach is 1.1. So a border alone never marks a control, chartreuse never carries text or sits unlabelled on apricot, and the timeline bar needs gaps and labels (§5). This is the same fault already logged for the Week one bar.
- inkSecondary on apricot (4.8) is fine at body size; do not go below 14 px there.

Add a small test that computes these pairs from `tokens.ts` so a later tweak cannot break them.

## 4. Type

- Display titles and screen headings: `Fraunces_600SemiBold`.
- UI text: `PlusJakartaSans_500Medium` and `PlusJakartaSans_600SemiBold`.
- Timers, hero numbers and all numerals: `PlusJakartaSans_800ExtraBold` or `600SemiBold` with `fontVariant: ['tabular-nums']`. Check on the emulator that the digits really are fixed-width in a running timer; if the font ignores the feature, say so and propose a fix rather than shipping a jittering timer.
- Hindi keeps Noto Sans Devanagari. Neither new font has Devanagari glyphs, so test one Hindi screen.
- Install `@expo-google-fonts/fraunces` and `@expo-google-fonts/plus-jakarta-sans`, load them in `app/src/app/fonts.ts`, and keep the fallback to system fonts if loading fails.
- The `type` scale in `tokens.ts` currently sets `fontWeight` on one variable font. Static font files need a family per weight, so each variant must name its family, and `Text` in `primitives.tsx` must stop relying on `fontWeight`. Grep for inline `fontWeight` overrides in screens and convert them to variants.
- Remove Roboto Flex once nothing references it.

## 5. Shape, depth and components

Put every number below into `tokens.ts` (`radius`, `space`, a new `elevation`), then use the tokens. Change the shared kit in `app/src/ui/` so screens inherit the look; do not restyle screen by screen.

**Corners.** `borderCurve: 'continuous'` goes with every radius, applied once in the kit's surfaces (it only has an effect on iOS). Hero cards radius 28, padding 20. Standard cards and plan tiles radius 22, padding 16. Day pills radius 20. Nested shapes are concentric: inner radius equals outer radius minus the padding between them, with a floor of 8.

**Buttons.** Primary buttons are full pills, 54 high (the kit's 56 becomes 54; 48 and 52 stay for compact rows). Icon buttons stay 48 visual with a 44 minimum.

**Depth.** Prefer the `boxShadow` style (works on both platforms on the New Architecture): `0 6 16 0 rgba(44,34,30,0.06)`. If it renders badly on the emulator, fall back to iOS shadow props plus, on Android, `elevation: 1` with a 1 px `edge` border. Never the default grey Android elevation on its own. At most one elevated layer per screen besides the tab bar.

**Day pills** (`DayPill` in `ui/progress.tsx`). Upcoming: solid surfacePeach. Today: terracotta with cream text. Rest and completed: canvas with a 1 px borderSubtle edge, plus an icon or check so the state is not carried by the border alone. No dashed borders on pills, cards or containers. The dashed goal line in charts and the dashed "optional" field can stay; they mean something.

**Workout timeline bar.** One pill track, height 36, radius 999, three segments in a 2 : 11 : 2 ratio: warm-up chartreuse, work terracotta, cool-down `cd`. Separate segments with a 2 px canvas gap, and label each with its minutes (inside the work segment in cream, below or inside the others in ink). Replace the existing session bar in `ui/session.tsx` and the Week one bar with this one component.

**Pressable.** Upgrade the existing `Touchable` in `ui/primitives.tsx` in place; the whole kit is built on it, and it carries the focus ring, tap-size and accessibility mapping that must survive. Add a Reanimated spring to 0.96 on press-in (`damping: 20, stiffness: 350`) and back on release. No scale under reduced motion. Do not add `TouchableOpacity` anywhere.

**Haptics** (`expo-haptics` is already installed). Not on every press; that turns into noise and drains attention. `selectionAsync` for day pills, segmented tabs, steppers and pickers. `ImpactFeedbackStyle.Light` for primary buttons. `NotificationFeedbackType.Success` once when a session completes. None for plain navigation rows, back buttons or scrolling. Add a prop to opt out, mock the module in `jest.setup.js`, and add a Settings switch only if the PRD already has one.

**Icons.** `lucide-react-native` at `strokeWidth={1.75}`, drawn in inkPrimary, or cream on terracotta. Keep the single `Icon` component in `primitives.tsx` and its string-name API: add one map from the names in use today to Lucide components, so screens do not change. Rewrite `ui/iconNames.test.ts` and `features/session/icons.test.ts` to check names against that map instead of the MaterialIcons glyph file. Lucide has no filled variants, so a selected tab or chip is shown by a terracotta tint and a surface pill behind it, not by a heavier icon. No ASCII characters standing in for icons (`>`, `<`, `+`, `-`). Avatars: a 42 px surfacePeach circle with a 1 px borderSubtle edge and initials or a `User` icon, never a grey disc. Remove `@expo/vector-icons` only when nothing imports it.

**Bottom sheets.** `BottomSheet` in `ui/overlays.tsx` was fixed two weeks ago for long lists. Keep its API. Swap its internals for `@gorhom/bottom-sheet` only if that library supports Reanimated 4 and RN 0.88 today; check before installing. Otherwise give the existing sheet a spring and a drag handle.

## 6. Exercise visuals

**Rule.** Wherever an exercise or workout appears, show the movement: Home hero card, ready-made plan tiles, exercise rows (Plan detail, Editor, Picker, Library), and the Player stage. Never a text-only row, never the generic gymnastics icon, never a blank frame.

**What already exists, so build on it:**

- `app/assets/content/exercises.json` has 66 moves. Each has an `id` (for example `march_in_place`), a `demo.frames` pair describing the start and end pose in words, a `demo.altKey` for the spoken description, and `loopMs`.
- `ui/illustration.tsx` has an `Illustration` host that flips two SVG frames and respects reduced motion.
- `features/session/icons.ts` is the icon fallback used today.

**Component.** `app/src/ui/ExerciseVisual.tsx`:

- Props: `exerciseId`, `size` (`'row'` 56, `'tile'` 64, `'card'` 84, `'hero'` 240), `playing` (default false).
- A rounded frame: radius 18 (scaled for hero), continuous curve, 1 px `edge` border, surfaceElevated background, all from tokens.
- Resolves in this order: Lottie file for the id, then a two-pose `Illustration` drawn from `demo.frames`, then the move icon. It never renders empty.
- **Only one animation plays at a time.** Rows and tiles show a still at the peak pose. The Home hero card and the Player stage animate, and pause when the screen loses focus, the session is paused, or reduced motion is on.
- Accessible label from `demo.altKey`.
- Colours come from tokens through Lottie colour filters keyed on layer names, so the figure stays visible in the dark theme (ink on a dark surface is 1.2 : 1, which is invisible).

Placement: Home hero `card` with the session's first work move; plan tiles `tile` with the plan's most typical move; rows `row`; Player stage `hero`, centred, replacing the static icon (this closes the open "two-frame move demo" item in `docs/progress.md`).

**Generating the animations** with the `text-to-lottie` skill from `diffusionstudio/lottie`:

- One file per move at `app/assets/animations/exercises/<exercise id>.json`, using the ids from `exercises.json`, not invented slugs. The skill writes to `public/projects/...`; generate in a scratch folder outside `app/` and copy only the final JSON in.
- Feed each prompt the move's own `demo.frames` text and step text, so the poses match what the app already tells the user.
- Style: flat, minimal side-on or three-quarter human figure, rounded joints and caps, no face detail, no equipment, transparent background. Three named layers, exactly: `body` (ink), `accent` (the working muscle group, terracotta), `ground` (mat or motion arc, chartreuse).
- Motion: one full rep, start pose to end pose and back, ease in and out, loops without a visible seam. Fixed camera, no zoom or pulse; a zoom moves the figure in its frame and reads as a glitch at 56 px.
- 60 fps. Loop length follows the move's tempo, 2 to 4 seconds, not a fixed 180 frames. Holds (plank, wall sit) get a slow breathing motion, not a rep.
- Vector shapes only, no images, no expressions. Target under 40 KB per file; report anything over 80 KB.

**Review gate.** A wrong demonstration is worse than none in an app that checks form. For each animation check: joints bend the right way, the spine and knees match the cue text, feet stay planted where they should, the loop has no pop. Anything that fails ships the two-pose fallback instead. Keep a table in `docs/plans/exercise-visuals.md` with one row per move: Lottie, fallback, or failed and why. A trainer or physiotherapist signs off before release; that sign-off is the user's to arrange, so list it as open.

**Spike first.** Generate squat, push-up and plank (a rep, a floor move and a hold). Render them at 56 and 240 on the emulator. Show the user. Continue to the other 63 only on a yes.

Add a test: every id in `exercises.json` resolves to a Lottie file or a fallback, and every Lottie file has the three named layers.

## 7. Tools and packages

Check each before use. Installing a skill or a native package changes the user's machine or forces a dev-client rebuild, so say what you are about to install first.

**Design skills.** Read each skill's source before installing it. Install per project, not globally.

| Skill | Install | How to use it here |
|---|---|---|
| `frontend-design` (Anthropic) | Already installed | Direction and copy realism |
| `pbakaus/impeccable` | `npx impeccable install`, then `/impeccable init` with `## Platform` set to `adaptive` in `PRODUCT.md` | `critique`, `audit`, `typeset`, `polish` read React Native source. Its detector and live mode are web-only; skip them |
| `Nutlope/hallmark` | `npx skills add nutlope/hallmark` | Built for web pages. Use its list of AI-design tells as a checklist; its browser lint does not apply |
| `Leonxlnx/taste-skill` | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` | Web-only. Borrow the art-direction vocabulary; do not run its render checks |
| `diffusionstudio/lottie` | `npx skills add diffusionstudio/lottie` | Generates the exercise animations (§6) |

**Packages.** Already in `app/package.json`: `react-native-reanimated` 4.7, `react-native-gesture-handler`, `react-native-svg`, `expo-haptics`. To add, with `npx --yes pnpm@9.12.0` from the repo root, pinned to exact versions like everything else:

- `lucide-react-native` (JS only).
- `@expo-google-fonts/fraunces`, `@expo-google-fonts/plus-jakarta-sans` (JS only).
- `lottie-react-native` (native; needs a dev-client rebuild; confirm it supports RN 0.88 and the New Architecture first). If it does not, `@shopify/react-native-skia` with Skottie is the alternative, at a larger binary cost.
- `@gorhom/bottom-sheet` only under the condition in §5.

Add all native packages in one go so there is one rebuild. Follow the Windows build notes in `docs/progress.md`.

## 8. How to run the work

Follow the lane and worktree rules in `CLAUDE.md`. Worktrees go in `../casafit-wt/<lane>`, branches are `lane/<name>`. Use the repo's agents: `mobile-engineer` builds, `qa-engineer` fixes tests, `reviewer` checks before a merge, `integrator` merges, `docs-keeper` records decisions.

**Phase 0 · Foundation, on one branch, nothing else running.** The kit, tokens, fonts and navigation are shared by every screen, so they change once, first, alone.

1. Record the baked-in decisions in `docs/decisions.md`, update the design rules in `CLAUDE.md`, and move the redesign to In progress in `docs/progress.md`.
2. Take "before" screenshots of the Wave 1 screens on the emulator into `docs/plans/screens/before/`.
3. Install packages, rebuild the dev client.
4. Tokens, fonts, `Text`, `Icon` and the icon map, `Touchable` spring and haptics, buttons, surfaces, `DayPill`, the timeline bar, tab bar, `ExerciseVisual` with fallbacks only.
5. Update the kit Gallery (`ui/Gallery.tsx`) so every component can be seen in one place.
6. All gates in §9 pass. Merge to `main`. From here the kit is frozen: a lane that needs a kit change reports it and the change is made on `main` between waves.

**Phase 1 · In parallel after Phase 0 merges.**

- `lane/visuals`: the three-move spike, then on approval the rest. Owns `app/assets/animations/` and `docs/plans/exercise-visuals.md` only.
- `lane/session`: Home, Player family, Library, Plan detail, Complete. Owns `app/src/features/session/`.
- `lane/features`: Progress, Paywall. Owns `app/src/features/progress/` and `app/src/features/formcheck/`.
- `lane/onboarding`: Week one. Owns `app/src/features/onboarding/`.

Each lane edits only its own folder. Merge one lane at a time, running the gates on `main` after each. Then stop: device walk, "after" screenshots beside the "before" ones, and a short report to the user.

**Phase 2 · Wave 2, after the user's review.** Same lanes, remaining screens: onboarding and settings; nutrition and steps; learn and the rest of form check and Pro; the rest of session (Editor, Picker, Week plan, Why, Check-in, Desk, yoga and dance).

**Phase 3 · Finish.** Remove unused packages (Roboto Flex, `@expo/vector-icons`, `react-native-paper` only if truly unused), run `/impeccable audit` and the accessibility review on the Wave 1 screens, update the Maestro flows if selectors changed, update `docs/progress.md`.

## 9. Gates and definition of done

Run from `app/` before every merge. All three must pass with no skipped or deleted tests:

```
npm run lint
npm test
npm run audit
```

`python tools/check.py` covers only the HTML designs; run it if a file under `project/` changed.

A screen is done when:

- It uses only kit components and tokens: no hex, no literal radius or font family, no `TouchableOpacity`, no dashed container.
- Every exercise or workout on it shows an `ExerciseVisual`.
- Numbers are tabular. Nothing is under 12 px. Nothing is clipped at the largest system font size.
- Light and dark both read correctly, and it still works with calories hidden.
- Every control still does what it did: the audit report has no new broken or suspicious entries.
- It has been seen on the emulator, not only in tests. Metro goes stale on this machine; restart with `--clear` if a change does not show (see the build notes).

## 10. Reporting

After each phase, tell the user: what changed, screenshots before and after, which gates passed with the test count, anything that deviated from this brief and why, and the open items. Say plainly when something was not checked on a device. Do not report a phase as done on test results alone.
