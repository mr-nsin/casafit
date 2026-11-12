// Lottie files for moves, keyed by exercise id. Empty until an animation passes the review
// in docs/plans/exercise-visuals.md; until then ExerciseVisual draws its own figure.
// Each file lives at app/assets/animations/exercises/<id>.json and must have three layers
// named `body`, `accent` and `ground`, which ExerciseVisual recolours from the theme.
//
//   squat: require('../../assets/animations/exercises/squat.json'),

export const ANIMATIONS: Record<string, unknown> = {};
