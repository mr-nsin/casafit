// Real backends: expo-audio for clips, expo-haptics for taps. Native modules are
// required lazily so importing this file never loads them under Jest.

import type { AudioBackend, HapticKind, HapticsBackend } from './index';

declare const require: (id: string) => any;

export function createExpoBackends(): { audio: AudioBackend; haptics: HapticsBackend } {
  let player: any = null;
  let modeSet = false;

  const audio: AudioBackend = {
    play(source, opts) {
      try {
        const mod = require('expo-audio');
        if (!modeSet) {
          modeSet = true;
          void mod.setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: opts.duck ? 'duckOthers' : 'mixWithOthers',
          });
        }
        player?.remove?.();
        player = mod.createAudioPlayer(source);
        player.play();
      } catch {
        // A missing clip must never break the session.
      }
    },
    stop() {
      try {
        player?.pause?.();
        player?.remove?.();
      } catch {
        // ignore
      }
      player = null;
    },
  };

  const haptics: HapticsBackend = {
    fire(kind: HapticKind) {
      try {
        const H = require('expo-haptics');
        if (kind === 'success') void H.notificationAsync(H.NotificationFeedbackType.Success);
        else if (kind === 'warning') void H.notificationAsync(H.NotificationFeedbackType.Warning);
        else if (kind === 'medium') void H.impactAsync(H.ImpactFeedbackStyle.Medium);
        else if (kind === 'light') void H.impactAsync(H.ImpactFeedbackStyle.Light);
        else void H.selectionAsync();
      } catch {
        // ignore
      }
    },
  };

  return { audio, haptics };
}
