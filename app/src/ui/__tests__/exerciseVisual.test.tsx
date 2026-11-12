import { render, screen } from '@testing-library/react-native';

import { loadContent } from '../../content';
import { ExerciseVisual } from '../ExerciseVisual';
import { ANIMATIONS } from '../exerciseAnimations';
import { DEFAULT_POSES, POSES, posesFor, tween, type Joints } from '../exercisePoses';

const JOINTS: (keyof Joints)[] = ['head', 'sh', 'hip', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB'];

describe('exercise poses', () => {
  const all = loadContent().exercises;

  it('has two key poses for every move in the content pack', () => {
    expect(all.length).toBeGreaterThan(50);
    const missing = all.filter((e) => !POSES[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it('keeps every joint inside the frame, with nothing below the floor', () => {
    for (const [id, m] of Object.entries(POSES)) {
      for (const pose of [m.a, m.b]) {
        for (const k of JOINTS) {
          const [x, y] = pose[k] as readonly [number, number];
          expect({ id, k, ok: x >= 4 && x <= 116 && y >= 4 && y <= 106 }).toEqual({ id, k, ok: true });
        }
      }
    }
  });

  it('gives every moving exercise two different poses', () => {
    for (const e of all) {
      const m = POSES[e.id]!;
      if (e.mode !== 'hold') expect({ id: e.id, moves: JSON.stringify(m.a) !== JSON.stringify(m.b) }).toEqual({ id: e.id, moves: true });
    }
  });

  it('tweens between the poses and falls back for unknown ids', () => {
    const m = POSES.squat!;
    expect(tween(m.a, m.b, 0).hip).toEqual(m.a.hip);
    expect(tween(m.a, m.b, 1).hip).toEqual(m.b.hip);
    expect(tween(m.a, m.b, 0.5).hip[1]).toBeCloseTo((m.a.hip[1] + m.b.hip[1]) / 2);
    expect(posesFor('not_a_move')).toBe(DEFAULT_POSES);
    expect(posesFor(null)).toBe(DEFAULT_POSES);
  });

  it('only registers animations for real exercise ids', () => {
    const ids = new Set(all.map((e) => e.id));
    for (const id of Object.keys(ANIMATIONS)) expect({ id, known: ids.has(id) }).toEqual({ id, known: true });
  });
});

describe('ExerciseVisual', () => {
  it('renders each size at its width and never renders empty', async () => {
    for (const [size, px] of [['row', 56], ['tile', 64], ['card', 84], ['hero', 240]] as const) {
      const { unmount } = await render(<ExerciseVisual exerciseId="pushup" size={size} />);
      const style = Object.assign({}, ...[screen.getByTestId('exercise-visual:pushup', { includeHiddenElements: true }).props.style].flat(5).filter(Boolean));
      expect(style.width).toBe(px);
      expect(style.height).toBe(px);
      await unmount();
    }
    await render(<ExerciseVisual exerciseId={undefined} />);
    expect(screen.getByTestId('exercise-visual:none', { includeHiddenElements: true })).toBeTruthy();
  });

  it('is an image with the alt text when labelled, and hidden when not', async () => {
    const first = await render(<ExerciseVisual exerciseId="squat" label="A person lowers into a squat" />);
    expect(screen.getByLabelText('A person lowers into a squat').props.accessibilityRole).toBe('image');
    await first.unmount();
    await render(<ExerciseVisual exerciseId="plank" />);
    expect(screen.getByTestId('exercise-visual:plank', { includeHiddenElements: true }).props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
