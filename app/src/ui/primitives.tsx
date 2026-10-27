import React, { useState } from 'react';
import {
  Pressable,
  Text as RNText,
  type AccessibilityRole,
  type AccessibilityState,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MIN_FONT, MIN_TAP, fontFamily, type, type ColorKey, type TypeVariant } from './tokens';
import { useTokens } from './useTokens';

/** Material Symbols Rounded names are rendered with the MaterialIcons glyph set. Never use `fitness_center`. */
export type IconName = string;

export function Icon({
  name,
  size = 24,
  color = 'on',
  style,
}: {
  name: IconName;
  size?: number;
  color?: ColorKey;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTokens();
  if (name === 'fitness_center') throw new Error('fitness_center is not allowed: CasaFit is a bodyweight app');
  return (
    <MaterialIcons
      // Decorative: the parent carries the accessible label.
      accessible={false}
      importantForAccessibility="no"
      name={name.replace(/_/g, '-') as never}
      size={size}
      color={t[color]}
      style={style}
    />
  );
}

export type AppTextProps = TextProps & { variant?: TypeVariant; color?: ColorKey; tabular?: boolean };

/** Roboto Flex text. Clamps size to 12 px minimum, tabular figures for numbers. */
export function Text({ variant = 'body', color = 'on', tabular, style, ...rest }: AppTextProps) {
  const t = useTokens();
  const v = type[variant];
  return (
    <RNText
      {...rest}
      style={[
        { fontFamily, color: t[color], ...v, fontSize: Math.max(MIN_FONT, v.fontSize) },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}

export type TouchableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Style applied while pressed (overlay). */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Visible focus ring colour key; defaults to primary. */
  children?: React.ReactNode;
  minSize?: number;
  role?: AccessibilityRole;
  label?: string;
  selected?: boolean;
  checked?: boolean | 'mixed';
  expanded?: boolean;
};

/** Pressable with 44 px minimum target, visible focus ring and accessibility mapping. */
export function Touchable({
  style,
  pressedStyle,
  children,
  minSize = MIN_TAP,
  role = 'button',
  label,
  selected,
  checked,
  expanded,
  disabled,
  onFocus,
  onBlur,
  accessibilityState,
  ...rest
}: TouchableProps) {
  const t = useTokens();
  const [focused, setFocused] = useState(false);
  const state: AccessibilityState = { ...accessibilityState, disabled: !!disabled };
  if (selected !== undefined) state.selected = selected;
  if (checked !== undefined) state.checked = checked;
  if (expanded !== undefined) state.expanded = expanded;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={state}
      disabled={disabled}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={({ pressed }) => [
        { minHeight: minSize, minWidth: minSize },
        style,
        pressed ? [{ opacity: 0.88 }, pressedStyle] : null,
        focused ? { outlineWidth: 3, outlineColor: t.p, outlineOffset: 2, outlineStyle: 'solid' } : null,
        disabled && !accessibilityState?.busy ? { opacity: 0.4 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
