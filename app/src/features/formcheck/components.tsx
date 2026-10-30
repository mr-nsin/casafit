import React, { Component, useContext, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Icon, InfoNote, StatusBanner, Text, TopBar, fixed, radius, space, useTokens, type IconName, type TopBarProps } from '../../ui';

/** Safe area, optional top bar, scrolling body and an optional pinned footer. */
export function Page({
  topBar,
  children,
  footer,
  gap = space.l,
}: {
  topBar?: TopBarProps;
  children: ReactNode;
  footer?: ReactNode;
  gap?: number;
}) {
  const t = useTokens();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + space.s }}>
      {topBar ? <TopBar {...topBar} /> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.l, paddingBottom: space.xxl, gap }}>
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: Math.max(insets.bottom, space.l), gap: space.s, backgroundColor: t.bg }}>{footer}</View>
      ) : null}
    </View>
  );
}

/** Dark, full-bleed camera area. Only camera views may use the fixed camera colours. */
export function CameraSurface({ children, style }: { children?: ReactNode; style?: object }) {
  return (
    <View
      accessible={false}
      style={[{ backgroundColor: fixed.camera.bg, borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {cameraPreviewEnabled() ? (
        <PreviewBoundary>
          <LivePreview />
        </PreviewBoundary>
      ) : null}
      {children}
    </View>
  );
}

/**
 * The live vision-camera preview is opt-in (EXPO_PUBLIC_CAMERA_PREVIEW=1) until it is confirmed on
 * a device build with RN 0.88. Without it, the surface is the dark framing placeholder.
 */
export const cameraPreviewEnabled = (): boolean => process.env.EXPO_PUBLIC_CAMERA_PREVIEW === '1';

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function LivePreview() {
  // Required lazily: importing vision-camera creates native objects that a build without it cannot make.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Camera } = require('react-native-vision-camera') as { Camera: React.ComponentType<{ style: object; device: string; isActive: boolean }> };
  return <Camera style={StyleSheet.absoluteFill} device="back" isActive />;
}

/** Corner brackets, dotted body outline and joint dots (m3-form), or the same figure with a flagged joint (m3-live). */
export function SkeletonOverlay({ mode, flagged = false, label }: { mode: 'guide' | 'live'; flagged?: boolean; label: string }) {
  const t = useTokens();
  const joints: [number, number][] = [
    [150, 118],
    [150, 188],
    [150, 262],
    [128, 340],
    [172, 340],
    [150, 400],
  ];
  const corner = (d: string) => <Path d={d} stroke={t.on} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.8} />;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ width: '100%', aspectRatio: 300 / 460 }}>
      <Svg width="100%" height="100%" viewBox="0 0 300 460">
        {corner('M16 52 V16 H52')}
        {corner('M248 16 H284 V52')}
        {corner('M16 408 V444 H52')}
        {corner('M248 444 H284 V408')}
        <Path
          d="M150 70 C170 70 176 96 176 112 L214 150 L204 262 L176 262 L182 420 L158 420 L150 330 L142 420 L118 420 L124 262 L96 262 L86 150 L124 112 C124 96 130 70 150 70 Z"
          stroke={t.on}
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeDasharray="2 8"
          strokeLinecap="round"
          fill="none"
        />
        {mode === 'live' ? <Line x1={150} y1={118} x2={150} y2={262} stroke={t.t} strokeWidth={3} strokeLinecap="round" /> : null}
        {joints.map(([x, y], i) => {
          const hot = flagged && i === 3;
          return <Circle key={i} cx={x} cy={y} r={hot ? 12 : 8} fill={hot ? t.er : t.t} />;
        })}
      </Svg>
    </View>
  );
}

/** One framing status: a check when fine, an arrow hint when not. Text carries the meaning, not colour. */
export function FramingChip({ kind, text }: { kind: 'ok' | 'hint'; text: string }) {
  const t = useTokens();
  const icon: IconName = kind === 'ok' ? 'check_circle' : 'arrow_back';
  return (
    <View
      accessible
      accessibilityRole="text"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32, paddingHorizontal: space.m, borderRadius: radius.s, backgroundColor: kind === 'ok' ? t.tc : t.pc }}
    >
      <Icon name={icon} size={16} color={kind === 'ok' ? 'otc' : 'opc'} />
      <Text variant="labelStrong" color={kind === 'ok' ? 'otc' : 'opc'}>
        {text}
      </Text>
    </View>
  );
}

/** Calm "not ready" state. No spend, nothing started. */
export function NotReady({ onBack }: { onBack: () => void }) {
  return (
    <Page topBar={{ title: 'Form check', leading: 'back', onLeading: onBack }}>
      <View style={{ alignItems: 'center', gap: space.m, paddingVertical: space.xxxl }}>
        <Icon name="videocam_off" size={48} color="osv" />
        <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Form check is not ready on this build
        </Text>
        <Text color="osv" style={{ textAlign: 'center' }}>
          Your training is not affected, and no free check was used. Voice cues still guide every move.
        </Text>
      </View>
    </Page>
  );
}

export function FindingRow({ status, title, text }: { status: 'ok' | 'warn'; title: string; text: string }) {
  const t = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${text}`}
      style={{ flexDirection: 'row', gap: space.m, alignItems: 'center', minHeight: 56, padding: space.m, borderRadius: radius.l, backgroundColor: status === 'ok' ? t.c3 : t.erc }}
    >
      <Icon name={status === 'ok' ? 'check_circle' : 'warning'} color={status === 'ok' ? 'p' : 'eoc'} />
      <View style={{ flex: 1 }}>
        <Text variant="title" color={status === 'ok' ? 'on' : 'eoc'}>
          {title}
        </Text>
        <Text variant="bodySmall" color={status === 'ok' ? 'osv' : 'eoc'}>
          {text}
        </Text>
      </View>
    </View>
  );
}

export function InfoLine({ icon, text, tone }: { icon: IconName; text: string; tone?: 'c3' | 'tc' }) {
  return <InfoNote icon={icon} text={text} tone={tone} />;
}

export { StatusBanner };
