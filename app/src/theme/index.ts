import { MD3LightTheme, MD3DarkTheme, configureFonts, type MD3Theme } from 'react-native-paper';
import { dark, light } from './tokens';

/**
 * `light` and `dark` are declared `as const`, so their value types are distinct
 * string literals. A theme builder must accept either palette, so widen each
 * colour to `string` while keeping the key set identical.
 */
export type ThemeTokens = { [K in keyof typeof light]: string };

/** Font family names registered in `src/app/fonts.ts`. */
export const fontFamily = {
  latin: 'RobotoFlex_400Regular',
  devanagari: 'NotoSansDevanagari_400Regular',
} as const;

function toPaper(t: ThemeTokens, base: MD3Theme): MD3Theme {
  return {
    ...base,
    fonts: configureFonts({ config: { fontFamily: fontFamily.latin } }),
    colors: {
      ...base.colors,
      primary: t.p,
      onPrimary: t.op,
      primaryContainer: t.pc,
      onPrimaryContainer: t.opc,
      secondary: t.s,
      onSecondary: t.os,
      secondaryContainer: t.sc,
      onSecondaryContainer: t.osc,
      tertiary: t.t,
      onTertiary: t.ot,
      tertiaryContainer: t.tc,
      onTertiaryContainer: t.otc,
      background: t.bg,
      onBackground: t.on,
      surface: t.bg,
      onSurface: t.on,
      surfaceVariant: t.sv,
      onSurfaceVariant: t.osv,
      outline: t.ol,
      outlineVariant: t.olv,
      error: t.er,
      errorContainer: t.erc,
      onErrorContainer: t.eoc,
    },
  };
}

export const casafitLight = toPaper(light, MD3LightTheme);
export const casafitDark = toPaper(dark, MD3DarkTheme);
export { light, dark, type, space, radius } from './tokens';
