import React, { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { ANIMATIONS } from './exerciseAnimations';
import { posesFor, tween, type Joints, type Pt } from './exercisePoses';
import { curve, radius, type ColorKey } from './tokens';
import { useReducedMotion } from './useMotion';
import { useTokens } from './useTokens';

export type ExerciseVisualSize = 'row' | 'tile' | 'card' | 'hero';
const SIZES: Record<ExerciseVisualSize, number> = { row: 56, tile: 64, card: 84, hero: 240 };

export type ExerciseVisualProps = {
  /** An id from assets/content/exercises.json. Unknown ids draw a calm standing figure. */
  exerciseId: string | null | undefined;
  size?: ExerciseVisualSize;
  /** Animate the rep. Off by default: lists show a still at the working pose. */
  playing?: boolean;
  /** Full cycle in ms (start pose, working pose and back). */
  loopMs?: number;
  /** Spoken description (the exercise's alt text). Without one the picture is decorative. */
  label?: string;
  /** Frame background. Defaults to the elevated surface. */
  tone?: ColorKey;
  style?: StyleProp<ViewStyle>;
};

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const pt = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

/** 0..1..0 over `period` ms while `on`; rests at the working pose (1) otherwise. */
function useRep(on: boolean, period: number): number {
  const [t, setT] = useState(1);
  const start = useRef(0);
  useEffect(() => {
    if (!on) return undefined;
    start.current = Date.now();
    // 30 updates a second is smooth for a figure this simple and easy on low-end phones.
    const id = setInterval(() => {
      const phase = ((Date.now() - start.current) % period) / period;
      setT(easeInOut(phase < 0.5 ? phase * 2 : 2 - phase * 2));
    }, 33);
    return () => clearInterval(id);
  }, [on, period]);
  // Not playing: hold the working pose, whatever the last animated value was.
  return on ? t : 1;
}

function Figure({ j, front, accent, ink, hot, far }: { j: Joints; front: boolean; accent: 'legs' | 'arms' | 'core'; ink: string; hot: string; far: number }) {
  const limb = (a: Pt, b: Pt, c: Pt, color: string, w: number, opacity = 1) => (
    <Path d={`M${pt(a)} L${pt(b)} L${pt(c)}`} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={opacity} />
  );
  const legs = accent === 'legs' ? hot : ink;
  const arms = accent === 'arms' ? hot : ink;
  const core = accent === 'core' ? hot : ink;
  const back = front ? 1 : far;
  const spine = j.sp ? `M${pt(j.sh)} Q${pt(j.sp)} ${pt(j.hip)}` : `M${pt(j.sh)} L${pt(j.hip)}`;
  return (
    <>
      {limb(j.hip, j.kB, j.fB, legs, 6.5, back)}
      {limb(j.sh, j.eB, j.hB, arms, 5.5, back)}
      <Path d={spine} stroke={core} strokeWidth={9} strokeLinecap="round" fill="none" />
      {limb(j.hip, j.kF, j.fF, legs, 6.5)}
      {limb(j.sh, j.eF, j.hF, arms, 5.5)}
      <Circle cx={j.head[0]} cy={j.head[1]} r={8} fill={ink} />
    </>
  );
}

/**
 * The picture of a move: a jointed figure that eases between the move's two key poses.
 * Body in ink, the working part in terracotta, the floor and props in chartreuse, all from
 * tokens, so it reads in light and dark. A Lottie file registered for the id in
 * `exerciseAnimations.ts` takes over when the Lottie module is in the build.
 */
export function ExerciseVisual({ exerciseId, size = 'row', playing = false, loopMs = 2400, label, tone = 'el', style }: ExerciseVisualProps) {
  const t = useTokens();
  const reduced = useReducedMotion();
  const px = SIZES[size];
  const moves = posesFor(exerciseId);
  const lottie = exerciseId ? ANIMATIONS[exerciseId] : undefined;
  const animate = playing && !reduced && !lottie;
  const rep = useRep(animate, Math.max(1200, loopMs));
  const j = tween(moves.a, moves.b, rep);
  const corner = size === 'hero' ? radius.xxl : radius.frame;
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      testID={`exercise-visual:${exerciseId ?? 'none'}`}
      style={[{ width: px, height: px, borderRadius: corner, ...curve, borderWidth: 1, borderColor: t.edge, backgroundColor: t[tone], overflow: 'hidden' }, style]}
    >
      {lottie ? (
        <LottieFrame source={lottie} playing={playing && !reduced} ink={t.on} hot={t.p} ground={t.tc} />
      ) : (
        <Svg width="100%" height="100%" viewBox="0 0 120 120">
          {moves.prop === 'wall' ? <Rect x={moves.a.head[0] < 60 ? 32 : 97} y={14} width={5} height={92} rx={2.5} fill={t.tc} /> : null}
          {moves.prop === 'chair' ? <Path d="M36 50 L36 106 M36 80 L62 80 M62 80 L62 106" stroke={t.tc} strokeWidth={5} strokeLinecap="round" fill="none" /> : null}
          {moves.prop === 'mat' ? <Rect x={10} y={105} width={100} height={5} rx={2.5} fill={t.tc} /> : <Line x1={16} y1={108} x2={104} y2={108} stroke={t.tc} strokeWidth={4} strokeLinecap="round" />}
          <Figure j={j} front={!!moves.front} accent={moves.accent} ink={t.on} hot={t.p} far={0.42} />
        </Svg>
      )}
    </View>
  );
}

type LottieProps = { source: unknown; playing: boolean; ink: string; hot: string; ground: string };

/** Lottie playback, coloured through the three named layers. Renders nothing if the module is missing. */
function LottieFrame({ source, playing, ink, hot, ground }: LottieProps) {
  const Lottie = loadLottie();
  if (!Lottie) return null;
  return React.createElement(Lottie, {
    source,
    autoPlay: playing,
    loop: true,
    progress: playing ? undefined : 0.5,
    style: { width: '100%', height: '100%' },
    colorFilters: [
      { keypath: 'body', color: ink },
      { keypath: 'accent', color: hot },
      { keypath: 'ground', color: ground },
    ],
  });
}

let lottieModule: React.ComponentType<Record<string, unknown>> | null | undefined;
function loadLottie() {
  if (lottieModule !== undefined) return lottieModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lottieModule = (require('lottie-react-native') as { default: React.ComponentType<Record<string, unknown>> }).default;
  } catch {
    lottieModule = null;
  }
  return lottieModule;
}
