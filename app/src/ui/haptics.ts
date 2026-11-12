// Small, deliberate haptics. Not every press buzzes: selection for pills, tabs, steppers and
// pickers; a light tap for primary buttons; success once when a session completes.
// expo-haptics is loaded lazily so tests and builds without the native module stay quiet.

export type Haptic = 'none' | 'select' | 'tap' | 'success';

type Module = typeof import('expo-haptics');
let mod: Module | null | undefined;
function load(): Module | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-haptics') as Module;
  } catch {
    mod = null;
  }
  return mod;
}

let enabled = true;
/** Turn all UI haptics off or on (tests, a future Settings switch). */
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function haptic(kind: Haptic): void {
  if (!enabled || kind === 'none') return;
  const h = load();
  if (!h) return;
  try {
    const p =
      kind === 'select'
        ? h.selectionAsync()
        : kind === 'tap'
          ? h.impactAsync(h.ImpactFeedbackStyle.Light)
          : h.notificationAsync(h.NotificationFeedbackType.Success);
    void Promise.resolve(p).catch(() => undefined);
  } catch {
    // No vibrator, or the module is not linked: nothing to do.
  }
}
