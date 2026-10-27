import React, { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icon, Text, Touchable, type IconName } from './primitives';
import { radius, space, type ColorKey } from './tokens';
import { useMotion } from './useMotion';
import { useTokens } from './useTokens';

/** Linear progress. `value` 0..100; undefined = indeterminate. */
export function ProgressBar({ value, label, height = 8, tone = 'p' }: { value?: number; label: string; height?: number; tone?: ColorKey }) {
  const t = useTokens();
  const { reduced, timing, loop } = useMotion();
  const [anim] = useState(() => new Animated.Value(value === undefined ? 0 : value / 100));
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (value === undefined) return loop(anim, 1600);
    timing(anim, { toValue: Math.min(100, Math.max(0, value)) / 100, duration: 500 }).start();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);
  const barW = value === undefined ? width * 0.3 : width;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={value === undefined ? undefined : { min: 0, max: 100, now: Math.round(value) }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height, borderRadius: height / 2, backgroundColor: t.sv, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: t[tone],
          width: value === undefined ? barW : anim.interpolate({ inputRange: [0, 1], outputRange: [0, width] }),
          transform: value === undefined ? [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.7] }) }] : undefined,
        }}
      />
    </View>
  );
}

export type RingProps = {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  tone?: ColorKey;
  /** Spoken description, e.g. "4,200 of 6,000 steps". */
  a11yLabel: string;
  center?: React.ReactNode;
  role?: 'progressbar' | 'timer';
};

/** Circular progress ring (ProgressRing, StepRing, TimerRing, ScoreRing). */
export function ProgressRing({ value, max, size = 192, stroke = 16, tone = 'p', a11yLabel, center, role = 'progressbar' }: RingProps) {
  const t = useTokens();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <View
      accessible
      accessibilityRole={role}
      accessibilityLabel={a11yLabel}
      accessibilityValue={role === 'progressbar' ? { min: 0, max, now: Math.min(max, Math.max(0, value)) } : undefined}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.sv} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c * frac} ${c}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {center}
    </View>
  );
}
export const StepRing = ProgressRing;
export const ScoreRing = ProgressRing;
export function TimerRing({ remainingMs, totalMs, size = 240, ...rest }: Omit<RingProps, 'value' | 'max' | 'role'> & { remainingMs: number; totalMs: number }) {
  return <ProgressRing {...rest} size={size} value={totalMs - remainingMs} max={totalMs} role="timer" />;
}

export type Segment = { weight: number; state: 'done' | 'current' | 'todo'; fill?: number; tone?: ColorKey };

/** Weighted segmented bar (session shape, budget). Welcome/WeekOne use SessionSegmentBar. */
export function SegmentedProgress({ segments, label, height = 12 }: { segments: Segment[]; label: string; height?: number }) {
  const t = useTokens();
  const done = segments.filter((s) => s.state === 'done').length;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: segments.length, now: done }} style={{ flexDirection: 'row', gap: 4 }}>
      {segments.map((s, i) => {
        const fill = s.state === 'done' ? 1 : s.state === 'current' ? (s.fill ?? 0.5) : 0;
        return (
          <View key={i} style={{ flex: s.weight, height, borderRadius: height / 2, backgroundColor: t.sv, overflow: 'hidden' }}>
            <View style={{ width: `${fill * 100}%`, height, backgroundColor: t[s.tone ?? 'p'] }} />
          </View>
        );
      })}
    </View>
  );
}

/** 2 min warm-up, 11 min work, 2 min cool-down. */
export function SessionSegmentBar({ warm = 2, work = 11, cool = 2, height = 32, showLabels = true }: { warm?: number; work?: number; cool?: number; height?: number; showLabels?: boolean }) {
  const t = useTokens();
  const parts: { label: string; min: number; bg: string; fg: ColorKey }[] = [
    { label: 'Warm-up', min: warm, bg: t.tc, fg: 'otc' },
    { label: 'Work', min: work, bg: t.p, fg: 'op' },
    { label: 'Cool-down', min: cool, bg: t.sc, fg: 'osc' },
  ];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${warm} minutes warm-up, ${work} minutes work, ${cool} minutes cool-down`}
      style={{ flexDirection: 'row', gap: 4, height }}
    >
      {parts.map((p) => (
        <View key={p.label} style={{ flex: p.min, backgroundColor: p.bg, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center' }}>
          {showLabels && p.min >= 4 ? (
            <Text variant="label" color={p.fg} tabular>
              {p.label} {p.min} min
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Target bar for nutrition macros. */
export function MacroBar({ value, target, unit, label }: { value: number; target: number; unit: string; label: string }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.xs }}>
        <Text variant="bodySmall">{label}</Text>
        <Text variant="bodySmall" color="osv" tabular>
          {value} of {target} {unit}
        </Text>
      </View>
      <ProgressBar value={target > 0 ? (value / target) * 100 : 0} label={`${label}: ${value} of ${target} ${unit}`} />
    </View>
  );
}

/** Seven bars with an optional dashed goal line. */
export function WeekBars({
  values,
  labels,
  goal,
  highlightIndex,
  height = 120,
  a11yLabels,
}: {
  values: number[];
  labels: string[];
  goal?: number;
  highlightIndex?: number;
  height?: number;
  a11yLabels?: string[];
}) {
  const t = useTokens();
  const top = Math.max(goal ?? 0, ...values, 1);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={a11yLabels ? a11yLabels.join('. ') : labels.map((l, i) => `${l} ${values[i] ?? 0}`).join(', ')}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: space.s }}>
        {goal !== undefined ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: (goal / top) * height, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.ol }} />
        ) : null}
        {values.map((v, i) => {
          const met = goal !== undefined && v >= goal;
          const bg = i === highlightIndex ? t.s : met ? t.p : t.pc;
          return <View key={i} style={{ flex: 1, height: Math.max(4, (v / top) * height), backgroundColor: bg, borderRadius: radius.s }} />;
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: space.s, marginTop: space.xs }}>
        {labels.map((l, i) => (
          <Text key={i} variant="label" color="osv" style={{ flex: 1, textAlign: 'center' }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function WeekDots({ days }: { days: { label: string; done: boolean }[] }) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d, i) => (
        <View key={i} accessible accessibilityLabel={`${d.label}, ${d.done ? 'done' : 'not done'}`} style={{ alignItems: 'center', gap: space.xs }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: d.done ? t.p : 'transparent', borderWidth: d.done ? 0 : 1, borderColor: t.ol, alignItems: 'center', justifyContent: 'center' }}>
            {d.done ? <Icon name="check" size={20} color="op" /> : null}
          </View>
          <Text variant="label" color="osv">
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** 28-cell activity grid; values 0..3 map to tonal steps. */
export function Heatmap({ cells, summary }: { cells: number[]; summary: string }) {
  const t = useTokens();
  const shade = [t.c3, t.pc, t.s, t.p];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {cells.map((c, i) => (
        <View key={i} style={{ width: `${100 / 7 - 1.6}%`, aspectRatio: 1, borderRadius: radius.s, backgroundColor: shade[Math.min(3, Math.max(0, c))] }} />
      ))}
    </View>
  );
}

export type DayKind = 'today' | 'planned' | 'active-rest' | 'rest' | 'done' | 'yoga' | 'optional';

export function DayPill({ day, kind, icon, caption, height = 88, onPress }: { day: string; kind: DayKind; icon?: IconName; caption?: string; height?: number; onPress?: () => void }) {
  const t = useTokens();
  const isToday = kind === 'today';
  const bg = isToday ? t.p : kind === 'rest' ? 'transparent' : t.c3;
  const fg: ColorKey = isToday ? 'op' : 'on';
  const desc = `${day}${caption ? `, ${caption}` : ''}${isToday ? ', today' : ''}`;
  return (
    <Touchable
      label={desc}
      onPress={onPress}
      style={{
        flex: 1,
        height,
        borderRadius: radius.l,
        backgroundColor: bg,
        borderWidth: kind === 'active-rest' || kind === 'rest' ? 1 : 0,
        borderStyle: kind === 'active-rest' ? 'dashed' : 'solid',
        borderColor: t.ol,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        opacity: 1,
      }}
    >
      <Text variant="label" color={fg}>
        {day}
      </Text>
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      {caption ? (
        <Text variant="label" color={fg}>
          {caption}
        </Text>
      ) : null}
    </Touchable>
  );
}

export function WeekStrip({ days }: { days: React.ComponentProps<typeof DayPill>[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.xs }}>
      {days.map((d) => (
        <DayPill key={d.day} {...d} />
      ))}
    </View>
  );
}
