# CasaFit

A 15-minute home workout app with food and step tracking. This repo holds the product documents and the Material 3 screen designs. There is no app code yet.

## Progress tracking

**Read `docs/progress.md` at the start of every session and before picking up work.** It lists what is done, in progress, pending and next up. Update it in the same commit whenever you complete, start or block an item, and keep its "Next up" list accurate.

## What is where

| Path | What it is |
|---|---|
| `fitness-app-prd.html` | Product requirements document (the main spec). Section numbers and `§` links are used throughout, so renumber with care. |
| `fitness-app-spec.html` | Earlier feature plan the PRD builds on. |
| `project/m3-*.dc.html` | The Material 3 screens, one file per screen, 390 px wide. |
| `project/*.dc.html` (no `m3-` prefix) | Earlier neo-brutalist screens. Reference only. |
| `project/canvas.json` | Board layout index for the design canvas. |
| `tools/check.py` | Validation. Run it before every merge. |

## Design rules for the M3 screens

- Material 3 tonal colour roles as CSS variables (`--p`, `--pc`, `--sc`, `--tc`, `--bg` and so on). Never hard-code a hex in a screen, except the camera view.
- Type: Roboto Flex only. Minimum 12 px. Sentence case. No all-caps labels, no tracked letter-spacing. Numbers use tabular figures.
- Icons: Material Symbols Rounded, filled when selected. No dumbbell (`fitness_center`): this is a home, bodyweight app.
- Tap targets 44 px or more. Every interactive element needs a visible focus ring.
- Motion: one orchestrated moment per screen at most. Always respect `prefers-reduced-motion`.
- Copy: plain, active verbs. Calories can be hidden by the user. Never shame.
- Product rules from the PRD: a 15-minute session is 2 min warm-up, 11 min work, 2 min cool-down. Free accounts get 2 form checks for life. Camera analysis stays on the phone.

## Check before merging

```
python tools/check.py
```

It fails on broken links, unbalanced tags, text under 12 px, all-caps labels and the dumbbell icon. Warnings (unlinked state screens, tap targets) are allowed.

## Working in parallel with git worktrees

Work is split into lanes. Each lane has its own worktree and branch, and edits only the files it owns.

| Lane | Branch | Owns |
|---|---|---|
| docs | `lane/docs` | `fitness-app-prd.html`, `fitness-app-spec.html` |
| onboarding | `lane/onboarding` | welcome, age, verify, otperror, offline, welcomeback, goals, mix, about, health, building, weekone |
| session | `lane/session` | home, homerest, weekplan, why, library, bodypart, plan, player, rest, paused, endsession, editor, picker, parts, lunge, complete, yoga, dance, desk |
| features | `lane/features` | camera, form, live, formresult, camdenied, nocredits, paywall, managepro, nutrition, nutriprofile, nutriplan, foodsearch, meal, steps, reverse, reversetimer, learn, myth, concepts, progress, recap, settings, notify, deleteacct |

Create worktrees next to the repo, not inside it:

```
git worktree add ../casafit-wt/session -b lane/session
```

Rules for every lane:

1. Do not edit `project/canvas.json`. The integrator rebuilds it after merging.
2. Do not edit the shared design tokens, the bottom navigation, or the font setup. Those are copied into every screen, so a change touches all of them. Global changes happen once, on `main`, while the lanes are idle.
3. Do not publish the design canvas from a lane. Only the integrator publishes, once, after merging.
4. Run `python tools/check.py` in your worktree before asking to merge.

Merge order: docs first, then the screen lanes one at a time. After each merge, run the check again on `main`.

Clean up a finished lane:

```
git worktree remove ../casafit-wt/session
```

Then `git branch -d lane/session` and `git worktree prune`.

## Notes

- The remote is `https://github.com/mr-nsin/casafit.git` (the repo was renamed from `research-fitness-app`).
- Line endings are LF everywhere (`.gitattributes`). Windows may print CRLF warnings on older checkouts. They are harmless.
- All numbers in the screens (prices, steps, meal calories, review dates) are sample content, not real data.
