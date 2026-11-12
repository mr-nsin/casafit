// CasaFit colour, type, shape and motion tokens. The keys are the Material role names the
// screens already use; the values are the warm cream, peach and terracotta palette from
// docs/plans/ui-redesign-master-prompt.md. This is the only file that may contain hex colours.

export const light = {
  // Brand terracotta and its pressed tint; apricot container for hero cards.
  p: '#9E4700', pp: '#7D3800', op: '#FDFBF7', pc: '#FADBC8', opc: '#2C221E',
  s: '#765849', os: '#FDFBF7', sc: '#F3D5C0', osc: '#2C221E',
  // Chartreuse accent: warm-up, "2 free", cardio. Never carries text on its own colour.
  t: '#5F6219', ot: '#FDFBF7', tc: '#E4EC8A', otc: '#2C221E',
  // Canvas, espresso ink, warm taupe, hairline.
  bg: '#FDFBF7', on: '#2C221E', sv: '#F1E1D6', osv: '#6E5D54',
  ol: '#85736A', olv: '#EAD8CC',
  // Surfaces from lightest to deepest. c3 is the resting peach card; el is the elevated surface.
  el: '#FFFDFB', c1: '#FBF4EE', c2: '#F9EEE6', c3: '#F6E6DC', c4: '#F0DFD5',
  // Cool-down segment and the warm 12% edge used on cards and illustration frames.
  cd: '#F3D5C0', edge: 'rgba(158,71,0,0.12)',
  er: '#BA1A1A', erc: '#FFDAD6', eoc: '#410002',
};

export type Tokens = { [K in keyof typeof light]: string };

export const dark: Tokens = {
  p: '#FFB68E', pp: '#F0A27A', op: '#552100', pc: '#793100', opc: '#FFDBC8',
  s: '#E6BEAB', os: '#432B1D', sc: '#5C4130', osc: '#FFDBCA',
  t: '#C8CB77', ot: '#303300', tc: '#464900', otc: '#E4E790',
  bg: '#1A120D', on: '#F0DFD5', sv: '#52443B', osv: '#D7C2B8',
  ol: '#9F8D83', olv: '#52443B',
  el: '#3D332D', c1: '#221A15', c2: '#271E19', c3: '#322823', c4: '#3D332D',
  cd: '#5C4130', edge: 'rgba(255,182,142,0.16)',
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

/** Font files loaded in app/src/app/fonts.ts. Static files, so the family carries the weight. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  ui500: 'PlusJakartaSans_500Medium',
  ui600: 'PlusJakartaSans_600SemiBold',
  ui700: 'PlusJakartaSans_700Bold',
  ui800: 'PlusJakartaSans_800ExtraBold',
} as const;
/** Default UI family (text fields, Paper). */
export const fontFamily = fonts.ui500;
export const MIN_FONT = 12;
export const MIN_TAP = 44;

/** `face` picks the family: 'display' is Fraunces, 'ui' is Plus Jakarta Sans at `fontWeight`. */
export const type = {
  display: { face: 'display', fontSize: 40, lineHeight: 46, fontWeight: '600', letterSpacing: -0.6 },
  timer: { face: 'ui', fontSize: 72, lineHeight: 78, fontWeight: '800', letterSpacing: -1.5 },
  headline: { face: 'display', fontSize: 26, lineHeight: 32, fontWeight: '600', letterSpacing: -0.2 },
  title: { face: 'ui', fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { face: 'ui', fontSize: 16, lineHeight: 24, fontWeight: '500' },
  bodySmall: { face: 'ui', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  label: { face: 'ui', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  labelStrong: { face: 'ui', fontSize: 12, lineHeight: 16, fontWeight: '600' },
} as const;
export type TypeVariant = keyof typeof type;

/** Family for a UI weight. Anything lighter than 600 is Medium; there is no Regular. */
export function uiFamily(weight: string | number | undefined): string {
  const w = weight === 'bold' ? 700 : Number(weight) || 500;
  if (w >= 800) return fonts.ui800;
  if (w >= 700) return fonts.ui700;
  if (w >= 600) return fonts.ui600;
  return fonts.ui500;
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
/** xl is the standard card (22), xxl the hero card (28), pill the day pill (20), frame the illustration frame (18). */
export const radius = { xs: 4, s: 8, m: 12, l: 16, frame: 18, pill: 20, xl: 22, xxl: 28, round: 999 } as const;
/** Inner radius of a shape nested inside `outer` with `gap` padding between them. */
export const concentric = (outer: number, gap: number): number => Math.max(8, outer - gap);

/** Continuous (squircle) corners. Only iOS draws the difference. */
export const curve = { borderCurve: 'continuous' } as const;
/** One soft warm shadow. Use on at most one layer per screen besides the tab bar. */
export const elevation = {
  card: { boxShadow: '0px 6px 16px 0px rgba(44,34,30,0.06)' },
  bar: { boxShadow: '0px 8px 24px 0px rgba(44,34,30,0.10)' },
} as const;

/** Motion tokens (m3-people board): emphasised 500 ms cubic-bezier(.2,0,0,1). */
export const motion = {
  easing: [0.2, 0, 0, 1] as const,
  durations: { short: 150, standard: 250, emphasised: 500, demoFlip: 1800, breathe: 6000 },
};
