import { createCueService, hapticFor, type HapticKind } from './audio-cues';
import { createFakeKeepAwake } from './keep-awake';
import { DEFAULT_PREFS, type Cue } from '../features/session/types';

function setup(clip: number | string | null = 'clip.mp3') {
  const played: { src: number | string; duck: boolean }[] = [];
  const haptics: HapticKind[] = [];
  const svc = createCueService({
    audio: { play: (src, o) => played.push({ src, duck: o.duck }), stop: () => {} },
    haptics: { fire: (k) => haptics.push(k) },
    resolveClip: () => clip,
  });
  return { svc, played, haptics };
}

const cue: Cue = { kind: 'step_start', name: 'Plank' };

describe('audio cues', () => {
  it('plays the voice clip, ducking when asked', () => {
    const { svc, played, haptics } = setup();
    svc.play(cue, DEFAULT_PREFS);
    expect(played).toEqual([{ src: 'clip.mp3', duck: true }]);
    expect(haptics).toEqual([]);
  });

  it('quiet mode is haptic only', () => {
    const { svc, played, haptics } = setup();
    svc.play(cue, { ...DEFAULT_PREFS, quiet: true });
    expect(played).toEqual([]);
    expect(haptics).toEqual(['medium']);
  });

  it('voice off is haptic only', () => {
    const { svc, played, haptics } = setup();
    svc.play({ kind: 'count', count: 3 }, { ...DEFAULT_PREFS, voice: false });
    expect(played).toEqual([]);
    expect(haptics).toEqual(['tick']);
  });

  it('falls back to a haptic when no clip is bundled', () => {
    const { svc, played, haptics } = setup(null);
    svc.play({ kind: 'done' }, DEFAULT_PREFS);
    expect(played).toEqual([]);
    expect(haptics).toEqual(['success']);
  });

  it('taps along with spoken counts', () => {
    const { svc, haptics } = setup();
    svc.play({ kind: 'count', count: 2 }, DEFAULT_PREFS);
    expect(haptics).toEqual(['tick']);
  });

  it('maps every cue kind to a haptic', () => {
    expect(hapticFor({ kind: 'switch_sides' })).toBe('light');
    expect(hapticFor({ kind: 'cooldown' })).toBe('success');
  });
});

describe('keep awake', () => {
  it('toggles', () => {
    const k = createFakeKeepAwake();
    k.activate();
    expect(k.active).toBe(true);
    k.deactivate();
    expect(k.active).toBe(false);
  });
});
