// The theme module is a thin re-export of app/src/ui so there is one token table.
// Existing imports from '@/theme' keep working.

import { paperTheme } from '../ui/paperTheme';

export { light, dark, type, space, radius, fixed, palettes, motion, MIN_FONT, MIN_TAP } from '../ui/tokens';
export type { Tokens, ColorKey, Scheme, TypeVariant } from '../ui/tokens';
export { paperTheme } from '../ui/paperTheme';

export const casafitLight = paperTheme('light');
export const casafitDark = paperTheme('dark');
