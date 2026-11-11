# UI/UX, testing and media: research notes

Written 11 November 2026. Sources are mostly vendor blogs, so treat rankings as indicative and check repos and pricing before adopting anything. Star counts come from third-party aggregators and may be stale.

## Why this exists
Some buttons do not work and the UI/UX needs a big lift. The flows stay as they are; the visuals and behaviour improve. Reference look (user image, 11 Nov): large photo cards per workout, dark pill bottom bar, ring timers on every list row, a floating vertical timer slider on the player. Our screens are tonal Material 3 with icon-only stages, so the biggest gap is missing exercise imagery.

## Testing stack (recommendation)
| Layer | Tool | Note |
|---|---|---|
| Component and logic | Jest + React Native Testing Library | Already used. Never runs on a real screen, which is how broken buttons slip through |
| End-to-end | Maestro (YAML flows, open source) | Flows in `app/.maestro`, not yet run |
| Alternatives | Detox (RN gray-box), Appium (broadest, more setup) | Opinions on Detox differ; no reason to switch |
| Gap | Tap-every-control audit | Our own build: walk each screen, press every control, fail if nothing happens. See `ui-audit.md` |

## Skills and UI/UX
- Anthropic `frontend-design` skill: most prominent; installed here. Mobile-specific skills are thin (a Vercel React Native skill, an ios-design skill; details unverified). Read any third-party skill source before installing.
- Available now: design skills for accessibility review, design critique, UX copy, design handoff.

## Animation
Reanimated and gesture-handler are already in the app. Split: Reanimated for gestures, transitions, progress rings; Rive for stateful pieces (buttons, check-ins, streak icons; test memory on low-end Android); Lottie for one-off celebrations; Skia only for custom effects (blur, shaders).

## AI-generated exercise media
- Consistent instructor: HeyGen, Invideo (persistent character).
- Exercise motion: Revid.ai (3D exercise animation), CloneMotion (clip from a photo).
- DIY: Midjourney or Stable Diffusion for one fixed character, Kling or Luma for motion; most control, most work.
- Risk: AI footage may show wrong technique. In an app that checks form that is worse than no demo. Plan: AI stills in one consistent style plus short looping two-pose animations; a trainer or physiotherapist reviews every exercise before release.

## Open decisions
1. Redesign scope: all 86 screens or the 8 most seen first (Home, Player, Library, Plan, Week one, Complete, Progress, Paywall).
2. Whether the new look may leave the CLAUDE.md rules (Material 3 tonal tokens, Roboto Flex, no hard-coded hex).
3. Media approach and budget (AI stills plus two-pose loops versus real filmed demos; which tool).
