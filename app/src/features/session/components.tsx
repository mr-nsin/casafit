// Presentational pieces for the Player family, built on the shared kit. These screens always
// open in the dark palette (Player, Rest, Paused, EndSession, Feel, SessionSettings), so every
// piece reads its colours from useTokens() inside DarkScope.

import { useContext, useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StatusBar, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { ExerciseVisual, Icon, Text, Touchable, UIProvider, curve, radius, space, useTokens, type ColorKey } from '../../ui';
import type { ProgressSegment } from './view';
import type { Rung } from './types';

/**
 * Light status-bar content while a dark screen is focused. The declarative StatusBar stack
 * restores the app default (ThemedStatusBar) when this unmounts or the screen loses focus.
 */
export function ScreenStatusBar() {
  const focused = useIsFocused();
  return focused ? <StatusBar barStyle="light-content" /> : null;
}

/** Forces the dark UI-kit palette so kit pieces match the dark Player family. */
export function DarkScope({ children }: { children: ReactNode }) {
  return (
    <UIProvider scheme="dark">
      <ScreenStatusBar />
      {children}
    </UIProvider>
  );
}

function ScreenBody({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTokens();
  // Edge to edge: keep the header (and its Close button) below the status bar, and the footer above the gesture bar.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  return (
    <View
      style={[
        { flex: 1, backgroundColor: t.bg, paddingHorizontal: space.xl, paddingTop: space.l + insets.top, paddingBottom: space.xl + insets.bottom },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <DarkScope>
      <ScreenBody style={style}>{children}</ScreenBody>
    </DarkScope>
  );
}

export function IconBtn({
  label,
  icon,
  onPress,
  size = 48,
  tone = 'plain',
  disabled,
  hint,
}: {
  label: string;
  /** Why the button is off, read out by screen readers. */
  hint?: string;
  /** Icon name from the UI kit, for example close or skip_next. */
  icon: string;
  onPress: () => void;
  size?: number;
  tone?: 'plain' | 'tonal' | 'filled';
  disabled?: boolean;
}) {
  const t = useTokens();
  const bg = tone === 'filled' ? t.p : tone === 'tonal' ? t.el : 'transparent';
  const fg: ColorKey = tone === 'filled' ? 'op' : 'on';
  return (
    <Touchable
      label={label}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      minSize={size}
      haptic={tone === 'filled' ? 'tap' : 'none'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: tone === 'tonal' ? 1 : 0,
        borderColor: t.edge,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={fg} />
    </Touchable>
  );
}

export function Btn({
  label,
  onPress,
  kind = 'filled',
  height = 52,
  disabled,
  hint,
}: {
  label: string;
  onPress: () => void;
  kind?: 'filled' | 'tonal' | 'outline' | 'text';
  height?: number;
  disabled?: boolean;
  hint?: string;
}) {
  const t = useTokens();
  const bg = kind === 'filled' ? t.p : kind === 'tonal' ? t.sc : 'transparent';
  const fg: ColorKey = kind === 'filled' ? 'op' : kind === 'tonal' ? 'osc' : 'p';
  return (
    <Touchable
      label={label}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      minSize={Math.max(48, height)}
      haptic={kind === 'filled' ? 'tap' : 'none'}
      style={{
        borderRadius: radius.round,
        ...curve,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.xxl,
        backgroundColor: bg,
        borderColor: kind === 'outline' ? t.ol : 'transparent',
        borderWidth: kind === 'outline' ? 1 : 0,
      }}
    >
      <Text variant="title" color={fg}>
        {label}
      </Text>
    </Touchable>
  );
}

export function TopBar({
  title,
  subtitle,
  onClose,
  closeLabel = 'End session',
  trailing,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  closeLabel?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s, marginBottom: space.m }}>
      {onClose ? <IconBtn label={closeLabel} icon="close" onPress={onClose} /> : <View style={{ width: 48 }} />}
      <View style={{ flex: 1, alignItems: 'center' }} accessibilityRole="header">
        <Text variant="labelStrong" color="p" tabular>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="title" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 48, alignItems: 'flex-end' }}>{trailing}</View>
    </View>
  );
}

export function SegmentedProgress({ segments, label }: { segments: ProgressSegment[]; label: string }) {
  const t = useTokens();
  return (
    <View
      style={{ flexDirection: 'row', gap: space.xs, height: 8, marginBottom: space.l }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(overall(segments) * 100) }}
    >
      {segments.map((s) => (
        <View key={s.key} style={{ flex: Math.max(1, s.weight), height: 8, borderRadius: radius.xs, overflow: 'hidden', backgroundColor: t.sv }}>
          <View style={{ width: `${Math.round(s.fill * 100)}%`, height: '100%', backgroundColor: t.p }} />
        </View>
      ))}
    </View>
  );
}

function overall(segments: ProgressSegment[]): number {
  const w = segments.reduce((a, s) => a + s.weight, 0) || 1;
  return segments.reduce((a, s) => a + s.weight * s.fill, 0) / w;
}

function StagePill({ text, floating }: { text: string; floating?: boolean }) {
  const t = useTokens();
  return (
    <View
      style={[
        { backgroundColor: t.c3, borderRadius: radius.round, ...curve, borderWidth: 1, borderColor: t.edge, paddingHorizontal: space.l, paddingVertical: space.s },
        floating ? { position: 'absolute', bottom: space.m } : null,
      ]}
    >
      <Text variant="labelStrong" tabular>
        {text}
      </Text>
    </View>
  );
}

/**
 * The stage. With an `exerciseId` it is the move's picture at hero size, centred, with the
 * pill under it; the picture is the screen's one motion moment and only moves while `playing`.
 * Without an id (Desk reset) it is a calm card with the icon for the kind of move.
 */
export function Stage({
  icon,
  description,
  pill,
  height = 220,
  exerciseId,
  playing = false,
}: {
  icon: string;
  description: string;
  pill?: string;
  height?: number;
  /** An id from the content pack. Draws the move instead of the icon. */
  exerciseId?: string;
  /** Animate the rep. False while paused, in Ready, or when the screen is not in front. */
  playing?: boolean;
}) {
  const t = useTokens();
  if (exerciseId) {
    return (
      <View style={{ alignItems: 'center', gap: space.m, marginBottom: space.m }}>
        <ExerciseVisual exerciseId={exerciseId} size="hero" px={200} playing={playing} label={description} />
        {pill ? <StagePill text={pill} /> : null}
      </View>
    );
  }
  return (
    <View
      style={{ height, backgroundColor: t.tc, borderRadius: radius.xxl, ...curve, alignItems: 'center', justifyContent: 'center', marginBottom: space.l }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={description}
    >
      <Icon name={icon} size={Math.round(height * 0.5)} color="otc" />
      {pill ? <StagePill text={pill} floating /> : null}
    </View>
  );
}

export function BigTimer({ text, caption }: { text: string; caption?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        variant="timer"
        color="p"
        // The timer is not a live region: voice and haptics announce phase changes instead.
        accessibilityLiveRegion="none"
        accessibilityLabel={`${text} left`}
      >
        {text}
      </Text>
      {caption ? (
        <Text variant="bodySmall" color="osv" tabular>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export function TimerRing({
  remainingMs,
  totalMs,
  size = 240,
  centre,
  sub,
  label,
}: {
  remainingMs: number;
  totalMs: number;
  size?: number;
  centre: string;
  sub?: string;
  label: string;
}) {
  const t = useTokens();
  const r = size * 0.433;
  const c = 2 * Math.PI * r;
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const digits = Math.round(size * 0.24);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityRole="timer" accessibilityLabel={label}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.sv} strokeWidth={12} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.p}
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="timer" style={{ fontSize: digits, lineHeight: digits + 6, letterSpacing: -digits / 48 }}>
        {centre}
      </Text>
      {sub ? (
        <Text variant="bodySmall" color="osv" tabular style={{ textAlign: 'center', maxWidth: size * 0.66 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export interface RadioOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function RadioGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: RadioOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const t = useTokens();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', gap: space.s }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Touchable
            key={String(o.value)}
            role="radio"
            label={o.label}
            selected={selected}
            checked={selected}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            minSize={48}
            style={{
              flex: 1,
              borderRadius: radius.l,
              ...curve,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: space.xs,
              paddingHorizontal: space.s,
              backgroundColor: selected ? t.pc : t.c3,
              // A clear outline and a check on the chosen option, so the state is obvious at a glance.
              borderWidth: 2,
              borderColor: selected ? t.p : 'transparent',
            }}
          >
            {selected ? <Icon name="check" size={16} color="opc" /> : null}
            {selected ? (
              <Text variant="title" color="opc" style={{ fontSize: 14, lineHeight: 20 }}>
                {o.label}
              </Text>
            ) : (
              <Text variant="bodySmall">{o.label}</Text>
            )}
          </Touchable>
        );
      })}
    </View>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  const t = useTokens();
  return (
    <View style={{ backgroundColor: t.c3, borderRadius: radius.xl, ...curve, padding: space.l }}>
      <Text variant="bodySmall" color="osv">
        {children}
      </Text>
    </View>
  );
}

/**
 * A short status line for the result of a tap that is otherwise quiet (Easier, +30s rest).
 * Always mounted so screen readers announce each change; iOS gets an explicit announcement.
 */
export function Notice({ text }: { text: string | null }) {
  const t = useTokens();
  useEffect(() => {
    if (text && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={
        text
          ? { backgroundColor: t.c3, borderRadius: radius.l, ...curve, paddingHorizontal: space.l, paddingVertical: space.s, marginTop: space.s, flexDirection: 'row', gap: space.s, alignItems: 'center' }
          : { height: 0 }
      }
    >
      {text ? <Icon name="info" size={18} color="osv" /> : null}
      {text ? (
        <Text testID="session-notice" variant="bodySmall" tabular style={{ flex: 1 }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

export const RUNG_OPTIONS: RadioOption<Rung>[] = [
  { value: -1, label: 'Easier' },
  { value: 0, label: 'As planned' },
  { value: 1, label: 'Harder' },
];
