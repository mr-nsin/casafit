// Reduced motion, synchronously: no animation timers or late state updates while a control is pressed.
// Use in a test file with: jest.mock('../ui/useMotion', () => require('./motionMock').motionModule());
/* eslint-disable @typescript-eslint/no-require-imports */

export function motionModule() {
  const { Animated } = require('react-native');
  const actual = jest.requireActual('../ui/useMotion');
  const one = new Animated.Value(1);
  const settle = (v: { setValue(n: number): void }, o?: { toValue?: number }) => v.setValue(o?.toValue ?? 1);
  return {
    ...actual,
    useReducedMotion: () => true,
    useEntrance: () => one,
    useMotion: () => ({
      reduced: true,
      durations: actual.useMotion.durations,
      easing: actual.easing,
      timing: (v: { setValue(n: number): void }, o?: { toValue?: number }) => ({ start: () => settle(v, o), stop() {} }),
      oneShot: settle,
      loop: () => () => undefined,
    }),
  };
}
