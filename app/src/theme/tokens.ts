// Material 3 tonal tokens, mirrored from the .dc.html screens in project/.
// Keep in sync with project/m3-*.dc.html .m3 { --p, --sc, --tc, ... }.

export const light = {
  p: '#9C4400',
  op: '#FFFFFF',
  pc: '#FFDBC8',
  opc: '#331200',
  s: '#765849',
  os: '#FFFFFF',
  sc: '#FFDBCA',
  osc: '#2B1609',
  t: '#5F6219',
  ot: '#FFFFFF',
  tc: '#E4E790',
  otc: '#1B1D00',
  bg: '#FFF8F5',
  on: '#221A15',
  sv: '#F4DED3',
  osv: '#52443B',
  ol: '#85736A',
  olv: '#D7C2B8',
  c1: '#FFF1EA',
  c2: '#FCEBE1',
  c3: '#F6E5DB',
  c4: '#F0DFD5',
  er: '#BA1A1A',
  erc: '#FFDAD6',
  eoc: '#410002',
} as const;

export const dark = {
  p: '#FFB68E',
  op: '#552100',
  pc: '#793100',
  opc: '#FFDBC8',
  s: '#E6BEAB',
  os: '#432B1D',
  sc: '#5C4130',
  osc: '#FFDBCA',
  t: '#C8CB77',
  ot: '#303300',
  tc: '#464900',
  otc: '#E4E790',
  bg: '#1A120D',
  on: '#F0DFD5',
  sv: '#52443B',
  osv: '#D7C2B8',
  ol: '#9F8D83',
  olv: '#52443B',
  c1: '#221A15',
  c2: '#271E19',
  c3: '#322823',
  c4: '#3D332D',
  er: '#FFB4AB',
  erc: '#93000A',
  eoc: '#FFDAD6',
} as const;

export type Tokens = typeof light;

export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '800' as const, letterSpacing: -0.8 },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24 } as const;
export const radius = { s: 8, m: 12, l: 16, xl: 20, round: 28 } as const;
