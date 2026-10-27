import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { motion } from './tokens';

/** True when the OS asks for reduced motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((v) => alive && setReduced(!!v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

export const easing = Easing.bezier(motion.easing[0], motion.easing[1], motion.easing[2], motion.easing[3]);

export type OneShotOptions = { duration?: number; delay?: number; toValue?: number; useNativeDriver?: boolean };

/**
 * Motion hook (D18). `reduced` gates everything. One-shot helpers collapse to zero
 * duration when reduced; infinite loops are for illustrations only (`loop`).
 */
export function useMotion() {
  const reduced = useReducedMotion();

  const timing = useCallback(
    (value: Animated.Value, opts: OneShotOptions = {}): Animated.CompositeAnimation => {
      const { duration = motion.durations.emphasised, delay = 0, toValue = 1, useNativeDriver = false } = opts;
      return Animated.timing(value, {
        toValue,
        duration: reduced ? 0 : duration,
        delay: reduced ? 0 : delay,
        easing,
        useNativeDriver,
      });
    },
    [reduced],
  );

  /** Run once (rise, pop, grow all drive a 0..1 value). */
  const oneShot = useCallback((value: Animated.Value, opts?: OneShotOptions) => timing(value, opts).start(), [timing]);

  /** Looping 0..1..0 animation; returns a stopper. Never loops under reduced motion. */
  const loop = useCallback(
    (value: Animated.Value, period: number = motion.durations.demoFlip) => {
      if (reduced) {
        value.setValue(0);
        return () => undefined;
      }
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: period / 2, easing: Easing.linear, useNativeDriver: false }),
          Animated.timing(value, { toValue: 0, duration: period / 2, easing: Easing.linear, useNativeDriver: false }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    },
    [reduced],
  );

  return { reduced, durations: motion.durations, easing, timing, oneShot, loop };
}

/** Value that animates 0 -> 1 once on mount (rise, pop, grow). Jumps to 1 when reduced. */
export function useEntrance(opts?: OneShotOptions): Animated.Value {
  const { reduced, oneShot } = useMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) v.setValue(1);
    else oneShot(v, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return v;
}
