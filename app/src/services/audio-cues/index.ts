// Voice cues and haptics behind small interfaces so Jest can fake them.
// Quiet mode, or voice switched off, swaps every cue to a haptic pattern.

import type { Cue, CueService, SessionPrefs } from '../../features/session/types';

export type HapticKind = 'tick' | 'light' | 'medium' | 'success' | 'warning';

export interface AudioBackend {
  /** Play a clip. `duck` lowers other audio while it plays. */
  play(source: number | string, opts: { duck: boolean }): void;
  stop(): void;
}

export interface HapticsBackend {
  fire(kind: HapticKind): void;
}

/** Returns the clip for a cue in a language, or null when none is bundled. */
export type ClipResolver = (cue: Cue, lang: string) => number | string | null;

export function hapticFor(cue: Cue): HapticKind {
  switch (cue.kind) {
    case 'count':
      return 'tick';
    case 'ten_seconds':
    case 'switch_sides':
    case 'paused':
    case 'resumed':
      return 'light';
    case 'rest':
    case 'step_start':
    case 'get_ready':
    case 'up_next':
    case 'halfway':
      return 'medium';
    case 'cooldown':
    case 'done':
      return 'success';
    default:
      return 'light';
  }
}

export function createCueService(deps: {
  audio: AudioBackend;
  haptics: HapticsBackend;
  resolveClip: ClipResolver;
}): CueService {
  return {
    play(cue: Cue, prefs: SessionPrefs) {
      const useVoice = prefs.voice && !prefs.quiet;
      if (useVoice) {
        const clip = deps.resolveClip(cue, prefs.lang);
        if (clip !== null) {
          deps.audio.play(clip, { duck: prefs.duck });
          // Counts get a tap too, so a muted phone in a pocket still counts down.
          if (cue.kind === 'count') deps.haptics.fire('tick');
          return;
        }
      }
      deps.haptics.fire(hapticFor(cue));
    },
    stop() {
      deps.audio.stop();
    },
  };
}

export { createExpoBackends } from './expo';
