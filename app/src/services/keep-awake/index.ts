// Keep the screen on while a session is visible. Cues must not rely on it: they also
// work with the screen off (voice and haptics).

import type { KeepAwakeService } from '../../features/session/types';

export const KEEP_AWAKE_TAG = 'casafit-session';

declare const require: (id: string) => any;

export function createExpoKeepAwake(): KeepAwakeService {
  let on = false;
  return {
    activate() {
      if (on) return;
      on = true;
      try {
        void require('expo-keep-awake').activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      } catch {
        // ignore
      }
    },
    deactivate() {
      if (!on) return;
      on = false;
      try {
        void require('expo-keep-awake').deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // ignore
      }
    },
  };
}

/** Counts activate/deactivate calls. For tests. */
export function createFakeKeepAwake(): KeepAwakeService & { active: boolean } {
  const f = {
    active: false,
    activate() {
      f.active = true;
    },
    deactivate() {
      f.active = false;
    },
  };
  return f;
}
