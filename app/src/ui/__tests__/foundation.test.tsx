import { render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { dark, light, palettes, type, MIN_FONT } from '../tokens';
import { paperTheme } from '../paperTheme';
import { UIProvider, useScheme, useTokens } from '../useTokens';
import { Text } from '../primitives';

// No @types/node in this package; the source-rule scan only needs fs and path.
declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fs: any = jest.requireActual('fs');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const path: any = jest.requireActual('path');

describe('tokens', () => {
  it('light and dark define the same roles', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });
  it('holds the brand palette on the existing role keys', () => {
    expect(light.bg).toBe('#FDFBF7'); // canvas
    expect(light.c3).toBe('#F6E6DC'); // surfacePeach
    expect(light.pc).toBe('#FADBC8'); // surfaceApricot
    expect(light.el).toBe('#FFFDFB'); // surfaceElevated
    expect(light.p).toBe('#9E4700'); // brandTerracotta
    expect(light.pp).toBe('#7D3800'); // brandTerracottaPressed
    expect(light.tc).toBe('#E4EC8A'); // accentChartreuse
    expect(light.on).toBe('#2C221E'); // inkPrimary
    expect(light.osv).toBe('#6E5D54'); // inkSecondary
    expect(light.olv).toBe('#EAD8CC'); // borderSubtle
    expect(dark.p).toBe('#FFB68E');
    expect(dark.bg).toBe('#1A120D');
  });
  it('keeps every text pairing at 4.5:1 or better, in light and dark', () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    // [text, surface]
    const pairs = [
      ['on', 'bg'], ['on', 'c3'], ['on', 'pc'], ['on', 'el'], ['on', 'cd'],
      ['osv', 'bg'], ['osv', 'c3'], ['osv', 'pc'],
      ['p', 'bg'], ['p', 'c3'], ['p', 'pc'], ['p', 'el'],
      ['op', 'p'], ['opc', 'pc'], ['osc', 'sc'], ['otc', 'tc'], ['os', 's'], ['eoc', 'erc'],
    ] as const;
    for (const t of [light, dark]) {
      for (const [fg, bg] of pairs) expect({ fg, bg, ok: ratio(t[fg], t[bg]) >= 4.5 }).toEqual({ fg, bg, ok: true });
    }
  });
  it('never defines text under 12 px', () => {
    for (const v of Object.values(type)) expect(v.fontSize).toBeGreaterThanOrEqual(MIN_FONT);
  });
});

describe('paperTheme', () => {
  it('maps roles for both schemes', () => {
    expect(paperTheme('light').colors.primary).toBe(light.p);
    expect(paperTheme('dark').colors.primaryContainer).toBe(dark.pc);
    expect(paperTheme('dark').dark).toBe(true);
  });
});

function Probe() {
  const t = useTokens();
  const s = useScheme();
  return <RNText testID="probe">{`${s}:${t.p}`}</RNText>;
}

describe('UIProvider and useTokens', () => {
  it('defaults to light without a provider', async () => {
    await render(<Probe />);
    expect(screen.getByTestId('probe').props.children).toBe(`light:${palettes.light.p}`);
  });
  it('honours an explicit dark scheme', async () => {
    await render(
      <UIProvider scheme="dark">
        <Probe />
      </UIProvider>,
    );
    expect(screen.getByTestId('probe').props.children).toBe(`dark:${dark.p}`);
  });
});

describe('Text', () => {
  it('clamps below-minimum sizes via variants and uses Plus Jakarta Sans', async () => {
    await render(<Text testID="t">Hello</Text>);
    const style = [screen.getByTestId('t').props.style].flat(5).filter(Boolean);
    const merged = Object.assign({}, ...style);
    expect(merged.fontFamily).toBe('PlusJakartaSans_500Medium');
    expect(merged.fontWeight).toBeUndefined();
    expect(merged.fontSize).toBeGreaterThanOrEqual(12);
  });
});

describe('source rules for app/src/ui', () => {
  const dir = path.resolve(__dirname, '..');
  const files = fs
    .readdirSync(dir)
    .filter((f: string) => /\.(ts|tsx)$/.test(f) && f !== 'tokens.ts');

  it('has no hard-coded hex colours outside tokens.ts', () => {
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect({ f, hex: src.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) }).toEqual({ f, hex: null });
    }
  });

  it('never uses the dumbbell icon as an icon name', () => {
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const uses = src.match(/icon[=:]\s*['"]fitness[_-]center['"]/g);
      expect({ f, uses }).toEqual({ f, uses: null });
    }
  });

  it('never sets a font size under 12', () => {
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const small = [...src.matchAll(/fontSize:\s*(\d+)/g)].filter((m) => Number(m[1]) < 12);
      expect({ f, small: small.length }).toEqual({ f, small: 0 });
    }
  });
});
