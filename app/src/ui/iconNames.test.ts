/* eslint-disable @typescript-eslint/no-require-imports */
// Node's fs and path are not in the app's tsconfig types, so they are required here.
const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[]; readFileSync(f: string, e: string): string };
const path = require('path') as { join(...p: string[]): string; relative(a: string, b: string): string };
declare const __dirname: string;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const glyphs: Record<string, number> = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Literal names passed as icon="..." / leadingIcon="..." / trailingIcon="..." / icon: '...' / glyph names.
const PATTERN = /\b(?:icon|leadingIcon|trailingIcon|iconName)(?:=|:\s*)\s*\{?\s*['"]([a-z0-9_]+)['"]/g;

describe('icon names', () => {
  it('every literal icon name in the app is a real MaterialIcons glyph', () => {
    const bad: string[] = [];
    for (const file of walk(path.join(__dirname, '..'))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(PATTERN)) {
        const name = m[1]!;
        if (name === 'fitness_center' || !(name.replace(/_/g, '-') in glyphs)) {
          bad.push(`${path.relative(path.join(__dirname, '..'), file)}: ${name}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
