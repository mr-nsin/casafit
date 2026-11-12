// Height and weight conversions and parsing. Pure; the saved value is always cm and kg.

export const HEIGHT_MIN_CM = 80;
export const HEIGHT_MAX_CM = 260;
export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 300;
export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

export type Parsed = { value: number | null; error?: string };

export const HEIGHT_CM_ERROR = `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm, or skip.`;
export const HEIGHT_FTIN_ERROR = 'Enter a height between 2 ft 8 in and 8 ft 6 in, or skip.';
export const WEIGHT_KG_ERROR = `Enter a weight between ${WEIGHT_MIN_KG} and ${WEIGHT_MAX_KG} kg, or skip.`;
export const WEIGHT_LB_ERROR = 'Enter a weight between 45 and 660 lb, or skip.';

export function parseHeightCm(raw: string): Parsed {
  const t = raw.trim();
  if (!t) return { value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < HEIGHT_MIN_CM || n > HEIGHT_MAX_CM) return { value: null, error: HEIGHT_CM_ERROR };
  return { value: Math.round(n) };
}

/** Feet and inches to cm. Empty on both is "no height". Inches must be 0 to 11.9. */
export function parseHeightFtIn(feet: string, inches: string): Parsed {
  const f = feet.trim();
  const i = inches.trim();
  if (!f && !i) return { value: null };
  const ft = f ? Number(f) : 0;
  const inch = i ? Number(i) : 0;
  if (!Number.isFinite(ft) || !Number.isFinite(inch) || ft < 0 || inch < 0) return { value: null, error: HEIGHT_FTIN_ERROR };
  if (inch >= 12) return { value: null, error: 'Inches go from 0 to 11. Add whole feet in the feet box.' };
  const cm = Math.round((ft * 12 + inch) * CM_PER_INCH);
  if (cm < HEIGHT_MIN_CM || cm > HEIGHT_MAX_CM) return { value: null, error: HEIGHT_FTIN_ERROR };
  return { value: cm };
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

export function parseWeightKg(raw: string): Parsed {
  const t = raw.trim();
  if (!t) return { value: null };
  const n = Number(t);
  if (!Number.isFinite(n) || n < WEIGHT_MIN_KG || n > WEIGHT_MAX_KG) return { value: null, error: WEIGHT_KG_ERROR };
  return { value: Math.round(n * 10) / 10 };
}

export function parseWeightLb(raw: string): Parsed {
  const t = raw.trim();
  if (!t) return { value: null };
  const n = Number(t);
  const kg = n * KG_PER_LB;
  if (!Number.isFinite(n) || kg < WEIGHT_MIN_KG - 0.5 || kg > WEIGHT_MAX_KG + 0.5) return { value: null, error: WEIGHT_LB_ERROR };
  return { value: Math.round(kg * 10) / 10 };
}

export const kgToLb = (kg: number): number => Math.round((kg / KG_PER_LB) * 10) / 10;
