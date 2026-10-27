// Material 3 tonal tokens, mirrored from the `.m3` CSS variables in project/m3-*.dc.html
// (light = :root defaults, dark = prefers-color-scheme: dark). This is the only file in
// app/src/ui that may contain hex colours.

export const light = {
  p: '#9C4400', op: '#FFFFFF', pc: '#FFDBC8', opc: '#331200',
  s: '#765849', os: '#FFFFFF', sc: '#FFDBCA', osc: '#2B1609',
  t: '#5F6219', ot: '#FFFFFF', tc: '#E4E790', otc: '#1B1D00',
  bg: '#FFF8F5', on: '#221A15', sv: '#F4DED3', osv: '#52443B',
  ol: '#85736A', olv: '#D7C2B8',
  c1: '#FFF1EA', c2: '#FCEBE1', c3: '#F6E5DB', c4: '#F0DFD5',
  er: '#BA1A1A', erc: '#FFDAD6', eoc: '#410002',
};

export type Tokens = { [K in keyof typeof light]: string };

export const dark: Tokens = {
  p: '#FFB68E', op: '#552100', pc: '#793100', opc: '#FFDBC8',
  s: '#E6BEAB', os: '#432B1D', sc: '#5C4130', osc: '#FFDBCA',
  t: '#C8CB77', ot: '#303300', tc: '#464900', otc: '#E4E790',
  bg: '#1A120D', on: '#F0DFD5', sv: '#52443B', osv: '#D7C2B8',
  ol: '#9F8D83', olv: '#52443B',
  c1: '#221A15', c2: '#271E19', c3: '#322823', c4: '#3D332D',
  er: '#FFB4AB', erc: '#93000A', eoc: '#FFDAD6',
};

export type ColorKey = keyof Tokens;
export type Scheme = 'light' | 'dark';
export const palettes: Record<Scheme, Tokens> = { light, dark };

/** Surfaces that are not theme roles: scrim, camera view, illustration skin/hair. */
export const fixed = {
  scrim: 'rgba(0,0,0,0.4)',
  camera: { bg: '#000000', fg: '#FFFFFF', overlay: 'rgba(0,0,0,0.55)' },
  illustration: {
    skinDeep: '#8D5524',
    skinMedium: '#B07445',
    skinLight: '#D49A6A',
    hair: '#2A1A12',
  },
} as const;

export const fontFamily = 'RobotoFlex_400Regular';
export const MIN_FONT = 12;
export const MIN_TAP = 44;

export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -0.8 },
  timer: { fontSize: 72, lineHeight: 76, fontWeight: '800', letterSpacing: -1 },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  labelStrong: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} as const;
export type TypeVariant = keyof typeof type;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 28, round: 999 } as const;

/** Motion tokens (m3-people board): emphasised 500 ms cubic-bezier(.2,0,0,1). */
export const motion = {
  easing: [0.2, 0, 0, 1] as const,
  durations: { short: 150, standard: 250, emphasised: 500, demoFlip: 1800, breathe: 6000 },
};
