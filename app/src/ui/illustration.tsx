import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { fixed, motion } from './tokens';
import { useReducedMotion } from './useMotion';
import { useTokens } from './useTokens';

export type SkinTone = 'deep' | 'medium' | 'light';
const skinHex = { deep: fixed.illustration.skinDeep, medium: fixed.illustration.skinMedium, light: fixed.illustration.skinLight } as const;

export type IllustrationProps = {
  /** One or two SVG frames (children of a viewBox). Frame 2 is optional. */
  frames: [React.ReactNode] | [React.ReactNode, React.ReactNode];
  viewBox?: string;
  size?: number;
  /** Alternate between frames (hard cut every demoFlip/2). Ignored under reduced motion. */
  loop?: boolean;
  /** Spoken description. Illustrations without one are hidden from screen readers. */
  a11yLabel?: string;
  /** Override flip period in ms for a full cycle. */
  period?: number;
};

/**
 * Illustration host (D17). Renders the two-frame SVG loop. Infinite loops are allowed
 * only here; reduced motion shows frame 1 only.
 */
export function Illustration({ frames, viewBox = '0 0 120 120', size = 160, loop = true, a11yLabel, period = motion.durations.demoFlip }: IllustrationProps) {
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const animate = loop && !reduced && frames.length > 1;
  useEffect(() => {
    if (!animate) return undefined;
    const id = setInterval(() => setIdx((i) => (i === 0 ? 1 : 0)), period / 2);
    return () => clearInterval(id);
  }, [animate, period]);
  const frame = animate ? (frames[idx] ?? frames[0]) : frames[0];
  return (
    <View
      accessible={!!a11yLabel}
      accessibilityRole={a11yLabel ? 'image' : undefined}
      accessibilityLabel={a11yLabel}
      importantForAccessibility={a11yLabel ? 'yes' : 'no-hide-descendants'}
      testID="illustration"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={viewBox}>
        {frame}
      </Svg>
    </View>
  );
}

type Pose = { armL: [number, number]; armR: [number, number]; legL: [number, number]; legR: [number, number] };

/** Faceless figure: head, torso (primary), legs (on-secondary), arms and hands in skin tone. */
function Figure({ pose, skin }: { pose: Pose; skin: SkinTone }) {
  const t = useTokens();
  const tone = skinHex[skin];
  const sh: [number, number] = [60, 52];
  const hip: [number, number] = [60, 84];
  return (
    <G>
      <Line x1={hip[0]} y1={hip[1]} x2={pose.legL[0]} y2={pose.legL[1]} stroke={t.s} strokeWidth={9} strokeLinecap="round" />
      <Line x1={hip[0]} y1={hip[1]} x2={pose.legR[0]} y2={pose.legR[1]} stroke={t.s} strokeWidth={9} strokeLinecap="round" />
      <Line x1={sh[0]} y1={sh[1]} x2={pose.armL[0]} y2={pose.armL[1]} stroke={tone} strokeWidth={7} strokeLinecap="round" />
      <Line x1={sh[0]} y1={sh[1]} x2={pose.armR[0]} y2={pose.armR[1]} stroke={tone} strokeWidth={7} strokeLinecap="round" />
      <Rect x={50} y={48} width={20} height={40} rx={10} fill={t.p} />
      <Circle cx={60} cy={34} r={11} fill={tone} />
      <Path d="M49 32 Q60 18 71 32 Q60 26 49 32Z" fill={fixed.illustration.hair} />
    </G>
  );
}

export type PoseName = 'stand' | 'walk' | 'squat' | 'reach';
const poses: Record<PoseName, [Pose, Pose]> = {
  stand: [
    { armL: [44, 78], armR: [76, 78], legL: [53, 114], legR: [67, 114] },
    { armL: [44, 70], armR: [76, 70], legL: [53, 114], legR: [67, 114] },
  ],
  walk: [
    { armL: [48, 76], armR: [72, 68], legL: [48, 114], legR: [72, 112] },
    { armL: [48, 68], armR: [72, 76], legL: [72, 112], legR: [48, 114] },
  ],
  squat: [
    { armL: [44, 78], armR: [76, 78], legL: [53, 114], legR: [67, 114] },
    { armL: [36, 56], armR: [84, 56], legL: [40, 104], legR: [80, 104] },
  ],
  reach: [
    { armL: [40, 30], armR: [80, 30], legL: [53, 114], legR: [67, 114] },
    { armL: [44, 78], armR: [76, 78], legL: [53, 114], legR: [67, 114] },
  ],
};

/** Faceless person illustration with a built-in two-frame pose loop. */
export function PeopleIllustration({ pose = 'stand', skin = 'medium', size = 160, loop = true, a11yLabel }: { pose?: PoseName; skin?: SkinTone; size?: number; loop?: boolean; a11yLabel?: string }) {
  const [a, b] = poses[pose];
  return <Illustration size={size} loop={loop} a11yLabel={a11yLabel} frames={[<Figure key="a" pose={a} skin={skin} />, <Figure key="b" pose={b} skin={skin} />]} />;
}
export const PersonIllustration = PeopleIllustration;

/** Hero icon in a soft tonal blob (Camera, CamDenied, FoodEmpty, ProWelcome). */
export function HeroIllustration({ children, size = 160 }: { children: React.ReactNode; size?: number }) {
  const t = useTokens();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.pc, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

/** Decorative blurred-blob background. Hidden from screen readers. */
export function BlobBackground({ variant = 'a' }: { variant?: 'a' | 'b' }) {
  const t = useTokens();
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width="100%" height="100%" viewBox="0 0 390 600" preserveAspectRatio="xMidYMid slice">
        <Ellipse cx={variant === 'a' ? 340 : 60} cy={80} rx={150} ry={130} fill={t.pc} opacity={0.6} />
        <Ellipse cx={variant === 'a' ? 40 : 340} cy={520} rx={140} ry={120} fill={t.tc} opacity={0.5} />
      </Svg>
    </View>
  );
}
