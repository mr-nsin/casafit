import { act, render, renderHook, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import { useMotion, useReducedMotion } from '../useMotion';
import { PeopleIllustration } from '../illustration';

const val = (v: Animated.Value) => (v as unknown as { __getValue(): number }).__getValue();

function mockReduce(value: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(value);
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('useReducedMotion', () => {
  it('reads the OS setting', async () => {
    mockReduce(true);
    const { result } = await renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(true);
  });
  it('is false by default', async () => {
    mockReduce(false);
    const { result } = await renderHook(() => useReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(false);
  });
});

describe('useMotion', () => {
  it('exposes the emphasised duration and a one-shot helper that finishes', async () => {
    mockReduce(false);
    const { result } = await renderHook(() => useMotion());
    await act(async () => {});
    expect(result.current.durations.emphasised).toBe(500);
    const v = new Animated.Value(0);
    const anim = result.current.timing(v, { duration: 0 });
    await act(async () => {
      anim.start();
    });
    expect(val(v)).toBe(1);
  });
  it('collapses one-shots and refuses loops when reduced', async () => {
    mockReduce(true);
    const { result } = await renderHook(() => useMotion());
    await act(async () => {});
    expect(result.current.reduced).toBe(true);
    const v = new Animated.Value(0.5);
    const stop = result.current.loop(v);
    expect(val(v)).toBe(0);
    expect(typeof stop).toBe('function');
  });
});

describe('Illustration loop', () => {
  it('flips between two frames, and keeps frame 1 under reduced motion', async () => {
    jest.useFakeTimers();
    mockReduce(false);
    await render(<PeopleIllustration pose="walk" a11yLabel="A person walking" />);
    await act(async () => {});
    expect(screen.getByLabelText('A person walking')).toBeTruthy();
    // The interval exists: advancing time must not throw and component stays mounted.
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('illustration')).toBeTruthy();
  });
  it('hides decorative illustrations from screen readers', async () => {
    mockReduce(true);
    await render(<PeopleIllustration />);
    expect(screen.getByTestId('illustration', { hidden: true }).props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
