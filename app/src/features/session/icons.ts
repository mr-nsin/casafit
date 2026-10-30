// One Material icon per kind of move. Used by the stage card, plan rows and the exercise
// page, so no move ever renders a blank, a dash or a "?". Never `fitness_center`.

export interface IconSource {
  style: 'normal' | 'yoga' | 'dance';
  mode: 'timed' | 'hold' | 'reps' | 'routine_step';
}

export const DEFAULT_MOVE_ICON = 'sports_gymnastics';

export function exerciseIcon(ex: Partial<IconSource> | null | undefined): string {
  if (!ex) return DEFAULT_MOVE_ICON;
  if (ex.style === 'yoga') return 'self_improvement';
  if (ex.style === 'dance') return 'music_note';
  if (ex.mode === 'hold') return 'accessibility_new';
  return DEFAULT_MOVE_ICON;
}
