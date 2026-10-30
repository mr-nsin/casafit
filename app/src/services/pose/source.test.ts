import { createDevCameraPermission, createSimulatedSource, createUnavailableSource, createVisionCameraPermission, defaultPoseSourceFactory, getPoseSource, poseAvailable, setPoseSourceFactory } from '.';
import type { PoseFrame } from './types';

afterEach(() => {
  setPoseSourceFactory(null);
  jest.useRealTimers();
});

describe('pose source port', () => {
  it('the unavailable source reports available = false and never calls back', () => {
    const s = createUnavailableSource('native_module_missing');
    const cb = jest.fn();
    s.start(cb);
    s.stop();
    expect(s).toMatchObject({ kind: 'unavailable', available: false, reason: 'native_module_missing' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('without the native casafit-pose module the default is the simulated source in dev', () => {
    expect(defaultPoseSourceFactory('squat')).toMatchObject({ kind: 'simulated', available: true });
    expect(poseAvailable('squat')).toBe(true);
  });

  it('in a release build (not __DEV__) the default is unavailable, not a crash', () => {
    const g = globalThis as { __DEV__?: boolean };
    const before = g.__DEV__;
    g.__DEV__ = false;
    try {
      expect(defaultPoseSourceFactory('squat')).toMatchObject({ kind: 'unavailable', available: false, reason: 'native_module_missing' });
    } finally {
      g.__DEV__ = before;
    }
  });

  it('can be replaced for tests', () => {
    setPoseSourceFactory(() => createUnavailableSource('test'));
    expect(getPoseSource('plank').available).toBe(false);
    expect(poseAvailable()).toBe(false);
  });

  it('the simulated source replays a synthetic squat on a timer, in order, then stops', () => {
    jest.useFakeTimers();
    const s = createSimulatedSource('squat');
    const frames: PoseFrame[] = [];
    s.start((f) => frames.push(f));
    jest.advanceTimersByTime(2000);
    const early = frames.length;
    expect(early).toBeGreaterThan(10);
    jest.advanceTimersByTime(30_000);
    expect(frames.length).toBeGreaterThan(early);
    expect(frames.every((f, i) => i === 0 || f.t >= frames[i - 1]!.t)).toBe(true);
    expect(frames[0]!.lm).toHaveLength(33);
    const total = frames.length;
    jest.advanceTimersByTime(10_000);
    expect(frames.length).toBe(total);
    s.stop();
  });

  it('stop halts delivery', () => {
    jest.useFakeTimers();
    const s = createSimulatedSource('push_up');
    const cb = jest.fn();
    s.start(cb);
    jest.advanceTimersByTime(500);
    s.stop();
    const n = cb.mock.calls.length;
    jest.advanceTimersByTime(5000);
    expect(cb.mock.calls.length).toBe(n);
  });
});

describe('camera permission port', () => {
  it('dev port: undetermined until asked, then granted', async () => {
    const p = createDevCameraPermission();
    expect(p.status()).toBe('undetermined');
    expect(await p.request()).toBe('granted');
    expect(p.status()).toBe('granted');
  });

  it('the real port never throws when vision-camera is missing: dev answers from memory', async () => {
    const p = createVisionCameraPermission();
    expect(['undetermined', 'granted', 'denied', 'unavailable']).toContain(p.status());
    await expect(p.request()).resolves.toBeDefined();
  });
});
