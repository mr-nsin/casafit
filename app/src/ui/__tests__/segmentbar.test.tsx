import { render, screen } from '@testing-library/react-native';

import { SessionSegmentBar } from '../progress';
import { palettes } from '../tokens';
import { UIProvider } from '../useTokens';

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('SessionSegmentBar on a tonal card (Week one)', () => {
  it('the cool-down segment stands out from the card in light and dark (3:1 for UI shapes)', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const t = palettes[scheme];
      // Before the fix: the cool-down colour against the card.
      expect(contrast(t.sc, t.pc)).toBeLessThan(1.3);
      // Now: the colour the bar uses on a tonal card.
      expect(contrast(t.s, t.pc)).toBeGreaterThanOrEqual(3);
      expect(contrast(t.os, t.s)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('labels warm-up and cool-down, at 12 px or more', async () => {
    await render(
      <UIProvider scheme="light">
        <SessionSegmentBar onTonal captions />
      </UIProvider>,
    );
    expect(screen.getByText('Warm-up 2 min')).toBeTruthy();
    expect(screen.getByText('Cool-down 2 min')).toBeTruthy();
    expect(screen.getByText('Work 11 min')).toBeTruthy();
    expect(screen.getByLabelText('2 minutes warm-up, 11 minutes work, 2 minutes cool-down')).toBeTruthy();
    for (const label of ['Warm-up 2 min', 'Cool-down 2 min']) {
      const style = Object.assign({}, ...[screen.getByText(label).props.style].flat(5).filter(Boolean));
      expect(style.fontSize).toBeGreaterThanOrEqual(12);
    }
  });

  it('the default bar is unchanged and shows no captions', async () => {
    await render(<SessionSegmentBar />);
    expect(screen.queryByText('Warm-up 2 min')).toBeNull();
  });
});
