import { MD3LightTheme, MD3DarkTheme, type MD3Theme } from 'react-native-paper';
import { dark, light, type Tokens } from './tokens';

function toPaper(t: Tokens, base: MD3Theme): MD3Theme {
  return {
    ...base,
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
