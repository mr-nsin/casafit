import { DefaultTheme, type Theme } from '@react-navigation/native';
import type { MD3Theme } from 'react-native-paper';

/** Map the Paper (Material 3) theme onto React Navigation's theme shape. */
export function toNavigationTheme(paper: MD3Theme, dark: boolean): Theme {
  return {
    dark,
    colors: {
      primary: paper.colors.primary,
      background: paper.colors.background,
      card: paper.colors.surface,
      text: paper.colors.onSurface,
      border: paper.colors.outlineVariant,
      notification: paper.colors.error,
    },
    fonts: DefaultTheme.fonts,
  };
}
