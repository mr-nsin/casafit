# CasaFit · Exercise visuals

One row per move in `app/assets/content/exercises.json`. Written 12 November 2026.

Every move is drawn by `ExerciseVisual` (`app/src/ui/ExerciseVisual.tsx`) as a jointed figure that eases between two key poses set by hand in `app/src/ui/exercisePoses.ts`. Contact sheets of all poses are in `screens/poses/`. No Lottie file is registered yet (`app/src/ui/exerciseAnimations.ts` is empty).

**Review is open for every row.** A wrong demonstration is worse than none in an app that checks form. A trainer or physiotherapist needs to check each figure against the cue text: joints bend the right way, spine and knees match the cue, feet planted where they should be. Mark the Review column when done; a move that fails should have its poses corrected in `exercisePoses.ts`.

View: side = seen from the side, facing right; front = seen from the front.

| Id | Name | Style | Mode | View | Highlight | Prop | Source | Review |
|---|---|---|---|---|---|---|---|---|
| `march_in_place` | March in place | normal | timed | side | legs | none | drawn figure | open |
| `arm_circles` | Arm circles | normal | timed | side | arms | none | drawn figure | open |
| `hip_circles` | Hip circles | normal | timed | front | core | none | drawn figure | open |
| `shoulder_rolls` | Shoulder rolls | normal | timed | side | arms | none | drawn figure | open |
| `torso_twist` | Standing twist | normal | timed | front | core | none | drawn figure | open |
| `inchworm` | Inchworm | normal | timed | side | core | none | drawn figure | open |
| `cat_cow` | Cat and cow | normal | timed | side | core | none | drawn figure | open |
| `jumping_jacks` | Jumping jacks | normal | timed | front | legs | none | drawn figure | open |
| `step_jacks` | Step jacks | normal | timed | front | legs | none | drawn figure | open |
| `high_knees` | High knees | normal | timed | side | legs | none | drawn figure | open |
| `mountain_climbers` | Mountain climbers | normal | timed | side | core | none | drawn figure | open |
| `skater_hop` | Skater hops | normal | timed | front | legs | none | drawn figure | open |
| `low_skater` | Low-impact skater | normal | timed | front | legs | none | drawn figure | open |
| `shadow_boxing` | Shadow boxing | normal | timed | side | arms | none | drawn figure | open |
| `chair_squat` | Chair squat | normal | timed | side | legs | chair | drawn figure | open |
| `squat` | Squat | normal | timed | side | legs | none | drawn figure | open |
| `sumo_squat` | Wide squat | normal | timed | front | legs | none | drawn figure | open |
| `jump_squat` | Jump squat | normal | timed | side | legs | none | drawn figure | open |
| `wall_sit` | Wall sit | normal | hold | side | legs | wall | drawn figure | open |
| `lunge` | Forward lunge | normal | timed | side | legs | none | drawn figure | open |
| `reverse_lunge` | Reverse lunge | normal | timed | side | legs | none | drawn figure | open |
| `side_lunge` | Side lunge | normal | timed | front | legs | none | drawn figure | open |
| `glute_bridge` | Glute bridge | normal | timed | side | legs | mat | drawn figure | open |
| `single_leg_bridge` | Single-leg bridge | normal | timed | side | legs | mat | drawn figure | open |
| `donkey_kick` | Donkey kick | normal | timed | side | legs | mat | drawn figure | open |
| `fire_hydrant` | Fire hydrant | normal | timed | side | legs | mat | drawn figure | open |
| `calf_raise` | Calf raise | normal | timed | side | legs | none | drawn figure | open |
| `wall_pushup` | Wall push-up | normal | timed | side | arms | wall | drawn figure | open |
| `knee_pushup` | Knee push-up | normal | timed | side | arms | mat | drawn figure | open |
| `pushup` | Push-up | normal | timed | side | arms | none | drawn figure | open |
| `diamond_pushup` | Close-hand push-up | normal | timed | side | arms | none | drawn figure | open |
| `pike_pushup` | Pike push-up | normal | timed | side | arms | none | drawn figure | open |
| `shoulder_taps` | Shoulder taps | normal | timed | side | core | none | drawn figure | open |
| `superman` | Superman | normal | timed | side | core | mat | drawn figure | open |
| `plank` | Plank | normal | hold | side | core | none | drawn figure | open |
| `knee_plank` | Knee plank | normal | hold | side | core | mat | drawn figure | open |
| `forearm_plank` | Forearm plank | normal | hold | side | core | mat | drawn figure | open |
| `side_plank` | Side plank | normal | hold | side | core | mat | drawn figure | open |
| `dead_bug` | Dead bug | normal | timed | side | core | mat | drawn figure | open |
| `bird_dog` | Bird dog | normal | hold | side | core | mat | drawn figure | open |
| `crunch` | Crunch | normal | timed | side | core | mat | drawn figure | open |
| `bicycle_crunch` | Bicycle crunch | normal | timed | side | core | mat | drawn figure | open |
| `reverse_crunch` | Reverse crunch | normal | timed | side | core | mat | drawn figure | open |
| `russian_twist` | Seated twist | normal | timed | side | core | mat | drawn figure | open |
| `hollow_hold` | Hollow hold | normal | hold | side | core | mat | drawn figure | open |
| `quad_stretch` | Standing quad stretch | normal | hold | side | legs | none | drawn figure | open |
| `hamstring_stretch` | Hamstring stretch | normal | hold | side | legs | mat | drawn figure | open |
| `childs_pose` | Child's pose | normal | hold | side | core | mat | drawn figure | open |
| `chest_opener` | Chest opener | normal | hold | side | arms | none | drawn figure | open |
| `figure_four` | Figure-four stretch | normal | hold | side | legs | chair | drawn figure | open |
| `mountain_pose` | Mountain pose | yoga | hold | side | core | none | drawn figure | open |
| `warrior_ii` | Warrior two | yoga | hold | front | legs | none | drawn figure | open |
| `downward_dog` | Downward dog | yoga | hold | side | core | mat | drawn figure | open |
| `cobra_pose` | Cobra pose | yoga | hold | side | core | mat | drawn figure | open |
| `tree_pose` | Tree pose | yoga | hold | front | legs | none | drawn figure | open |
| `chair_pose` | Chair pose | yoga | hold | side | legs | none | drawn figure | open |
| `grapevine` | Grapevine | dance | routine_step | front | legs | none | drawn figure | open |
| `step_touch` | Step touch | dance | routine_step | front | legs | none | drawn figure | open |
| `box_step` | Box step | dance | routine_step | front | legs | none | drawn figure | open |
| `hip_sway` | Hip sway | dance | routine_step | front | core | none | drawn figure | open |
| `bollywood_clap_step` | Clap step | dance | routine_step | front | arms | none | drawn figure | open |
| `neck_release` | Neck release | normal | hold | side | core | chair | drawn figure | open |
| `seated_twist` | Desk twist | normal | hold | side | core | chair | drawn figure | open |
| `wrist_stretch` | Wrist stretch | normal | hold | side | arms | chair | drawn figure | open |
| `shoulder_blade_squeeze` | Shoulder blade squeeze | normal | timed | side | arms | chair | drawn figure | open |
| `ankle_pumps` | Ankle pumps | normal | timed | side | legs | chair | drawn figure | open |

## Lottie spike (not started)

The brief allows a three-move Lottie spike (squat, push-up, plank) with the `text-to-lottie` skill. It has not been run: the drawn figures already cover all 66 moves in theme colours, and playing a Lottie file needs a dev-client rebuild (`lottie-react-native` 7.5.0 is installed but not in the current build). A file that passes review goes in `app/assets/animations/exercises/<id>.json` with layers named `body`, `accent` and `ground`, and is registered in `exerciseAnimations.ts`; it then replaces the drawn figure for that move.
