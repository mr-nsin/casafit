import { createMediaPipePoseSource, createPoseBridge, defaultPoseSourceFactory, getNativePose, POSE_BUFFER_FLOATS, resetNativePoseForTests, unpackLandmarks } from '.';
import type { PoseFrame } from './types';

afterEach(() => {
  resetNativePoseForTests(undefined);
  delete process.env.EXPO_PUBLIC_CAMERA_PREVIEW;
});

/** Image landmark i is x = i/100, y = 0.5, z = -i, v = 0.9. World landmark i is x = i, y = 2, z = 3, v = 0.8. */
function packed(): Float32Array {
  const f = new Float32Array(POSE_BUFFER_FLOATS);
  for (let i = 0; i < 33; i++) {
    f.set([i / 100, 0.5, -i, 0.9], i * 4);
    f.set([i, 2, 3, 0.8], 33 * 4 + i * 4);
  }
  return f;
}

const fakeNative = () => ({ open: jest.fn(), close: jest.fn() });

describe('unpackLandmarks', () => {
  it('maps image and world landmarks, in MediaPipe order', () => {
    const f = unpackLandmarks(packed(), 1234)!;
    expect(f.t).toBe(1234);
    expect(f.lm).toHaveLength(33);
    expect(f.lm[11]!.x).toBeCloseTo(0.11);
    expect(f.lm[11]!.y).toBeCloseTo(0.5);
    expect(f.lm[11]!.v).toBeCloseTo(0.9);
    expect(f.world).toHaveLength(33);
    expect(f.world![27]).toMatchObject({ x: 27, y: 2, z: 3 });
    expect(f.world![27]!.v).toBeCloseTo(0.8);
  });

  it('scales to the upright image: a sideways buffer swaps width and height', () => {
    expect(unpackLandmarks(packed(), 1, { width: 640, height: 480, orientation: 'up' })).toMatchObject({ w: 640, h: 480 });
    expect(unpackLandmarks(packed(), 1, { width: 640, height: 480, orientation: 'left' })).toMatchObject({ w: 480, h: 640 });
    expect(unpackLandmarks(packed(), 1, { width: 640, height: 480, orientation: 'right' })).toMatchObject({ w: 480, h: 640 });
    expect(unpackLandmarks(packed(), 1, { width: 640, height: 480, orientation: 'down' })).toMatchObject({ w: 640, h: 480 });
  });

  it('keeps off-frame coordinates (framing needs them) but clamps visibility to 0..1', () => {
    const f = packed();
    f.set([-0.2, 1.3, 0, 1.7], 0);
    const out = unpackLandmarks(f, 1)!;
    expect(out.lm[0]!.x).toBeCloseTo(-0.2);
    expect(out.lm[0]!.y).toBeCloseTo(1.3);
    expect(out.lm[0]!.v).toBe(1);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', new Float32Array(0)],
    ['short', new Float32Array(132)],
    ['long', new Float32Array(POSE_BUFFER_FLOATS + 4)],
  ])('rejects a %s buffer', (_name, value) => {
    expect(unpackLandmarks(value as never, 1)).toBeNull();
  });

  it('rejects NaN and Infinity anywhere, and a bad timestamp', () => {
    const a = packed();
    a[100] = NaN;
    expect(unpackLandmarks(a, 1)).toBeNull();
    const b = packed();
    b[263] = Infinity;
    expect(unpackLandmarks(b, 1)).toBeNull();
    expect(unpackLandmarks(packed(), NaN)).toBeNull();
  });
});

describe('pose bridge', () => {
  it('drops frames when nobody listens, delivers when attached, stops after detach', () => {
    let t = 100;
    const bridge = createPoseBridge(() => (t += 10));
    expect(bridge.deliver(packed())).toBe(false);
    const got: PoseFrame[] = [];
    bridge.attach((f) => got.push(f));
    expect(bridge.attached).toBe(true);
    expect(bridge.deliver(packed())).toBe(true);
    expect(bridge.deliver(packed())).toBe(true);
    expect(got.map((f) => f.t)).toEqual([110, 120]);
    expect(bridge.deliver(new Float32Array(3))).toBe(false);
    expect(got).toHaveLength(2);
    bridge.detach();
    expect(bridge.deliver(packed())).toBe(false);
    expect(got).toHaveLength(2);
  });
});

describe('MediaPipe pose source', () => {
  it('reports unavailable when the native module is missing (Jest, release builds without it)', () => {
    expect(getNativePose()).toBeNull();
    const s = createMediaPipePoseSource();
    expect(s).toMatchObject({ kind: 'unavailable', available: false, reason: 'native_module_missing' });
    const cb = jest.fn();
    s.start(cb);
    s.stop();
    expect(cb).not.toHaveBeenCalled();
  });

  it('opens the detector on start, feeds landmarks to the callback, closes on stop', () => {
    const native = fakeNative();
    const bridge = createPoseBridge(() => 5);
    const s = createMediaPipePoseSource({ native, bridge });
    expect(s).toMatchObject({ kind: 'native', available: true, needsCamera: true });

    const got: PoseFrame[] = [];
    s.start((f) => got.push(f));
    expect(native.open).toHaveBeenCalledWith(0.5, 0.5, 0.5, 15);
    bridge.deliver(packed(), { width: 640, height: 480, orientation: 'left' });
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ t: 5, w: 480, h: 640 });

    s.stop();
    expect(native.close).toHaveBeenCalledTimes(1);
    bridge.deliver(packed());
    expect(got).toHaveLength(1);
    s.stop();
    expect(native.close).toHaveBeenCalledTimes(1);
  });

  it('a second start does not reopen the detector', () => {
    const native = fakeNative();
    const s = createMediaPipePoseSource({ native, bridge: createPoseBridge() });
    s.start(() => {});
    s.start(() => {});
    expect(native.open).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the model cannot load: no landmarks, no throw', () => {
    const native = fakeNative();
    native.open.mockImplementation(() => {
      throw new Error('model missing');
    });
    const bridge = createPoseBridge();
    const s = createMediaPipePoseSource({ native, bridge });
    expect(() => s.start(() => {})).not.toThrow();
    expect(bridge.attached).toBe(false);
    expect(() => s.stop()).not.toThrow();
    expect(native.close).not.toHaveBeenCalled();
  });

  it('a close that throws does not block stop', () => {
    const native = fakeNative();
    native.close.mockImplementation(() => {
      throw new Error('boom');
    });
    const s = createMediaPipePoseSource({ native, bridge: createPoseBridge() });
    s.start(() => {});
    expect(() => s.stop()).not.toThrow();
  });

  it('a stopped source does not detach another running source', () => {
    const bridge = createPoseBridge();
    const running = createMediaPipePoseSource({ native: fakeNative(), bridge });
    const idle = createMediaPipePoseSource({ native: fakeNative(), bridge });
    running.start(() => {});
    idle.stop();
    expect(bridge.attached).toBe(true);
  });
});

describe('default factory', () => {
  it('without the module the native source is never chosen, flag or not', () => {
    process.env.EXPO_PUBLIC_CAMERA_PREVIEW = '1';
    expect(defaultPoseSourceFactory('squat').kind).toBe('simulated');
  });
});
