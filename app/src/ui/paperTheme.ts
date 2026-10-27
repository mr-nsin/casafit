import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';
import { fontFamily, palettes, type Scheme } from './tokens';

/** Paper MD3 theme built from the CasaFit tokens. */
export function paperTheme(scheme: Scheme): MD3Theme {
  const t = palettes[scheme];
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    roundness: 4,
    fonts: configureFonts({ config: { fontFamily } }),
    colors: {
      ...base.colors,
      primary: t.p, onPrimary: t.op, primaryContainer: t.pc, onPrimaryContainer: t.opc,
      secondary: t.s, onSecondary: t.os, secondaryContainer: t.sc, onSecondaryContainer: t.osc,
      tertiary: t.t, onTertiary: t.ot, tertiaryContainer: t.tc, onTertiaryContainer: t.otc,
      background: t.bg, onBackground: t.on, surface: t.bg, onSurface: t.on,
      surfaceVariant: t.sv, onSurfaceVariant: t.osv, outline: t.ol, outlineVariant: t.olv,
      error: t.er, errorContainer: t.erc, onErrorContainer: t.eoc,
    },
  };
}
