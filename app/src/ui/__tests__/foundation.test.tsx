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
  it('matches the m3 CSS variables for key roles', () => {
    expect(light.p).toBe('#9C4400');
    expect(dark.p).toBe('#FFB68E');
    expect(light.bg).toBe('#FFF8F5');
    expect(dark.bg).toBe('#1A120D');
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
  it('clamps below-minimum sizes via variants and uses Roboto Flex', async () => {
    await render(<Text testID="t">Hello</Text>);
    const style = [screen.getByTestId('t').props.style].flat(5).filter(Boolean);
    const merged = Object.assign({}, ...style);
    expect(merged.fontFamily).toBe('RobotoFlex_400Regular');
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
