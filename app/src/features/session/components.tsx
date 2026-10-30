// Small presentational pieces for the Player family. Dark palette by default (design:
// Player, Rest, Paused, EndSession, Feel and SessionSettings open dark). These are local
// until the ui lane's shared components are merged; swap them then.

import { useState, type ReactNode } from 'react';
import { StatusBar } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { dark, radius, space, type } from '../../theme';
import { Icon, UIProvider } from '../../ui';
import type { ProgressSegment } from './view';
import type { Rung } from './types';

export const tk = dark;

/** Pressable that reports keyboard or switch-access focus so every control shows a ring. */
export function FocusPressable({
  style,
  ...rest
}: Omit<PressableProps, 'style'> & {
  style: (state: { pressed: boolean; focused: boolean }) => StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={({ pressed }) => style({ pressed, focused })}
    />
  );
}

/**
 * Light status-bar content while a dark screen is focused. The declarative StatusBar stack
 * restores the app default (ThemedStatusBar) when this unmounts or the screen loses focus.
 */
export function ScreenStatusBar() {
  const focused = useIsFocused();
  return focused ? <StatusBar barStyle="light-content" /> : null;
}

/** Forces the dark UI-kit palette so kit icons match the dark Player family. */
export function DarkScope({ children }: { children: ReactNode }) {
  return (
    <UIProvider scheme="dark">
      <ScreenStatusBar />
      {children}
    </UIProvider>
  );
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <DarkScope>
      <View style={[styles.screen, style]}>{children}</View>
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
}: {
  label: string;
  /** Material icon name from the UI kit, for example close or skip_next. */
  icon: string;
  onPress: () => void;
  size?: number;
  tone?: 'plain' | 'tonal' | 'filled';
  disabled?: boolean;
}) {
  const bg = tone === 'filled' ? tk.p : tone === 'tonal' ? tk.c4 : 'transparent';
  const fgKey = tone === 'filled' ? 'op' : 'on';
  return (
    <FocusPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ focused, pressed }) => [
        styles.iconBtn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        focused && styles.focus,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={fgKey} />
    </FocusPressable>
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
  const bg = kind === 'filled' ? tk.p : kind === 'tonal' ? tk.sc : 'transparent';
  const fg = kind === 'filled' ? tk.op : kind === 'tonal' ? tk.osc : tk.p;
  return (
    <FocusPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ focused, pressed }) => [
        styles.btn,
        {
          minHeight: Math.max(48, height),
          backgroundColor: bg,
          borderColor: kind === 'outline' ? tk.ol : 'transparent',
          borderWidth: kind === 'outline' ? 1 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        focused && styles.focus,
      ]}
    >
      <Text style={[type.title, { color: fg }]}>{label}</Text>
    </FocusPressable>
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
    <View style={styles.topBar}>
      {onClose ? <IconBtn label={closeLabel} icon="close" onPress={onClose} /> : <View style={{ width: 48 }} />}
      <View style={styles.topTitle} accessibilityRole="header">
        <Text style={[type.label, { color: tk.p }]}>{title}</Text>
        {subtitle ? (
          <Text style={[type.title, { color: tk.on }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 48, alignItems: 'flex-end' }}>{trailing}</View>
    </View>
  );
}

export function SegmentedProgress({ segments, label }: { segments: ProgressSegment[]; label: string }) {
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(overall(segments) * 100) }}
    >
      {segments.map((s) => (
        <View key={s.key} style={[styles.seg, { flex: Math.max(1, s.weight), backgroundColor: tk.sv }]}>
          <View style={{ width: `${Math.round(s.fill * 100)}%`, height: '100%', backgroundColor: tk.p }} />
        </View>
      ))}
    </View>
  );
}

function overall(segments: ProgressSegment[]): number {
  const w = segments.reduce((a, s) => a + s.weight, 0) || 1;
  return segments.reduce((a, s) => a + s.weight * s.fill, 0) / w;
}

/** Stage card: a large calm icon for the move's kind, with an optional pill. */
export function Stage({ icon, description, pill, height = 220 }: { icon: string; description: string; pill?: string; height?: number }) {
  return (
    <View style={[styles.stage, { height }]} accessible accessibilityRole="image" accessibilityLabel={description}>
      <Icon name={icon} size={Math.round(height * 0.5)} color="otc" />
      {pill ? (
        <View style={styles.pill}>
          <Text style={[type.label, { color: tk.on }]}>{pill}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function BigTimer({ text, caption, size = 72 }: { text: string; caption?: string; size?: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        // The timer is not a live region: voice and haptics announce phase changes instead.
        accessibilityLiveRegion="none"
        accessibilityLabel={`${text} left`}
        style={{ fontSize: size, lineHeight: size + 6, fontWeight: '800', color: tk.p, fontVariant: ['tabular-nums'] }}
      >
        {text}
      </Text>
      {caption ? <Text style={[type.bodySmall, { color: tk.osv, fontVariant: ['tabular-nums'] }]}>{caption}</Text> : null}
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
  const r = size * 0.433;
  const c = 2 * Math.PI * r;
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityRole="timer" accessibilityLabel={label}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={tk.sv} strokeWidth={12} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tk.p}
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.24, fontWeight: '800', color: tk.on, fontVariant: ['tabular-nums'] }}>{centre}</Text>
      {sub ? <Text style={[type.bodySmall, { color: tk.osv }]}>{sub}</Text> : null}
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
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.radioRow}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <FocusPressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, checked: selected, disabled: !!o.disabled }}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            style={({ focused }) => [
              styles.radio,
              { backgroundColor: selected ? tk.pc : tk.c3, opacity: o.disabled ? 0.4 : 1 },
              focused && styles.focus,
            ]}
          >
            {selected ? <Icon name="check" size={16} color="opc" /> : null}
            <Text style={[type.bodySmall, { color: selected ? tk.opc : tk.on, fontWeight: selected ? '700' : '500' }]}>
              {o.label}
            </Text>
          </FocusPressable>
        );
      })}
    </View>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <View style={styles.note}>
      <Text style={[type.bodySmall, { color: tk.osv }]}>{children}</Text>
    </View>
  );
}

export const RUNG_OPTIONS: RadioOption<Rung>[] = [
  { value: -1, label: 'Easier' },
  { value: 0, label: 'As planned' },
  { value: 1, label: 'Harder' },
];

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tk.bg, paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.xl },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl },
  focus: { borderWidth: 3, borderColor: tk.on },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginBottom: space.m },
  topTitle: { flex: 1, alignItems: 'center' },
  progress: { flexDirection: 'row', gap: 3, height: 8, marginBottom: space.l },
  seg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  stage: { backgroundColor: tk.tc, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: space.l },
  pill: { position: 'absolute', bottom: space.m, backgroundColor: tk.c1, borderRadius: radius.round, paddingHorizontal: space.l, paddingVertical: space.s },
  radioRow: { flexDirection: 'row', gap: space.s },
  radio: { flex: 1, minHeight: 48, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs, paddingHorizontal: space.s },
  note: { backgroundColor: tk.c3, borderRadius: radius.l, padding: space.l },
});
