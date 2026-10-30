import { loadContent } from '../../content';
import { DEFAULT_MOVE_ICON, exerciseIcon } from './icons';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const glyphs: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');
const valid = (name: string) => name !== 'fitness_center' && name.replace(/_/g, '-') in glyphs;

describe('exerciseIcon', () => {
  it('resolves every exercise in the content pack to a real icon', () => {
    const all = loadContent().exercises;
    expect(all.length).toBeGreaterThan(50);
    for (const ex of all) {
      const name = exerciseIcon(ex);
      expect({ id: ex.id, name, ok: valid(name) }).toEqual({ id: ex.id, name, ok: true });
    }
  });

  it('never returns a dash, and falls back for unknown moves', () => {
    expect(exerciseIcon({ style: 'normal', mode: 'hold' })).not.toBe('horizontal_rule');
    expect(exerciseIcon(null)).toBe(DEFAULT_MOVE_ICON);
    expect(valid(DEFAULT_MOVE_ICON)).toBe(true);
  });

  it('uses valid names for the player controls', () => {
    for (const n of ['close', 'skip_previous', 'skip_next', 'tune', 'pause', 'check', 'chair']) expect(valid(n)).toBe(true);
  });
});
