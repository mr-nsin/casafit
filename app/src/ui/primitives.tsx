import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text as RNText,
  type AccessibilityRole,
  type AccessibilityState,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { haptic, type Haptic } from './haptics';
import { FALLBACK_ICON, ICONS } from './iconMap';
import { MIN_FONT, MIN_TAP, fonts, type, uiFamily, type ColorKey, type TypeVariant } from './tokens';
import { useReducedMotion } from './useMotion';
import { useTokens } from './useTokens';

/**
 * Icon names are the snake_case names the screens have always used. `iconMap.ts` maps each
 * one to a Lucide icon. Never use `fitness_center`: CasaFit is a bodyweight app.
 */
export type IconName = string;

/** Lucide icon at stroke 1.75. Decorative: the parent carries the accessible label. */
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
  const Glyph = ICONS[name] ?? FALLBACK_ICON;
  return (
    <Glyph
      accessible={false}
      importantForAccessibility="no"
      testID={`icon:${name}`}
      size={size}
      color={t[color]}
      strokeWidth={1.75}
      style={style as never}
    />
  );
}

export type AppTextProps = TextProps & { variant?: TypeVariant; color?: ColorKey; tabular?: boolean };

/**
 * App text. Headings are Fraunces, everything else Plus Jakarta Sans. The font files are
 * static, so the weight is expressed by the family and `fontWeight` is never passed down
 * (Android would fake a bold on top). Clamps size to 12 px; `tabular` fixes digit widths.
 */
export function Text({ variant = 'body', color = 'on', tabular, style, ...rest }: AppTextProps) {
  const t = useTokens();
  const { face, fontWeight: variantWeight, ...v } = type[variant];
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const { fontWeight: styleWeight, fontFamily: styleFamily, ...over } = flat;
  // A heading that is resized down to UI size, or given a weight, is UI text, not a display line.
  const display = face === 'display' && styleWeight === undefined && (over.fontSize ?? v.fontSize) >= 20;
  const family = styleFamily ?? (display ? fonts.display : uiFamily(styleWeight ?? variantWeight));
  const numeric = tabular || variant === 'timer';
  return (
    <RNText
      {...rest}
      style={[
        { color: t[color], ...v },
        over,
        { fontFamily: family, fontSize: Math.max(MIN_FONT, over.fontSize ?? v.fontSize) },
        numeric ? { fontVariant: ['tabular-nums'] } : null,
      ]}
    />
  );
}

export type TouchableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Style applied while pressed (overlay). */
  pressedStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  minSize?: number;
  role?: AccessibilityRole;
  label?: string;
  selected?: boolean;
  checked?: boolean | 'mixed';
  expanded?: boolean;
  /** Haptic on press. Defaults to 'select' for tabs, radios, checkboxes and switches, else none. */
  haptic?: Haptic;
  /** Set false for large surfaces (full-width rows, cards) where a scale would look wrong. */
  spring?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SELECT_ROLES: AccessibilityRole[] = ['tab', 'radio', 'checkbox', 'switch'];
const SPRING = { stiffness: 350, damping: 20, mass: 1, useNativeDriver: true } as const;

/**
 * Pressable with a 44 px minimum target, visible focus ring, accessibility mapping, a spring
 * to 0.96 while pressed (off under reduced motion) and an optional haptic.
 */
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
  onPressIn,
  onPressOut,
  onPress,
  haptic: hapticKind,
  spring = true,
  accessibilityState,
  ...rest
}: TouchableProps) {
  const t = useTokens();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const state: AccessibilityState = { ...accessibilityState, disabled: !!disabled };
  if (selected !== undefined) state.selected = selected;
  if (checked !== undefined) state.checked = checked;
  if (expanded !== undefined) state.expanded = expanded;
  const kind: Haptic = hapticKind ?? (SELECT_ROLES.includes(role) ? 'select' : 'none');
  const animate = spring && !reduced && !!onPress;
  return (
    <AnimatedPressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={state}
      disabled={disabled}
      {...rest}
      onPress={
        onPress
          ? (e) => {
              haptic(kind);
              onPress(e);
            }
          : undefined
      }
      onPressIn={(e) => {
        setPressed(true);
        if (animate) Animated.spring(scale, { toValue: 0.96, ...SPRING }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        if (animate) Animated.spring(scale, { toValue: 1, ...SPRING }).start();
        onPressOut?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        { minHeight: minSize, minWidth: minSize },
        style,
        pressed ? [{ opacity: 0.9 }, pressedStyle] : null,
        focused ? { outlineWidth: 3, outlineColor: t.p, outlineOffset: 2, outlineStyle: 'solid' } : null,
        disabled && !accessibilityState?.busy ? { opacity: 0.4 } : null,
        animate ? { transform: [{ scale }] } : null,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
