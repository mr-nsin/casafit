// Camera permission port. The real one asks vision-camera; when its native module is missing
// (emulator without the dev build) a dev build answers from memory so the flow can still be
// walked, and a release build says "unavailable" so the gate can show a calm message.

export type CameraPermission = 'granted' | 'undetermined' | 'denied' | 'unavailable';

export interface CameraPermissionPort {
  status(): CameraPermission;
  request(): Promise<CameraPermission>;
}

type VcStatus = 'not-determined' | 'authorized' | 'denied' | 'restricted';
interface VcFactory {
  cameraPermissionStatus: VcStatus;
  requestCameraPermission(): Promise<boolean>;
}

const mapStatus = (s: VcStatus): CameraPermission =>
  s === 'authorized' ? 'granted' : s === 'not-determined' ? 'undetermined' : 'denied';

function loadVisionCamera(): VcFactory | null {
  try {
    // Lazy: importing the package creates its Nitro hybrid object, which throws without the native build.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-vision-camera') as { VisionCamera?: VcFactory };
    return mod.VisionCamera ?? null;
  } catch {
    return null;
  }
}

export function createDevCameraPermission(initial: CameraPermission = 'undetermined'): CameraPermissionPort & { set(s: CameraPermission): void } {
  let current = initial;
  return {
    status: () => current,
    async request() {
      if (current === 'undetermined') current = 'granted';
      return current;
    },
    set(s) {
      current = s;
    },
  };
}

export function createVisionCameraPermission(): CameraPermissionPort {
  const unavailable: CameraPermissionPort = { status: () => 'unavailable', request: async () => 'unavailable' };
  let vc: VcFactory | null | undefined;
  let fallback: CameraPermissionPort | null = null;
  const get = (): CameraPermissionPort | VcFactory => {
    if (vc === undefined) vc = loadVisionCamera();
    if (vc) return vc;
    fallback ??= __DEV__ ? createDevCameraPermission() : unavailable;
    return fallback;
  };
  return {
    status() {
      const g = get();
      return 'cameraPermissionStatus' in g ? mapStatus(g.cameraPermissionStatus) : g.status();
    },
    async request() {
      const g = get();
      if ('cameraPermissionStatus' in g) {
        try {
          return (await g.requestCameraPermission()) ? 'granted' : 'denied';
        } catch {
          return 'denied';
        }
      }
      return g.request();
    },
  };
}

let current: CameraPermissionPort | null = null;
export const getCameraPermission = (): CameraPermissionPort => (current ??= createVisionCameraPermission());
export function setCameraPermissionPort(p: CameraPermissionPort | null): void {
  current = p;
}
