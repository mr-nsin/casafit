# Device findings (Pixel_7 emulator, 12 Nov 2026)

Debug build with the pose module, placeholder icon, and all work to 7 Nov. Dev token auth (`app/.env.local`), local API not running. First pass only: Welcome, Age, Verify, Home (rest day), Nutrition. The emulator was overloaded for part of the run, so slow taps were not counted as defects.

## Working
- Welcome, Age (year sheet scrolls, 18+ checkbox enables Continue), Home rest day (week strip, rest cards, tomorrow card, 2 free chip), Nutrition goal chips, food plan builds with valid numbers.

## Defects (ordered by how many people they hit)
1. **Verify is a dead end without a Supabase project or dev token**: "Sign in is not set up on this build", only the back arrow leaves. Expected until Supabase exists; a release build must never reach this.
2. **Keyboard covers the focused field** on "Your food plan" (Height and Weight hidden behind the keyboard, no scroll into view). My second field tap landed on the keyboard and both numbers went into Height ("170670").
3. **Build my food plan looks enabled but does nothing, with no message** when height is impossible or weight is empty. No validation text. (Audit: disabled/no-op with no hint.)
4. **First tap after the keyboard is only a dismiss** (matches audit finding: ScrollView without `keyboardShouldPersistTaps="handled"`).
5. **Header ignores the status bar inset** on the Nutrition stack screens: clock overlaps the back arrow and title, the tune icon overlaps the battery.
6. **Stale helper text**: "Add your height and weight so we can work out your daily target." stays after valid values are entered.
7. **Back from the food plan returns to the questionnaire**, not the Nutrition tab, and these screens hide the tab bar, so tab taps hit page content.
8. **Year of birth list starts at 2025** for an adults-only app (should start at the current year minus 18, or at least not offer impossible years).
9. **Food names read awkwardly**: "Almonds - 3 chamach, Appam - 3 appams" (copy and unit formatting; content review).
10. Welcome bar: warm-up and cool-down segments unlabelled (known).

## Not yet checked on device
Progress, Steps, Learn, Profile and Settings, Library, Plan, Editor and drag, Player, Rest, Complete, Pro screens, camera and live check, Offline and error states. See `ui-audit.md` for the controls the Jest audit flagged as broken or suspicious.

## Second pass, 12 Nov (after the tester fixes)

Checked on the emulator: About (ft/in, kg/lb, Male/Female/Other, keyboard no longer covers fields, first tap on Build my plan works), Week one (labelled bar, plain day tiles), Ready then Start, Harder and +30s rest feedback, Close, Keep going, food plan form, food search in pieces, portion picker.

Fixed in this pass:
- **Player family header sat under the status bar.** The Close X was drawn under the clock and only its lower half was tappable, so a tap on the visible X did nothing. `Screen` in `features/session/components.tsx` now adds the top and bottom insets. This was the main cause of "buttons not working".
- **Food plan blamed height and weight when the year of birth was missing.** The form now asks for the year of birth when the profile has none, and the button says what is missing.
- **Back from the food plan went back to the questionnaire.** Save now replaces the form with the plan.
- **Plans asked for 20 almonds.** Plan builds are capped at the second quick step (10).

Still open:
- The Start button moves down when a notice appears under Easier/Harder.
- On Add to snack and Same as yesterday the button label is clipped ("Add to", "Same as"). Cause not found; check the font load and Text layout.
- Home opens slightly scrolled under the status bar after a reload.
- The floating Expo dev button covers the top-right icon in debug builds only.
- Not yet walked: Progress, Steps, Learn, Settings, Library, Rest, Complete, Pro screens, camera.

